import Foundation

/// Port of the date/time helpers in `src/lib/utils.ts`.
///
/// Events store a plain `YYYY-MM-DD` date and a free-text time; the web parses
/// them in the viewer's local zone (`new Date(iso + "T00:00:00")`) and this does
/// the same so a Midland evening stays a Midland evening.
enum EventDates {
    private static let isoDay: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static func localized(_ template: String) -> DateFormatter {
        let f = DateFormatter()
        f.setLocalizedDateFormatFromTemplate(template)
        return f
    }

    private static let shortDay = localized("EEEMMMd")
    private static let longDay = localized("EEEEMMMMdyyyy")

    static func date(fromISO iso: String) -> Date? {
        isoDay.date(from: iso)
    }

    static func iso(from date: Date) -> String {
        isoDay.string(from: date)
    }

    /// "Mon, Aug 5"
    static func formatShort(_ iso: String) -> String {
        guard let date = date(fromISO: iso) else { return iso }
        return shortDay.string(from: date)
    }

    /// "Monday, August 5, 2026"
    static func formatLong(_ iso: String) -> String {
        guard let date = date(fromISO: iso) else { return iso }
        return longDay.string(from: date)
    }

    static var todayISO: String { iso(from: Date()) }

    /// Today through seven days out, inclusive — the Happenings window.
    static func isWithinNextWeek(_ iso: String) -> Bool {
        guard let day = date(fromISO: iso) else { return false }
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        guard let weekOut = calendar.date(byAdding: .day, value: 7, to: today) else { return false }
        return day >= today && day <= weekOut
    }

    /// Accepts "6:30 PM" and "18:30", matching `parseTimeToHM`.
    static func parseTime(_ raw: String) -> (hour: Int, minute: Int)? {
        let text = raw.trimmingCharacters(in: .whitespaces)

        if let match = text.range(of: #"^(\d{1,2}):(\d{2})\s*([APap][Mm])$"#, options: .regularExpression) {
            let body = String(text[match])
            let parts = body.split(whereSeparator: { $0 == ":" || $0 == " " })
            guard parts.count >= 2, var hour = Int(parts[0]) else { return nil }
            let minuteText = parts[1].prefix(2)
            guard let minute = Int(minuteText) else { return nil }
            let isPM = body.uppercased().hasSuffix("PM")
            if isPM, hour != 12 { hour += 12 }
            if !isPM, hour == 12 { hour = 0 }
            return (hour, minute)
        }

        if text.range(of: #"^\d{1,2}:\d{2}$"#, options: .regularExpression) != nil {
            let parts = text.split(separator: ":")
            guard let hour = Int(parts[0]), let minute = Int(parts[1]) else { return nil }
            return (hour, minute)
        }

        return nil
    }

    /// Normalizes stored times to "6:30 PM"; unparseable values pass through.
    static func formatTime(_ raw: String) -> String {
        guard let hm = parseTime(raw) else { return raw }
        let period = hm.hour >= 12 ? "PM" : "AM"
        let hour12 = hm.hour % 12 == 0 ? 12 : hm.hour % 12
        return String(format: "%d:%02d %@", hour12, hm.minute, period)
    }

    /// Real start/end instants for calendar export. Untimed events fall back to
    /// an all-day span, and timed ones get the web's two-hour default duration.
    static func interval(for event: MeetupEvent) -> (start: Date, end: Date, isAllDay: Bool)? {
        guard let day = date(fromISO: event.date) else { return nil }
        guard let hm = parseTime(event.time) else {
            let end = Calendar.current.date(byAdding: .day, value: 1, to: day) ?? day
            return (day, end, true)
        }
        let calendar = Calendar.current
        guard
            let start = calendar.date(bySettingHour: hm.hour, minute: hm.minute, second: 0, of: day),
            let end = calendar.date(byAdding: .minute, value: 120, to: start)
        else { return nil }
        return (start, end, false)
    }
}
