import Foundation

enum WebSocketMessage: Codable, Sendable {
    case permissionRequest(PermissionRequest)
    case permissionResolved(PermissionResolved)

    struct PermissionResolved: Codable, Sendable {
        let id: String
        let decision: Decision
        let reason: String?
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
        }
    }
}
