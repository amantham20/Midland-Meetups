import SwiftUI

/// The overflow of the web header nav: Submit, Game, Admin, and account controls.
struct MoreView: View {
    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data
    @Environment(ToastCenter.self) private var toasts

    @State private var isConfirmingDeletion = false
    @State private var isDeleting = false

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
                    .disabled(isDeleting)

                    Button(role: .destructive) {
                        isConfirmingDeletion = true
                    } label: {
                        HStack {
                            Label(
                                isDeleting ? "Deleting account…" : "Delete account",
                                systemImage: "trash"
                            )
                            if isDeleting {
                                Spacer()
                                ProgressView()
                            }
                        }
                    }
                    .disabled(isDeleting)
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
        .alert("Delete your account?", isPresented: $isConfirmingDeletion) {
            Button("Delete permanently", role: .destructive) {
                Task { await deleteAccount() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(
                """
                This deletes your sign-in, your squad profile and photo, and every \
                RSVP you've made. Submissions still waiting on approval are deleted \
                too. Events and stories already on the board stay up, with your name \
                replaced by "Former member". This can't be undone.
                """
            )
        }
    }

    private func deleteAccount() async {
        guard let uid = session.uid else { return }
        isDeleting = true
        defer { isDeleting = false }

        do {
            // Firestore first: the rules match every deletion against the signed-in
            // uid, and once the Auth user is gone there's no way back in to finish.
            try await data.erasePersonalData(userId: uid, email: session.email)
            try await session.deleteAccount()
            toasts.success("Your account and your data are gone.")
        } catch {
            let message = (error as? LocalizedError)?.errorDescription
                ?? "Couldn't delete your account. Try again."
            toasts.error(message)
        }

        await data.refreshFeed(signedIn: session.isSignedIn)
    }
}
