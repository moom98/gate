import Foundation

struct BrokerConfig {
    var brokerURL: String
    var authToken: String?

    init(brokerURL: String = "http://localhost:3000", authToken: String? = nil) {
        self.brokerURL = brokerURL
        self.authToken = authToken
    }

    var wsURL: String {
        brokerURL
            .replacingOccurrences(of: "http://", with: "ws://")
            .replacingOccurrences(of: "https://", with: "wss://")
    }
}
