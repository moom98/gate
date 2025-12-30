import SwiftUI

public struct MainView: View {
    @Environment(AppState.self) private var appState

    @State private var errorMessage: String?
    @State private var showNotificationSettings = false

    public var body: some View {
        @Bindable var appState = appState

        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    StatusBadge(status: appState.webSocketManager.status)
                        .padding(.top)

                    if appState.webSocketManager.pendingRequests.isEmpty {
                        EmptyStateView()
                    } else {
                        ForEach(appState.webSocketManager.pendingRequests) { request in
                            PermissionRequestCard(request: request) { decision in
                                await handleDecision(requestId: request.id, decision: decision)
                            }
                            .padding(.horizontal)
                        }
                    }
                }
            }
            .navigationTitle("Gate")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button("Test Notification") {
                            Task {
                                await testNotification()
                            }
                        }

                        Button("Notification Settings") {
                            showNotificationSettings = true
                        }

                        Divider()

                        Button("Reconnect") {
                            reconnect()
                        }

                        Button("Logout", role: .destructive) {
                            Task {
                                await logout()
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .sheet(isPresented: $showNotificationSettings) {
                NotificationSettingsView()
                    .environment(appState)
            }
            .alert("Error", isPresented: .constant(errorMessage != nil)) {
                Button("OK") {
                    errorMessage = nil
                }
            } message: {
                if let errorMessage {
                    Text(errorMessage)
                }
            }
        }
    }

    public init() {}

    private func handleDecision(requestId: String, decision: Decision) async {
        let apiClient = APIClient(config: appState.config)

        do {
            try await apiClient.sendDecision(requestId: requestId, decision: decision)
            appState.webSocketManager.removeRequest(withId: requestId)
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func reconnect() {
        appState.webSocketManager.disconnect()
        appState.webSocketManager.connect()
    }

    private func logout() async {
        await appState.logout()
    }

    private func testNotification() async {
        await appState.notificationManager.sendTestNotification()
    }
}

struct StatusBadge: View {
    let status: ConnectionStatus

    var body: some View {
        HStack {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
            Text(statusText)
                .font(.caption)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }

    private var statusColor: Color {
        switch status {
        case .connected:
            return .green
        case .connecting:
            return .orange
        case .disconnected:
            return .gray
        case .error:
            return .red
        }
    }

    private var statusText: String {
        switch status {
        case .connected:
            return "Connected"
        case .connecting:
            return "Connecting..."
        case .disconnected:
            return "Disconnected"
        case .error(let message):
            return "Error: \(message)"
        }
    }
}

struct EmptyStateView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 60))
                .foregroundColor(.green)

            Text("No Pending Requests")
                .font(.headline)

            Text("Permission requests will appear here when Claude Code needs approval.")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .padding()
    }
}
