import SwiftUI

/// Port of `src/components/AttributionField.tsx`.
///
/// "It's you, unless you say otherwise": the signed-in account's name is used
/// by default and the name box only appears once the toggle is on.
///
/// Pass `people` to let the user tag a real member instead of typing a name —
/// the tagged account comes back through the `otherUserId` binding.
struct AttributionField: View {
    let label: String
    let myName: String
    var selfHint: String?
    let toggleLabel: String
    let otherLabel: String
    var otherPlaceholder: String = ""
    @Binding var byOther: Bool
    @Binding var otherName: String
    /// Members who can be tagged. Empty for a plain free-text field.
    var people: [HostCandidate] = []
    /// Auth uid of the tagged member; "" when the name was typed in.
    var otherUserId: Binding<String> = .constant("")
    /// Small print shown once a member is tagged.
    var taggedHint: String?

    private var canTag: Bool { !people.isEmpty }

    var body: some View {
        LabeledField(label: label) {
            VStack(alignment: .leading, spacing: 12) {
                accountCard

                Toggle(toggleLabel, isOn: $byOther)
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.ink)
                    .tint(Theme.blue)

                if byOther, canTag {
                    LabeledField(
                        label: "Tag a member",
                        hint: "or pick “someone else” to type a name"
                    ) {
                        Picker("Tag a member", selection: taggedSelection) {
                            Text("Someone else (type a name)").tag("")
                            // A tagged account that has since left the squad
                            // still needs an option to sit on.
                            if !otherUserId.wrappedValue.isEmpty,
                               !people.contains(where: { $0.userId == otherUserId.wrappedValue }) {
                                Text(otherName.isEmpty ? "Tagged member" : otherName)
                                    .tag(otherUserId.wrappedValue)
                            }
                            ForEach(people) { person in
                                Text(person.name).tag(person.userId)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(Theme.ink)
                    }

                    if !otherUserId.wrappedValue.isEmpty, let taggedHint {
                        Text(taggedHint)
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                if byOther, otherUserId.wrappedValue.isEmpty {
                    LabeledField(label: otherLabel) {
                        TextField(otherPlaceholder, text: $otherName)
                            .textContentType(.name)
                            .fieldBox()
                    }
                }
            }
        }
    }

    /// Picking a member fills in the display name the event actually stores.
    private var taggedSelection: Binding<String> {
        Binding(
            get: { otherUserId.wrappedValue },
            set: { userId in
                otherUserId.wrappedValue = userId
                if let person = people.first(where: { $0.userId == userId }) {
                    otherName = person.name
                }
            }
        )
    }

    private var accountCard: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(myName.isEmpty ? "Your account" : myName)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.ink)
            if let selfHint {
                Text(selfHint)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.muted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 13)
        .padding(.vertical, 10)
        .background(byOther ? Theme.surface2 : Theme.blue.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSmall, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusSmall, style: .continuous)
                .strokeBorder(
                    byOther ? Theme.border : Theme.blue.opacity(0.4),
                    lineWidth: 1.5
                )
        )
        .opacity(byOther ? 0.6 : 1)
    }
}
