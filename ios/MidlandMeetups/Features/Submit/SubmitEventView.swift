import SwiftUI

/// Port of `src/app/submit/page.tsx`.
///
/// You can only invite audience groups you belong to — enforced here the same way
/// the web form does, by filtering the picker down to the viewer's own groups and
/// re-filtering the selection at submit time.
struct SubmitEventView: View {
    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data
    @Environment(ToastCenter.self) private var toasts

    @State private var title = ""
    @State private var hostedByOther = false
    @State private var otherHost = ""
    @State private var otherHostUserId = ""
    @State private var date = Date()
    @State private var time = Date()
    @State private var location = ""
    @State private var details = ""
    @State private var tags: [String] = []
    @State private var isSaving = false
    @State private var statusMessage = ""
    @State private var editingEvent: MeetupEvent?

    private var myGroups: [AudienceGroup] {
        Audience.groups(data.groups, for: session.email)
    }

    /// You're the host unless you said someone else is.
    private var resolvedHost: String {
        (hostedByOther ? otherHost : session.preferredName)
            .trimmingCharacters(in: .whitespaces)
    }

    private var canSubmit: Bool {
        !isSaving
            && !title.trimmingCharacters(in: .whitespaces).isEmpty
            && !resolvedHost.isEmpty
            && !location.trimmingCharacters(in: .whitespaces).isEmpty
            && !details.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        Screen {
            PageHeaderView(
                kicker: "Got an idea?",
                title: "Submit an Event",
                lede: "Fill this out and it'll go to the organizer for review. You're the host unless you say otherwise, and you can invite only audience groups you're a member of."
            )

            if !AppConfig.isConfigured {
                ConfigNotice()
            } else if session.isRestoring {
                EmptyNote("Checking sign-in…")
            } else if !session.isSignedIn {
                SignInPrompt(
                    message: "You need an account to submit events — this keeps spam off the board without a shared password in the page source."
                )
            } else {
                form
                MyEventsSection(onEdit: { editingEvent = $0 })
            }
        }
        .navigationTitle("Submit an Event")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: session.uid) {
            guard let uid = session.uid else { return }
            await data.loadMyEvents(userId: uid)
            // The host picker is built from squad profiles.
            if data.squad.isEmpty { await data.loadSquad() }
        }
        .onChange(of: myGroups) { _, groups in
            // Drop any selection the user is no longer allowed to use.
            let allowed = Set(groups.map(\.slug))
            tags = tags.filter { allowed.contains($0) }
        }
        .sheet(item: $editingEvent) { event in
            NavigationStack {
                EventEditSheet(
                    event: event,
                    groups: data.groups,
                    myName: session.preferredName,
                    myUserId: session.uid ?? ""
                ) {
                    guard let uid = session.uid else { return }
                    await data.loadMyEvents(userId: uid)
                    await data.loadEvents()
                }
            }
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 14) {
            LabeledField(label: "Event title") {
                TextField("e.g. Kayak Night at Sanford Lake", text: $title)
                    .fieldBox()
            }

            AttributionField(
                label: "Host",
                myName: session.preferredName,
                selfHint: "your account name",
                toggleLabel: "Someone else is hosting",
                otherLabel: "Host's name",
                otherPlaceholder: "Who's running this one?",
                byOther: $hostedByOther,
                otherName: $otherHost,
                people: data.hostCandidates,
                otherUserId: $otherHostUserId,
                taggedHint: "They'll be able to edit this event too."
            )

            LabeledField(label: "Date") {
                DatePicker("Date", selection: $date, displayedComponents: .date)
                    .labelsHidden()
                    .datePickerStyle(.compact)
            }

            LabeledField(label: "Time") {
                DatePicker("Time", selection: $time, displayedComponents: .hourAndMinute)
                    .labelsHidden()
                    .datePickerStyle(.compact)
            }

            LabeledField(label: "Location") {
                TextField("Where's it happening?", text: $location)
                    .fieldBox()
            }

            LabeledField(label: "Description", hint: "what should people expect?") {
                TextField(
                    "What's the plan, what to bring, anything people should know.",
                    text: $details,
                    axis: .vertical
                )
                .lineLimit(4...10)
                .fieldBox()
            }

            LabeledField(label: "Invite audience groups") {
                if myGroups.isEmpty {
                    Text("You're not in any audience groups yet, so this event will be visible to everyone once approved. Ask an admin to add your account email to a group if you want to invite a private audience.")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.muted)
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Leave all unselected for everyone. Pick a group to invite only that audience.")
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.muted)
                            .fixedSize(horizontal: false, vertical: true)
                        TagPicker(groups: myGroups, selected: $tags)
                    }
                }
            }

            Button("Send Submission") {
                Task { await submit() }
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(!canSubmit)

            if !statusMessage.isEmpty {
                Text(statusMessage)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .cardSurface()
    }

    private func submit() async {
        guard let uid = session.uid else {
            toasts.info("Sign in to submit an event.")
            return
        }
        let allowed = Set(myGroups.map(\.slug))
        let safeTags = tags.filter { allowed.contains($0) }

        isSaving = true
        statusMessage = "Sending…"
        defer { isSaving = false }

        do {
            try await data.submitEvent(
                title: title.trimmingCharacters(in: .whitespaces),
                host: resolvedHost,
                hostUserId: hostedByOther ? otherHostUserId : uid,
                date: EventDates.iso(from: date),
                time: formattedTime,
                location: location.trimmingCharacters(in: .whitespaces),
                description: details.trimmingCharacters(in: .whitespaces),
                userId: uid,
                tags: safeTags
            )
            title = ""
            location = ""
            details = ""
            tags = []
            hostedByOther = false
            otherHost = ""
            otherHostUserId = ""
            await data.loadMyEvents(userId: uid)
            let message = "Event submitted! It'll show on the board once it's approved."
            statusMessage = message
            toasts.success(message)
        } catch {
            let message = "Couldn't submit that event. Check your connection and try again."
            statusMessage = message
            toasts.error(message)
        }
    }

    /// Stored in the same display form the web writes, e.g. "6:30 PM".
    private var formattedTime: String {
        let parts = Calendar.current.dateComponents([.hour, .minute], from: time)
        let hour = parts.hour ?? 0
        let minute = parts.minute ?? 0
        return EventDates.formatTime(String(format: "%02d:%02d", hour, minute))
    }
}

