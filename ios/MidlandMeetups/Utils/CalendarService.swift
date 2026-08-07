import EventKit
import Foundation

/// The web offers a Google Calendar template link. On iOS the native equivalent is
/// writing straight into the user's own calendar.
///
/// This deliberately stays on **write-only** access. `EKEventEditViewController`
/// would let the user review the event first, but it needs full read access to
/// every calendar on the device — far too much for a meetup board — and renders
/// blank without it. Saving directly needs only the permission we actually use.
enum CalendarService {
    static let store = EKEventStore()

    enum AddResult {
        case added
        case accessDenied
        case noCalendar
        case badDate
    }

    static func add(_ meetup: MeetupEvent) async -> AddResult {
        guard (try? await store.requestWriteOnlyAccessToEvents()) == true else {
            return .accessDenied
        }
        guard let interval = EventDates.interval(for: meetup) else {
            return .badDate
        }
        guard let calendar = store.defaultCalendarForNewEvents else {
            return .noCalendar
        }

        let event = EKEvent(eventStore: store)
        event.calendar = calendar
        event.title = meetup.title
        event.location = meetup.location
        event.startDate = interval.start
        event.endDate = interval.end
        event.isAllDay = interval.isAllDay
        event.notes = notes(for: meetup)

        do {
            try store.save(event, span: .thisEvent, commit: true)
            return .added
        } catch {
            return .noCalendar
        }
    }

    private static func notes(for meetup: MeetupEvent) -> String {
        var notes = meetup.description
        if !meetup.statusNote.isEmpty {
            notes += "\n\nUpdate: \(meetup.statusNote)"
        }
        if !meetup.host.isEmpty {
            notes += "\n\nHosted by \(meetup.host)"
        }
        return notes
    }
}
