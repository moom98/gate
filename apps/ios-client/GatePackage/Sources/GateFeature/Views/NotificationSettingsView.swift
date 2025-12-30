import SwiftUI
import UserNotifications

public struct NotificationSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState

    public var body: some View {
        NavigationStack {
            List {
                Section {
                    StatusRow(
                        title: "Notification Status",
                        value: statusText,
                        color: statusColor
                    )
                } header: {
                    Text("Current Status")
                }

                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Gate uses notifications to alert you when permission requests arrive from Claude Code.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)

                        Text("For the best experience:")
                            .font(.subheadline)
                            .fontWeight(.semibold)

                        VStack(alignment: .leading, spacing: 4) {
                            Label("Enable notifications in Settings", systemImage: "checkmark.circle.fill")
                                .font(.caption)
                            Label("Keep the app in foreground", systemImage: "checkmark.circle.fill")
                                .font(.caption)
                        }
                    }
                    .padding(.vertical, 4)
                } header: {
                    Text("About")
                }

                Section {
                    if appState.notificationManager.authorizationStatus == .notDetermined {
                        Button {
                            Task {
                                _ = await appState.notificationManager.requestAuthorization()
                            }
                        } label: {
                            Label("Enable Notifications", systemImage: "bell.badge")
                        }
                    } else if appState.notificationManager.authorizationStatus == .denied {
                        Button {
                            appState.notificationManager.openSettings()
                        } label: {
                            Label("Open Settings", systemImage: "gear")
                        }
                    } else if appState.notificationManager.authorizationStatus == .authorized {
                        Button {
                            Task {
                                await appState.notificationManager.sendTestNotification()
                            }
                        } label: {
                            Label("Send Test Notification", systemImage: "bell.badge.fill")
                        }
                    }
                } header: {
                    Text("Actions")
                } footer: {
                    if appState.notificationManager.authorizationStatus == .denied {
                        Text("Notifications are disabled. Please enable them in Settings > Gate > Notifications")
                            .font(.caption)
                    }
                }

                if let error = appState.notificationManager.lastError {
                    Section {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                    } header: {
                        Text("Error")
                    }
                }
            }
            .navigationTitle("Notifications")
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

    public init() {}

    private var statusText: String {
        switch appState.notificationManager.authorizationStatus {
        case .notDetermined:
            return "Not Configured"
        case .denied:
            return "Disabled"
        case .authorized:
            return "Enabled"
        case .provisional:
            return "Provisional"
        case .ephemeral:
            return "Ephemeral"
        @unknown default:
            return "Unknown"
        }
    }

    private var statusColor: Color {
        switch appState.notificationManager.authorizationStatus {
        case .authorized:
            return .green
        case .denied:
            return .red
        case .notDetermined:
            return .orange
        default:
            return .gray
        }
    }
}

struct StatusRow: View {
    let title: String
    let value: String
    let color: Color

    var body: some View {
        HStack {
            Text(title)
            Spacer()
            HStack(spacing: 6) {
                Circle()
                    .fill(color)
                    .frame(width: 8, height: 8)
                Text(value)
                    .foregroundColor(color)
            }
        }
    }
}
