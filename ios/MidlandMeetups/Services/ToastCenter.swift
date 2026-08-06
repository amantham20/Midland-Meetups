import Foundation
import Observation
import SwiftUI

/// Port of `toast-store.ts` / `ToastHost.tsx` — one transient banner at a time.
@MainActor
@Observable
final class ToastCenter {
    enum Tone {
        case success, error, info

        var duration: TimeInterval {
            switch self {
            case .success: return 5
            case .error: return 6.5
            case .info: return 4
            }
        }

        var color: Color {
            switch self {
            case .success: return Theme.green
            case .error: return Theme.red
            case .info: return Theme.blue
            }
        }

        var symbol: String {
            switch self {
            case .success: return "checkmark.circle.fill"
            case .error: return "exclamationmark.triangle.fill"
            case .info: return "info.circle.fill"
            }
        }
    }

    struct Toast: Identifiable, Equatable {
        let id = UUID()
        let message: String
        let tone: Tone

        static func == (lhs: Toast, rhs: Toast) -> Bool { lhs.id == rhs.id }
    }

    private(set) var current: Toast?
    private var dismissTask: Task<Void, Never>?

    func success(_ message: String) { show(message, tone: .success) }
    func error(_ message: String) { show(message, tone: .error) }
    func info(_ message: String) { show(message, tone: .info) }

    func show(_ message: String, tone: Tone) {
        let toast = Toast(message: message, tone: tone)
        withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) {
            current = toast
        }
        dismissTask?.cancel()
        dismissTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(tone.duration))
            guard !Task.isCancelled else { return }
            self?.dismiss(toast)
        }
    }

    func dismiss(_ toast: Toast? = nil) {
        if let toast, current != toast { return }
        withAnimation(.easeOut(duration: 0.2)) { current = nil }
    }
}

/// Floats above the tab bar so it never covers the primary action.
///
/// The overlay is attached to the `TabView` itself, so its frame includes the tab
/// bar — without the bottom inset the banner renders behind it and is invisible.
struct ToastOverlay: View {
    let toasts: ToastCenter

    private let tabBarClearance: CGFloat = 96

    var body: some View {
        VStack {
            Spacer()
            if let toast = toasts.current {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: toast.tone.symbol)
                        .foregroundStyle(toast.tone.color)
                        .font(.system(size: 17, weight: .semibold))
                    Text(toast.message)
                        .font(.system(size: 15))
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                }
                .padding(14)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMedium, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusMedium, style: .continuous)
                        .strokeBorder(Theme.border, lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.18), radius: 18, y: 8)
                .padding(.horizontal, 16)
                .padding(.bottom, tabBarClearance)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .onTapGesture { toasts.dismiss() }
            }
        }
        .animation(.spring(response: 0.32, dampingFraction: 0.86), value: toasts.current)
        .allowsHitTesting(toasts.current != nil)
    }
}
