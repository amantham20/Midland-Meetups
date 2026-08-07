import Foundation
import Observation

/// Port of `src/lib/firebase/data.ts`.
///
/// The web client keeps everything live with `onSnapshot`. Firestore's realtime
/// channel is gRPC-only, so over REST the app refreshes on appear, on pull-to-refresh,
/// and whenever it returns to the foreground, and re-reads immediately after its own
/// writes so the UI never lags behind an action the user just took.
@MainActor
@Observable
final class DataStore {
    var events: [MeetupEvent] = []
    var rsvps: [Rsvp] = []
    var memories: [Memory] = []
    var squad: [SquadMember] = []
    var groups: [AudienceGroup] = []

    var eventsError: String?
    var memoriesError: String?
    var squadError: String?

    private(set) var hasLoadedFeed = false
    private(set) var isRefreshing = false

    private let client: FirestoreClient?

    init() {
        client = AppConfig.firebase.map(FirestoreClient.init(config:))
    }

    private func requireClient() throws -> FirestoreClient {
        guard let client else { throw FirebaseError(message: "Firebase isn't configured.") }
        return client
    }

    // MARK: - Public feeds

    /// Everything the signed-out board needs. `groups` is layered on separately
    /// because Firestore rules only expose it to signed-in users.
    func refreshFeed(signedIn: Bool) async {
        guard client != nil else {
            hasLoadedFeed = true
            return
        }
        isRefreshing = true
        defer {
            isRefreshing = false
            hasLoadedFeed = true
        }

        async let eventsTask: Void = loadEvents()
        async let rsvpsTask: Void = loadRsvps()
        async let memoriesTask: Void = loadMemories()
        async let squadTask: Void = loadSquad()
        _ = await (eventsTask, rsvpsTask, memoriesTask, squadTask)

        if signedIn {
            await loadGroups()
        } else {
            groups = []
        }
    }

    func loadEvents() async {
        guard let client else { return }
        do {
            let query = FirestoreQuery("events")
                .whereEqualTo("approved", .boolean(true))
                .order(by: "date")
            events = try await client.run(query).map(MeetupEvent.init(document:))
            eventsError = nil
        } catch {
            eventsError = "Couldn't load events. Check your connection and Firestore rules."
        }
    }

    func loadRsvps() async {
        guard let client else { return }
        rsvps = ((try? await client.list("rsvps")) ?? []).map(Rsvp.init(document:))
    }

    func loadMemories() async {
        guard let client else { return }
        do {
            let query = FirestoreQuery("memories")
                .whereEqualTo("approved", .boolean(true))
                .order(by: "date", descending: true)
            memories = try await client.run(query).map(Memory.init(document:))
            memoriesError = nil
        } catch {
            memoriesError = "Couldn't load the archive."
        }
    }

    func loadSquad() async {
        guard let client else { return }
        do {
            let query = FirestoreQuery("squad").whereEqualTo("approved", .boolean(true))
            squad = try await client.run(query)
                .map(SquadMember.init(document:))
                .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            squadError = nil
        } catch {
            squadError = "Couldn't load the squad."
        }
    }

