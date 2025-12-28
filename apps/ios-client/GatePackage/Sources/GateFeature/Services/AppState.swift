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

    init() {
        let initialConfig = BrokerConfig()
        self.config = initialConfig
        self.webSocketManager = WebSocketManager(config: initialConfig)

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

        webSocketManager = WebSocketManager(config: config)
        webSocketManager.connect()
    }

    func logout() async {
        await authStorage.clearToken()
        config.authToken = nil
        webSocketManager.disconnect()
    }
}
