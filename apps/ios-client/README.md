# Gate iOS Client

**[English](README.md)** | 日本語


SwiftUI application for iOS to manage Claude Code permission requests remotely.

## Overview

Gate iOS Client allows you to approve or deny Claude Code command execution requests from your iPhone or iPad. When Claude Code needs permission to run a command, the request appears instantly on your device, letting you review and approve it from anywhere on your local network.

## Requirements

- iOS 17.0+
- Xcode 15+ (Xcode 16+ recommended)
- Same Wi-Fi network as the Gate broker
- Gate broker running on your computer

## Features

- ✅ 6-digit pairing code authentication
- ✅ Manual broker IP:port configuration
- ✅ WebSocket real-time updates
- ✅ Allow/Deny buttons for permission requests
- ✅ Token-based authentication with persistence
- ✅ Automatic reconnection handling
- ✅ Error handling and user feedback
- ✅ Universal app (iPhone and iPad)

## Project Structure

```
Gate.xcworkspace/           # Xcode workspace
├── Gate.xcodeproj/         # App shell
├── Gate/                   # App target (entry point only)
│   └── GateApp.swift
└── GatePackage/            # Swift Package (all features)
    └── Sources/
        └── GateFeature/
            ├── Models/             # Data models
            │   ├── PermissionRequest.swift
            │   ├── AuthResponse.swift
            │   ├── WebSocketMessage.swift
            │   └── BrokerConfig.swift
            ├── Services/           # Business logic
            │   ├── AuthStorage.swift
            │   ├── APIClient.swift
            │   ├── WebSocketManager.swift
            │   └── AppState.swift
            └── Views/              # SwiftUI views
                ├── ContentView.swift
                ├── PairingView.swift
                ├── MainView.swift
                └── PermissionRequestCard.swift
```

## Setup

### 1. Fix Xcode Command Line Tools (if needed)

If you see errors about `xcodebuild` requiring Xcode, run:

```bash
# Switch to Xcode application
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer

# Verify the path
xcode-select -p
# Should output: /Applications/Xcode.app/Contents/Developer
```

### 2. Open the Project

```bash
cd apps/ios-client
open Gate.xcworkspace
```

**Important:** Always open `Gate.xcworkspace`, not `Gate.xcodeproj`.

### 3. Build and Run

In Xcode:
1. Select a simulator or connected device
2. Press `Cmd + R` to build and run

## Usage

### First-Time Setup

1. **Start the Broker** (on your computer):
   ```bash
   cd apps/broker
   pnpm dev
   ```

   The broker will display a 6-digit pairing code:
   ```
   ┌─────────────────────────────────────────┐
   │         PAIRING CODE                    │
   │                                         │
   │         123456                          │
   │                                         │
   │  Use this code to pair clients          │
   │  Expires in 5 minutes                   │
   └─────────────────────────────────────────┘
   ```

2. **Launch the iOS App**:
   - The app will show the pairing screen
   - Enter your broker URL (e.g., `http://192.168.1.100:3000`)
     - Use your computer's IP address, not `localhost`
     - Find your IP with: `ifconfig | grep "inet "`
   - Enter the 6-digit pairing code
   - Tap "Pair Device"

3. **Authenticated**:
   - Once paired, the app automatically connects via WebSocket
   - The authentication token is saved locally
   - You'll see the main screen with connection status

### Managing Permission Requests

1. **Real-Time Updates**:
   - When Claude Code requests permission, it appears instantly in the app
   - Each request shows:
     - Summary (command description)
     - Full command
     - Working directory
     - Raw prompt text

2. **Approve or Deny**:
   - Tap "Allow" (green) to approve the command
   - Tap "Deny" (red) to reject the command
   - The decision is sent immediately to the broker
   - The request disappears once resolved

3. **Connection Status**:
   - ● Green: Connected
   - ● Orange: Connecting
   - ● Red: Error
   - ● Gray: Disconnected

### Settings

Tap the menu icon (⋯) in the top-right to:
- **Reconnect**: Manually reconnect to the broker
- **Logout**: Clear stored credentials and return to pairing screen

## Architecture

