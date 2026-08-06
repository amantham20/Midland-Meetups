import Foundation

struct FirebaseError: LocalizedError {
    let message: String
    var status: Int?
    var errorDescription: String? { message }

    static func from(data: Data, status: Int) -> FirebaseError {
        if
            let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let err = obj["error"] as? [String: Any],
            let message = err["message"] as? String
        {
            return FirebaseError(message: message, status: status)
        }
        return FirebaseError(message: "Request failed (\(status)).", status: status)
    }
}

/// Supplies the current Firebase ID token to the Firestore client without the
/// networking layer having to know about `SessionStore` (which owns refresh).
final class TokenBroker: @unchecked Sendable {
    static let shared = TokenBroker()

    private let lock = NSLock()
    private var _provider: (() async -> String?)?

    func setProvider(_ provider: @escaping () async -> String?) {
        lock.lock()
        _provider = provider
        lock.unlock()
    }

    func currentToken() async -> String? {
        await snapshotProvider()?()
    }

    /// Reads the provider synchronously — holding a lock across an `await` is
    /// unsupported, so the closure is copied out before it is called.
    private func snapshotProvider() -> (() async -> String?)? {
        lock.lock()
        defer { lock.unlock() }
        return _provider
    }
}

/// A single equality filter plus optional ordering — enough for every query the
/// web client runs (`where approved == true` + `orderBy date`).
struct FirestoreQuery {
    let collection: String
    var whereField: String?
    var whereValue: FirestoreValue?
    var orderByField: String?
    var descending: Bool = false
    var limit: Int?

    init(_ collection: String) { self.collection = collection }

    func whereEqualTo(_ field: String, _ value: FirestoreValue) -> FirestoreQuery {
        var copy = self
        copy.whereField = field
        copy.whereValue = value
        return copy
    }

    func order(by field: String, descending: Bool = false) -> FirestoreQuery {
        var copy = self
        copy.orderByField = field
        copy.descending = descending
        return copy
    }

    func limited(to count: Int) -> FirestoreQuery {
        var copy = self
        copy.limit = count
        return copy
    }

    var structuredQuery: [String: Any] {
        var q: [String: Any] = ["from": [["collectionId": collection]]]
        if let field = whereField, let value = whereValue {
            q["where"] = [
                "fieldFilter": [
                    "field": ["fieldPath": field],
                    "op": "EQUAL",
                    "value": value.jsonObject,
                ],
            ]
        }
        if let field = orderByField {
            q["orderBy"] = [[
                "field": ["fieldPath": field],
                "direction": descending ? "DESCENDING" : "ASCENDING",
            ]]
        }
        if let limit { q["limit"] = limit }
        return q
    }
}

/// Firestore over its REST API.
///
/// The Firebase iOS SDK expects a `GoogleService-Info.plist` from a registered *iOS*
/// app; this project only has web credentials, and REST accepts exactly those — the
/// web API key for unauthenticated reads and a Firebase ID token for everything else.
/// Security rules are evaluated identically either way.
struct FirestoreClient {
    let config: FirebaseConfig
    private let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.requestCachePolicy = .reloadIgnoringLocalCacheData
        c.timeoutIntervalForRequest = 30
        return URLSession(configuration: c)
    }()

    private var documentsBase: String {
        "https://firestore.googleapis.com/v1/projects/\(config.projectId)/databases/(default)/documents"
    }

    // MARK: - Reads

    /// Runs a structured query. Firestore streams results as an array of
    /// `{document: ...}` envelopes; empty results come back as a single
    /// envelope with no `document` key.
    func run(_ query: FirestoreQuery) async throws -> [FirestoreDocument] {
        let body: [String: Any] = ["structuredQuery": query.structuredQuery]
        let data = try await send(
            method: "POST",
            url: try url(path: documentsBase + ":runQuery"),
            body: body
        )
        guard let rows = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }
        return rows.compactMap { row in
            guard let doc = row["document"] else { return nil }
            return FirestoreDocument(json: doc)
        }
    }

    /// Lists a whole collection, following `nextPageToken` to completion.
    func list(_ collection: String) async throws -> [FirestoreDocument] {
        var results: [FirestoreDocument] = []
        var pageToken: String?

        repeat {
            var items = [URLQueryItem(name: "pageSize", value: "300")]
            if let pageToken { items.append(URLQueryItem(name: "pageToken", value: pageToken)) }

            let data = try await send(
                method: "GET",
                url: try url(path: "\(documentsBase)/\(collection)", extraQuery: items),
                body: nil
            )
            let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            let docs = (obj?["documents"] as? [Any]) ?? []
            results.append(contentsOf: docs.compactMap(FirestoreDocument.init(json:)))
            pageToken = obj?["nextPageToken"] as? String
        } while pageToken != nil

        return results
    }

    // MARK: - Writes

    /// Creates a document with a server-generated id (`addDoc`).
    @discardableResult
    func create(
        in collection: String,
        fields: [String: FirestoreValue]
    ) async throws -> FirestoreDocument? {
        let data = try await send(
            method: "POST",
            url: try url(path: "\(documentsBase)/\(collection)"),
            body: ["fields": fields.mapValues(\.jsonObject)]
        )
        return FirestoreDocument(json: try JSONSerialization.jsonObject(with: data))
    }

    /// Patches specific fields, leaving everything else intact (`updateDoc`, or
    /// `setDoc(merge: true)`). Passing `mask: nil` replaces the whole document,
    /// which is what a plain `setDoc` does.
    @discardableResult
    func patch(
        _ collection: String,
        _ documentId: String,
        fields: [String: FirestoreValue],
        mask: [String]?
    ) async throws -> FirestoreDocument? {
        let maskItems = (mask ?? []).map { URLQueryItem(name: "updateMask.fieldPaths", value: $0) }
        let data = try await send(
            method: "PATCH",
            url: try url(path: "\(documentsBase)/\(collection)/\(documentId)", extraQuery: maskItems),
            body: ["fields": fields.mapValues(\.jsonObject)]
        )
        return FirestoreDocument(json: try JSONSerialization.jsonObject(with: data))
    }

    /// Writes every supplied field and leaves untouched fields alone.
    @discardableResult
    func merge(
        _ collection: String,
        _ documentId: String,
        fields: [String: FirestoreValue]
    ) async throws -> FirestoreDocument? {
        try await patch(collection, documentId, fields: fields, mask: Array(fields.keys))
    }

    func delete(_ collection: String, _ documentId: String) async throws {
        _ = try await send(
            method: "DELETE",
            url: try url(path: "\(documentsBase)/\(collection)/\(documentId)"),
            body: nil
        )
    }

    // MARK: - Transport

    private func url(path: String, extraQuery: [URLQueryItem] = []) throws -> URL {
        guard var components = URLComponents(string: path) else {
            throw FirebaseError(message: "Bad Firestore URL.")
        }
        components.queryItems = [URLQueryItem(name: "key", value: config.apiKey)] + extraQuery
        guard let url = components.url else {
            throw FirebaseError(message: "Bad Firestore URL.")
        }
        return url
    }

    private func send(method: String, url: URL, body: [String: Any]?) async throws -> Data {
        var request = URLRequest(url: url)
        request.httpMethod = method
        if let body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        // No token → the request is evaluated as `request.auth == null`, which is
        // exactly how the web client reads the public (approved) collections.
        if let token = await TokenBroker.shared.currentToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200 ..< 300).contains(status) else {
            throw FirebaseError.from(data: data, status: status)
        }
        return data
    }
}
