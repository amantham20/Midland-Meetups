import SwiftUI

/// The web `Header` nav becomes a tab bar. Happenings / RSVPs / Lore / Squad are
/// the four standing destinations; Submit, Game, Admin and account live under More.
struct RootView: View {
    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data
    @Environment(ToastCenter.self) private var toasts
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        TabView {
            NavigationStack { HappeningsView() }
                .tabItem { Label("Happenings", systemImage: "calendar") }

            NavigationStack { RsvpsView() }
                .tabItem { Label("RSVPs", systemImage: "checkmark.circle") }

            NavigationStack { LoreView() }
                .tabItem { Label("Lore", systemImage: "book") }

            NavigationStack { SquadView() }
                .tabItem { Label("Squad", systemImage: "person.3") }

            NavigationStack { MoreView() }
                .tabItem { Label("More", systemImage: "ellipsis.circle") }
        }
        .tint(Theme.blue)
        .overlay(ToastOverlay(toasts: toasts))
        .task {
            await session.restore()
            await data.refreshFeed(signedIn: session.isSignedIn)
        }
        .onChange(of: session.isSignedIn) { _, signedIn in
            // Audience groups are readable only once signed in, and the visible
            // event list depends on them.
            Task { await data.refreshFeed(signedIn: signedIn) }
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active, !session.isRestoring else { return }
            session.touchActivity()
            Task { await data.refreshFeed(signedIn: session.isSignedIn) }
        }
    }
}

/// The standard page container: a scrolling column on the app background.
struct Screen<Content: View>: View {
    var spacing: CGFloat = 20
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: spacing) {
                content
            }
            .padding(.horizontal, 20)
            .padding(.top, 4)
            .padding(.bottom, 44)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.bg)
        .scrollDismissesKeyboard(.interactively)
    }
}

/// Shown in place of a form when an action needs an account.
struct SignInPrompt: View {
    let message: String

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(message)
                .font(.system(size: 15))
                .foregroundStyle(Theme.muted)
                .fixedSize(horizontal: false, vertical: true)

            NavigationLink {
                LoginView()
            } label: {
                Text("Sign in to continue")
            }
            .buttonStyle(PrimaryButtonStyle())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface()
    }
}
