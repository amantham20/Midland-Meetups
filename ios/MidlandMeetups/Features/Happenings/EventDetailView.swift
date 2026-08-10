import SwiftUI

/// Port of `EventModal.tsx`. A pushed screen rather than a modal — on a phone the
/// modal's scrolling body is just a worse version of a navigation push.
struct EventDetailView: View {
    let event: MeetupEvent

    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data
    @Environment(ToastCenter.self) private var toasts

    @State private var byOther = false
    @State private var otherName = ""
    @State private var isSaving = false
    @State private var statusMessage = ""
    @State private var isAddingToCalendar = false
    @State private var isEditing = false

    private var mine: Rsvp? {
        guard let uid = session.uid else { return nil }
        return data.rsvps.first { $0.eventId == event.id && $0.userId == uid }
    }

    /// Whoever submitted it and whoever is tagged as host can fix their own
    /// event; admins can fix any.
    private var canEdit: Bool {
        guard let uid = session.uid else { return false }
        return session.isAdmin || event.createdBy == uid || event.hostUserId == uid
    }

    private var rsvpName: String {
        let chosen = byOther ? otherName : session.preferredName
        return chosen.trimmingCharacters(in: .whitespaces)
    }

    private var goingCount: Int {
        data.rsvps.filter { $0.eventId == event.id && $0.status == .going }.count
    }

    private var notGoingCount: Int {
        data.rsvps.filter { $0.eventId == event.id && $0.status == .notGoing }.count
    }

    var body: some View {
        Screen(spacing: 18) {
            StatusPill(status: event.status)

            Text(event.title)
                .font(Theme.display(28))
                .tracking(-0.5)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 7) {
                MetaRow(symbol: "calendar", text: EventDates.formatLong(event.date))
                MetaRow(symbol: "clock", text: EventDates.formatTime(event.time))
                MetaRow(symbol: "mappin.and.ellipse", text: event.location)
                MetaRow(symbol: "person", text: "Hosted by \(event.host)")
            }

            if !event.statusNote.isEmpty {
                Text("**Update:** \(event.statusNote)")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Theme.surface2)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMedium, style: .continuous))
            }

            if !event.description.isEmpty {
                Text(event.description)
                    .font(.system(size: 16))
                    .foregroundStyle(Theme.ink)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack(spacing: 10) {
                Button {
                    Task { await addToCalendar() }
                } label: {
                    Label(
                        isAddingToCalendar ? "Adding…" : "Add to Calendar",
                        systemImage: "calendar.badge.plus"
                    )
                }
                .buttonStyle(SecondaryButtonStyle(tint: Theme.blue))
                .disabled(isAddingToCalendar)

                if canEdit {
                    Button {
                        isEditing = true
                    } label: {
                        Label("Edit event", systemImage: "pencil")
                    }
                    .buttonStyle(SecondaryButtonStyle())
                }
            }

            rsvpCard
        }
        .navigationTitle(event.title)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            // An RSVP saved under a different name keeps that name in view.
            if let saved = mine?.name,
               saved.caseInsensitiveCompare(session.preferredName) != .orderedSame {
                byOther = true
                otherName = saved
            }
        }
        .sheet(isPresented: $isEditing) {
            NavigationStack {
                EventEditSheet(
                    event: event,
                    groups: data.groups,
                    myName: session.preferredName,
                    myUserId: session.uid ?? ""
                ) {
                    await data.loadEvents()
                    if let uid = session.uid {
                        await data.loadMyEvents(userId: uid)
                    }
                }
            }
        }
    }

    // MARK: - RSVP

    private var rsvpCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Are you going?")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.ink)

            if !session.isSignedIn {
                SignInPromptInline(message: "Sign in to RSVP and keep your name on the list.")
            } else {
                AttributionField(
                    label: "Name shown on RSVPs",
                    myName: session.preferredName,
                    selfHint: "your account name",
                    toggleLabel: "Show a different name",
                    otherLabel: "Name to show",
                    otherPlaceholder: "Your name",
                    byOther: $byOther,
                    otherName: $otherName
                )

                HStack(spacing: 10) {
                    rsvpButton(
                        title: "I'm going",
                        value: .going,
                        activeColor: Theme.green
                    )
                    rsvpButton(
                        title: "Can't make it",
                        value: .notGoing,
                        activeColor: Theme.muted
                    )
                }
            }

            Text(footerText)
                .font(.system(size: 14))
                .foregroundStyle(Theme.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface()
    }

    private func rsvpButton(title: String, value: RsvpStatus, activeColor: Color) -> some View {
        let isActive = mine?.status == value
        return Button {
            Task { await submitRsvp(value) }
        } label: {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(isActive ? Color.white : Theme.ink)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 11)
                .background(isActive ? activeColor : Theme.surface)
                .clipShape(Capsule())
                .overlay(
                    Capsule().strokeBorder(isActive ? activeColor : Theme.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .disabled(isSaving)
    }

    private var footerText: String {
        if !statusMessage.isEmpty { return statusMessage }
        if goingCount > 0 || notGoingCount > 0 {
            return "\(goingCount) going · \(notGoingCount) can't make it"
        }
        return "Be the first to say you're in."
    }

    private func submitRsvp(_ value: RsvpStatus) async {
        guard let uid = session.uid else {
            toasts.info("Sign in to RSVP.")
            return
        }
        let displayName = rsvpName.isEmpty ? session.preferredName : rsvpName
        guard !displayName.isEmpty else {
            statusMessage = "Add your name first."
            toasts.info("Add your name first.")
            return
        }

        // Tapping the active choice clears the RSVP, same as the web toggle.
        let next: RsvpStatus? = mine?.status == value ? nil : value

        isSaving = true
        statusMessage = "Saving…"
        defer { isSaving = false }

        do {
            try await data.setRsvp(
                eventId: event.id,
                userId: uid,
                name: displayName,
                status: next
            )
            let message: String
            switch next {
            case .going: message = "You're going!"
            case .notGoing: message = "Marked as not going."
            case nil: message = "RSVP cleared."
            }
            statusMessage = message
            toasts.success(message)
        } catch {
            let message = "Couldn't save that — check your connection and try again."
            statusMessage = message
            toasts.error(message)
        }
    }

    // MARK: - Calendar

    private func addToCalendar() async {
        isAddingToCalendar = true
        defer { isAddingToCalendar = false }

        switch await CalendarService.add(event) {
        case .added:
            toasts.success("Added to your calendar.")
        case .accessDenied:
            toasts.error("Calendar access is off. Turn it on in Settings to add events.")
        case .noCalendar:
            toasts.error("Couldn't find a calendar to add this to.")
        case .badDate:
            toasts.error("Couldn't read that event's date.")
        }
    }
}

/// A compact sign-in nudge for use inside an existing card.
struct SignInPromptInline: View {
    let message: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(message)
                .font(.system(size: 14))
                .foregroundStyle(Theme.muted)
                .fixedSize(horizontal: false, vertical: true)
            NavigationLink { LoginView() } label: {
                Text("Sign in")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.blue)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
