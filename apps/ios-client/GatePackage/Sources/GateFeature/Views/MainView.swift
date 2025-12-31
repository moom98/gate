import SwiftUI

public struct MainView: View {
    @Environment(AppState.self) private var appState

    @State private var errorMessage: String?
    @State private var showNotificationSettings = false
    @State private var selectedPrompt: (id: String, text: String)? = nil

    public var body: some View {
        @Bindable var appState = appState

        NavigationStack {
            List {
                // Status badge section
                Section {
                    HStack {
                        Spacer()
                        StatusBadge(status: appState.webSocketManager.status)
                        Spacer()
                    }
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())

                // Resolved permissions (completion notifications)
                if !appState.webSocketManager.resolvedPermissions.isEmpty {
                    Section {
                        ForEach(appState.webSocketManager.resolvedPermissions) { resolved in
                            ResolvedPermissionCard(resolvedPermission: resolved)
                                .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                        }
                        .onDelete { indexSet in
                            for index in indexSet {
                                let resolved = appState.webSocketManager.resolvedPermissions[index]
                                appState.webSocketManager.removeResolvedPermission(withId: resolved.id)
                            }
                        }
                    } header: {
                        Text("Completed")
                    }
                }

                // Pending requests
                if !appState.webSocketManager.pendingRequests.isEmpty {
                    Section {
                        ForEach(appState.webSocketManager.pendingRequests) { request in
                            PermissionRequestCard(request: request) { decision in
                                await handleDecision(requestId: request.id, decision: decision)
                            }
                            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                        }
                    } header: {
                        if !appState.webSocketManager.resolvedPermissions.isEmpty {
                            Text("Pending")
                        }
                    }
                }

                // Empty state
                if appState.webSocketManager.pendingRequests.isEmpty && appState.webSocketManager.resolvedPermissions.isEmpty {
                    Section {
                        EmptyStateView()
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
            }
            .listStyle(.insetGrouped)
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
            .sheet(item: Binding(
                get: { selectedPrompt.map { PromptSheetItem(id: $0.id, text: $0.text) } },
                set: { selectedPrompt = $0.map { ($0.id, $0.text) } }
            )) { item in
                FullPromptView(prompt: item.text)
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
            .onAppear {
                // Set up notification tap callback
                appState.notificationManager.onNotificationTapped = { requestId, rawPrompt in
                    selectedPrompt = (id: requestId, text: rawPrompt)
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

// Helper type for sheet presentation
struct PromptSheetItem: Identifiable {
    let id: String
    let text: String
}

// Full prompt display view
struct FullPromptView: View {
    @Environment(\.dismiss) private var dismiss
    let prompt: String

    var body: some View {
        NavigationStack {
            ScrollView {
                Text(prompt)
                    .font(.body)
                    .padding()
            }
            .navigationTitle("Full Prompt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}
