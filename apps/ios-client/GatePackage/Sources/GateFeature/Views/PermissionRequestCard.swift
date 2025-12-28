import SwiftUI

struct PermissionRequestCard: View {
    let request: PermissionRequest
    let onDecision: (Decision) async -> Void

    @State private var isSending = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(request.summary)
                .font(.headline)

            VStack(alignment: .leading, spacing: 8) {
                InfoRow(label: "Command", value: request.details.command)
                InfoRow(label: "Directory", value: request.details.cwd)
                InfoRow(label: "Prompt", value: request.details.rawPrompt)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundColor(.red)
            }

            HStack(spacing: 12) {
                Button {
                    Task {
                        await sendDecision(.deny)
                    }
                } label: {
                    HStack {
                        Spacer()
                        if isSending {
                            ProgressView()
                                .progressViewStyle(.circular)
                        } else {
                            Text("Deny")
                        }
                        Spacer()
                    }
                }
                .buttonStyle(.bordered)
                .tint(.red)
                .disabled(isSending)

                Button {
                    Task {
                        await sendDecision(.allow)
                    }
                } label: {
                    HStack {
                        Spacer()
                        if isSending {
                            ProgressView()
                                .progressViewStyle(.circular)
                        } else {
                            Text("Allow")
                        }
                        Spacer()
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .disabled(isSending)
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }

    private func sendDecision(_ decision: Decision) async {
        isSending = true
        errorMessage = nil
        defer { isSending = false }

        await onDecision(decision)
    }
}

struct InfoRow: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(value)
                .font(.body)
                .textSelection(.enabled)
        }
    }
}
