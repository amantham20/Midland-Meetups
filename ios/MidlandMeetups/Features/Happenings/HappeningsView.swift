import SwiftUI

/// Port of `src/app/page.tsx` — the next seven days, filtered to the audiences
/// this viewer belongs to.
struct HappeningsView: View {
    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data

    private var visibleEvents: [MeetupEvent] {
        Audience.filter(
            data.events,
            userEmail: session.email,
            isAdmin: session.isAdmin,
            groups: data.groups
        )
    }

    private var weekEvents: [MeetupEvent] {
        visibleEvents
            .filter { EventDates.isWithinNextWeek($0.date) }
            .sorted { $0.date < $1.date }
    }

    /// The status ticker: anything this week that isn't simply "confirmed".
    private var tickerUpdates: [MeetupEvent] {
        weekEvents.filter { $0.status != .confirmed && !$0.statusNote.isEmpty }
    }

    private var tagLabels: [String: String] { Audience.nameMap(data.groups) }

    var body: some View {
        Screen {
            PageHeaderView(
                kicker: "Next 7 days",
                title: "Happenings This Week",
                lede: "Everything on the books between now and next week. Tagged events only show if your email is in that group (or you're an admin)."
            )

            if !AppConfig.isConfigured {
                ConfigNotice()
            } else {
                if !tickerUpdates.isEmpty {
                    StatusTicker(events: tickerUpdates)
                }

                if !data.hasLoadedFeed {
                    EmptyNote("Loading the week…")
                } else if let error = data.eventsError {
                    EmptyNote(error)
                } else if weekEvents.isEmpty {
                    EmptyNote(
                        session.isSignedIn
                            ? "Nothing on the board for the next 7 days. Submit an event to get something posted."
                            : "Nothing on the board for the next 7 days (sign in to see tagged group events)."
                    )
                }

                ForEach(weekEvents) { event in
                    NavigationLink(value: event) {
                        EventCardView(
                            event: event,
                            rsvps: data.rsvps,
                            myUserId: session.uid,
                            tagLabels: tagLabels
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .navigationTitle("Happenings")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: MeetupEvent.self) { event in
            EventDetailView(event: event)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    SubmitEventView()
                } label: {
                    Label("Submit an Event", systemImage: "plus")
                }
            }
        }
        .refreshable {
            await data.refreshFeed(signedIn: session.isSignedIn)
        }
    }
}

/// The event status ticker from the web board.
private struct StatusTicker: View {
    let events: [MeetupEvent]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(events) { event in
                HStack(alignment: .top, spacing: 8) {
                    StatusPill(status: event.status)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(event.title)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.ink)
                        Text(event.statusNote)
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface(padding: 14, cornerRadius: Theme.radiusMedium)
    }
}
