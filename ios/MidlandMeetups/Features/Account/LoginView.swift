import SwiftUI

/// Port of `src/app/login/page.tsx` — email + password, with an inline
/// register mode. Firebase Auth is reached over the Identity Toolkit REST API.
struct LoginView: View {
    enum Mode {
        case signIn, register
    }

    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data
    @Environment(ToastCenter.self) private var toasts
    @Environment(\.dismiss) private var dismiss

    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var displayName = ""
    @State private var isBusy = false
    @State private var errorMessage = ""

    @FocusState private var focusedField: Field?

    private enum Field {
        case name, email, password
    }

    private var canSubmit: Bool {
        !isBusy
            && email.contains("@")
            && password.count >= 6
            && (mode == .signIn || !displayName.trimmingCharacters(in: .whitespaces).isEmpty)
    }

    var body: some View {
        Screen {
            PageHeaderView(
                kicker: "Account",
                title: mode == .signIn ? "Sign in" : "Create an account",
                lede: "Use email and password. Your session stays signed in on this device."
            )

            if !AppConfig.isConfigured {
                ConfigNotice()
            } else {
                VStack(alignment: .leading, spacing: 14) {
                    if mode == .register {
                        LabeledField(label: "Display name") {
                            TextField("What should we call you?", text: $displayName)
                                .textContentType(.name)
                                .focused($focusedField, equals: .name)
                                .fieldBox()
                        }
                    }

                    LabeledField(label: "Email") {
                        TextField("you@example.com", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($focusedField, equals: .email)
                            .fieldBox()
                    }

                    LabeledField(label: "Password", hint: "at least 6 characters") {
                        SecureField("••••••••", text: $password)
                            .textContentType(mode == .register ? .newPassword : .password)
                            .focused($focusedField, equals: .password)
                            .fieldBox()
                    }

                    Button(mode == .register ? "Create account" : "Sign in") {
                        Task { await submit() }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(!canSubmit)

                    Button {
                        withAnimation {
                            mode = mode == .signIn ? .register : .signIn
                            errorMessage = ""
                        }
                    } label: {
                        Text(mode == .signIn ? "New here? Create an account" : "Already have an account? Sign in")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.blue)
                    }
                    .buttonStyle(.plain)

                    if !errorMessage.isEmpty {
                        Text(errorMessage)
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.red)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .cardSurface()
            }
        }
        .navigationTitle("Sign in")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func submit() async {
        isBusy = true
        errorMessage = ""
        focusedField = nil
        defer { isBusy = false }

        do {
            if mode == .register {
                try await session.register(
                    email: email.trimmingCharacters(in: .whitespaces),
                    password: password,
                    displayName: displayName
                )
                toasts.success("Account created — you're signed in.")
            } else {
                try await session.signIn(
                    email: email.trimmingCharacters(in: .whitespaces),
                    password: password
                )
                toasts.success("Signed in.")
            }
            password = ""
            await data.refreshFeed(signedIn: true)
            dismiss()
        } catch {
            let message = (error as? LocalizedError)?.errorDescription
                ?? "Couldn't sign in. Check your email and password."
            errorMessage = message
            toasts.error(message)
        }
    }
}
