import SwiftUI

/// Port of `EventCard.tsx`.
struct EventCardView: View {
    let event: MeetupEvent
    let rsvps: [Rsvp]
    var myUserId: String?
    var tagLabels: [String: String] = [:]

    private var mine: Rsvp? {
        guard let myUserId else { return nil }
        return rsvps.first { $0.eventId == event.id && $0.userId == myUserId }
    }

    private var goingCount: Int {
        rsvps.filter { $0.eventId == event.id && $0.status == .going }.count
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                Text(event.title)
                    .font(Theme.display(18))
                    .foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                StatusPill(status: event.status)
            }

            if !event.tags.isEmpty {
                TagChipsView(tags: event.tags, labels: tagLabels)
            }

            VStack(alignment: .leading, spacing: 5) {
                MetaRow(symbol: "calendar", text: EventDates.formatShort(event.date))
                MetaRow(symbol: "clock", text: EventDates.formatTime(event.time))
                MetaRow(symbol: "mappin.and.ellipse", text: event.location)
            }

            if !event.description.isEmpty {
                Text(event.description)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.ink.opacity(0.8))
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Divider().overlay(Theme.border)

            HStack {
                Text("Hosted by \(event.host)")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
                Spacer(minLength: 8)
                Text(trailingLabel)
                    .font(.system(size: 13, weight: mine?.status == .going ? .semibold : .medium))
                    .foregroundStyle(mine?.status == .going ? Theme.green : Theme.muted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface()
    }

    private var trailingLabel: String {
        if let mine {
            return mine.status == .going ? "✓ You're going" : "Not going"
        }
        return goingCount > 0 ? "\(goingCount) going" : "Tap for details"
    }
}

/// An icon + label line, matching the calendar / clock / pin rows on the web card.
struct MetaRow: View {
    let symbol: String
    let text: String
    var color: Color = Theme.muted

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 7) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .medium))
                .frame(width: 16)
            Text(text)
                .font(.system(size: 14))
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .foregroundStyle(color)
    }
}
