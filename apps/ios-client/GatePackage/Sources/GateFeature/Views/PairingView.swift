import SwiftUI

public struct PairingView: View {
    @Environment(AppState.self) private var appState

    @State private var brokerURL = NetworkUtility.getDefaultBrokerURL()
    @State private var pairingCode = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    public var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Broker URL", text: $brokerURL)
                        .textContentType(.URL)
                        .autocapitalization(.none)
                        .disabled(isLoading)
                } header: {
                    Text("Server Configuration")
                } footer: {
                    Text("Enter the broker server URL (e.g., http://192.168.1.100:3000)")
                }

                Section {
                    TextField("Pairing Code", text: $pairingCode)
                        .keyboardType(.numberPad)
                        .disabled(isLoading)
                        .onChange(of: pairingCode) { _, newValue in
                            pairingCode = String(newValue.prefix(6).filter { $0.isNumber })
                        }
                } header: {
                    Text("Pairing Code")
                } footer: {
                    Text("Enter the 6-digit code displayed on the broker console")
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundColor(.red)
                    }
                }

                Section {
                    Button {
                        Task {
                            await performPairing()
                        }
                    } label: {
                        HStack {
                            Spacer()
                            if isLoading {
                                ProgressView()
                                    .progressViewStyle(.circular)
                            } else {
                                Text("Pair Device")
                            }
                            Spacer()
                        }
                    }
                    .disabled(pairingCode.count != 6 || isLoading)
                }
            }
            .navigationTitle("Pair with Broker")
        }
    }

    public init() {}

    private func performPairing() async {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }

        let apiClient = APIClient(config: BrokerConfig(brokerURL: brokerURL))

        do {
            let response = try await apiClient.pair(code: pairingCode)

            await appState.authenticate(token: response.token, brokerURL: brokerURL)

        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
