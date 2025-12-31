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

    /// Track whether the app is currently active (foreground)
    /// When true, notifications will not be shown
    var isAppActive: Bool = true

    // Notification category and action identifiers
    private static let permissionCategoryIdentifier = "PERMISSION_REQUEST"
    private static let timeoutCategoryIdentifier = "TIMEOUT_NOTIFICATION"
    private static let resolvedCategoryIdentifier = "PERMISSION_RESOLVED"
    private static let allowActionIdentifier = "ALLOW_ACTION"
    private static let denyActionIdentifier = "DENY_ACTION"
    private static let retryActionIdentifier = "RETRY_ACTION"
    private static let dismissActionIdentifier = "DISMISS_ACTION"
    private static let okActionIdentifier = "OK_ACTION"

    // Callbacks for handling notification actions
    var onDecisionMade: ((String, Decision) -> Void)?
    var onNotificationTapped: ((String, String) -> Void)?
    var onRetryRequested: ((String) -> Void)?

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
        // Permission request category (Allow/Deny)
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

        let permissionCategory = UNNotificationCategory(
            identifier: Self.permissionCategoryIdentifier,
            actions: [allowAction, denyAction],
            intentIdentifiers: [],
            options: []
        )

        // Timeout notification category (Retry/Dismiss)
        let retryAction = UNNotificationAction(
            identifier: Self.retryActionIdentifier,
            title: "Retry",
            options: [.foreground]
        )

        let dismissAction = UNNotificationAction(
            identifier: Self.dismissActionIdentifier,
            title: "Dismiss",
            options: []
        )

        let timeoutCategory = UNNotificationCategory(
            identifier: Self.timeoutCategoryIdentifier,
            actions: [retryAction, dismissAction],
            intentIdentifiers: [],
            options: []
        )

        // Permission resolved category (OK only)
        let okAction = UNNotificationAction(
            identifier: Self.okActionIdentifier,
            title: "OK",
            options: []
        )

        let resolvedCategory = UNNotificationCategory(
            identifier: Self.resolvedCategoryIdentifier,
            actions: [okAction],
            intentIdentifiers: [],
            options: []
        )

        // Preserve existing categories and add our three categories
        center.getNotificationCategories { existingCategories in
            var allCategories = existingCategories
            allCategories.insert(permissionCategory)
            allCategories.insert(timeoutCategory)
            allCategories.insert(resolvedCategory)
            self.center.setNotificationCategories(allCategories)
            print("[NotificationManager] Notification categories registered")
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
        content.categoryIdentifier = Self.permissionCategoryIdentifier

        // Store request ID and full prompt in userInfo for later reference
        content.userInfo = [
            "requestId": request.id,
            "summary": request.summary,
            "rawPrompt": request.details.rawPrompt
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

    /// Send notification for a timed-out permission request
    /// - Parameter request: The permission request that timed out
    func notifyTimeout(_ request: PermissionRequest) async {
        guard authorizationStatus == .authorized else {
            print("[NotificationManager] Cannot send timeout notification: not authorized")
            return
        }

        let content = UNMutableNotificationContent()
        content.title = "Request Timed Out"
        content.body = truncateSummary(request.summary)
        content.sound = .default
        content.categoryIdentifier = Self.timeoutCategoryIdentifier

        // Store request ID and prompt for retry functionality
        content.userInfo = [
            "requestId": request.id,
            "summary": request.summary,
            "rawPrompt": request.details.rawPrompt,
            "isTimeout": true
        ]

        let notificationRequest = UNNotificationRequest(
            identifier: "\(request.id)-timeout",
            content: content,
            trigger: nil
        )

        do {
            try await center.add(notificationRequest)
            print("[NotificationManager] Timeout notification sent: \(request.id)")
        } catch {
            print("[NotificationManager] Failed to send timeout notification: \(error)")
        }
    }

    /// Send notification when a permission request is resolved
    /// - Parameters:
    ///   - request: The permission request that was resolved
    ///   - decision: The decision that was made
    func notifyPermissionResolved(_ request: PermissionRequest, decision: Decision) async {
        guard authorizationStatus == .authorized else {
            print("[NotificationManager] Cannot send resolved notification: not authorized")
            return
        }

        let content = UNMutableNotificationContent()
        content.title = decision == .allow ? "Request Allowed ✓" : "Request Denied ✗"
        content.body = truncateSummary(request.summary, maxLength: 60)
        content.sound = .default
        content.categoryIdentifier = Self.resolvedCategoryIdentifier

        let notificationRequest = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )

        do {
            try await center.add(notificationRequest)
            print("[NotificationManager] Permission resolved notification sent: \(request.id) (\(decision))")
        } catch {
            print("[NotificationManager] Failed to send resolved notification: \(error)")
        }
    }

    /// Send notification when Claude is ready and waiting for user input
    func notifyClaudeReady() async {
        guard authorizationStatus == .authorized else {
            print("[NotificationManager] Cannot send Claude ready notification: not authorized")
            return
        }

        let content = UNMutableNotificationContent()
        content.title = "Claude is Ready"
        content.body = "Waiting for your input"
        content.sound = .default
        content.categoryIdentifier = Self.resolvedCategoryIdentifier

        let notificationRequest = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )

        do {
            try await center.add(notificationRequest)
            print("[NotificationManager] Claude ready notification sent")
        } catch {
            print("[NotificationManager] Failed to send Claude ready notification: \(error)")
        }
    }

    /// Truncate summary to fit in notification
    private func truncateSummary(_ summary: String, maxLength: Int = 40) -> String {
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
    /// Only shows notifications when the app is in background
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        print("[NotificationManager] Will present notification: \(notification.request.identifier)")

        // Check if app is active (foreground) - if so, don't show notification
        // Access isAppActive from MainActor context
        let isActive = MainActor.assumeIsolated {
            return self.isAppActive
        }

        if isActive {
            print("[NotificationManager] App is active, suppressing notification")
            completionHandler([])
        } else {
            print("[NotificationManager] App is inactive, showing notification")
            completionHandler([.banner, .list, .sound])
        }
    }

    /// Handle notification tap (when user taps the notification)
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        print("[NotificationManager] Did receive notification response: \(response.actionIdentifier)")

        // Extract request ID from notification userInfo
        let requestId = response.notification.request.content.userInfo["requestId"] as? String
        let rawPrompt = response.notification.request.content.userInfo["rawPrompt"] as? String

        // Handle action buttons
        let decision: Decision?
        switch response.actionIdentifier {
        case Self.allowActionIdentifier:
            guard let requestId = requestId else {
                completionHandler()
                return
            }
            decision = .allow
            print("[NotificationManager] User allowed request: \(requestId)")

        case Self.denyActionIdentifier:
            guard let requestId = requestId else {
                completionHandler()
                return
            }
            decision = .deny
            print("[NotificationManager] User denied request: \(requestId)")

        case Self.retryActionIdentifier:
            // Handle retry action for timeout notifications
            guard let requestId = requestId else {
                completionHandler()
                return
            }
            print("[NotificationManager] User requested retry: \(requestId)")
            Task { @MainActor in
                self.onRetryRequested?(requestId)
            }
            completionHandler()
            return

        case Self.dismissActionIdentifier, Self.okActionIdentifier:
            // Just dismiss the notification, no action needed
            print("[NotificationManager] User dismissed notification")
            completionHandler()
            return

        case UNNotificationDefaultActionIdentifier:
            // User tapped the notification body (not an action button)
            // Show full prompt if available
            if let requestId = requestId, let rawPrompt = rawPrompt {
                print("[NotificationManager] User tapped notification: \(requestId)")
                Task { @MainActor in
                    self.onNotificationTapped?(requestId, rawPrompt)
                }
            }
            completionHandler()
            return

        default:
            completionHandler()
            return
        }

        // Notify the callback if a decision was made
        if let decision = decision, let requestId = requestId {
            Task { @MainActor in
                self.onDecisionMade?(requestId, decision)
            }
        }

        completionHandler()
    }
}
