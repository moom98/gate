import Foundation
import Network

/// Utility for network-related operations
enum NetworkUtility {
    /// Get the WiFi IP address of the device
    /// - Returns: WiFi IP address string, or nil if not available
    static func getWiFiIPAddress() -> String? {
        var address: String?

        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0 else { return nil }
        defer { freeifaddrs(ifaddr) }

        var ptr = ifaddr
        while ptr != nil {
            defer { ptr = ptr?.pointee.ifa_next }

            guard let interface = ptr?.pointee else { continue }
            let addrFamily = interface.ifa_addr.pointee.sa_family

            // Check for IPv4
            if addrFamily == UInt8(AF_INET) {
                let name = String(cString: interface.ifa_name)

                // Check if this is a WiFi interface
                if name == "en0" {
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
                    // Find the null terminator and create string from UTF-8 bytes
                    if let nullIndex = hostname.firstIndex(of: 0) {
                        let utf8Data = hostname[0..<nullIndex].map { UInt8(bitPattern: $0) }
                        address = String(decoding: utf8Data, as: UTF8.self)
                    }
                }
            }
        }

        return address
    }

    /// Generate default broker URL based on WiFi gateway IP
    /// - Returns: Default broker URL (e.g., "http://192.168.1.1:3000")
    static func generateDefaultBrokerURL() -> String {
        // Try to get WiFi IP address
        if let wifiIP = getWiFiIPAddress() {
            // Extract gateway IP (assume it's xxx.xxx.xxx.1)
            let components = wifiIP.split(separator: ".")
            if components.count == 4 {
                let gatewayIP = "\(components[0]).\(components[1]).\(components[2]).1"
                return "http://\(gatewayIP):3000"
            }
        }

        // Fallback to localhost
        return "http://localhost:3000"
    }
}
