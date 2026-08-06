import SwiftUI

// MARK: - Page header

/// The kicker / title / lede stack from `PageHeader.tsx`.
struct PageHeaderView: View {
    let kicker: String
    let title: String
    let lede: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(kicker.uppercased())
                .font(.system(size: 12, weight: .semibold))
                .tracking(1.4)
                .foregroundStyle(Theme.muted)

            Text(title)
                .font(Theme.display(32))
                .tracking(-0.6)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)

            Text(lede)
                .font(.system(size: 16))
                .foregroundStyle(Theme.muted)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Status pill

/// Mirrors `StatusPill.tsx`: confirmed events show nothing at all.
struct StatusPill: View {
    let status: EventStatus

    private var colors: (background: Color, foreground: Color) {
        switch status {
        case .confirmed: return (Theme.green.opacity(0.15), Theme.green)
        case .rainDelay: return (Theme.yellow.opacity(0.25), Theme.amberInk)
        case .canceled: return (Theme.red.opacity(0.15), Theme.red)
        case .relocated: return (Theme.blue.opacity(0.15), Theme.blueInk)
        }
    }

    var body: some View {
        if status != .confirmed {
            Text(status.label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(colors.foreground)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(colors.background)
                .clipShape(Capsule())
                .fixedSize()
        }
    }
}

// MARK: - Tag chips

struct TagChipsView: View {
    let tags: [String]
    var labels: [String: String] = [:]

    var body: some View {
        if !tags.isEmpty {
            FlowLayout(spacing: 6, lineSpacing: 6) {
                ForEach(tags, id: \.self) { tag in
                    Text(labels[tag] ?? tag)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.blue)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Theme.blue.opacity(0.12))
                        .clipShape(Capsule())
                }
            }
        }
    }
}

/// A selectable version of the chips, used on Submit and Admin.
struct TagPicker: View {
    let groups: [AudienceGroup]
    @Binding var selected: [String]

    var body: some View {
        FlowLayout(spacing: 8, lineSpacing: 8) {
            ForEach(groups) { group in
                let isOn = selected.contains(group.slug)
                Button {
                    if isOn {
                        selected.removeAll { $0 == group.slug }
                    } else {
                        selected.append(group.slug)
                    }
                } label: {
                    Text(group.name)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(isOn ? Color.white : Theme.muted)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(isOn ? Theme.blue : Theme.surface)
                        .clipShape(Capsule())
                        .overlay(
                            Capsule().strokeBorder(isOn ? Theme.blue : Theme.border, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Empty note

/// `EmptyNote.tsx` — a dashed placeholder for empty / loading / error states.
struct EmptyNote: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(.system(size: 15))
            .foregroundStyle(Theme.muted)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 20)
            .padding(.vertical, 30)
            .background(Theme.surface2.opacity(0.6))
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLarge, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusLarge, style: .continuous)
                    .strokeBorder(Theme.border, style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
            )
    }
}

// MARK: - Section heading

struct SectionHeading: View {
    let text: String

    var body: some View {
        Text(text)
            .font(Theme.display(21))
            .foregroundStyle(Theme.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Form field

/// The shared `.field` / `.field-label` pairing from globals.css.
struct LabeledField<Content: View>: View {
    let label: String
    var hint: String?
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Text(label)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                if let hint {
                    Text("— \(hint)")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.muted)
                }
            }
            content
        }
    }
}

struct FieldBox: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 16))
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 13)
            .padding(.vertical, 11)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSmall, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusSmall, style: .continuous)
                    .strokeBorder(Theme.border, lineWidth: 1.5)
            )
    }
}

extension View {
    func fieldBox() -> some View { modifier(FieldBox()) }
}

// MARK: - Brand mark

/// `BrandMark.tsx` — three overlapping translucent circles.
struct BrandMark: View {
    var size: CGFloat = 34

    var body: some View {
        Canvas { context, canvasSize in
            let scale = canvasSize.width / 40
            let circles: [(CGFloat, CGFloat, CGFloat, Color, Double)] = [
                (15, 16, 11, Color(hex: 0x2851E3), 0.9),
                (25, 16, 11, Color(hex: 0xE5484D), 0.85),
                (20, 25, 11, Color(hex: 0xF6B93B), 0.85),
            ]
            for (x, y, r, color, opacity) in circles {
                let rect = CGRect(
                    x: (x - r) * scale,
                    y: (y - r) * scale,
                    width: r * 2 * scale,
                    height: r * 2 * scale
                )
                context.fill(Path(ellipseIn: rect), with: .color(color.opacity(opacity)))
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

// MARK: - Flow layout

/// Wraps chips onto as many lines as they need — the equivalent of
/// `flex flex-wrap gap-2`.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var rowWidth: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalHeight: CGFloat = 0
        var widestRow: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if rowWidth > 0, rowWidth + spacing + size.width > maxWidth {
                totalHeight += rowHeight + lineSpacing
                widestRow = max(widestRow, rowWidth)
                rowWidth = size.width
                rowHeight = size.height
            } else {
                rowWidth += rowWidth > 0 ? spacing + size.width : size.width
                rowHeight = max(rowHeight, size.height)
            }
        }
        widestRow = max(widestRow, rowWidth)
        totalHeight += rowHeight

        return CGSize(
            width: maxWidth == .infinity ? widestRow : min(widestRow, maxWidth),
            height: totalHeight
        )
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout Void
    ) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + lineSpacing
                rowHeight = 0
            }
            subview.place(
                at: CGPoint(x: x, y: y),
                anchor: .topLeading,
                proposal: ProposedViewSize(size)
            )
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

// MARK: - Config notice

/// `ConfigNotice.tsx`, restated for the iOS build where the credentials come
/// from a generated plist instead of `.env.local`.
struct ConfigNotice: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Connect Firebase")
                .font(Theme.display(18))
                .foregroundStyle(Theme.ink)
            Text("No Firebase credentials are bundled. Run **ios/Scripts/generate-firebase-config.sh** from the repo root to build `Firebase.plist` out of your `.env.local`, then rebuild the app.")
                .font(.system(size: 15))
                .foregroundStyle(Theme.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface()
    }
}
