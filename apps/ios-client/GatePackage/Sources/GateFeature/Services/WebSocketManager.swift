import Foundation
import Observation

enum ConnectionStatus {
    case disconnected
    case connecting
    case connected
    case error(String)
}

@MainActor
@Observable
final class WebSocketManager {
    private(set) var status: ConnectionStatus = .disconnected
    private(set) var pendingRequests: [PermissionRequest] = []

    private var webSocketTask: URLSessionWebSocketTask?
    private let config: BrokerConfig

    init(config: BrokerConfig) {
        self.config = config
    }

    func connect() {
        if case .connected = status { return }
        if case .connecting = status { return }

        status = .connecting

        guard let token = config.authToken else {
            status = .error("No authentication token")
            return
        }

        guard var urlComponents = URLComponents(string: "\(config.wsURL)/ws") else {
            status = .error("Invalid URL")
            return
        }

        urlComponents.queryItems = [URLQueryItem(name: "token", value: token)]

        guard let url = urlComponents.url else {
            status = .error("Invalid URL")
            return
        }

        let session = URLSession(configuration: .default)
        webSocketTask = session.webSocketTask(with: url)
        webSocketTask?.resume()

        status = .connected

        Task {
            await receiveMessages()
        }
    }

    func disconnect() {
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        status = .disconnected
        pendingRequests.removeAll()
    }

    private func receiveMessages() async {
        guard let webSocketTask = webSocketTask else { return }

        do {
            let message = try await webSocketTask.receive()

            switch message {
            case .string(let text):
                await handleTextMessage(text)

            case .data(let data):
                await handleDataMessage(data)

            @unknown default:
                break
            }

            await receiveMessages()

        } catch {
            if case .connected = status {
                status = .error("Connection lost: \(error.localizedDescription)")
            }
        }
    }

    private func handleTextMessage(_ text: String) async {
        guard let data = text.data(using: .utf8) else { return }
        await handleDataMessage(data)
    }

    private func handleDataMessage(_ data: Data) async {
        do {
            let message = try JSONDecoder().decode(WebSocketMessage.self, from: data)

            switch message {
            case .permissionRequest(let request):
                if !pendingRequests.contains(where: { $0.id == request.id }) {
                    pendingRequests.append(request)
                }
            case .permissionResolved(let resolved):
                pendingRequests.removeAll { $0.id == resolved.id }
            }
        } catch {
            print("Failed to decode WebSocket message: \(error)")
        }
    }

    func removeRequest(withId id: String) {
        pendingRequests.removeAll { $0.id == id }
    }
}
