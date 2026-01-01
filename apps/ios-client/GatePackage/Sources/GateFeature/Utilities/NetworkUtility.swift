import Foundation
import Network

#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

/// Utility for network-related operations
enum NetworkUtility {
    struct NetworkInterfaceAddress {
        let name: String
        let family: sa_family_t
        let address: String?
    }

    /// Get the device's current WiFi IP address
    /// Returns nil if no WiFi connection is available
    static func getWiFiIPAddress(
        interfaceProvider: () -> [NetworkInterfaceAddress] = NetworkUtility.loadInterfaceAddresses
    ) -> String? {
        for interface in interfaceProvider() {
            guard interface.family == sa_family_t(AF_INET) else { continue }
            guard interface.name == "en0" else { continue }
            guard let address = interface.address, !address.isEmpty else { continue }
            return address
        }

        return nil
    }

    /// Get default broker URL using WiFi IP address
    /// Falls back to localhost if WiFi IP is not available
    ///
    /// - Note: Returns the device's own IP address, assuming the broker runs on the same device.
    ///
    /// - Warning: Uses plain HTTP for local development only. This means pairing codes and tokens
    ///   are transmitted in plaintext over the network. Only use this on trusted local networks
    ///   (e.g., your home WiFi). For production use, the broker should implement HTTPS with proper
    ///   certificate validation. Users can manually edit the URL in the pairing screen if needed.
    static func getDefaultBrokerURL(
        ipAddressProvider: () -> String? = NetworkUtility.getWiFiIPAddress
    ) -> String {
        guard let ipAddress = ipAddressProvider(), !ipAddress.isEmpty else {
            return "http://localhost:3000"
        }

        // Return the device's own IP address with broker port
        // The user can manually edit this if the broker runs on a different machine
        return "http://\(ipAddress):3000"
    }

    private static func loadInterfaceAddresses() -> [NetworkInterfaceAddress] {
        var addresses: [NetworkInterfaceAddress] = []
        var ifaddr: UnsafeMutablePointer<ifaddrs>?

        guard getifaddrs(&ifaddr) == 0 else { return addresses }
        defer { freeifaddrs(ifaddr) }

        var ptr = ifaddr
        while ptr != nil {
            defer { ptr = ptr?.pointee.ifa_next }

            guard let interface = ptr?.pointee, let addrPointer = interface.ifa_addr else { continue }

            let name = String(cString: interface.ifa_name)
            let family = addrPointer.pointee.sa_family
            let address = family == sa_family_t(AF_INET) ? convertIPv4Address(UnsafePointer(addrPointer)) : nil

            addresses.append(
                NetworkInterfaceAddress(
                    name: name,
                    family: family,
                    address: address
                )
            )
        }

        return addresses
    }

    private static func convertIPv4Address(_ addressPointer: UnsafePointer<sockaddr>) -> String? {
        addressPointer.withMemoryRebound(to: sockaddr_in.self, capacity: 1) { sockAddrInPtr in
            formatIPv4Address(sockAddrInPtr.pointee.sin_addr)
        }
    }

    static func formatIPv4Address(_ sinAddress: in_addr) -> String? {
        var address = sinAddress
        var addrBuffer = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
        let result = withUnsafePointer(to: &address) { pointer in
            inet_ntop(
                AF_INET,
                pointer,
                &addrBuffer,
                socklen_t(INET_ADDRSTRLEN)
            )
        }

        guard result != nil else { return nil }
        return String(cString: addrBuffer)
    }
}
