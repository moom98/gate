import Foundation
import Network

/// Utility for network-related operations
enum NetworkUtility {
    /// Get the device's current WiFi IP address
    /// Returns nil if no WiFi connection is available
    static func getWiFiIPAddress() -> String? {
        var address: String?
        var ifaddr: UnsafeMutablePointer<ifaddrs>?

        guard getifaddrs(&ifaddr) == 0 else { return nil }
        defer { freeifaddrs(ifaddr) }

        var ptr = ifaddr
        while ptr != nil {
            defer { ptr = ptr?.pointee.ifa_next }

            guard let interface = ptr?.pointee else { continue }

            // Check for IPv4 interface
            let addrFamily = interface.ifa_addr.pointee.sa_family
            guard addrFamily == UInt8(AF_INET) else { continue }

            // Get interface name
            let name = String(cString: interface.ifa_name)

            // We're looking for en0 (WiFi interface on iOS)
            guard name == "en0" else { continue }

            // Convert address to string
            var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            getnameinfo(
                interface.ifa_addr,
                socklen_t(interface.ifa_addr.pointee.sa_len),
                &hostname,
                socklen_t(hostname.count),
                nil,
                socklen_t(0),
                NI_NUMERICHOST
            )

            address = String(cString: hostname)
        }

        return address
    }

    /// Get default broker URL using WiFi IP address
    /// Falls back to localhost if WiFi IP is not available
    static func getDefaultBrokerURL() -> String {
        guard let ipAddress = getWiFiIPAddress() else {
            return "http://localhost:3000"
        }

        // Try to construct gateway IP (usually .1 on the network)
        let components = ipAddress.split(separator: ".")
        guard components.count == 4 else {
            // Fallback to device's own IP if parsing fails
            return "http://\(ipAddress):3000"
        }

        // Replace last octet with 1 (common gateway address)
        // e.g., 192.168.1.50 -> 192.168.1.1
        let gatewayIP = "\(components[0]).\(components[1]).\(components[2]).1"
        return "http://\(gatewayIP):3000"
    }
}
