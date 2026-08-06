import Foundation

/// Everything persisted for a signed-in user. Stored in the keychain so the
/// session survives relaunches, matching `browserLocalPersistence` on the web.
struct AuthSession: Codable, Equatable {
    var uid: String
    var email: String
    var displayName: String
    var idToken: String
    var refreshToken: String
    var expiresAt: Date

    var isExpiringSoon: Bool { expiresAt.timeIntervalSinceNow < 60 }
}

/// Firebase Auth over the Identity Toolkit REST API — the same endpoints the
/// `firebase/auth` JS SDK calls, driven by the web API key.
struct AuthClient {
    let config: FirebaseConfig

    private var identityBase: String { "https://identitytoolkit.googleapis.com/v1/accounts" }
    private var tokenBase: String { "https://securetoken.googleapis.com/v1/token" }

    // MARK: - Sign in / register

    func signIn(email: String, password: String) async throws -> AuthSession {
        let json = try await post(
            "\(identityBase):signInWithPassword",
            body: ["email": email, "password": password, "returnSecureToken": true]
        )
        return try session(from: json)
    }

    func register(email: String, password: String, displayName: String) async throws -> AuthSession {
        let json = try await post(
            "\(identityBase):signUp",
            body: ["email": email, "password": password, "returnSecureToken": true]
        )
        var session = try session(from: json)

        let name = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        if !name.isEmpty {
            let updated = try await post(
                "\(identityBase):update",
                body: ["idToken": session.idToken, "displayName": name, "returnSecureToken": true]
            )
            session.displayName = (updated["displayName"] as? String) ?? name
            // `accounts:update` mints a fresh token pair; keep the newest.
            if let idToken = updated["idToken"] as? String { session.idToken = idToken }
            if let refresh = updated["refreshToken"] as? String { session.refreshToken = refresh }
            if let expires = updated["expiresIn"] as? String, let seconds = Double(expires) {
                session.expiresAt = Date().addingTimeInterval(seconds)
            }
        }
        return session
    }

    // MARK: - Token lifecycle

    /// Exchanges a refresh token for a fresh ID token.
    func refresh(_ session: AuthSession) async throws -> AuthSession {
        var request = URLRequest(url: try makeURL(tokenBase))
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        var form = URLComponents()
        form.queryItems = [
            URLQueryItem(name: "grant_type", value: "refresh_token"),
            URLQueryItem(name: "refresh_token", value: session.refreshToken),
        ]
        request.httpBody = form.query?.data(using: .utf8)

        let json = try await perform(request)
        var next = session
        if let idToken = json["id_token"] as? String { next.idToken = idToken }
        if let refresh = json["refresh_token"] as? String { next.refreshToken = refresh }
        if let expires = json["expires_in"] as? String, let seconds = Double(expires) {
            next.expiresAt = Date().addingTimeInterval(seconds)
        }
        if let uid = json["user_id"] as? String { next.uid = uid }
        return next
    }

    /// Refreshes the cached profile (email / display name) from Firebase.
    func lookup(idToken: String) async throws -> (email: String, displayName: String) {
        let json = try await post("\(identityBase):lookup", body: ["idToken": idToken])
        guard let user = (json["users"] as? [[String: Any]])?.first else {
            throw FirebaseError(message: "Account not found.")
        }
        return (user["email"] as? String ?? "", user["displayName"] as? String ?? "")
    }

    // MARK: - Helpers

    private func session(from json: [String: Any]) throws -> AuthSession {
        guard
            let idToken = json["idToken"] as? String,
            let refreshToken = json["refreshToken"] as? String,
            let uid = json["localId"] as? String
        else {
            throw FirebaseError(message: "Unexpected sign-in response.")
        }
        let seconds = Double(json["expiresIn"] as? String ?? "3600") ?? 3600
        return AuthSession(
            uid: uid,
            email: json["email"] as? String ?? "",
            displayName: json["displayName"] as? String ?? "",
            idToken: idToken,
            refreshToken: refreshToken,
            expiresAt: Date().addingTimeInterval(seconds)
        )
    }

    private func makeURL(_ path: String) throws -> URL {
        guard var components = URLComponents(string: path) else {
            throw FirebaseError(message: "Bad auth URL.")
        }
        components.queryItems = [URLQueryItem(name: "key", value: config.apiKey)]
        guard let url = components.url else { throw FirebaseError(message: "Bad auth URL.") }
        return url
    }

    private func post(_ path: String, body: [String: Any]) async throws -> [String: Any] {
        var request = URLRequest(url: try makeURL(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return try await perform(request)
    }

    private func perform(_ request: URLRequest) async throws -> [String: Any] {
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200 ..< 300).contains(status) else {
            throw AuthClient.friendlyError(FirebaseError.from(data: data, status: status))
        }
        return (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    /// Identity Toolkit returns machine codes; turn the common ones into the same
    /// language the web app shows.
    private static func friendlyError(_ error: FirebaseError) -> FirebaseError {
        let code = error.message.split(separator: ":").first.map(String.init) ?? error.message
        switch code.trimmingCharacters(in: .whitespaces) {
        case "EMAIL_EXISTS":
            return FirebaseError(message: "That email already has an account. Try signing in.", status: error.status)
        case "WEAK_PASSWORD":
            return FirebaseError(message: "Use a password of at least 6 characters.", status: error.status)
        case "INVALID_EMAIL":
            return FirebaseError(message: "That doesn't look like a valid email address.", status: error.status)
        case "EMAIL_NOT_FOUND", "INVALID_PASSWORD", "INVALID_LOGIN_CREDENTIALS":
            return FirebaseError(message: "Couldn't sign in. Check your email and password.", status: error.status)
        case "USER_DISABLED":
            return FirebaseError(message: "That account has been disabled.", status: error.status)
        case "TOO_MANY_ATTEMPTS_TRY_LATER":
            return FirebaseError(message: "Too many attempts. Wait a bit and try again.", status: error.status)
        case "TOKEN_EXPIRED", "INVALID_REFRESH_TOKEN", "USER_NOT_FOUND":
            return FirebaseError(message: "Your session expired. Sign in again.", status: error.status)
        default:
            return error
        }
    }
}

// MARK: - ID token claims

enum JWT {
    /// Reads the payload of a Firebase ID token. Used only to surface the `admin`
    /// custom claim in the UI — Firestore rules re-verify it server side.
    static func claims(from token: String) -> [String: Any] {
        let parts = token.split(separator: ".")
        guard parts.count >= 2 else { return [:] }

        var base64 = String(parts[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while base64.count % 4 != 0 { base64 += "=" }

        guard
            let data = Data(base64Encoded: base64),
            let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return [:] }
        return obj
    }

    static func hasAdminClaim(_ token: String) -> Bool {
        claims(from: token)["admin"] as? Bool == true
    }
}
