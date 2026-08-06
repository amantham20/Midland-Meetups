import PhotosUI
import SwiftUI

/// Port of `src/app/squad/SquadClient.tsx` — the member board plus the
/// "join or edit your profile" form, matched to the signed-in email.
struct SquadView: View {
    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data
    @Environment(ToastCenter.self) private var toasts

    /// nil = no profile yet; the flag tracks whether the lookup has finished.
    @State private var myProfile: SquadMember?
    @State private var hasResolvedProfile = false

    @State private var form = SquadForm()
    @State private var pickedItem: PhotosPickerItem?
    @State private var pendingPhoto: ImageCompression.Result?
    @State private var pendingPreview: UIImage?
    @State private var isSaving = false
    @State private var statusMessage = ""

    // `.top` keeps cards of unequal height aligned to the row's top edge instead
    // of floating in its centre.
    private let columns = [
        GridItem(.flexible(), spacing: 14, alignment: .top),
        GridItem(.flexible(), spacing: 14, alignment: .top),
    ]

    private var myGroups: [AudienceGroup] {
        Audience.groups(data.groups, for: myProfile?.email ?? session.email)
    }

    var body: some View {
        Screen {
            PageHeaderView(
                kicker: "Who's in it",
                title: "The Squad",
                lede: "The people who show up. Sign in to join or edit your profile. Email links you to audience groups for private events."
            )

            if !AppConfig.isConfigured {
                ConfigNotice()
            } else {
                memberGrid
                profileSection.padding(.top, 14)
            }
        }
        .navigationTitle("The Squad")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: session.uid) { await resolveProfile() }
        .onChange(of: pickedItem) { _, item in
            Task { await loadPhoto(item) }
        }
        .refreshable {
            await data.refreshFeed(signedIn: session.isSignedIn)
            await resolveProfile()
        }
    }

    // MARK: - Board

    @ViewBuilder
    private var memberGrid: some View {
        if !data.hasLoadedFeed {
            EmptyNote("Loading the squad…")
        } else if let error = data.squadError {
            EmptyNote(error)
        } else if data.squad.isEmpty {
            EmptyNote("No profiles yet — be the first to join the squad below.")
        } else {
            LazyVGrid(columns: columns, spacing: 14) {
                ForEach(data.squad) { member in
                    SquadMemberCard(member: member)
                }
            }
        }
    }

    // MARK: - Profile form

    @ViewBuilder
    private var profileSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                Text("YOUR PROFILE")
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(1.4)
                    .foregroundStyle(Theme.muted)
                Text(myProfile == nil ? "Join the Squad" : "Edit your profile")
                    .font(Theme.display(26))
                    .tracking(-0.4)
                    .foregroundStyle(Theme.ink)
                Text(profileLede)
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.muted)
                    .fixedSize(horizontal: false, vertical: true)

                if myProfile != nil, !myGroups.isEmpty {
                    Text("Your groups: \(myGroups.map(\.name).joined(separator: ", "))")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.blue)
                }
            }

            if !session.isSignedIn {
                SignInPrompt(message: "Sign in to join or edit your squad profile.")
            } else if !hasResolvedProfile {
                EmptyNote("Loading your profile…")
            } else {
                formCard
            }
        }
    }

    private var profileLede: String {
        guard let profile = myProfile else {
            return "Tell us a bit about yourself. A photo is optional. Your account email is what connects you to audience groups."
        }
        return profile.approved
            ? "Update your details anytime. Keep your email current so you stay in the right event groups."
            : "Your profile is waiting for approval — you can still edit it. It will appear on the board once approved."
    }

    private var formCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            LabeledField(label: "Name") {
                TextField("What should people call you?", text: $form.name)
                    .textContentType(.name)
                    .fieldBox()
            }

            LabeledField(label: "Occupation") {
                TextField("What do you do?", text: $form.occupation)
                    .fieldBox()
            }

            LabeledField(label: "Age") {
                TextField("e.g. 29", text: $form.age)
                    .keyboardType(.numberPad)
                    .fieldBox()
            }

            LabeledField(label: "Gender", hint: "however you'd like it shown") {
                TextField("e.g. she/her, he/him, they/them", text: $form.gender)
                    .fieldBox()
            }

            LabeledField(label: "Email", hint: "locked to your sign-in account") {
                Text(session.email ?? "")
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .foregroundStyle(Theme.muted)
                    .fieldBox()
            }

            LabeledField(label: "Social media link", hint: "optional") {
                TextField("https://instagram.com/yourname", text: $form.socialLink)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .fieldBox()
            }

            LabeledField(label: "Bio") {
                TextField(
                    "A sentence or two about you — what brings you around, what you're into.",
                    text: $form.bio,
                    axis: .vertical
                )
                .lineLimit(4...10)
                .fieldBox()
            }

            photoPicker

            Button(saveButtonTitle) {
                Task { await save() }
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(!canSave)

            if !statusMessage.isEmpty {
                Text(statusMessage)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .cardSurface()
    }

    private var photoPicker: some View {
        LabeledField(
            label: "Photo",
            hint: myProfile == nil ? "optional" : "optional, leave empty to keep current"
        ) {
            HStack(spacing: 14) {
                Group {
                    if let pendingPreview {
                        Image(uiImage: pendingPreview)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 68, height: 68)
                            .clipShape(Circle())
                    } else if let myProfile {
                        SquadAvatar(member: myProfile, size: 68)
                    } else {
                        Circle()
                            .fill(Theme.surface2)
                            .frame(width: 68, height: 68)
                            .overlay(
                                Image(systemName: "person.fill")
                                    .font(.system(size: 26))
                                    .foregroundStyle(Theme.muted)
                            )
                    }
                }

                PhotosPicker(selection: $pickedItem, matching: .images) {
                    Text(pendingPhoto == nil ? "Choose photo" : "Change photo")
                }
                .buttonStyle(SecondaryButtonStyle())

                Spacer(minLength: 0)
            }
        }
    }

    private var saveButtonTitle: String {
        if isSaving { return myProfile == nil ? "Sending…" : "Saving…" }
        return myProfile == nil ? "Send Profile" : "Save profile"
    }

    private var canSave: Bool {
        !isSaving
            && !form.name.trimmingCharacters(in: .whitespaces).isEmpty
            && !form.occupation.trimmingCharacters(in: .whitespaces).isEmpty
            && !form.age.trimmingCharacters(in: .whitespaces).isEmpty
            && !form.gender.trimmingCharacters(in: .whitespaces).isEmpty
            && !form.bio.trimmingCharacters(in: .whitespaces).isEmpty
    }

    // MARK: - Actions

    private func resolveProfile() async {
        guard AppConfig.isConfigured, let uid = session.uid else {
            myProfile = nil
            hasResolvedProfile = false
            return
        }
        hasResolvedProfile = false
        let profile = await data.findEditableSquadProfile(userId: uid, email: session.email)
        myProfile = profile
        form.fill(from: profile, fallbackName: session.preferredName)
        hasResolvedProfile = true
    }

    private func loadPhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        statusMessage = "Compressing photo…"
        do {
            guard
                let raw = try await item.loadTransferable(type: Data.self),
                let image = UIImage(data: raw)
            else {
                throw FirebaseError(message: "Could not read that image.")
            }
            let compressed = try ImageCompression.compress(image)
            pendingPhoto = compressed
            pendingPreview = UIImage(
                data: Data(base64Encoded: compressed.base64) ?? Data()
            )
            statusMessage = ""
        } catch {
            pendingPhoto = nil
            pendingPreview = nil
            let message = (error as? LocalizedError)?.errorDescription
                ?? "Could not read that image."
            statusMessage = message
            toasts.error(message)
        }
    }

    private func save() async {
        guard let uid = session.uid, let email = session.email else {
            toasts.info("Sign in to join the squad.")
            return
        }
        isSaving = true
        statusMessage = myProfile == nil ? "Sending…" : "Saving…"
        defer { isSaving = false }

        do {
            if let profile = myProfile {
                // Ownership is by sign-in email — refuse anything else, as the web does.
                guard profile.email == Audience.normalizeEmail(email) else {
                    throw FirebaseError(
                        message: "You can only edit the profile for your sign-in email."
                    )
                }
                try await data.updateMySquadProfile(
                    memberId: profile.id,
                    userId: uid,
                    name: form.trimmed(\.name),
                    occupation: form.trimmed(\.occupation),
                    age: form.trimmed(\.age),
                    gender: form.trimmed(\.gender),
                    socialLink: form.trimmed(\.socialLink),
                    bio: form.trimmed(\.bio),
                    email: email,
                    photoBase64: pendingPhoto?.base64,
                    photoMimeType: pendingPhoto?.mimeType
                )
                statusMessage = "Profile updated."
                toasts.success("Profile updated.")
            } else {
                try await data.submitSquadMember(
                    name: form.trimmed(\.name),
                    occupation: form.trimmed(\.occupation),
                    age: form.trimmed(\.age),
                    gender: form.trimmed(\.gender),
                    socialLink: form.trimmed(\.socialLink),
                    bio: form.trimmed(\.bio),
                    email: email,
                    photoBase64: pendingPhoto?.base64 ?? "",
                    photoMimeType: pendingPhoto?.mimeType ?? "image/jpeg",
                    userId: uid
                )
                let message = "Sent! Your profile is in for review and will show up once approved."
                statusMessage = message
                toasts.success(message)
            }

            pendingPhoto = nil
            pendingPreview = nil
            pickedItem = nil
            await resolveProfile()
            await data.loadSquad()
        } catch {
            let message = (error as? LocalizedError)?.errorDescription
                ?? "Couldn't save your profile. Check your connection."
            statusMessage = message
            toasts.error(message)
        }
    }
}