/// Port of `src/app/submit/MyEvents.tsx` — the account's own submissions,
/// including the pending ones that appear nowhere else, each editable in place.
private struct MyEventsSection: View {
    let onEdit: (MeetupEvent) -> Void

    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data

    /// `myEvents` is stamped with the uid it came from, so an account switch
    /// reads as "loading" instead of showing the previous account's events.
    private var hasLoaded: Bool {
        session.uid != nil && data.myEventsUserId == session.uid
    }

    private var upcoming: [MeetupEvent] {
        data.myEvents.filter { $0.date >= EventDates.todayISO }
    }

    private var past: [MeetupEvent] {
        data.myEvents
            .filter { $0.date < EventDates.todayISO }
            .sorted { $0.date > $1.date }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text("YOURS TO RUN")
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(1.2)
                    .foregroundStyle(Theme.muted)
                SectionHeading(text: "Events you host")
                Text("Everything you submitted, plus anything someone tagged you as host on. Change the details, move the date or flag a rain delay — edits to an approved event show on the board right away.")
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if !hasLoaded {
                EmptyNote("Loading your events…")
            } else if let error = data.myEventsError {
                EmptyNote(error)
            } else if data.myEvents.isEmpty {
                EmptyNote("Nothing yet — send one in with the form above, or ask a host to tag you on theirs.")
            } else {
                ForEach(upcoming) { event in
                    row(for: event)
                }
                if !past.isEmpty {
                    Text("Past")
                        .font(Theme.display(17))
                        .foregroundStyle(Theme.ink)
                        .padding(.top, 6)
                    ForEach(past) { event in
                        row(for: event)
                    }
                }
            }
        }
        .padding(.top, 10)
    }

    private func row(for event: MeetupEvent) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(event.title)
                    .font(Theme.display(17))
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                StatusPill(status: event.status)
            }

            if let uid = session.uid, event.createdBy != uid {
                Text("Tagged as host")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.blue)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Theme.blue.opacity(0.12))
                    .clipShape(Capsule())
            }

            if !event.approved {
                Text(event.hidden ? "Removed by organizers" : "Awaiting approval")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(event.hidden ? Theme.red : Theme.amberInk)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(
                        event.hidden ? Theme.red.opacity(0.14) : Theme.yellow.opacity(0.22)
                    )
                    .clipShape(Capsule())
            }

            VStack(alignment: .leading, spacing: 5) {
                MetaRow(symbol: "calendar", text: EventDates.formatShort(event.date))
                MetaRow(symbol: "clock", text: EventDates.formatTime(event.time))
                MetaRow(symbol: "mappin.and.ellipse", text: event.location)
                MetaRow(symbol: "person", text: "Hosted by \(event.host)")
            }

            TagChipsView(tags: event.tags, labels: Audience.nameMap(data.groups))

            Button("Edit") { onEdit(event) }
                .buttonStyle(SecondaryButtonStyle())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface()
    }
}
