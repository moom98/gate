import Foundation
import Observation

@Observable
@MainActor
final class AppState {
    var config: BrokerConfig
    var isAuthenticated: Bool {
        config.authToken != nil
    }

    private let authStorage = AuthStorage()
    private(set) var webSocketManager: WebSocketManager
    private(set) var notificationManager: NotificationManager

    init() {
        let initialConfig = BrokerConfig()
        self.config = initialConfig

        // Initialize managers
        let notificationManager = NotificationManager()
        self.notificationManager = notificationManager

        // Initialize WebSocket manager with notification manager
        self.webSocketManager = WebSocketManager(config: initialConfig, notificationManager: notificationManager)

        // Setup callbacks
        setupCallbacks()

        Task {
            await loadSavedCredentials()
        }
    }

    /// Setup all callbacks for notification and WebSocket managers
    private func setupCallbacks() {
        // Setup callback for notification actions
        notificationManager.onDecisionMade = { [weak self] requestId, decision in
            guard let self = self else { return }
            Task {
                await self.handleNotificationDecision(requestId: requestId, decision: decision)
            }
        }

        notificationManager.onRetryRequested = { [weak self] requestId in
            guard let self = self else { return }
            Task {
                await self.handleRetry(requestId: requestId)
            }
        }
    }

    /// Handle decision made from notification action buttons
    private func handleNotificationDecision(requestId: String, decision: Decision) async {
        let apiClient = APIClient(config: config)

        do {
            try await apiClient.sendDecision(requestId: requestId, decision: decision)
            print("[AppState] Decision sent successfully: \(requestId) -> \(decision)")

            // Remove from pending requests
            webSocketManager.removeRequest(withId: requestId)

            // Mark as resolved in notification manager
            await notificationManager.markRequestResolved(requestId)
        } catch {
            print("[AppState] Failed to send decision: \(error)")
            // Note: In a production app, you might want to show an error to the user
            // For now, we just log it since notification actions don't have easy UI feedback
        }
    }

    /// Handle retry request from timeout notification
    private func handleRetry(requestId: String) async {
        let apiClient = APIClient(config: config)

        do {
            let response = try await apiClient.retryRequest(requestId: requestId)
            if response.success, let newId = response.newId {
                print("[AppState] Retry successful, new request ID: \(newId)")
            } else {
                print("[AppState] Retry failed: request not found")
            }
        } catch {
            print("[AppState] Retry failed: \(error)")
        }
    }

    func loadSavedCredentials() async {
        if let token = await authStorage.loadToken() {
            config.authToken = token
        }

        if let url = await authStorage.loadBrokerURL() {
            config.brokerURL = url
        }

        if config.authToken != nil {
            webSocketManager.connect()
        }
    }

    func authenticate(token: String, brokerURL: String) async {
        config.authToken = token
        config.brokerURL = brokerURL

        await authStorage.saveToken(token)
        await authStorage.saveBrokerURL(brokerURL)

        webSocketManager = WebSocketManager(config: config, notificationManager: notificationManager)
        setupCallbacks() // Re-setup callbacks after creating new WebSocketManager
        webSocketManager.connect()
    }

    func logout() async {
        await authStorage.clearToken()
        config.authToken = nil
        webSocketManager.disconnect()
    }
}
