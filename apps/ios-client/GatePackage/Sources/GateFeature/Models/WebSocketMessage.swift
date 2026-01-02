import Foundation

enum WebSocketMessage: Codable, Sendable {
    case permissionRequest(PermissionRequest)
    case permissionResolved(PermissionResolved)
    case claudeIdlePrompt(ClaudeIdlePrompt)
    case codexTurnComplete(CodexTurnComplete)

    struct PermissionResolved: Codable, Sendable {
        let id: String
        let decision: Decision
        let reason: String?
    }

    struct ClaudeIdlePrompt: Codable, Sendable {
        let type: String
        let ts: String
        let project: String?
    }

    struct CodexTurnComplete: Codable, Sendable {
        let type: String
        let threadId: String
        let cwd: String
        let ts: String
        let message: String?
    }

    enum CodingKeys: String, CodingKey {
        case type
        case payload
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)

        switch type {
        case "permission_request":
            let payload = try container.decode(PermissionRequest.self, forKey: .payload)
            self = .permissionRequest(payload)

        case "permission_resolved":
            let payload = try container.decode(PermissionResolved.self, forKey: .payload)
            self = .permissionResolved(payload)

        case "claude_idle_prompt":
            let payload = try container.decode(ClaudeIdlePrompt.self, forKey: .payload)
            self = .claudeIdlePrompt(payload)

        case "codex_turn_complete":
            let payload = try container.decode(CodexTurnComplete.self, forKey: .payload)
            self = .codexTurnComplete(payload)

        default:
            throw DecodingError.dataCorruptedError(
                forKey: .type,
                in: container,
                debugDescription: "Unknown message type: \(type)"
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)

        switch self {
        case .permissionRequest(let request):
            try container.encode("permission_request", forKey: .type)
            try container.encode(request, forKey: .payload)

        case .permissionResolved(let resolved):
            try container.encode("permission_resolved", forKey: .type)
            try container.encode(resolved, forKey: .payload)

        case .claudeIdlePrompt(let event):
            try container.encode("claude_idle_prompt", forKey: .type)
            try container.encode(event, forKey: .payload)

        case .codexTurnComplete(let event):
            try container.encode("codex_turn_complete", forKey: .type)
            try container.encode(event, forKey: .payload)
        }
    }
}