// MARK: - Form state

private struct SquadForm {
    var name = ""
    var occupation = ""
    var age = ""
    var gender = ""
    var socialLink = ""
    var bio = ""

    mutating func fill(from profile: SquadMember?, fallbackName: String) {
        name = profile?.name ?? fallbackName
        occupation = profile?.occupation ?? ""
        age = profile?.age ?? ""
        gender = profile?.gender ?? ""
        socialLink = profile?.socialLink ?? ""
        bio = profile?.bio ?? ""
    }

    func trimmed(_ keyPath: KeyPath<SquadForm, String>) -> String {
        self[keyPath: keyPath].trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

// MARK: - Member card

private struct SquadMemberCard: View {
    let member: SquadMember

    @Environment(\.openURL) private var openURL

    private var subtitle: String {
        [member.age, member.gender].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    var body: some View {
        VStack(spacing: 8) {
            SquadAvatar(member: member, size: 88)
                .padding(.bottom, 2)

            Text(member.name)
                .font(Theme.display(16))
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)

            if !member.occupation.isEmpty {
                Text(member.occupation)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.muted)
                    .multilineTextAlignment(.center)
            }

            if !subtitle.isEmpty {
                Text(subtitle)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
                    .multilineTextAlignment(.center)
            }

            if !member.bio.isEmpty {
                Text(member.bio)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.ink.opacity(0.85))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let url = URL(string: member.socialLink), !member.socialLink.isEmpty {
                Button {
                    openURL(url)
                } label: {
                    Label("Follow", systemImage: "link")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.blue)
                }
                .buttonStyle(.plain)
                .padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .cardSurface(padding: 16)
    }
}
