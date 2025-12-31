import SwiftUI

struct ToastView: View {
    let message: String
    let isSuccess: Bool
    @Binding var isPresented: Bool

    var body: some View {
        VStack {
            Spacer()

            HStack(spacing: 12) {
                Image(systemName: isSuccess ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .foregroundColor(isSuccess ? .green : .red)
                    .font(.title2)

                Text(message)
                    .font(.body)
                    .foregroundColor(.primary)

                Spacer()

                Button {
                    withAnimation {
                        isPresented = false
                    }
                } label: {
                    Text("OK")
                        .font(.caption)
                        .fontWeight(.semibold)
                }
            }
            .padding()
            .background(Color(.secondarySystemBackground))
            .cornerRadius(12)
            .shadow(radius: 8)
            .padding(.horizontal)
            .padding(.bottom, 20)
        }
        .transition(.move(edge: .bottom).combined(with: .opacity))
        .onAppear {
            // Auto-dismiss after 5 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
                withAnimation {
                    isPresented = false
                }
            }
        }
    }
}

// Toast notification manager for easy display
@MainActor
@Observable
final class ToastManager {
    var currentToast: ToastData?

    struct ToastData: Identifiable {
        let id = UUID()
        let message: String
        let isSuccess: Bool
    }

    func show(_ message: String, isSuccess: Bool = true) {
        currentToast = ToastData(message: message, isSuccess: isSuccess)
    }

    func dismiss() {
        currentToast = nil
    }
}

// View modifier for toast presentation
struct ToastModifier: ViewModifier {
    @Bindable var toastManager: ToastManager

    func body(content: Content) -> some View {
        content
            .overlay {
                if let toast = toastManager.currentToast {
                    ToastView(
                        message: toast.message,
                        isSuccess: toast.isSuccess,
                        isPresented: Binding(
                            get: { toastManager.currentToast != nil },
                            set: { if !$0 { toastManager.dismiss() } }
                        )
                    )
                    .zIndex(999)
                }
            }
    }
}

extension View {
    func toast(manager: ToastManager) -> some View {
        modifier(ToastModifier(toastManager: manager))
    }
}
