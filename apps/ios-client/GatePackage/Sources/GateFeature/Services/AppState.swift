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

        Task {
            await loadSavedCredentials()
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
