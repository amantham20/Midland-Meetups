import Foundation

/// Firebase web-app credentials, mirroring the `NEXT_PUBLIC_FIREBASE_*` values the
/// web client uses. Generated into the bundle by `ios/Scripts/generate-firebase-config.sh`
/// so the plist is never committed — same contract as `.env.local` on the web side.
struct FirebaseConfig {
    let apiKey: String
    let projectId: String
    let authDomain: String
    let appId: String
    let messagingSenderId: String
    /// UIDs that get the Admin tab. Real write access is still enforced by Firestore rules.
    let adminUids: [String]
}

enum AppConfig {
    /// The legacy browser game, still hosted on GitHub Pages.
    static let gameURL = URL(string: "https://ryanpelletier.github.io/Midland-Meetups/game.html")!

    static let firebase: FirebaseConfig? = loadFirebase()

    static var isConfigured: Bool { firebase != nil }

    private static func loadFirebase() -> FirebaseConfig? {
        guard
            let url = Bundle.main.url(forResource: "Firebase", withExtension: "plist"),
            let data = try? Data(contentsOf: url),
            let raw = try? PropertyListSerialization.propertyList(from: data, format: nil),
            let dict = raw as? [String: Any]
        else { return nil }

        func value(_ key: String) -> String {
            (dict[key] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        }

        let apiKey = value("apiKey")
        let projectId = value("projectId")
        let appId = value("appId")
        // Matches the web `isFirebaseConfigured()` check.
        guard !apiKey.isEmpty, !projectId.isEmpty, !appId.isEmpty else { return nil }

        let adminUids = value("adminUids")
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }

        return FirebaseConfig(
            apiKey: apiKey,
            projectId: projectId,
            authDomain: value("authDomain"),
            appId: appId,
            messagingSenderId: value("messagingSenderId"),
            adminUids: adminUids
        )
    }
}
