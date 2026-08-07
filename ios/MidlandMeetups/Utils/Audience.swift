import Foundation

/// Port of `src/lib/audience.ts`.
///
/// Events carry audience-group slugs in `tags`. An event with no tags is public;
/// a tagged event is only visible to admins and to signed-in users whose email is
/// listed on one of those groups. Firestore rules let every signed-in user read
/// `groups`, so this filtering happens client side exactly as it does on the web.
enum Audience {
    static func normalizeEmail(_ email: String?) -> String {
        (email ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    static func parseEmailList(_ raw: String) -> [String] {
        var seen = Set<String>()
        for part in raw.components(separatedBy: CharacterSet(charactersIn: "\n,;")) {
            let email = normalizeEmail(part)
            if !email.isEmpty, email.contains("@") { seen.insert(email) }
        }
        return seen.sorted()
    }

    static func slugify(_ name: String) -> String {
        let lowered = name.trimmingCharacters(in: .whitespaces).lowercased()
        var out = ""
        var lastWasDash = false
        for ch in lowered {
            if ch.isLetter && ch.isASCII || ch.isNumber && ch.isASCII {
                out.append(ch)
                lastWasDash = false
            } else if !lastWasDash {
                out.append("-")
                lastWasDash = true
            }
        }
        while out.hasPrefix("-") { out.removeFirst() }
        while out.hasSuffix("-") { out.removeLast() }
        return out.isEmpty ? "group" : out
    }

    /// Groups that include this email.
    static func groups(_ groups: [AudienceGroup], for email: String?) -> [AudienceGroup] {
        let email = normalizeEmail(email)
        guard !email.isEmpty else { return [] }
        return groups.filter { $0.emails.contains(email) }
    }

    static func canView(
        _ event: MeetupEvent,
        userEmail: String?,
        isAdmin: Bool,
        groups: [AudienceGroup]
    ) -> Bool {
        if event.tags.isEmpty { return true }   // public
        if isAdmin { return true }
        let email = normalizeEmail(userEmail)
        guard !email.isEmpty else { return false }
        return event.tags.contains { slug in
            guard let group = groups.first(where: { $0.slug == slug || $0.id == slug }) else {
                return false
            }
            return group.emails.contains(email)
        }
    }

    static func filter(
        _ events: [MeetupEvent],
        userEmail: String?,
        isAdmin: Bool,
        groups: [AudienceGroup]
    ) -> [MeetupEvent] {
        events.filter { canView($0, userEmail: userEmail, isAdmin: isAdmin, groups: groups) }
    }

    /// slug (and id) → display name, for rendering tag chips.
    static func nameMap(_ groups: [AudienceGroup]) -> [String: String] {
        var map: [String: String] = [:]
        for group in groups {
            map[group.slug] = group.name
            map[group.id] = group.name
        }
        return map
    }
}
