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

    // Notification category and action identifiers
    private static let permissionCategoryIdentifier = "PERMISSION_REQUEST"
    private static let allowActionIdentifier = "ALLOW_ACTION"
    private static let denyActionIdentifier = "DENY_ACTION"

    // Callback for handling notification actions
    var onDecisionMade: ((String, Decision) -> Void)?

    override init() {
        super.init()
        center.delegate = self
        setupNotificationCategories()

        Task {
            await checkAuthorizationStatus()
        }
    }

    /// Setup notification categories with Allow/Deny actions
    private func setupNotificationCategories() {
        let allowAction = UNNotificationAction(
            identifier: Self.allowActionIdentifier,
            title: "Allow",
            options: [.foreground]
        )

        let denyAction = UNNotificationAction(
            identifier: Self.denyActionIdentifier,
            title: "Deny",
            options: [.destructive]
        )

        let category = UNNotificationCategory(
            identifier: Self.permissionCategoryIdentifier,
            actions: [allowAction, denyAction],
            intentIdentifiers: [],
            options: []
        )

        center.setNotificationCategories([category])
        print("[NotificationManager] Notification categories registered")
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
        content.categoryIdentifier = Self.permissionCategoryIdentifier

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
    func markRequestResolved(_ requestId: String) async {
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

        // Extract request ID from notification userInfo
        guard let requestId = response.notification.request.content.userInfo["requestId"] as? String else {
            print("[NotificationManager] No request ID found in notification")
            completionHandler()
            return
        }

        // Handle action buttons
        let decision: Decision?
        switch response.actionIdentifier {
        case Self.allowActionIdentifier:
            decision = .allow
            print("[NotificationManager] User allowed request: \(requestId)")

        case Self.denyActionIdentifier:
            decision = .deny
            print("[NotificationManager] User denied request: \(requestId)")

        case UNNotificationDefaultActionIdentifier:
            // User tapped the notification body (not an action button)
            // Just open the app, no decision made
            print("[NotificationManager] User tapped notification: \(requestId)")
            decision = nil

        default:
            decision = nil
        }

        // Notify the callback if a decision was made
        if let decision = decision {
            Task { @MainActor in
                self.onDecisionMade?(requestId, decision)
            }
        }

        completionHandler()
    }
}
