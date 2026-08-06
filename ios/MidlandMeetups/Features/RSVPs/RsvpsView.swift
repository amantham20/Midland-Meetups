import SwiftUI

/// Port of `src/app/rsvps/page.tsx` — every event and who's said they're in.
struct RsvpsView: View {
    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data

    private var visible: [MeetupEvent] {
        Audience.filter(
            data.events,
            userEmail: session.email,
            isAdmin: session.isAdmin,
            groups: data.groups
        )
    }

    private var upcoming: [MeetupEvent] {
        let today = EventDates.todayISO
        return visible.filter { $0.date >= today }.sorted { $0.date < $1.date }
    }

    private var past: [MeetupEvent] {
        let today = EventDates.todayISO
        return visible.filter { $0.date < today }.sorted { $0.date > $1.date }
    }

    private var tagLabels: [String: String] { Audience.nameMap(data.groups) }

    var body: some View {
        Screen {
            PageHeaderView(
                kicker: "Who's going",
                title: "RSVPs",
                lede: "Every event, and who's said they're going or can't make it."
            )

            if !AppConfig.isConfigured {
                ConfigNotice()
            } else if !data.hasLoadedFeed {
                EmptyNote("Loading RSVPs…")
            } else if let error = data.eventsError {
                EmptyNote(error)
            } else if visible.isEmpty {
                EmptyNote("No events yet.")
            } else {
                SectionHeading(text: "Upcoming")
                if upcoming.isEmpty {
                    EmptyNote("Nothing upcoming.")
                } else {
                    ForEach(upcoming) { event in
                        EventRsvpCard(event: event, rsvps: data.rsvps, tagLabels: tagLabels)
                    }
                }

                if !past.isEmpty {
                    SectionHeading(text: "Past")
                        .padding(.top, 12)
                    ForEach(past) { event in
                        EventRsvpCard(event: event, rsvps: data.rsvps, tagLabels: tagLabels)
                    }
                }
            }
        }
        .navigationTitle("RSVPs")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable {
            await data.refreshFeed(signedIn: session.isSignedIn)
        }
    }
}

private struct EventRsvpCard: View {
    let event: MeetupEvent
    let rsvps: [Rsvp]
    var tagLabels: [String: String] = [:]

    private var going: [Rsvp] {
        rsvps.filter { $0.eventId == event.id && $0.status == .going }
    }

    private var notGoing: [Rsvp] {
        rsvps.filter { $0.eventId == event.id && $0.status == .notGoing }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(event.title)
                        .font(Theme.display(18))
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)

                    HStack(spacing: 14) {
                        Label(EventDates.formatShort(event.date), systemImage: "calendar")
                        Label(EventDates.formatTime(event.time), systemImage: "clock")
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)

                    if !event.tags.isEmpty {
                        TagChipsView(tags: event.tags, labels: tagLabels)
                    }
                }
                Spacer(minLength: 0)
                StatusPill(status: event.status)
            }

            AttendeeColumn(
                title: "Going (\(going.count))",
                titleColor: Theme.green,
                names: going.map(\.name)
            )
            AttendeeColumn(
                title: "Can't make it (\(notGoing.count))",
                titleColor: Theme.muted,
                names: notGoing.map(\.name)
            )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface()
    }
}

private struct AttendeeColumn: View {
    let title: String
    let titleColor: Color
    let names: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(titleColor)

            if names.isEmpty {
                Text("No one yet")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted)
            } else {
                ForEach(Array(names.enumerated()), id: \.offset) { _, name in
                    Text(name)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.ink)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
