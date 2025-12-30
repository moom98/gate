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

        // Initialize notification manager first
        let notificationManager = NotificationManager()
        self.notificationManager = notificationManager

        // Then initialize WebSocket manager with notification manager
        self.webSocketManager = WebSocketManager(config: initialConfig, notificationManager: notificationManager)

        // Setup callback for notification actions
        notificationManager.onDecisionMade = { [weak self] requestId, decision in
            guard let self = self else { return }
            Task {
                await self.handleNotificationDecision(requestId: requestId, decision: decision)
            }
        }

        Task {
            await loadSavedCredentials()
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
        webSocketManager.connect()
    }

    func logout() async {
        await authStorage.clearToken()
        config.authToken = nil
        webSocketManager.disconnect()
    }
}
