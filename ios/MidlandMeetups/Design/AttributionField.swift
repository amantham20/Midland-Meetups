import SwiftUI

/// Port of `src/components/AttributionField.tsx`.
///
/// "It's you, unless you say otherwise": the signed-in account's name is used
/// by default and the name box only appears once the toggle is on.
struct AttributionField: View {
    let label: String
    let myName: String
    var selfHint: String?
    let toggleLabel: String
    let otherLabel: String
    var otherPlaceholder: String = ""
    @Binding var byOther: Bool
    @Binding var otherName: String

    var body: some View {
        LabeledField(label: label) {
            VStack(alignment: .leading, spacing: 12) {
                accountCard

                Toggle(toggleLabel, isOn: $byOther)
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.ink)
                    .tint(Theme.blue)

                if byOther {
                    LabeledField(label: otherLabel) {
                        TextField(otherPlaceholder, text: $otherName)
                            .textContentType(.name)
                            .fieldBox()
                    }
                }
            }
        }
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
