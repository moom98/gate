import Foundation
import Network

#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

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

            // Use inet_ntop() to convert sockaddr_in to IP address string
            // This is the most reliable method that handles byte order correctly
            var addrBuffer = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
            let result = interface.ifa_addr.withMemoryRebound(to: sockaddr_in.self, capacity: 1) { sockAddrInPtr in
                inet_ntop(
                    AF_INET,
                    &sockAddrInPtr.pointee.sin_addr,
                    &addrBuffer,
                    socklen_t(INET_ADDRSTRLEN)
                )
            }
            
            guard result != nil else {
                continue
            }
            
            address = String(cString: addrBuffer)
        }

        return address
    }

    /// Get default broker URL using WiFi IP address
    /// Falls back to localhost if WiFi IP is not available
    /// Note: Returns the device's own IP address, assuming the broker runs on the same device
    static func getDefaultBrokerURL() -> String {
        guard let ipAddress = getWiFiIPAddress() else {
            return "http://localhost:3000"
        }

        // Return the device's own IP address with broker port
        // The user can manually edit this if the broker runs on a different machine
        return "http://\(ipAddress):3000"
    }
}