### Models
- `PermissionRequest`: Permission request from the broker
- `Decision`: Allow/Deny decision enum
- `WebSocketMessage`: WebSocket message protocol
- `BrokerConfig`: Broker URL and authentication token

### Services
- `AuthStorage`: Persists token in UserDefaults (actor)
- `APIClient`: HTTP API client for pairing and decisions (actor)
- `WebSocketManager`: WebSocket connection manager (@Observable)
- `AppState`: Application-wide state management (@Observable)

### Views
- `ContentView`: Root view with authentication routing
- `PairingView`: Pairing screen with broker URL and code input
- `MainView`: Main screen with request list and connection status
- `PermissionRequestCard`: Individual request card with Allow/Deny buttons

### State Management

The app uses **SwiftUI's native state management**:
- `@Observable` for reactive state objects
- `@State` for view-local state
- `@Environment` for dependency injection
- Actors for thread-safe data access
- Swift Concurrency (async/await) throughout

## Security

- Authentication tokens are stored in `UserDefaults`
- All API requests use Bearer token authentication
- WebSocket connections include token in query parameter
- Tokens persist across app launches until logout
- Network requests use HTTPS in production (HTTP for local development)

## Development

### Building with XcodeBuildMCP

```javascript
// Set session defaults
session-set-defaults({
  workspacePath: "/path/to/Gate.xcworkspace",
  scheme: "Gate",
  simulatorName: "iPhone 16"
})

// Build for simulator
build_sim()

// Build and run
build_run_sim()

// Run tests
test_sim()
```

### Adding Dependencies

Edit `GatePackage/Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/example/Package", from: "1.0.0")
],
targets: [
    .target(
        name: "GateFeature",
        dependencies: ["Package"]
    ),
]
```

### Testing

Tests use the **Swift Testing** framework (not XCTest):

```swift
import Testing

@Test func pairingCodeValidation() async throws {
    let code = "123456"
    #expect(code.count == 6)
    #expect(code.allSatisfy { $0.isNumber })
}
```

Run tests in Xcode with `Cmd + U` or via XcodeBuildMCP.

## Troubleshooting

### Cannot connect to broker

**Problem:** App shows "Error" or "Disconnected"

**Solutions:**
- Ensure iOS device/simulator is on the same Wi-Fi network as broker
- Verify broker URL is correct (use IP address, not `localhost`)
- Check that broker is running: `curl http://<broker-ip>:3000/health`
- Try pinging the broker: `ping <broker-ip>`

### WebSocket connection fails

**Problem:** Connected but requests don't appear

**Solutions:**
- Verify authentication token is valid
- Check broker logs for connection errors
- Try reconnecting from the menu
- Re-pair the device if token expired

### Pairing fails

**Problem:** "Invalid code" or "Request failed" error

**Solutions:**
- Ensure the pairing code is correct (6 digits)
- Check that the code hasn't expired (5 minutes)
- Verify broker URL is accessible: `curl http://<broker-ip>:3000/health`
- Look for typos in the URL (http:// prefix required)

### Xcode build errors

**Problem:** `xcode-select: error: tool 'xcodebuild' requires Xcode`

**Solution:**
```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
xcode-select -p  # Verify
```

## Configuration

### Build Settings

Build settings are managed through XCConfig files in `Config/`:
- `Config/Shared.xcconfig` - Common settings (bundle ID, deployment target)
- `Config/Debug.xcconfig` - Debug-specific settings
- `Config/Release.xcconfig` - Release-specific settings
- `Config/Tests.xcconfig` - Test-specific settings

### Entitlements

App capabilities are defined in `Config/Gate.entitlements`. This file can be edited directly to add capabilities like:
- HealthKit
- CloudKit
- Push Notifications
- Background Modes

## Future Enhancements

Potential improvements:
- [ ] mDNS auto-discovery of broker on local network
- [ ] Push notifications for background operation
- [ ] iPad-optimized multi-column layout
- [ ] Dark mode support
- [ ] Haptic feedback for decisions
- [ ] Request history and statistics
- [ ] Multiple broker support
- [ ] Biometric authentication (Face ID / Touch ID)

## Support

For issues and feature requests, please use the main Gate repository issue tracker.

## License

MIT
