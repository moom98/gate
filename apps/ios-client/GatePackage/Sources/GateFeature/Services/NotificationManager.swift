import Foundation
import UIKit
import UserNotifications

/// Manages local notifications for permission requests
@MainActor
final class NotificationManager: NSObject, ObservableObject {
    @Published var authorizationStatus: UNAuthorizationStatus = .notDetermined
    @Published var lastError: String?

    private let center = UNUserNotificationCenter.current()
    private var notifiedRequestIds: Set<String> = []

    override init() {
        super.init()
        center.delegate = self

        Task {
            await checkAuthorizationStatus()
        }
    }

    /// Request notification permissions from the user
    func requestAuthorization() async -> Bool {
        lastError = nil
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            await checkAuthorizationStatus()
            return granted
        } catch {
            lastError = "Failed to request authorization: \(error.localizedDescription)"
            print("[NotificationManager] Authorization request failed: \(error)")
            return false
        }
    }

    /// Check current authorization status
    func checkAuthorizationStatus() async {
        let settings = await center.notificationSettings()
        authorizationStatus = settings.authorizationStatus
        print("[NotificationManager] Authorization status: \(authorizationStatus.rawValue)")
    }

    /// Send a test notification (for debugging)
    func sendTestNotification() async {
        lastError = nil
        guard authorizationStatus == .authorized else {
            lastError = "Notifications not authorized"
            print("[NotificationManager] Cannot send notification: not authorized")
            return
        }

        let content = UNMutableNotificationContent()
        content.title = "Test Notification"
        content.body = "This is a test notification from Gate. You should see this even when the app is in foreground."
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        )

        do {
            try await center.add(request)
            print("[NotificationManager] Test notification scheduled")
        } catch {
            lastError = "Failed to schedule notification: \(error.localizedDescription)"
            print("[NotificationManager] Failed to schedule notification: \(error)")
        }
    }

    /// Send notification for a permission request
    /// - Parameter request: The permission request to notify about
    func notifyPermissionRequest(_ request: PermissionRequest) async {
        // Prevent duplicate notifications for the same request
        guard !notifiedRequestIds.contains(request.id) else {
            print("[NotificationManager] Already notified for request: \(request.id)")
            return
        }

        guard authorizationStatus == .authorized else {
            print("[NotificationManager] Cannot send notification: not authorized")
            return
        }

        notifiedRequestIds.insert(request.id)

        let content = UNMutableNotificationContent()
        content.title = "Permission Request"
        content.body = truncateSummary(request.summary)
        content.sound = .default

        // Store request ID in userInfo for later reference
        content.userInfo = [
            "requestId": request.id,
            "summary": request.summary
        ]

        let notificationRequest = UNNotificationRequest(
            identifier: request.id,
            content: content,
            trigger: nil
        )

        do {
            try await center.add(notificationRequest)
            print("[NotificationManager] Permission request notification sent: \(request.id)")
        } catch {
            lastError = "Failed to send notification: \(error.localizedDescription)"
            print("[NotificationManager] Failed to send notification: \(error)")
            // Remove from notified set if we failed to send
            notifiedRequestIds.remove(request.id)
        }
    }

    /// Remove a request from the notified set when it's resolved
    /// - Parameter requestId: The ID of the resolved request
    func markRequestResolved(_ requestId: String) {
        notifiedRequestIds.remove(requestId)
        // Also remove the notification from notification center
        center.removeDeliveredNotifications(withIdentifiers: [requestId])
        print("[NotificationManager] Marked request as resolved: \(requestId)")
    }

    /// Truncate summary to fit in notification
    private func truncateSummary(_ summary: String, maxLength: Int = 100) -> String {
        if summary.count <= maxLength {
            return summary
        }
        return String(summary.prefix(maxLength - 3)) + "..."
    }

    /// Open system settings to enable notifications
    func openSettings() {
        guard let settingsUrl = URL(string: UIApplication.openSettingsURLString) else {
            return
        }

        if UIApplication.shared.canOpenURL(settingsUrl) {
            UIApplication.shared.open(settingsUrl)
        }
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension NotificationManager: UNUserNotificationCenterDelegate {
    /// Handle notification presentation while app is in foreground
    /// This is REQUIRED to show notifications when the app is in the FOREGROUND
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        print("[NotificationManager] Will present notification: \(notification.request.identifier)")

        // Show banner, list, and play sound even when app is in foreground
        completionHandler([.banner, .list, .sound])
    }

    /// Handle notification tap (when user taps the notification)
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        print("[NotificationManager] Did receive notification response: \(response.actionIdentifier)")

        // Handle notification tap here
        // response.notification.request.content.userInfo contains custom data

        completionHandler()
    }
}
