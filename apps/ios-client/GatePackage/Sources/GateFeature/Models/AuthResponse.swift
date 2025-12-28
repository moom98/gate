import Foundation

struct PairingCodeResponse: Codable, Sendable {
    let success: Bool
    let code: String
    let expiresIn: String
}

struct PairingResponse: Codable, Sendable {
    let success: Bool
    let token: String
}

struct ErrorResponse: Codable, Sendable {
    let success: Bool
    let error: String?
}
