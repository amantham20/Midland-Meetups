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
    /// Display name of the host, tagged member or free text.
    var host: String
    /// Auth uid of the tagged host, when the host is a member rather than a
    /// typed-in name. A tagged host can edit the event like its submitter.
    var hostUserId: String
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
        hostUserId = document.string("hostUserId")
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

/// A member you can tag as host: an approved squad profile with an Auth account.
struct HostCandidate: Identifiable, Hashable {
    var userId: String
    var name: String

    var id: String { userId }
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

// MARK: - Report

/// What a report points at. `member` covers both a squad profile and the person
/// behind it — reporting someone and reporting their profile is one action here.
/// `other` is the catch-all filed from More → Report, where there is no single
/// document to attach to.
enum ReportTargetType: String, Codable, Hashable {
    case event
    case memory
    case member
    case other

    var label: String {
        switch self {
        case .event: return "Event"
        case .memory: return "Lore story"
        case .member: return "Member"
        case .other: return "General"
        }
    }

    /// The collection the target lives in, when it has one.
    var collection: String? {
        switch self {
        case .event: return "events"
        case .memory: return "memories"
        case .member: return "squad"
        case .other: return nil
        }
    }
}

enum ReportReason: String, CaseIterable, Codable, Hashable {
    case harassment
    case hate
    case sexual
    case violence
    case spam
    case impersonation
    case illegal
    case other

    var label: String {
        switch self {
        case .harassment: return "Harassment or bullying"
        case .hate: return "Hate speech or discrimination"
        case .sexual: return "Sexual or explicit content"
        case .violence: return "Violence or threats"
        case .spam: return "Spam or a scam"
        case .impersonation: return "Impersonation or a fake profile"
        case .illegal: return "Illegal or dangerous activity"
        case .other: return "Something else"
        }
    }

    static func label(for raw: String) -> String {
        ReportReason(rawValue: raw)?.label ?? raw
    }
}

enum ReportStatus: String, Codable, Hashable {
    case open
    case reviewed
}

/// A filed report. Only organizers can read these — see `firestore.rules`.
struct ContentReport: Identifiable, Hashable {
    var id: String
    var targetType: ReportTargetType
    /// Document id of the reported content; empty for a general report.
    var targetId: String
    /// Title or name captured when filed, so the queue reads even after a delete.
    var targetLabel: String
    var reason: String
    var details: String
    var reportedBy: String
    var reporterEmail: String
    var reporterName: String
    var status: ReportStatus
    var createdAt: Date?

    init(document: FirestoreDocument) {
        id = document.id
        targetType = ReportTargetType(rawValue: document.string("targetType")) ?? .other
        targetId = document.string("targetId")
        targetLabel = document.string("targetLabel")
        reason = document.string("reason")
        details = document.string("details")
        reportedBy = document.string("reportedBy")
        reporterEmail = document.string("reporterEmail")
        reporterName = document.string("reporterName")
        status = ReportStatus(rawValue: document.string("status")) ?? .open
        createdAt = document.date("createdAt")
    }
}

/// What a report is being filed against, handed to the report sheet.
struct ReportTarget: Identifiable, Hashable {
    var type: ReportTargetType
    /// Document id of the thing being reported; empty for a general report.
    var id: String = ""
    /// Title or name, shown back to the reporter and stored with the report.
    var label: String = ""

    static let general = ReportTarget(type: .other)

    static func event(_ event: MeetupEvent) -> ReportTarget {
        ReportTarget(type: .event, id: event.id, label: event.title)
    }

    static func memory(_ memory: Memory) -> ReportTarget {
        ReportTarget(type: .memory, id: memory.id, label: memory.title)
    }

    static func member(_ member: SquadMember) -> ReportTarget {
        ReportTarget(type: .member, id: member.id, label: member.name)
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