    func loadGroups() async {
        guard let client else { return }
        guard let docs = try? await client.list("groups") else { return }
        groups = docs
            .map(AudienceGroup.init(document:))
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    // MARK: - Submissions

    func submitEvent(
        title: String,
        host: String,
        date: String,
        time: String,
        location: String,
        description: String,
        userId: String,
        tags: [String]
    ) async throws {
        let client = try requireClient()
        try await client.create(in: "events", fields: [
            "title": .string(title),
            "host": .string(host),
            "date": .string(date),
            "time": .string(time),
            "location": .string(location),
            "description": .string(description),
            "status": .string(EventStatus.confirmed.rawValue),
            "statusNote": .string(""),
            "approved": .boolean(false),
            "reminderSent": .boolean(false),
            "tags": .array(tags.map { .string($0) }),
            "createdBy": .string(userId),
            "createdAt": .timestamp(Date()),
        ])
    }

    func submitMemory(title: String, author: String, text: String, userId: String) async throws {
        let client = try requireClient()
        try await client.create(in: "memories", fields: [
            "title": .string(title),
            "author": .string(author),
            "text": .string(text),
            "date": .string(EventDates.todayISO),
            "approved": .boolean(false),
            "createdBy": .string(userId),
            "createdAt": .timestamp(Date()),
        ])
    }

    /// One RSVP document per user per event: `rsvps/{userId}_{eventId}`.
    func setRsvp(eventId: String, userId: String, name: String, status: RsvpStatus?) async throws {
        let client = try requireClient()
        let documentId = "\(userId)_\(eventId)"

        guard let status else {
            try await client.delete("rsvps", documentId)
            await loadRsvps()
            return
        }

        try await client.merge("rsvps", documentId, fields: [
            "eventId": .string(eventId),
            "userId": .string(userId),
            "name": .string(name),
            "status": .string(status.rawValue),
            "updatedAt": .timestamp(Date()),
        ])
        await loadRsvps()
    }

    // MARK: - Squad profile

    func submitSquadMember(
        name: String,
        occupation: String,
        age: String,
        gender: String,
        socialLink: String,
        bio: String,
        email: String,
        photoBase64: String,
        photoMimeType: String,
        userId: String
    ) async throws {
        let client = try requireClient()
        let email = Audience.normalizeEmail(email)
        try await client.create(in: "squad", fields: [
            "name": .string(name),
            "occupation": .string(occupation),
            "age": .string(age),
            "gender": .string(gender),
            "socialLink": .string(socialLink),
            "bio": .string(bio),
            "email": .string(email),
            // Email is the match key; stamp the uid alongside it.
            "userId": .string(email.isEmpty ? "" : userId),
            "photoBase64": .string(photoBase64),
            "photoMimeType": .string(photoMimeType.isEmpty ? "image/jpeg" : photoMimeType),
            "photoUrl": .string(""),
            "approved": .boolean(false),
            "createdBy": .string(userId),
            "createdAt": .timestamp(Date()),
        ])
    }

    /// Updates the profile matched to the signed-in email. `photoBase64 == nil`
    /// keeps whatever photo is already on the document.
    func updateMySquadProfile(
        memberId: String,
        userId: String,
        name: String,
        occupation: String,
        age: String,
        gender: String,
        socialLink: String,
        bio: String,
        email: String,
        photoBase64: String?,
        photoMimeType: String?
    ) async throws {
        let client = try requireClient()
        let email = Audience.normalizeEmail(email)

        var fields: [String: FirestoreValue] = [
            "name": .string(name),
            "occupation": .string(occupation),
            "age": .string(age),
            "gender": .string(gender),
            "socialLink": .string(socialLink),
            "bio": .string(bio),
            "email": .string(email),
            "userId": .string(email.isEmpty ? "" : userId),
            "createdBy": .string(email.isEmpty ? "" : userId),
            "updatedAt": .timestamp(Date()),
        ]
        if let photoBase64, !photoBase64.isEmpty {
            fields["photoBase64"] = .string(photoBase64)
            fields["photoMimeType"] = .string(photoMimeType ?? "image/jpeg")
        }

        try await client.merge("squad", memberId, fields: fields)
    }

    /// The profile this user may edit — matched by sign-in email, exactly as the
    /// Firestore rules do. Stamps `userId` when it's missing so the doc stays linked.
    func findEditableSquadProfile(userId: String, email: String?) async -> SquadMember? {
        guard let client else { return nil }
        let email = Audience.normalizeEmail(email)
        guard !email.isEmpty, !userId.isEmpty else { return nil }

        let query = FirestoreQuery("squad").whereEqualTo("email", .string(email))
        guard
            let docs = try? await client.run(query),
            let first = docs.first
        else { return nil }

        var member = SquadMember(document: first)
        if member.userId != userId {
            let stamped = try? await client.merge("squad", member.id, fields: [
                "userId": .string(userId),
                "createdBy": .string(userId),
                "updatedAt": .timestamp(Date()),
            ])
            if stamped != nil { member.userId = userId }
        }
        return member
    }

    // MARK: - Admin

    func fetchAllForAdmin() async throws -> AdminSnapshot {
        let client = try requireClient()
        async let events = client.list("events")
        async let memories = client.list("memories")
        async let squad = client.list("squad")
        async let groups = client.list("groups")

        return try await AdminSnapshot(
            events: events.map(MeetupEvent.init(document:))
                .sorted { $0.date > $1.date },
            memories: memories.map(Memory.init(document:))
                .sorted { $0.date > $1.date },
            squad: squad.map(SquadMember.init(document:))
                .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending },
            groups: groups.map(AudienceGroup.init(document:))
                .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        )
    }

    func approve(collection: String, id: String) async throws {
        let client = try requireClient()
        try await client.merge(collection, id, fields: ["approved": .boolean(true)])
    }

    /// Rejecting a submission deletes the document, matching `rejectDocument`.
    func reject(collection: String, id: String) async throws {
        let client = try requireClient()
        try await client.delete(collection, id)
    }

    func updateEventStatus(eventId: String, status: EventStatus, statusNote: String) async throws {
        let client = try requireClient()
        try await client.merge("events", eventId, fields: [
            "status": .string(status.rawValue),
            "statusNote": .string(statusNote.trimmingCharacters(in: .whitespacesAndNewlines)),
        ])
    }

    func updateEventTags(eventId: String, tags: [String]) async throws {
        let client = try requireClient()
        try await client.merge("events", eventId, fields: [
            "tags": .array(tags.map { .string($0) }),
        ])
    }

    @discardableResult
    func saveGroup(id: String?, name: String, emails: [String]) async throws -> String {
        let client = try requireClient()
        let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { throw FirebaseError(message: "Group name is required.") }

        let slug = Audience.slugify(name)
        let documentId = id ?? slug
        let emails = emails.map(Audience.normalizeEmail).filter { $0.contains("@") }

        try await client.merge("groups", documentId, fields: [
            "name": .string(name),
            "slug": .string(slug),
            "emails": .array(emails.map { .string($0) }),
            "updatedAt": .timestamp(Date()),
        ])
        return documentId
    }

    func deleteGroup(id: String) async throws {
        let client = try requireClient()
        try await client.delete("groups", id)
    }

    /// Admin edit of any squad member.
    ///
    /// The web build resolves email → Auth uid through a `firebase-admin` route;
    /// the app has no server, so it leaves `userId` alone. Ownership matching in
    /// `firestore.rules` is email-based, so editing stays correct either way.
    func adminUpdateSquadMember(
        memberId: String,
        name: String,
        occupation: String,
        age: String,
        gender: String,
        socialLink: String,
        bio: String,
        email: String,
        approved: Bool
    ) async throws {
        let client = try requireClient()
        try await client.merge("squad", memberId, fields: [
            "name": .string(name),
            "occupation": .string(occupation),
            "age": .string(age),
            "gender": .string(gender),
            "socialLink": .string(socialLink),
            "bio": .string(bio),
            "email": .string(Audience.normalizeEmail(email)),
            "approved": .boolean(approved),
            "updatedAt": .timestamp(Date()),
        ])
    }
}

struct AdminSnapshot {
    var events: [MeetupEvent] = []
    var memories: [Memory] = []
    var squad: [SquadMember] = []
    var groups: [AudienceGroup] = []
}
