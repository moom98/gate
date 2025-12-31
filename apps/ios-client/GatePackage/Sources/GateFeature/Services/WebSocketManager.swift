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
    private(set) var isClaudeIdle: Bool = false
    private(set) var resolvedPermissions: [ResolvedPermission] = []

    private var webSocketTask: URLSessionWebSocketTask?
    private let config: BrokerConfig
    private weak var notificationManager: NotificationManager?

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
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        status = .disconnected
        pendingRequests.removeAll()
        isClaudeIdle = false
        resolvedPermissions.removeAll()
    }

    func dismissIdleState() {
        isClaudeIdle = false
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

                    // Clear idle state when new request arrives
                    isClaudeIdle = false
                }
            case .permissionResolved(let resolved):
                if let request = pendingRequests.first(where: { $0.id == resolved.id }) {
                    if resolved.reason == "timeout" {
                        // Send timeout notification
                        await notificationManager?.notifyTimeout(request)
                    } else {
                        // Send completion notification for manual decisions
                        await notificationManager?.notifyPermissionResolved(request, decision: resolved.decision)

                        // Add to resolved permissions list for in-app display
                        let resolvedPermission = ResolvedPermission(
                            id: resolved.id,
                            request: request,
                            decision: resolved.decision
                        )
                        resolvedPermissions.insert(resolvedPermission, at: 0) // Insert at top
                    }
                }

                pendingRequests.removeAll { $0.id == resolved.id }

                // Mark request as resolved in notification manager
                await notificationManager?.markRequestResolved(resolved.id)
            case .claudeIdlePrompt:
                // Set idle state - will show card in UI
                isClaudeIdle = true

                // Also send notification (only shown when app is in background)
                await notificationManager?.notifyClaudeReady()
            }
        } catch {
            print("Failed to decode WebSocket message: \(error)")
        }
    }

    func removeRequest(withId id: String) {
        pendingRequests.removeAll { $0.id == id }
    }

    func removeResolvedPermission(withId id: String) {
        resolvedPermissions.removeAll { $0.id == id }
    }
}
