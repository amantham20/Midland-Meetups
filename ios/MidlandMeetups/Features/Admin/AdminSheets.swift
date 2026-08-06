import SwiftUI

/// Edits the public status ticker and the audience tags for one event.
struct EventAdminSheet: View {
    let event: MeetupEvent
    let groups: [AudienceGroup]
    let onSave: (EventStatus, String, [String]) async -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var status: EventStatus
    @State private var note: String
    @State private var tags: [String]
    @State private var isSaving = false

    init(
        event: MeetupEvent,
        groups: [AudienceGroup],
        onSave: @escaping (EventStatus, String, [String]) async -> Void
    ) {
        self.event = event
        self.groups = groups
        self.onSave = onSave
        _status = State(initialValue: event.status)
        _note = State(initialValue: event.statusNote)
        _tags = State(initialValue: event.tags)
    }

    var body: some View {
        Screen {
            VStack(alignment: .leading, spacing: 6) {
                Text(event.title)
                    .font(Theme.display(22))
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text("\(EventDates.formatShort(event.date)) · \(EventDates.formatTime(event.time)) · \(event.location)")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }

            VStack(alignment: .leading, spacing: 14) {
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
                        text: $note,
                        axis: .vertical
                    )
                    .lineLimit(2...5)
                    .fieldBox()
                }

                LabeledField(label: "Audience groups") {
                    if groups.isEmpty {
                        Text("No groups yet. Create one below the queue to invite a private audience.")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    } else {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("No selection means everyone sees this event.")
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.muted)
                            TagPicker(groups: groups, selected: $tags)
                        }
                    }
                }

                Button(isSaving ? "Saving…" : "Save changes") {
                    isSaving = true
                    Task {
                        await onSave(status, note, tags)
                        isSaving = false
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(isSaving)
            }
            .cardSurface()
        }
        .navigationTitle("Edit event")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Close") { dismiss() }
            }
        }
    }
}

/// Creates or edits an audience group. Members are picked from squad profiles
/// (their emails are the source of truth), with room for extras who haven't
/// joined the squad yet.
struct GroupEditorSheet: View {
    let draft: GroupDraft
    let squad: [SquadMember]
    let onSave: (String, [String]) async -> Void
    let onDelete: (() async -> Void)?

    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var selectedEmails: Set<String>
    @State private var extraEmails: String
    @State private var isSaving = false
    @State private var isConfirmingDelete = false

    init(
        draft: GroupDraft,
        squad: [SquadMember],
        onSave: @escaping (String, [String]) async -> Void,
        onDelete: (() async -> Void)?
    ) {
        self.draft = draft
        self.squad = squad
        self.onSave = onSave
        self.onDelete = onDelete

        _name = State(initialValue: draft.name)

        // Emails already on a squad profile become checkboxes; the rest are text.
        let squadEmails = Set(squad.map(\.email).filter { !$0.isEmpty })
        let existing = Set(draft.emails)
        _selectedEmails = State(initialValue: existing.intersection(squadEmails))
        _extraEmails = State(
            initialValue: existing.subtracting(squadEmails).sorted().joined(separator: "\n")
        )
    }

    private var membersWithEmail: [SquadMember] {
        squad.filter { !$0.email.isEmpty }
    }

    private var resolvedEmails: [String] {
        var all = selectedEmails
        for email in Audience.parseEmailList(extraEmails) { all.insert(email) }
        return all.sorted()
    }

    var body: some View {
        Screen {
            VStack(alignment: .leading, spacing: 14) {
                LabeledField(label: "Group name") {
                    TextField("e.g. Kayak Crew", text: $name)
                        .fieldBox()
                }

                LabeledField(label: "Squad members", hint: "\(selectedEmails.count) selected") {
                    if membersWithEmail.isEmpty {
                        Text("No squad profiles have an email yet.")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.muted)
                    } else {
                        VStack(spacing: 0) {
                            ForEach(membersWithEmail) { member in
                                Button {
                                    if selectedEmails.contains(member.email) {
                                        selectedEmails.remove(member.email)
                                    } else {
                                        selectedEmails.insert(member.email)
                                    }
                                } label: {
                                    HStack(spacing: 10) {
                                        Image(
                                            systemName: selectedEmails.contains(member.email)
                                                ? "checkmark.circle.fill"
                                                : "circle"
                                        )
                                        .foregroundStyle(
                                            selectedEmails.contains(member.email)
                                                ? Theme.blue
                                                : Theme.muted
                                        )
                                        VStack(alignment: .leading, spacing: 1) {
                                            Text(member.name)
                                                .font(.system(size: 14, weight: .medium))
                                                .foregroundStyle(Theme.ink)
                                            Text(member.email)
                                                .font(.system(size: 12))
                                                .foregroundStyle(Theme.muted)
                                        }
                                        Spacer(minLength: 0)
                                    }
                                    .padding(.vertical, 7)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                LabeledField(label: "Other emails", hint: "one per line, optional") {
                    TextField("someone@example.com", text: $extraEmails, axis: .vertical)
                        .lineLimit(2...6)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .fieldBox()
                }

                Text("\(resolvedEmails.count) email\(resolvedEmails.count == 1 ? "" : "s") in this group.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)

                Button(isSaving ? "Saving…" : "Save group") {
                    isSaving = true
                    Task {
                        await onSave(name, resolvedEmails)
                        isSaving = false
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(isSaving || name.trimmingCharacters(in: .whitespaces).isEmpty)

                if onDelete != nil {
                    Button(role: .destructive) {
                        isConfirmingDelete = true
                    } label: {
                        Text("Delete group")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.red)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                    }
                    .buttonStyle(.plain)
                }
            }
            .cardSurface()
        }
        .navigationTitle(draft.isNew ? "New group" : "Edit group")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Close") { dismiss() }
            }
        }
        .confirmationDialog(
            "Delete this group?",
            isPresented: $isConfirmingDelete,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                Task { await onDelete?() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Events tagged with this group will become visible to everyone.")
        }
    }
}
