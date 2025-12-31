import SwiftUI

struct ResolvedPermissionCard: View {
    let resolvedPermission: ResolvedPermission

    private var truncatedSummary: String {
        if resolvedPermission.request.summary.count <= 80 {
            return resolvedPermission.request.summary
        }
        return String(resolvedPermission.request.summary.prefix(77)) + "..."
    }

    private var decisionColor: Color {
        switch resolvedPermission.decision {
        case .allow, .alwaysAllow:
            return .green
        case .deny:
            return .red
        }
    }

    private var decisionText: String {
        switch resolvedPermission.decision {
        case .allow:
            return "Request Allowed ✓"
        case .deny:
            return "Request Denied ✗"
        case .alwaysAllow:
            return "Always Allowed ✓✓"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: resolvedPermission.decision == .deny ? "xmark.circle.fill" : "checkmark.circle.fill")
                    .foregroundColor(decisionColor)
                    .font(.title2)

                VStack(alignment: .leading, spacing: 4) {
                    Text(decisionText)
                        .font(.headline)
                        .foregroundColor(decisionColor)

                    Text(truncatedSummary)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }

            VStack(alignment: .leading, spacing: 8) {
                InfoRow(label: "Command", value: resolvedPermission.request.details.command)
                InfoRow(label: "Directory", value: resolvedPermission.request.details.cwd)
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(decisionColor.opacity(0.3), lineWidth: 2)
        )
    }
}
