import Foundation

enum WebSocketMessage: Codable, Sendable {
    case permissionRequest(PermissionRequest)
    case permissionResolved(PermissionResolved)

    struct PermissionResolved: Codable, Sendable {
        let id: String
        let decision: Decision
    }

    enum CodingKeys: String, CodingKey {
        case type
        case id
        case summary
        case details
        case timeoutSec
        case decision
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)

        switch type {
        case "permission_request":
            let id = try container.decode(String.self, forKey: .id)
            let summary = try container.decode(String.self, forKey: .summary)
            let details = try container.decode(PermissionRequest.Details.self, forKey: .details)
            let timeoutSec = try container.decode(Int.self, forKey: .timeoutSec)
            self = .permissionRequest(PermissionRequest(
                id: id,
                summary: summary,
                details: details,
                timeoutSec: timeoutSec
            ))

        case "permission_resolved":
            let id = try container.decode(String.self, forKey: .id)
            let decision = try container.decode(Decision.self, forKey: .decision)
            self = .permissionResolved(PermissionResolved(id: id, decision: decision))

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
            try container.encode(request.id, forKey: .id)
            try container.encode(request.summary, forKey: .summary)
            try container.encode(request.details, forKey: .details)
            try container.encode(request.timeoutSec, forKey: .timeoutSec)

        case .permissionResolved(let resolved):
            try container.encode("permission_resolved", forKey: .type)
            try container.encode(resolved.id, forKey: .id)
            try container.encode(resolved.decision, forKey: .decision)
        }
    }
}
