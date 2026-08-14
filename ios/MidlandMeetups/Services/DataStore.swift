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
    /// The signed-in account's own submissions, pending ones included.
    var myEvents: [MeetupEvent] = []
    var rsvps: [Rsvp] = []
    var memories: [Memory] = []
    var squad: [SquadMember] = []
    var groups: [AudienceGroup] = []

    var eventsError: String?
    var myEventsError: String?
    var memoriesError: String?
    var squadError: String?

    /// Whose events `myEvents` holds — `nil` until the first load.
    private(set) var myEventsUserId: String?

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

    /// Every event this account is responsible for — the ones it submitted plus
    /// the ones it's tagged as host on — approved or not; the pending ones show
    /// up in no other feed.
    ///
    /// Two single-field queries rather than one `OR`: each matches a clause the
    /// read rule can satisfy on its own, and neither needs a composite index.
    func loadMyEvents(userId: String) async {
        guard let client else { return }
        if myEventsUserId != userId {
            myEvents = []
            myEventsError = nil
        }
        defer { myEventsUserId = userId }
        do {
            let submitted = FirestoreQuery("events")
                .whereEqualTo("createdBy", .string(userId))
            let hosting = FirestoreQuery("events")
                .whereEqualTo("hostUserId", .string(userId))
            async let submittedDocs = client.run(submitted)
            async let hostingDocs = client.run(hosting)
            let documents = try await submittedDocs + hostingDocs

            var byId: [String: MeetupEvent] = [:]
            for document in documents {
                let event = MeetupEvent(document: document)
                byId[event.id] = event
            }
            myEvents = byId.values.sorted { $0.date < $1.date }
            myEventsError = nil
        } catch {
            myEvents = []
            myEventsError = "Couldn't load your events."
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

    /// Approved squad profiles linked to an Auth account — the people who can
    /// be tagged as a host. Profiles with no `userId` have no account to hand
    /// the event to, but their name can still be typed in.
    var hostCandidates: [HostCandidate] {
        squad
            .compactMap { member -> HostCandidate? in
                let name = member.name.trimmingCharacters(in: .whitespaces)
                guard let userId = member.userId, !userId.isEmpty, !name.isEmpty else {
                    return nil
                }
                return HostCandidate(userId: userId, name: name)
            }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
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
        hostUserId: String,
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
            "hostUserId": .string(hostUserId),
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

    // MARK: - Account deletion

    /// The byline left on content whose author has deleted their account.
    static let formerMemberName = "Former member"

    /// Clears this account out of Firestore, ahead of deleting the Auth user.
    ///
    /// Personal records — the squad profile and every RSVP — go outright, as do
    /// submissions still waiting on approval, which nobody else has ever seen.
    /// Content already on the board stays, because other people's plans hang off
    /// it, but the author comes off it: the byline becomes "Former member" and the
    /// uid link is cleared. What remains is `createdBy`, a uid that no longer
    /// resolves to an account.
    ///
    /// Must run while the ID token is still good — every deletion here is matched
    /// against `request.auth.uid` in `firestore.rules`.
    func erasePersonalData(userId: String, email: String?) async throws {
        let client = try requireClient()

        // `rsvps/{userId}_{eventId}` — deletable by the account that owns them.
        let rsvpDocs = try await client.run(
            FirestoreQuery("rsvps").whereEqualTo("userId", .string(userId))
        )
        for document in rsvpDocs {
            try await client.delete("rsvps", document.id)
        }

        // The profile carries the name, email, photo, bio and social link.
        if let profile = await findEditableSquadProfile(userId: userId, email: email) {
            try await client.delete("squad", profile.id)
        }

        try await eraseAuthoredEvents(client: client, userId: userId)
        try await eraseAuthoredMemories(client: client, userId: userId)

        myEvents = []
        myEventsUserId = nil
    }

    /// Submitted and hosted events, deduplicated the way `loadMyEvents` does it.
    private func eraseAuthoredEvents(client: FirestoreClient, userId: String) async throws {
        let submitted = FirestoreQuery("events").whereEqualTo("createdBy", .string(userId))
        let hosting = FirestoreQuery("events").whereEqualTo("hostUserId", .string(userId))
        async let submittedDocs = client.run(submitted)
        async let hostingDocs = client.run(hosting)
        let documents = try await submittedDocs + hostingDocs

        var byId: [String: MeetupEvent] = [:]
        for document in documents {
            let event = MeetupEvent(document: document)
            byId[event.id] = event
        }

        for event in byId.values {
            if !event.approved, event.createdBy == userId {
                try await client.delete("events", event.id)
            } else if event.hostUserId == userId {
                // Exactly the fields `hostEditableKeysOnly()` allows.
                try await client.merge("events", event.id, fields: [
                    "host": .string(Self.formerMemberName),
                    "hostUserId": .string(""),
                    "updatedAt": .timestamp(Date()),
                ])
            }
            // Approved and hosted by someone else: nothing here identifies you.
        }
    }

    private func eraseAuthoredMemories(client: FirestoreClient, userId: String) async throws {
        let documents = try await client.run(
            FirestoreQuery("memories").whereEqualTo("createdBy", .string(userId))
        )
        for document in documents {
            let memory = Memory(document: document)
            if memory.approved {
                // The byline is the only field the author rule lets them write.
                try await client.merge("memories", memory.id, fields: [
                    "author": .string(Self.formerMemberName),
                ])
            } else {
                try await client.delete("memories", memory.id)
            }
        }
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

    /// Full edit of an event, for the host who submitted it or an admin —
    /// `updateEventDetails` on the web. `approved` and `createdBy` are never
    /// written, so a host can't self-approve or reassign an event.
    ///
    /// Pass `resetReminder` when the slot moved so the day-before push fires
    /// again for the new date.
    func updateEventDetails(
        eventId: String,
        title: String,
        host: String,
        hostUserId: String,
        date: String,
        time: String,
        location: String,
        description: String,
        status: EventStatus,
        statusNote: String,
        tags: [String],
        resetReminder: Bool
    ) async throws {
        let client = try requireClient()
        var fields: [String: FirestoreValue] = [
            "title": .string(title.trimmingCharacters(in: .whitespaces)),
            "host": .string(host.trimmingCharacters(in: .whitespaces)),
            "hostUserId": .string(hostUserId),
            "date": .string(date),
            "time": .string(time),
            "location": .string(location.trimmingCharacters(in: .whitespaces)),
            "description": .string(description.trimmingCharacters(in: .whitespaces)),
            "status": .string(status.rawValue),
            "statusNote": .string(statusNote.trimmingCharacters(in: .whitespacesAndNewlines)),
            "tags": .array(tags.map { .string($0) }),
            "updatedAt": .timestamp(Date()),
        ]
        if resetReminder {
            fields["reminderSent"] = .boolean(false)
        }
        try await client.merge("events", eventId, fields: fields)
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
