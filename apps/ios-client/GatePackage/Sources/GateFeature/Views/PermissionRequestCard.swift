import SwiftUI

struct PermissionRequestCard: View {
    let request: PermissionRequest
    let onDecision: (Decision) async -> Void

    @State private var isSending = false
    @State private var errorMessage: String?
    @State private var isPromptExpanded = false

    // Truncate summary to 80 characters
    private var truncatedSummary: String {
        if request.summary.count <= 80 {
            return request.summary
        }
        return String(request.summary.prefix(77)) + "..."
    }

    // Truncate prompt to 100 characters when collapsed
    private var displayPrompt: String {
        if isPromptExpanded || request.details.rawPrompt.count <= 100 {
            return request.details.rawPrompt
        }
        return String(request.details.rawPrompt.prefix(97)) + "..."
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(truncatedSummary)
                .font(.headline)

            VStack(alignment: .leading, spacing: 8) {
                InfoRow(label: "Command", value: request.details.command)
                InfoRow(label: "Directory", value: request.details.cwd)

                // Prompt with expand/collapse
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Prompt")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Spacer()

                        if request.details.rawPrompt.count > 100 {
                            Button {
                                isPromptExpanded.toggle()
                            } label: {
                                Text(isPromptExpanded ? "Show less" : "Show more")
                                    .font(.caption2)
                            }
                        }
                    }

                    Text(displayPrompt)
                        .font(.body)
                        .textSelection(.enabled)
                }
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
                                .font(.caption)
                        }
                        Spacer()
                    }
                }
                .buttonStyle(.bordered)
                .tint(.red)
                .disabled(isSending)

                // Show Always Allow button only if allowed
                if request.allowAlwaysAllow == true {
                    Button {
                        Task {
                            await sendDecision(.alwaysAllow)
                        }
                    } label: {
                        HStack {
                            Spacer()
                            if isSending {
                                ProgressView()
                                    .progressViewStyle(.circular)
                            } else {
                                Text("Always Allow")
                                    .font(.caption)
                            }
                            Spacer()
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.blue)
                    .disabled(isSending)
                }

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
                                .font(.caption)
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
