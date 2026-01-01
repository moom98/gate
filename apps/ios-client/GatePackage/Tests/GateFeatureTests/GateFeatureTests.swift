import Testing
@testable import GateFeature

#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

@Test("WiFi address returns nil when WiFi interface is unavailable")
func wifiIPAddressReturnsNilWithoutWiFiInterface() {
    let interfaces = [
        makeInterface(name: "lo0", address: "127.0.0.1"),
        makeInterface(name: "en1", address: "192.168.1.20")
    ]

    let address = NetworkUtility.getWiFiIPAddress(interfaceProvider: { interfaces })
    #expect(address == nil)
}

@Test("WiFi address returns IPv4 address for en0")
func wifiIPAddressReturnsEn0IPv4Address() {
    let interfaces = [
        makeInterface(name: "lo0", address: "127.0.0.1"),
        makeInterface(name: "en0", address: "192.168.1.42")
    ]

    let address = NetworkUtility.getWiFiIPAddress(interfaceProvider: { interfaces })
    #expect(address == "192.168.1.42")
}

@Test("WiFi address skips entries when inet_ntop fails")
func wifiIPAddressSkipsInterfacesWithoutResolvedAddress() {
    let interfaces = [
        makeInterface(name: "en0", address: nil)
    ]

    let address = NetworkUtility.getWiFiIPAddress(interfaceProvider: { interfaces })
    #expect(address == nil)
}

@Test("Default broker URL falls back to localhost")
func defaultBrokerURLFallsBackToLocalhost() {
    let url = NetworkUtility.getDefaultBrokerURL(ipAddressProvider: { nil })
    #expect(url == "http://localhost:3000")
}

@Test("Default broker URL uses detected WiFi IP address")
func defaultBrokerURLUsesWiFiAddress() {
    let url = NetworkUtility.getDefaultBrokerURL(ipAddressProvider: { "10.0.0.15" })
    #expect(url == "http://10.0.0.15:3000")
}

@Test("formatIPv4Address converts network byte order correctly")
func formatIPv4AddressConvertsBytes() throws {
    var address = in_addr()
    let conversionResult = withUnsafeMutablePointer(to: &address) { pointer in
        inet_pton(AF_INET, "192.168.50.4", pointer)
    }

    #expect(conversionResult == 1)
    #expect(NetworkUtility.formatIPv4Address(address) == "192.168.50.4")
}

private func makeInterface(
    name: String,
    family: sa_family_t = sa_family_t(AF_INET),
    address: String?
) -> NetworkUtility.NetworkInterfaceAddress {
    NetworkUtility.NetworkInterfaceAddress(
        name: name,
        family: family,
        address: address
    )
}
