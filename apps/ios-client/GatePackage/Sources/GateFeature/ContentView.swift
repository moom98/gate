import SwiftUI

public struct ContentView: View {
    @State private var appState = AppState()
    @Environment(\.scenePhase) private var scenePhase

    public var body: some View {
        Group {
            if appState.isAuthenticated {
                MainView()
            } else {
                PairingView()
            }
        }
        .environment(appState)
        .onChange(of: scenePhase) { oldPhase, newPhase in
            // Update notification manager when scene phase changes
            updateNotificationManagerActiveState(newPhase)
        }
        .onAppear {
            // Set initial state
            updateNotificationManagerActiveState(scenePhase)
        }
    }

    private func updateNotificationManagerActiveState(_ phase: ScenePhase) {
        // Update notification manager to track if app is active (foreground)
        // Only show notifications when app is in background or inactive
        let isActive = (phase == .active)
        appState.notificationManager.isAppActive = isActive
        print("[ContentView] Scene phase changed to \(phase), isAppActive: \(isActive)")
    }

    public init() {}
}
