import SwiftUI

/// Design tokens ported from `src/app/globals.css`.
///
/// The web app is light-only; iOS users expect dark mode, so the neutrals flip
/// with the system appearance while the brand hues stay recognizable (lifted a
/// little in dark so they keep their contrast against a dark surface).
extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }

    static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(
                red: CGFloat((hex >> 16) & 0xFF) / 255,
                green: CGFloat((hex >> 8) & 0xFF) / 255,
                blue: CGFloat(hex & 0xFF) / 255,
                alpha: 1
            )
        })
    }
}

enum Theme {
    // Neutrals
    static let bg = Color.adaptive(light: 0xF5F6F8, dark: 0x0E1116)
    static let surface = Color.adaptive(light: 0xFFFFFF, dark: 0x171B22)
    static let surface2 = Color.adaptive(light: 0xEFF1F5, dark: 0x212630)
    static let ink = Color.adaptive(light: 0x14181F, dark: 0xF2F4F8)
    static let muted = Color.adaptive(light: 0x667085, dark: 0x98A2B3)
    static let border = Color.adaptive(light: 0xE4E7EC, dark: 0x2A303B)

    // Brand
    static let blue = Color.adaptive(light: 0x2851E3, dark: 0x6B8AFF)
    static let blueInk = Color.adaptive(light: 0x1B3AA8, dark: 0x4C6EF0)
    static let red = Color.adaptive(light: 0xE5484D, dark: 0xFF6B70)
    static let yellow = Color.adaptive(light: 0xF6B93B, dark: 0xF6B93B)
    static let green = Color.adaptive(light: 0x12B76A, dark: 0x3DDC97)
    /// Readable text on the yellow rain-delay chip.
    static let amberInk = Color.adaptive(light: 0x8A6A12, dark: 0xF6D98B)

    // Radii — --r-lg / --r-md / --r-sm
    static let radiusLarge: CGFloat = 18
    static let radiusMedium: CGFloat = 12
    static let radiusSmall: CGFloat = 8

    /// The web pairs Space Grotesk (display) with Inter (body). Neither ships with
    /// iOS, so headings use SF Pro tightened up to read the same way.
    static func display(_ size: CGFloat, weight: Font.Weight = .bold) -> Font {
        .system(size: size, weight: weight)
    }
}

// MARK: - Shared surfaces

/// The `rounded-lg border border-border bg-surface shadow-sm` card used everywhere.
struct CardSurface: ViewModifier {
    var padding: CGFloat = 20
    var cornerRadius: CGFloat = Theme.radiusLarge

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(Theme.border, lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.05), radius: 2, x: 0, y: 1)
    }
}

extension View {
    func cardSurface(padding: CGFloat = 20, cornerRadius: CGFloat = Theme.radiusLarge) -> some View {
        modifier(CardSurface(padding: padding, cornerRadius: cornerRadius))
    }
}

/// `.btn-primary` — a pill-shaped filled button.
struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(configuration.isPressed ? Theme.blueInk : Theme.blue)
            .clipShape(Capsule())
            .opacity(isEnabled ? 1 : 0.6)
    }
}

/// A secondary pill that reads as an outline rather than a filled action.
struct SecondaryButtonStyle: ButtonStyle {
    var tint: Color = Theme.ink

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(tint)
            .padding(.horizontal, 18)
            .padding(.vertical, 11)
            .background(configuration.isPressed ? Theme.surface2 : Theme.surface)
            .clipShape(Capsule())
            .overlay(Capsule().strokeBorder(Theme.border, lineWidth: 1))
    }
}
