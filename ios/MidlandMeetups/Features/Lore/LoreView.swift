import SwiftUI

/// Port of `src/app/lore/page.tsx` — the archive plus the submission form.
struct LoreView: View {
    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data
    @Environment(ToastCenter.self) private var toasts

    @State private var title = ""
    @State private var author = ""
    @State private var text = ""
    @State private var isSaving = false
    @State private var statusMessage = ""

    private var canSubmit: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
            && !author.trimmingCharacters(in: .whitespaces).isEmpty
            && !text.trimmingCharacters(in: .whitespaces).isEmpty
            && !isSaving
    }

    var body: some View {
        Screen {
            PageHeaderView(
                kicker: "Volume whatever, issue whenever",
                title: "The Lore Letter",
                lede: "The stories that get retold at the next event. Canoe disasters, pie controversies, the dog that got loose — if it happened at a Mixer event, it belongs here."
            )

            if !AppConfig.isConfigured {
                ConfigNotice()
            } else {
                if !data.hasLoadedFeed {
                    EmptyNote("Loading the archive…")
                } else if let error = data.memoriesError {
                    EmptyNote(error)
                } else if data.memories.isEmpty {
                    EmptyNote("No memories posted yet. Be the first!")
                }

                ForEach(data.memories) { memory in
                    MemoryCard(memory: memory)
                }

                submissionSection
                    .padding(.top, 14)
            }
        }
        .navigationTitle("The Lore Letter")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if author.isEmpty { author = session.preferredName }
        }
        .refreshable {
            await data.refreshFeed(signedIn: session.isSignedIn)
        }
    }

    private var submissionSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                Text("GOT A MEMORY?")
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(1.4)
                    .foregroundStyle(Theme.muted)
                Text("Add to the Letter")
                    .font(Theme.display(26))
                    .tracking(-0.4)
                    .foregroundStyle(Theme.ink)
                Text("Send in your story and it'll show up here once it's been approved.")
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if !session.isSignedIn {
                SignInPrompt(message: "Sign in to submit a memory.")
            } else {
                VStack(alignment: .leading, spacing: 14) {
                    LabeledField(label: "Title") {
                        TextField("e.g. The Great Canoe Mishap", text: $title)
                            .fieldBox()
                    }
                    LabeledField(label: "Your name") {
                        TextField("Who's telling it", text: $author)
                            .textContentType(.name)
                            .fieldBox()
                    }
                    LabeledField(label: "What happened") {
                        TextField(
                            "Tell it like you would at the next event.",
                            text: $text,
                            axis: .vertical
                        )
                        .lineLimit(5...12)
                        .fieldBox()
                    }

                    Button("Send Memory") {
                        Task { await submit() }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(!canSubmit)

                    if !statusMessage.isEmpty {
                        Text(statusMessage)
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.muted)
                    }
                }
                .cardSurface()
            }
        }
    }

    private func submit() async {
        guard let uid = session.uid else {
            toasts.info("Sign in to send a memory.")
            return
        }
        isSaving = true
        statusMessage = "Sending…"
        defer { isSaving = false }

        do {
            try await data.submitMemory(
                title: title.trimmingCharacters(in: .whitespaces),
                author: author.trimmingCharacters(in: .whitespaces),
                text: text.trimmingCharacters(in: .whitespaces),
                userId: uid
            )
            title = ""
            text = ""
            let message = "Sent! Your story is in for review and will show up once approved."
            statusMessage = message
            toasts.success(message)
        } catch {
            let message = "Something went wrong. Check your connection and try again."
            statusMessage = message
            toasts.error(message)
        }
    }
}

private struct MemoryCard: View {
    let memory: Memory

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(memory.title)
                .font(Theme.display(18))
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)

            Text("\(memory.author) · \(EventDates.formatShort(memory.date))")
                .font(.system(size: 13))
                .foregroundStyle(Theme.muted)

            Text(memory.text)
                .font(.system(size: 15))
                .foregroundStyle(Theme.ink.opacity(0.9))
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface()
    }
}
