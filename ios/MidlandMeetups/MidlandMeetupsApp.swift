import SwiftUI

@main
struct MidlandMeetupsApp: App {
    @State private var session = SessionStore()
    @State private var data = DataStore()
    @State private var toasts = ToastCenter()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(data)
                .environment(toasts)
        }
    }
}
