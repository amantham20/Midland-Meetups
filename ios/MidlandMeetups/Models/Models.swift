import Foundation

// Swift ports of `src/lib/types.ts`, plus the Firestore document mapping that
// `src/lib/firebase/data.ts` does with its `mapEvent` / `mapSquad` helpers.

enum EventStatus: String, CaseIterable, Codable, Hashable {
    case confirmed
    case rainDelay = "rain-delay"
    case canceled
    case relocated

    var label: String {
        switch self {
        case .confirmed: return "Confirmed"
        case .rainDelay: return "Rain delay"
        case .canceled: return "Canceled"
        case .relocated: return "Relocated"
        }
    }
}

enum RsvpStatus: String, Codable, Hashable {
    case going
    case notGoing = "not-going"
}

// MARK: - Event

struct MeetupEvent: Identifiable, Hashable {
    var id: String
    var title: String
    var host: String
    /// `YYYY-MM-DD`
    var date: String
    /// Display time, e.g. "6:30 PM"
    var time: String
    var location: String
    var description: String
    var status: EventStatus
    var statusNote: String
    var approved: Bool
    /// Audience group slugs. Empty = visible to everyone.
    var tags: [String]
    var createdBy: String?

    init(document: FirestoreDocument) {
        id = document.id
        title = document.string("title")
        host = document.string("host")
        date = document.string("date")
        time = document.string("time")
        location = document.string("location")
        description = document.string("description")
        status = EventStatus(rawValue: document.string("status")) ?? .confirmed
        statusNote = document.string("statusNote")
        approved = document.bool("approved")
        tags = document.stringArray("tags")
        createdBy = document.optionalString("createdBy")
    }
}

// MARK: - Lore

struct Memory: Identifiable, Hashable {
    var id: String
    var title: String
    var author: String
    var date: String
    var text: String
    var approved: Bool
    var createdBy: String?

    init(document: FirestoreDocument) {
        id = document.id
        title = document.string("title")
        author = document.string("author")
        date = document.string("date")
        text = document.string("text")
        approved = document.bool("approved")
        createdBy = document.optionalString("createdBy")
    }
}

// MARK: - Squad

struct SquadMember: Identifiable, Hashable {
    var id: String
    var name: String
    var occupation: String
    var age: String
    var gender: String
    var socialLink: String
    var bio: String
    /// Sign-in email — the primary key for "your profile" matching.
    var email: String
    var userId: String?
    /// Compressed JPEG base64, stored inline on the document (no Cloud Storage).
    var photoBase64: String
    var photoMimeType: String
    var photoUrl: String
    var approved: Bool

    init(document: FirestoreDocument) {
        id = document.id
        name = document.string("name")
        occupation = document.string("occupation")
        age = document.string("age")
        gender = document.string("gender")
        socialLink = document.string("socialLink")
        bio = document.string("bio")
        email = Audience.normalizeEmail(document.string("email"))
        // userId is canonical; older docs only carry createdBy.
        userId = document.optionalString("userId") ?? document.optionalString("createdBy")
        photoBase64 = document.string("photoBase64")
        let mime = document.string("photoMimeType")
        photoMimeType = mime.isEmpty ? "image/jpeg" : mime
        photoUrl = document.string("photoUrl")
        approved = document.bool("approved")
    }
}

// MARK: - RSVP

struct Rsvp: Identifiable, Hashable {
    var id: String
    var eventId: String
    var userId: String
    var name: String
    var status: RsvpStatus

    init(document: FirestoreDocument) {
        id = document.id
        eventId = document.string("eventId")
        userId = document.string("userId")
        name = document.string("name")
        status = RsvpStatus(rawValue: document.string("status")) ?? .going
    }
}

// MARK: - Audience group

struct AudienceGroup: Identifiable, Hashable {
    var id: String
    var name: String
    /// Stable lowercase slug referenced by `events.tags`.
    var slug: String
    var emails: [String]

    init(document: FirestoreDocument) {
        id = document.id
        let name = document.string("name")
        self.name = name.isEmpty ? document.id : name
        let slug = document.string("slug")
        self.slug = slug.isEmpty ? document.id : slug
        emails = document.stringArray("emails")
            .map(Audience.normalizeEmail)
            .filter { $0.contains("@") }
    }
}
