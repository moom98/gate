import SwiftUI

struct ClaudeIdleCard: View {
    let onDismiss: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            // Icon
            Image(systemName: "checkmark.circle.fill")
                .font(.title2)
                .foregroundStyle(.green)

            // Text content
            VStack(alignment: .leading, spacing: 4) {
                Text("Claude is Ready")
                    .font(.headline)
                    .foregroundStyle(.primary)

                Text("Waiting for your input")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            // Dismiss button
            Button {
                onDismiss()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.green.opacity(0.1))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(.green.opacity(0.3), lineWidth: 1)
        )
        .padding(.horizontal)
        .transition(.move(edge: .top).combined(with: .opacity))
    }
}

#Preview {
    VStack {
        ClaudeIdleCard {
            print("Dismissed")
        }

        Spacer()
    }
}
