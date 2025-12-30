import Foundation

enum APIError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(statusCode: Int, message: String)
    case decodingError(Error)
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let statusCode, let message):
            return "HTTP \(statusCode): \(message)"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}

struct RetryResponse: Codable {
    let success: Bool
    let newId: String?
}

actor APIClient {
    private let config: BrokerConfig

    init(config: BrokerConfig) {
        self.config = config
    }

    func pair(code: String) async throws -> PairingResponse {
        guard let url = URL(string: "\(config.brokerURL)/v1/pair") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let payload = ["code": code]
        request.httpBody = try JSONEncoder().encode(payload)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }

            if httpResponse.statusCode != 200 {
                if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                    throw APIError.httpError(
                        statusCode: httpResponse.statusCode,
                        message: errorResponse.error ?? "Unknown error"
                    )
                }
                throw APIError.httpError(
                    statusCode: httpResponse.statusCode,
                    message: "Request failed"
                )
            }

            do {
                return try JSONDecoder().decode(PairingResponse.self, from: data)
            } catch {
                throw APIError.decodingError(error)
            }
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.networkError(error)
        }
    }

    func sendDecision(requestId: String, decision: Decision) async throws {
        guard let url = URL(string: "\(config.brokerURL)/v1/decisions") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = config.authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let payload = DecisionPayload(id: requestId, decision: decision)
        request.httpBody = try JSONEncoder().encode(payload)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }

            if httpResponse.statusCode != 200 {
                if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                    throw APIError.httpError(
                        statusCode: httpResponse.statusCode,
                        message: errorResponse.error ?? "Unknown error"
                    )
                }
                throw APIError.httpError(
                    statusCode: httpResponse.statusCode,
                    message: "Request failed"
                )
            }
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.networkError(error)
        }
    }

    func retryRequest(requestId: String) async throws -> RetryResponse {
        guard let url = URL(string: "\(config.brokerURL)/v1/requests/retry/\(requestId)") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = config.authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }

            if httpResponse.statusCode != 200 {
                if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                    throw APIError.httpError(
                        statusCode: httpResponse.statusCode,
                        message: errorResponse.error ?? "Unknown error"
                    )
                }
                throw APIError.httpError(
                    statusCode: httpResponse.statusCode,
                    message: "Request failed"
                )
            }

            do {
                return try JSONDecoder().decode(RetryResponse.self, from: data)
            } catch {
                throw APIError.decodingError(error)
            }
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.networkError(error)
        }
    }
}
