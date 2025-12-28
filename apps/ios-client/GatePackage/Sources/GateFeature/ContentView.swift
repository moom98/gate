import SwiftUI

public struct ContentView: View {
    @State private var appState = AppState()

    public var body: some View {
        Group {
            if appState.isAuthenticated {
                MainView()
            } else {
                PairingView()
            }
        }
        .environment(appState)
    }

    public init() {}
}
