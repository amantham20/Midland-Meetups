import Foundation

/// Firestore's REST wire format tags every field with its type, e.g.
/// `{"stringValue": "hi"}` or `{"arrayValue": {"values": [...]}}`.
indirect enum FirestoreValue {
    case string(String)
    case integer(Int64)
    case double(Double)
    case boolean(Bool)
    case timestamp(Date)
    case array([FirestoreValue])
    case map([String: FirestoreValue])
    case null
}

// MARK: - Decoding

extension FirestoreValue {
    static func decode(_ any: Any) -> FirestoreValue {
        guard let obj = any as? [String: Any] else { return .null }

        if obj["nullValue"] != nil { return .null }
        if let s = obj["stringValue"] as? String { return .string(s) }
        if let b = obj["booleanValue"] as? Bool { return .boolean(b) }
        if let raw = obj["integerValue"] {
            // int64 arrives as a JSON string to survive round-tripping.
            if let s = raw as? String, let v = Int64(s) { return .integer(v) }
            if let n = raw as? NSNumber { return .integer(n.int64Value) }
        }
        if let n = obj["doubleValue"] as? NSNumber { return .double(n.doubleValue) }
        if let s = obj["timestampValue"] as? String {
            return .timestamp(RFC3339.date(from: s) ?? .distantPast)
        }
        if let a = obj["arrayValue"] as? [String: Any] {
            let values = (a["values"] as? [Any]) ?? []
            return .array(values.map(FirestoreValue.decode))
        }
        if let m = obj["mapValue"] as? [String: Any] {
            let fields = (m["fields"] as? [String: Any]) ?? [:]
            return .map(fields.mapValues(FirestoreValue.decode))
        }
        if let r = obj["referenceValue"] as? String { return .string(r) }
        return .null
    }
}

// MARK: - Encoding

extension FirestoreValue {
    var jsonObject: [String: Any] {
        switch self {
        case .string(let s): return ["stringValue": s]
        case .integer(let i): return ["integerValue": String(i)]
        case .double(let d): return ["doubleValue": d]
        case .boolean(let b): return ["booleanValue": b]
        case .timestamp(let d): return ["timestampValue": RFC3339.string(from: d)]
        case .null: return ["nullValue": NSNull()]
        case .array(let items):
            return ["arrayValue": ["values": items.map(\.jsonObject)]]
        case .map(let fields):
            return ["mapValue": ["fields": fields.mapValues(\.jsonObject)]]
        }
    }
}

// MARK: - Reading

extension FirestoreValue {
    /// Mirrors the web mappers' `String(data.x ?? "")` coercion so numeric-looking
    /// legacy fields (an `age` written as a number) still render.
    var asString: String {
        switch self {
        case .string(let s): return s
        case .integer(let i): return String(i)
        case .double(let d): return d == d.rounded() ? String(Int64(d)) : String(d)
        case .boolean(let b): return b ? "true" : "false"
        case .timestamp(let d): return RFC3339.string(from: d)
        case .null, .array, .map: return ""
        }
    }

    var asBool: Bool {
        switch self {
        case .boolean(let b): return b
        case .string(let s): return s == "true"
        case .integer(let i): return i != 0
        default: return false
        }
    }

    var asStringArray: [String] {
        guard case .array(let items) = self else { return [] }
        return items.map(\.asString).filter { !$0.isEmpty }
    }

    var asDate: Date? {
        switch self {
        case .timestamp(let d): return d
        case .string(let s): return RFC3339.date(from: s)
        default: return nil
        }
    }
}

// MARK: - A Firestore document

struct FirestoreDocument {
    /// Full resource name: `projects/{p}/databases/(default)/documents/{collection}/{id}`
    let name: String
    let fields: [String: FirestoreValue]

    var id: String { name.split(separator: "/").last.map(String.init) ?? "" }

    init?(json: Any) {
        guard let obj = json as? [String: Any], let name = obj["name"] as? String else { return nil }
        self.name = name
        let raw = (obj["fields"] as? [String: Any]) ?? [:]
        self.fields = raw.mapValues(FirestoreValue.decode)
    }

    func string(_ key: String) -> String { fields[key]?.asString ?? "" }
    func bool(_ key: String) -> Bool { fields[key]?.asBool ?? false }
    func stringArray(_ key: String) -> [String] { fields[key]?.asStringArray ?? [] }
    func date(_ key: String) -> Date? { fields[key]?.asDate }

    /// Nil when absent or empty, matching the optional `createdBy?` fields on the web types.
    func optionalString(_ key: String) -> String? {
        let v = string(key)
        return v.isEmpty ? nil : v
    }
}

// MARK: - RFC3339 helpers

enum RFC3339 {
    private static let withFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func date(from string: String) -> Date? {
        withFractional.date(from: string) ?? plain.date(from: string)
    }

    static func string(from date: Date) -> String {
        withFractional.string(from: date)
    }
}
