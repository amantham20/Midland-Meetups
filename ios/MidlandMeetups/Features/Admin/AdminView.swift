import SwiftUI

/// Port of `src/app/admin/page.tsx` — the approval queue, event status ticker
/// controls, and audience group management.
struct AdminView: View {
    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data
    @Environment(ToastCenter.self) private var toasts

    @State private var snapshot = AdminSnapshot()
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var busyId: String?
    @State private var editingEvent: MeetupEvent?
    @State private var editingGroup: GroupDraft?
    @State private var pendingRejection: Rejection?
    @State private var pendingContentDeletion: ContentReport?
    @State private var pendingReportDismissal: ContentReport?

    private var pendingEvents: [MeetupEvent] { snapshot.events.filter { !$0.approved } }
    private var pendingMemories: [Memory] { snapshot.memories.filter { !$0.approved } }
    private var pendingSquad: [SquadMember] { snapshot.squad.filter { !$0.approved } }
    private var openReports: [ContentReport] {
        (snapshot.reports ?? []).filter { $0.status == .open }
    }
    private var reviewedReports: [ContentReport] {
        (snapshot.reports ?? []).filter { $0.status == .reviewed }
    }

    /// Every document a report can point at. A report outlives its target, so
    /// this is what tells a card to stop offering to delete something that's
    /// already gone.
    private var liveTargetIds: Set<String> {
        Set(snapshot.events.map(\.id) + snapshot.memories.map(\.id) + snapshot.squad.map(\.id))
    }
    /// Every event, pending included — admins edit all of them here.
    private var allEvents: [MeetupEvent] {
        snapshot.events.sorted { $0.date > $1.date }
    }

