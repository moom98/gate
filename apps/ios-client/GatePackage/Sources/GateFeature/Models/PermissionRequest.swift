import Foundation

struct PermissionRequest: Identifiable, Codable, Sendable {
    let id: String
    let summary: String
    let details: Details
    let timeoutSec: Int

    struct Details: Codable, Sendable {
        let cwd: String
        let command: String
        let rawPrompt: String
    }
}

enum Decision: String, Codable, Sendable {
    case allow
    case deny
    case alwaysAllow
}

struct DecisionPayload: Codable, Sendable {
    let id: String
    let decision: Decision
}
