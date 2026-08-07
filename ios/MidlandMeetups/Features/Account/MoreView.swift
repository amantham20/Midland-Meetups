import SwiftUI

/// The overflow of the web header nav: Submit, Game, Admin, and account controls.
struct MoreView: View {
    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data
    @Environment(ToastCenter.self) private var toasts

    var body: some View {
        List {
            Section {
                HStack(spacing: 12) {
                    BrandMark(size: 38)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Midland Meetups")
                            .font(Theme.display(19))
                            .foregroundStyle(Theme.ink)
                        Text("A bulletin board for the crew · Midland, MI")
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.muted)
                    }
                }
                .padding(.vertical, 6)
                .listRowBackground(Theme.surface)
            }

            Section {
                NavigationLink {
                    SubmitEventView()
                } label: {
                    Label("Submit an Event", systemImage: "plus.circle")
                }

                Link(destination: AppConfig.gameURL) {
                    HStack {
                        Label("Game", systemImage: "gamecontroller")
                        Spacer()
                        Image(systemName: "arrow.up.right.square")
                            .foregroundStyle(Theme.muted)
                            .font(.system(size: 13))
                    }
                }

                if session.isAdmin {
                    NavigationLink {
                        AdminView()
                    } label: {
                        Label("Admin queue", systemImage: "checkmark.seal")
                    }
                }
            }
            .listRowBackground(Theme.surface)

            Section("Account") {
                if session.isSignedIn {
                    VStack(alignment: .leading, spacing: 3) {
                        if let name = session.displayName {
                            Text(name)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Theme.ink)
                        }
                        Text(session.email ?? "Signed in")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.muted)
                    }
                    .padding(.vertical, 2)

                    Button(role: .destructive) {
                        session.signOut()
                        toasts.info("Signed out.")
                        Task { await data.refreshFeed(signedIn: false) }
                    } label: {
                        Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                } else {
                    NavigationLink {
                        LoginView()
                    } label: {
                        Label("Sign in", systemImage: "person.crop.circle")
                    }
                }
            }
            .listRowBackground(Theme.surface)

            Section {
                Text("Signed-in sessions stay active for 100 days of use. Tagged events only appear when your email is in that audience group.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
            }
            .listRowBackground(Color.clear)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.bg)
        .navigationTitle("More")
        .navigationBarTitleDisplayMode(.inline)
        .tint(Theme.blue)
    }
}
