import Foundation

actor AuthStorage {
    private let tokenKey = "gate.broker.token"
    private let urlKey = "gate.broker.url"

    func saveToken(_ token: String) {
        UserDefaults.standard.set(token, forKey: tokenKey)
    }

    func loadToken() -> String? {
        UserDefaults.standard.string(forKey: tokenKey)
    }

    func clearToken() {
        UserDefaults.standard.removeObject(forKey: tokenKey)
    }

    func saveBrokerURL(_ url: String) {
        UserDefaults.standard.set(url, forKey: urlKey)
    }

    func loadBrokerURL() -> String? {
        UserDefaults.standard.string(forKey: urlKey)
    }
}
