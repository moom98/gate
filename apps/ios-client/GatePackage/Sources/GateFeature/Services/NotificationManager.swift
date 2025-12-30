import Foundation
import UIKit
import UserNotifications

/// Manages local notifications for permission requests
@MainActor
final class NotificationManager: NSObject, ObservableObject {
    @Published var authorizationStatus: UNAuthorizationStatus = .notDetermined
    @Published var lastError: String?

    private let center = UNUserNotificationCenter.current()

    override init() {
        super.init()
        center.delegate = self

        Task {
            await checkAuthorizationStatus()
        }
    }

    /// Request notification permissions from the user
    func requestAuthorization() async -> Bool {
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
    /// This is REQUIRED to show notifications when the app is active
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        print("[NotificationManager] Will present notification: \(notification.request.identifier)")

        // Show banner, list, and play sound even when app is in foreground
        // .banner requires iOS 14+, .list for notification center
        if #available(iOS 14.0, *) {
            completionHandler([.banner, .list, .sound])
        } else {
            completionHandler([.alert, .sound])
        }
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
