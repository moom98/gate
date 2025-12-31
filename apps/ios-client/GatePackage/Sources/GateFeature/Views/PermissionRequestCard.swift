import SwiftUI

struct PermissionRequestCard: View {
    let request: PermissionRequest
    let onDecision: (Decision) async -> Void

    @State private var isSending = false
    @State private var errorMessage: String?
    @State private var expandedField: ExpandedField? = nil

    enum ExpandedField: Identifiable {
        case command
        case directory
        case prompt

        var id: Self { self }
    }

    // Truncate summary to 80 characters
    private var truncatedSummary: String {
        if request.summary.count <= 80 {
            return request.summary
        }
        return String(request.summary.prefix(77)) + "..."
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(truncatedSummary)
                .font(.headline)
                .lineLimit(2)

            VStack(alignment: .leading, spacing: 8) {
                ExpandableInfoRow(
                    label: "Command",
                    value: request.details.command,
                    isExpanded: expandedField == .command
                ) {
                    expandedField = .command
                }

                ExpandableInfoRow(
                    label: "Directory",
                    value: request.details.cwd,
                    isExpanded: expandedField == .directory
                ) {
                    expandedField = .directory
                }

                ExpandableInfoRow(
                    label: "Prompt",
                    value: request.details.rawPrompt,
                    isExpanded: expandedField == .prompt
                ) {
                    expandedField = .prompt
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
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
        .sheet(item: $expandedField) { field in
            ExpandedTextView(
                title: fieldTitle(for: field),
                text: fieldValue(for: field)
            )
        }
    }

    private func sendDecision(_ decision: Decision) async {
        isSending = true
        errorMessage = nil
        defer { isSending = false }

        await onDecision(decision)
    }

    private func fieldTitle(for field: ExpandedField) -> String {
        switch field {
        case .command:
            return "Command"
        case .directory:
            return "Directory"
        case .prompt:
            return "Prompt"
        }
    }

    private func fieldValue(for field: ExpandedField) -> String {
        switch field {
        case .command:
            return request.details.command
        case .directory:
            return request.details.cwd
        case .prompt:
            return request.details.rawPrompt
        }
    }
}

// Expandable info row component
struct ExpandableInfoRow: View {
    let label: String
    let value: String
    let isExpanded: Bool
    let onTap: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)

            HStack {
                Text(value)
                    .font(.body)
                    .lineLimit(2)
                    .textSelection(.enabled)

                Spacer()

                if needsExpansion {
                    Button {
                        onTap()
                    } label: {
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(.blue)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            if needsExpansion {
                onTap()
            }
        }
    }

    private var needsExpansion: Bool {
        // Check if text would exceed 2 lines (rough estimate)
        let font = UIFont.preferredFont(forTextStyle: .body)
        let lineHeight = font.lineHeight
        let maxHeight = lineHeight * 2
        let textHeight = value.boundingRect(
            with: CGSize(width: 300, height: CGFloat.greatestFiniteMagnitude),
            options: .usesLineFragmentOrigin,
            attributes: [.font: font],
            context: nil
        ).height

        return textHeight > maxHeight
    }
}

// Expanded text view (full screen)
struct ExpandedTextView: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let text: String

    var body: some View {
        NavigationStack {
            ScrollView {
                Text(text)
                    .font(.body)
                    .padding()
                    .textSelection(.enabled)
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}
