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
    private weak var notificationManager: NotificationManager?
    private var idleTimer: Task<Void, Never>?
    private let idleTimeoutSeconds: Double = 10.0

    init(config: BrokerConfig, notificationManager: NotificationManager? = nil) {
        self.config = config
        self.notificationManager = notificationManager
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
        idleTimer?.cancel()
        idleTimer = nil
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

                    // Send notification for new permission request
                    await notificationManager?.notifyPermissionRequest(request)

                    // Reset idle timer on new request
                    resetIdleTimer()
                }
            case .permissionResolved(let resolved):
                // Only send timeout notifications, not completion notifications
                if let request = pendingRequests.first(where: { $0.id == resolved.id }) {
                    if resolved.reason == "timeout" {
                        await notificationManager?.notifyTimeout(request)
                    }
                }

                pendingRequests.removeAll { $0.id == resolved.id }

                // Mark request as resolved in notification manager
                await notificationManager?.markRequestResolved(resolved.id)

                // Reset idle timer after request resolution
                resetIdleTimer()
            }
        } catch {
            print("Failed to decode WebSocket message: \(error)")
        }
    }

    private func resetIdleTimer() {
        // Cancel existing timer
        idleTimer?.cancel()

        // Only start idle timer if there are no pending requests
        guard pendingRequests.isEmpty else {
            idleTimer = nil
            return
        }

        // Start new idle timer
        idleTimer = Task { @MainActor in
            try? await Task.sleep(for: .seconds(idleTimeoutSeconds))

            // Check if task was cancelled
            guard !Task.isCancelled else { return }

            // Check again if there are no pending requests
            guard pendingRequests.isEmpty else { return }

            // Send "Claude ready" notification
            await notificationManager?.notifyClaudeReady()
        }
    }

    func removeRequest(withId id: String) {
        pendingRequests.removeAll { $0.id == id }

        // Reset idle timer when request is manually removed
        resetIdleTimer()
    }
}
