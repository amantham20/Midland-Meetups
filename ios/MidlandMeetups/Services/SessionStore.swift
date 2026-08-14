import Foundation
import Observation

/// Port of `AuthContext.tsx`.
///
/// Keeps the signed-in user, refreshes the ID token before it lapses, and applies
/// the same sliding 100-day activity window the web client enforces.
@MainActor
@Observable
final class SessionStore {
    private(set) var session: AuthSession?
    /// True until the keychain has been checked, so the UI doesn't flash "signed out".
    private(set) var isRestoring = true

    private let auth: AuthClient?
    private let adminUids: [String]
    private var refreshTask: Task<AuthSession?, Never>?

    private static let keychainAccount = "session"
    private static let lastActivityKey = "mm-auth-last-activity"
    private static let sessionWindow: TimeInterval = 100 * 24 * 60 * 60

    init() {
        if let config = AppConfig.firebase {
            auth = AuthClient(config: config)
            adminUids = config.adminUids
        } else {
            auth = nil
            adminUids = []
        }

        TokenBroker.shared.setProvider { [weak self] in
            await self?.validIdToken()
        }
    }

    // MARK: - Derived state

    var uid: String? { session?.uid }
    var email: String? {
        guard let email = session?.email, !email.isEmpty else { return nil }
        return email
    }

    var displayName: String? {
        guard let name = session?.displayName, !name.isEmpty else { return nil }
        return name
    }

    /// Best available label for RSVP rows and prefilled name fields.
    var preferredName: String { displayName ?? email ?? "" }

    var isSignedIn: Bool { session != nil }

    /// UID listed in the bundled admin list — drives nav only.
    var isAdminListed: Bool {
        guard let uid = session?.uid else { return false }
        return adminUids.contains(uid)
    }

    /// `admin: true` on the ID token — the claim Firestore rules actually check.
    var hasAdminClaim: Bool {
        guard let token = session?.idToken else { return false }
        return JWT.hasAdminClaim(token)
    }

    var isAdmin: Bool { isAdminListed || hasAdminClaim }

    // MARK: - Lifecycle

    func restore() async {
        defer { isRestoring = false }
        guard let auth else { return }
        guard
            let data = Keychain.data(for: Self.keychainAccount),
            let stored = try? JSONDecoder().decode(AuthSession.self, from: data)
        else { return }

        // Sliding window: a session idle past 100 days is dropped.
        guard isActivityWindowValid else {
            clear()
            return
        }

        session = stored
        touchActivity()

        // Warm the token so the first Firestore write doesn't pay for a refresh.
        if stored.isExpiringSoon {
            do {
                let refreshed = try await auth.refresh(stored)
                persist(refreshed)
            } catch {
                clear()
            }
        }
    }

    func signIn(email: String, password: String) async throws {
        guard let auth else { throw FirebaseError(message: "Firebase isn't configured.") }
        let session = try await auth.signIn(email: email, password: password)
        persist(session)
        touchActivity()
    }

    func register(email: String, password: String, displayName: String) async throws {
        guard let auth else { throw FirebaseError(message: "Firebase isn't configured.") }
        let session = try await auth.register(
            email: email,
            password: password,
            displayName: displayName
        )
        persist(session)
        touchActivity()
    }

    func signOut() {
        clear()
    }

    /// Deletes the Auth user and drops the local session. Call
    /// `DataStore.erasePersonalData` first — once the account is gone there is no
    /// way back in to finish the cleanup.
    func deleteAccount() async throws {
        guard let auth else { throw FirebaseError(message: "Firebase isn't configured.") }
        guard let token = await validIdToken() else {
            throw FirebaseError(message: "Your session expired. Sign in again to delete your account.")
        }
        try await auth.deleteAccount(idToken: token)
        clear()
    }

    /// Returns a token that is valid for at least another minute, refreshing if needed.
    /// Concurrent callers share one refresh instead of racing.
    func validIdToken() async -> String? {
        guard let auth, let current = session else { return nil }
        guard current.isExpiringSoon else { return current.idToken }

        if let inFlight = refreshTask {
            return await inFlight.value?.idToken
        }

        let task = Task { [auth, current] () -> AuthSession? in
            do {
                let refreshed = try await auth.refresh(current)
                persist(refreshed)
                return refreshed
            } catch {
                clear()
                return nil
            }
        }
        refreshTask = task
        let result = await task.value
        refreshTask = nil
        return result?.idToken
    }

    /// Re-reads profile fields after they change server side.
    func refreshProfile() async {
        guard let auth, let token = await validIdToken() else { return }
        guard let profile = try? await auth.lookup(idToken: token) else { return }
        guard var current = session else { return }
        current.email = profile.email
        current.displayName = profile.displayName
        persist(current)
    }

    /// Called when the app comes back to the foreground.
    func touchActivity() {
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: Self.lastActivityKey)
    }

    // MARK: - Storage

    private var isActivityWindowValid: Bool {
        let last = UserDefaults.standard.double(forKey: Self.lastActivityKey)
        // No stamp yet (fresh install over an old session) — start the window now.
        guard last > 0 else { return true }
        return Date().timeIntervalSince1970 - last < Self.sessionWindow
    }

    private func persist(_ session: AuthSession) {
        self.session = session
        if let data = try? JSONEncoder().encode(session) {
            Keychain.set(data, for: Self.keychainAccount)
        }
    }

    private func clear() {
        session = nil
        Keychain.remove(Self.keychainAccount)
        UserDefaults.standard.removeObject(forKey: Self.lastActivityKey)
    }
}
