import SwiftUI

/// Address published in the Terms — the route for anyone who can't file in-app.
enum Support {
    static let contactEmail = "hey@amantham.com"

    /// A prefilled mail composer, so an emailed report still says what it's about.
    static func reportMailURL(for target: ReportTarget) -> URL? {
        let subject = target.label.isEmpty
            ? "Report content or a user"
            : "Report: \(target.label)"
        let body = [
            "What are you reporting?",
            target.label.isEmpty
                ? "(event, story, profile or account)"
                : "\(target.type.label): \(target.label)",
            "",
            "What's wrong with it?",
            "",
        ].joined(separator: "\n")

        var components = URLComponents(string: "mailto:\(contactEmail)")
        components?.queryItems = [
            URLQueryItem(name: "subject", value: subject),
            URLQueryItem(name: "body", value: body),
        ]
        return components?.url
    }
}

/// Reports a piece of content or a member to the organizers.
///
/// The report lands in the admin queue (`reports`), which only organizers can
/// read — filing one is a write the reporter can never read back. Reporting
/// needs an account so the queue can't be flooded anonymously; everyone else
/// gets the published email address.
struct ReportSheet: View {
    let target: ReportTarget

    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data
    @Environment(ToastCenter.self) private var toasts
    @Environment(\.dismiss) private var dismiss

    @State private var reason: ReportReason = .harassment
    @State private var details = ""
    @State private var isSending = false
    @State private var errorMessage: String?

    private var isGeneral: Bool { target.type == .other }

    private var canSend: Bool {
        guard !isSending else { return false }
        // A general report has nothing attached to it, so it has to say what it's about.
        return !isGeneral || !details.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        Screen {
            VStack(alignment: .leading, spacing: 8) {
                Text(isGeneral ? "REPORT" : target.type.label.uppercased())
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(1.4)
                    .foregroundStyle(Theme.muted)
                Text(target.label.isEmpty ? "Report content or a user" : target.label)
                    .font(Theme.display(24))
                    .tracking(-0.4)
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Reports go to the organizers only. They can hide or delete the content and take action on the account behind it.")
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if session.isSignedIn {
                form
            } else {
                SignInPrompt(message: "Sign in to send a report, so an organizer can follow up with you.")
            }

            emailFallback
        }
        .navigationTitle("Report")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Close") { dismiss() }
            }
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 16) {
            LabeledField(label: "What's wrong?") {
                VStack(spacing: 0) {
                    ForEach(ReportReason.allCases, id: \.self) { option in
                        Button {
                            reason = option
                        } label: {
                            HStack(spacing: 10) {
                                Image(
                                    systemName: reason == option
                                        ? "largecircle.fill.circle"
                                        : "circle"
                                )
                                .foregroundStyle(reason == option ? Theme.blue : Theme.muted)
                                Text(option.label)
                                    .font(.system(size: 15))
                                    .foregroundStyle(Theme.ink)
                                    .multilineTextAlignment(.leading)
                                Spacer(minLength: 0)
                            }
                            .contentShape(Rectangle())
                            .padding(.vertical, 7)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            LabeledField(label: "Details", hint: isGeneral ? nil : "optional") {
                TextField(
                    isGeneral
                        ? "Which event, story, profile or person, and what's wrong with it?"
                        : "Anything the organizers should know.",
                    text: $details,
                    axis: .vertical
                )
                .lineLimit(4...10)
                .fieldBox()
            }

            Button(isSending ? "Sending…" : "Send report") {
                Task { await send() }
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(!canSend)

            if let errorMessage {
                Text(errorMessage)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.red)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .cardSurface()
    }

    @ViewBuilder
    private var emailFallback: some View {
        if let url = Support.reportMailURL(for: target) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Prefer email?")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                Link(destination: url) {
                    Label(Support.contactEmail, systemImage: "envelope")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.blue)
                }
                Text("Include enough detail to identify the content. Either way you'll get a reply.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .cardSurface(padding: 14, cornerRadius: Theme.radiusMedium)
        }
    }

    private func send() async {
        guard let uid = session.uid else {
            toasts.info("Sign in to send a report.")
            return
        }
        isSending = true
        errorMessage = nil
        defer { isSending = false }

        do {
            try await data.submitReport(
                target: target,
                reason: reason,
                details: details,
                userId: uid,
                reporterEmail: session.email,
                reporterName: session.preferredName
            )
            toasts.success("Report sent. An organizer will review it.")
            dismiss()
        } catch {
            let message = (error as? LocalizedError)?.errorDescription
                ?? "Couldn't send that report. Check your connection and try again."
            errorMessage = message
            toasts.error(message)
        }
    }
}

/// The standard trigger: a quiet button that opens `ReportSheet` for a target.
struct ReportButton: View {
    let target: ReportTarget
    var label = "Report"

    @State private var isPresented = false

    var body: some View {
        Button {
            isPresented = true
        } label: {
            Label(label, systemImage: "flag")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.muted)
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $isPresented) {
            NavigationStack {
                ReportSheet(target: target)
            }
        }
    }
}
