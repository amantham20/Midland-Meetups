import SwiftUI

/// Port of `src/components/EventEditModal.tsx` — the host's own edit form, also
/// reachable by admins on any event.
///
/// The draft is seeded once in `init`, so a refresh landing on the same document
/// can't yank fields out from under whoever is typing.
struct EventEditSheet: View {
    let event: MeetupEvent
    /// All audience groups; the picker is narrowed to the editor's own.
    let groups: [AudienceGroup]
    let onSaved: () async -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data
    @Environment(ToastCenter.self) private var toasts

    @State private var title: String
    @State private var hostedByOther: Bool
    @State private var otherHost: String
    @State private var otherHostUserId: String
    @State private var date: Date
    @State private var time: Date
    @State private var location: String
    @State private var details: String
    @State private var status: EventStatus
    @State private var statusNote: String
    @State private var tags: [String]
    @State private var isSaving = false

    init(
        event: MeetupEvent,
        groups: [AudienceGroup],
        myName: String,
        myUserId: String,
        onSaved: @escaping () async -> Void
    ) {
        self.event = event
        self.groups = groups
        self.onSaved = onSaved

        // "It's me" only when both the name and the tagged account line up — an
        // event tagged to someone else who shares your name is still theirs.
        let isMine = myUserId.isEmpty || event.hostUserId.isEmpty
            ? event.host.caseInsensitiveCompare(myName) == .orderedSame
            : event.hostUserId == myUserId
        _title = State(initialValue: event.title)
        _hostedByOther = State(initialValue: !isMine)
        _otherHost = State(initialValue: isMine ? "" : event.host)
        _otherHostUserId = State(initialValue: isMine ? "" : event.hostUserId)
        _date = State(initialValue: EventDates.date(fromISO: event.date) ?? Date())
        _time = State(initialValue: EventEditSheet.timeDate(for: event))
        _location = State(initialValue: event.location)
        _details = State(initialValue: event.description)
        _status = State(initialValue: event.status)
        _statusNote = State(initialValue: event.statusNote)
        _tags = State(initialValue: event.tags)
    }

    /// The stored display time as a `Date` the picker can drive.
    private static func timeDate(for event: MeetupEvent) -> Date {
        let hm = EventDates.parseTime(event.time) ?? (hour: 18, minute: 0)
        return Calendar.current.date(
            bySettingHour: hm.hour,
            minute: hm.minute,
            second: 0,
            of: Date()
        ) ?? Date()
    }

    private var myName: String { session.preferredName }

    /// Admins manage every group; everyone else only the ones they're in.
    private var editableGroups: [AudienceGroup] {
        session.isAdmin ? groups : Audience.groups(groups, for: session.email)
    }

    /// Groups you're not in stay on the event untouched — an admin may have
    /// added them, and dropping them silently would widen the audience.
    private var lockedTags: [String] {
        let allowed = Set(editableGroups.map(\.slug))
        return tags.filter { !allowed.contains($0) }
    }

    private var selectableTags: Binding<[String]> {
        Binding(
            get: {
                let allowed = Set(editableGroups.map(\.slug))
                return tags.filter { allowed.contains($0) }
            },
            set: { tags = lockedTags + $0 }
        )
    }

    private var resolvedHost: String {
        (hostedByOther ? otherHost : myName).trimmingCharacters(in: .whitespaces)
    }

    private var canSave: Bool {
        !isSaving
            && !title.trimmingCharacters(in: .whitespaces).isEmpty
            && !resolvedHost.isEmpty
            && !location.trimmingCharacters(in: .whitespaces).isEmpty
            && !details.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        Screen {
            Text(
                event.approved
                    ? "Changes go live on the board right away."
                    : "This one is still waiting for approval — edits won't reset its place in the queue."
            )
            .font(.system(size: 14))
            .foregroundStyle(Theme.muted)
            .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 14) {
                LabeledField(label: "Event title") {
                    TextField("Event title", text: $title)
                        .fieldBox()
                }

                AttributionField(
                    label: "Host",
                    myName: myName,
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

                LabeledField(label: "Description") {
                    TextField("What's the plan?", text: $details, axis: .vertical)
                        .lineLimit(4...10)
                        .fieldBox()
                }

                LabeledField(label: "Status") {
                    Picker("Status", selection: $status) {
                        ForEach(EventStatus.allCases, id: \.self) { value in
                            Text(value.label).tag(value)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                LabeledField(label: "Status note", hint: "shown on the ticker") {
                    TextField(
                        "e.g. Moved to the pavilion — same time",
                        text: $statusNote,
                        axis: .vertical
                    )
                    .lineLimit(2...5)
                    .fieldBox()
                }

                LabeledField(label: "Invite audience groups") {
                    if editableGroups.isEmpty {
                        Text("You're not in any audience groups, so there's nothing to change here.")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    } else {
                        TagPicker(groups: editableGroups, selected: selectableTags)
                    }

                    if !lockedTags.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Also invited by an admin (you can't change these):")
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.muted)
                            TagChipsView(tags: lockedTags, labels: Audience.nameMap(groups))
                        }
                    }
                }

                Button(isSaving ? "Saving…" : "Save changes") {
                    Task { await save() }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(!canSave)
            }
            .cardSurface()
        }
        .navigationTitle("Edit event")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            // The host picker is built from squad profiles.
            if data.squad.isEmpty { await data.loadSquad() }
        }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
                    .disabled(isSaving)
            }
        }
    }

    private func save() async {
        let isoDate = EventDates.iso(from: date)
        let parts = Calendar.current.dateComponents([.hour, .minute], from: time)
        let displayTime = EventDates.formatTime(
            String(format: "%02d:%02d", parts.hour ?? 0, parts.minute ?? 0)
        )
        let moved = isoDate != event.date || displayTime != event.time

        isSaving = true
        defer { isSaving = false }

        do {
            try await data.updateEventDetails(
                eventId: event.id,
                title: title,
                host: resolvedHost,
                hostUserId: hostedByOther ? otherHostUserId : (session.uid ?? ""),
                date: isoDate,
                time: displayTime,
                location: location,
                description: details,
                status: status,
                statusNote: statusNote,
                tags: tags,
                resetReminder: moved
            )
            toasts.success("Event updated.")
            await onSaved()
            dismiss()
        } catch {
            toasts.error("Couldn't save those changes. Check your connection.")
        }
    }
}