    var body: some View {
        Screen {
            PageHeaderView(
                kicker: "Organizer tools",
                title: "Admin",
                lede: "Approve what comes in, keep the status ticker current, and manage who sees tagged events."
            )

            if !session.isAdmin {
                EmptyNote("This account isn't an organizer.")
            } else {
                if session.isAdminListed && !session.hasAdminClaim {
                    claimNotice
                }

                if isLoading {
                    EmptyNote("Loading the queue…")
                } else if let errorMessage {
                    EmptyNote(errorMessage)
                } else {
                    reportsSection
                    queueSections
                    statusSection
                    groupsSection
                }
            }
        }
        .navigationTitle("Admin")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: $editingEvent) { event in
            NavigationStack {
                EventEditSheet(
                    event: event,
                    groups: snapshot.groups,
                    myName: session.preferredName,
                    myUserId: session.uid ?? ""
                ) {
                    await load()
                    await data.refreshFeed(signedIn: session.isSignedIn)
                }
            }
        }
        .sheet(item: $editingGroup) { draft in
            NavigationStack {
                GroupEditorSheet(
                    draft: draft,
                    squad: snapshot.squad,
                    onSave: { name, emails in await saveGroup(id: draft.id, name: name, emails: emails) },
                    onDelete: draft.isNew ? nil : { await deleteGroup(id: draft.id) }
                )
            }
        }
        .confirmationDialog(
            "Reject this submission?",
            isPresented: Binding(
                get: { pendingRejection != nil },
                set: { if !$0 { pendingRejection = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete permanently", role: .destructive) {
                if let pendingRejection {
                    Task { await reject(pendingRejection) }
                }
            }
            Button("Cancel", role: .cancel) { pendingRejection = nil }
        } message: {
            Text("Rejecting deletes \(pendingRejection?.label ?? "this submission"). This can't be undone.")
        }
        .confirmationDialog(
            "Delete the reported content?",
            isPresented: Binding(
                get: { pendingContentDeletion != nil },
                set: { if !$0 { pendingContentDeletion = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete permanently", role: .destructive) {
                if let pendingContentDeletion {
                    Task { await deleteReportedContent(pendingContentDeletion) }
                }
            }
            Button("Cancel", role: .cancel) { pendingContentDeletion = nil }
        } message: {
            Text("This deletes \(pendingContentDeletion?.targetLabel ?? "the reported content") and marks the report reviewed. This can't be undone.")
        }
        .confirmationDialog(
            "Dismiss this report?",
            isPresented: Binding(
                get: { pendingReportDismissal != nil },
                set: { if !$0 { pendingReportDismissal = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Dismiss report", role: .destructive) {
                if let pendingReportDismissal {
                    Task { await dismissReport(pendingReportDismissal) }
                }
            }
            Button("Cancel", role: .cancel) { pendingReportDismissal = nil }
        } message: {
            Text("The report leaves the queue. Whatever it pointed at stays where it is.")
        }
    }

    // MARK: - Sections

    /// Reports members filed from the app. Open ones lead; the reviewed ones
    /// stay below as a record until an organizer clears them out.
    @ViewBuilder
    private var reportsSection: some View {
        SectionHeading(text: "Reports (\(openReports.count))")

        if snapshot.reports == nil {
            EmptyNote("Couldn't read the reports queue — deploy the current firestore.rules, which is what grants organizers access to it.")
        } else if openReports.isEmpty, reviewedReports.isEmpty {
            EmptyNote("No one has reported anything.")
        } else {
            if openReports.isEmpty {
                EmptyNote("Nothing open. Reviewed reports are below.")
            }
            ForEach(openReports) { report in
                reportCard(report)
            }
            if !reviewedReports.isEmpty {
                Text("Reviewed (\(reviewedReports.count))")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.muted)
                ForEach(reviewedReports) { report in
                    reportCard(report)
                }
            }
        }
    }

    private func reportCard(_ report: ContentReport) -> some View {
        let targetExists = report.targetType.collection != nil
            && liveTargetIds.contains(report.targetId)
        let isOpen = report.status == .open

        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(ReportReason.label(for: report.reason))
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(reportSubtitle(report, targetExists: targetExists))
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                Text(isOpen ? "Open" : "Reviewed")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(isOpen ? Theme.red : Theme.muted)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background((isOpen ? Theme.red : Theme.muted).opacity(0.14))
                    .clipShape(Capsule())
            }

            if !report.details.isEmpty {
                Text(report.details)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.ink.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
            }

            Text("Filed by \(report.reporterName.isEmpty ? "a member" : report.reporterName)"
                + (report.reporterEmail.isEmpty ? "" : " · \(report.reporterEmail)"))
                .font(.system(size: 12))
                .foregroundStyle(Theme.muted)

            HStack(spacing: 10) {
                Button {
                    Task { await setReportStatus(report, to: isOpen ? .reviewed : .open) }
                } label: {
                    Text(isOpen ? "Mark reviewed" : "Reopen")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Theme.surface2)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .disabled(busyId == report.id)

                if targetExists {
                    Button {
                        pendingContentDeletion = report
                    } label: {
                        Text("Delete content")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.red)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(Theme.surface)
                            .clipShape(Capsule())
                            .overlay(Capsule().strokeBorder(Theme.red.opacity(0.5), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .disabled(busyId == report.id)
                }
            }

            Button {
                pendingReportDismissal = report
            } label: {
                Text("Dismiss report")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.muted)
            }
            .buttonStyle(.plain)
            .disabled(busyId == report.id)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface(padding: 16, cornerRadius: Theme.radiusMedium)
        .opacity(busyId == report.id ? 0.6 : 1)
    }

    private func reportSubtitle(_ report: ContentReport, targetExists: Bool) -> String {
        var parts = [report.targetType.label]
        if !report.targetLabel.isEmpty { parts.append(report.targetLabel) }
        if !report.targetId.isEmpty, !targetExists { parts.append("content already gone") }
        if let filed = report.createdAt {
            parts.append(filed.formatted(date: .abbreviated, time: .shortened))
        }
        return parts.joined(separator: " · ")
    }

    private var claimNotice: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Read-only admin")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.ink)
            Text("Your UID is on the admin list, but the ID token has no `admin` claim. Firestore rules also accept the bootstrap UID list, so writes may still work — if they're rejected, grant the claim from the web app's /admin page.")
                .font(.system(size: 14))
                .foregroundStyle(Theme.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface(padding: 14, cornerRadius: Theme.radiusMedium)
    }

    @ViewBuilder
    private var queueSections: some View {
        SectionHeading(text: "Pending events (\(pendingEvents.count))")
        if pendingEvents.isEmpty {
            EmptyNote("Nothing waiting.")
        } else {
            ForEach(pendingEvents) { event in
                PendingCard(
                    title: event.title,
                    subtitle: "\(EventDates.formatShort(event.date)) · \(EventDates.formatTime(event.time)) · \(event.location)",
                    detail: event.description,
                    footnote: "Submitted by \(event.host)",
                    isBusy: busyId == event.id,
                    onApprove: { await approve(collection: "events", id: event.id) },
                    onReject: {
                        pendingRejection = Rejection(
                            collection: "events", id: event.id, label: "“\(event.title)”"
                        )
                    }
                )
            }
        }

        SectionHeading(text: "Pending lore (\(pendingMemories.count))")
        if pendingMemories.isEmpty {
            EmptyNote("Nothing waiting.")
        } else {
            ForEach(pendingMemories) { memory in
                PendingCard(
                    title: memory.title,
                    subtitle: "\(memory.author) · \(EventDates.formatShort(memory.date))",
                    detail: memory.text,
                    footnote: nil,
                    isBusy: busyId == memory.id,
                    onApprove: { await approve(collection: "memories", id: memory.id) },
                    onReject: {
                        pendingRejection = Rejection(
                            collection: "memories", id: memory.id, label: "“\(memory.title)”"
                        )
                    }
                )
            }
        }

        SectionHeading(text: "Pending squad (\(pendingSquad.count))")
        if pendingSquad.isEmpty {
            EmptyNote("Nothing waiting.")
        } else {
            ForEach(pendingSquad) { member in
                PendingCard(
                    title: member.name,
                    subtitle: [member.occupation, member.email].filter { !$0.isEmpty }.joined(separator: " · "),
                    detail: member.bio,
                    footnote: nil,
                    isBusy: busyId == member.id,
                    leading: { AnyView(SquadAvatar(member: member, size: 48)) },
                    onApprove: { await approve(collection: "squad", id: member.id) },
                    onReject: {
                        pendingRejection = Rejection(
                            collection: "squad", id: member.id, label: "\(member.name)'s profile"
                        )
                    }
                )
            }
        }
    }

    @ViewBuilder
    private var statusSection: some View {
        SectionHeading(text: "All events")
            .padding(.top, 8)

        if allEvents.isEmpty {
            EmptyNote("No events yet.")
        } else {
            ForEach(allEvents) { event in
                Button {
                    editingEvent = event
                } label: {
                    HStack(alignment: .top, spacing: 12) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(event.title)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Theme.ink)
                                .multilineTextAlignment(.leading)
                            Text(EventDates.formatShort(event.date))
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.muted)
                            if !event.tags.isEmpty {
                                TagChipsView(
                                    tags: event.tags,
                                    labels: Audience.nameMap(snapshot.groups)
                                )
                            }
                            if !event.statusNote.isEmpty {
                                Text(event.statusNote)
                                    .font(.system(size: 13))
                                    .foregroundStyle(Theme.muted)
                                    .multilineTextAlignment(.leading)
                            }
                        }
                        Spacer(minLength: 0)
                        VStack(alignment: .trailing, spacing: 6) {
                            if !event.approved {
                                Text("Pending")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(Theme.amberInk)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 4)
                                    .background(Theme.yellow.opacity(0.22))
                                    .clipShape(Capsule())
                            }
                            StatusPill(status: event.status)
                            Image(systemName: "chevron.right")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Theme.muted)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .cardSurface(padding: 14, cornerRadius: Theme.radiusMedium)
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private var groupsSection: some View {
        HStack {
            SectionHeading(text: "Audience groups")
            Button {
                editingGroup = GroupDraft(id: nil, name: "", emails: [])
            } label: {
                Label("New", systemImage: "plus")
                    .font(.system(size: 14, weight: .semibold))
            }
            .buttonStyle(.plain)
            .foregroundStyle(Theme.blue)
        }
        .padding(.top, 8)

        if snapshot.groups.isEmpty {
            EmptyNote("No groups yet. Create one to invite a private audience.")
        } else {
            ForEach(snapshot.groups) { group in
                Button {
                    editingGroup = GroupDraft(id: group.id, name: group.name, emails: group.emails)
                } label: {
                    HStack(alignment: .top, spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(group.name)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Theme.ink)
                            Text("\(group.emails.count) member\(group.emails.count == 1 ? "" : "s") · \(group.slug)")
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.muted)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.muted)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .cardSurface(padding: 14, cornerRadius: Theme.radiusMedium)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Actions

    private func load() async {
        guard session.isAdmin else {
            isLoading = false
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            snapshot = try await data.fetchAllForAdmin()
            errorMessage = nil
        } catch {
            errorMessage = "Couldn't load admin data. Your account needs admin access in Firestore rules."
        }
    }

    private func approve(collection: String, id: String) async {
        busyId = id
        defer { busyId = nil }
        do {
            try await data.approve(collection: collection, id: id)
            toasts.success("Approved.")
            await load()
            await data.refreshFeed(signedIn: session.isSignedIn)
        } catch {
            toasts.error((error as? LocalizedError)?.errorDescription ?? "Couldn't approve that.")
        }
    }

    private func reject(_ rejection: Rejection) async {
        pendingRejection = nil
        busyId = rejection.id
        defer { busyId = nil }
        do {
            try await data.reject(collection: rejection.collection, id: rejection.id)
            toasts.info("Rejected and deleted.")
            await load()
            await data.refreshFeed(signedIn: session.isSignedIn)
        } catch {
            toasts.error((error as? LocalizedError)?.errorDescription ?? "Couldn't reject that.")
        }
    }

    private func setReportStatus(_ report: ContentReport, to status: ReportStatus) async {
        busyId = report.id
        defer { busyId = nil }
        do {
            try await data.setReportStatus(id: report.id, status: status)
            toasts.success(status == .reviewed ? "Marked reviewed." : "Reopened.")
            await load()
        } catch {
            toasts.error(
                (error as? LocalizedError)?.errorDescription ?? "Couldn't update that report."
            )
        }
    }

    private func deleteReportedContent(_ report: ContentReport) async {
        pendingContentDeletion = nil
        busyId = report.id
        defer { busyId = nil }
        do {
            try await data.deleteReportedContent(report)
            toasts.success("Content deleted and the report marked reviewed.")
            await load()
            await data.refreshFeed(signedIn: session.isSignedIn)
        } catch {
            toasts.error(
                (error as? LocalizedError)?.errorDescription ?? "Couldn't delete that content."
            )
        }
    }

    private func dismissReport(_ report: ContentReport) async {
        pendingReportDismissal = nil
        busyId = report.id
        defer { busyId = nil }
        do {
            try await data.deleteReport(id: report.id)
            toasts.info("Report dismissed.")
            await load()
        } catch {
            toasts.error(
                (error as? LocalizedError)?.errorDescription ?? "Couldn't dismiss that report."
            )
        }
    }

    private func saveGroup(id: String?, name: String, emails: [String]) async {
        do {
            try await data.saveGroup(id: id, name: name, emails: emails)
            editingGroup = nil
            toasts.success("Group saved.")
            await load()
            await data.loadGroups()
        } catch {
            toasts.error((error as? LocalizedError)?.errorDescription ?? "Couldn't save that group.")
        }
    }

    private func deleteGroup(id: String?) async {
        guard let id else { return }
        do {
            try await data.deleteGroup(id: id)
            editingGroup = nil
            toasts.info("Group deleted.")
            await load()
            await data.loadGroups()
        } catch {
            toasts.error((error as? LocalizedError)?.errorDescription ?? "Couldn't delete that group.")
        }
    }
}

// MARK: - Supporting types

private struct Rejection: Identifiable {
    let collection: String
    let id: String
    let label: String
}

struct GroupDraft: Identifiable {
    let id: String?
    let name: String
    let emails: [String]

    var isNew: Bool { id == nil }
}

// MARK: - Pending card

private struct PendingCard: View {
    let title: String
    let subtitle: String
    let detail: String
    let footnote: String?
    let isBusy: Bool
    var leading: (() -> AnyView)?
    let onApprove: () async -> Void
    let onReject: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                if let leading { leading() }
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    if !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 0)
            }

            if !detail.isEmpty {
                Text(detail)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.ink.opacity(0.85))
                    .lineLimit(4)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let footnote {
                Text(footnote)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
            }

            HStack(spacing: 10) {
                Button {
                    Task { await onApprove() }
                } label: {
                    Text("Approve")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Theme.green)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .disabled(isBusy)

                Button(action: onReject) {
                    Text("Reject")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.red)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Theme.surface)
                        .clipShape(Capsule())
                        .overlay(Capsule().strokeBorder(Theme.red.opacity(0.5), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(isBusy)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface()
        .opacity(isBusy ? 0.6 : 1)
    }
}
