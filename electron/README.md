# New API Electron Desktop App

This directory contains the Electron wrapper for New API, providing a native desktop application with system tray support for Windows, macOS, and Linux.

## Prerequisites

### 1. Go Binary (Required)
The Electron app requires the compiled Go binary to function. You have two options:

**Option A: Use existing binary (without Go installed)**
```bash
# If you have a pre-built binary (e.g., new-api-macos)
cp ../new-api-macos ../new-api
```

**Option B: Build from source (requires Go)**
TODO

### 3. Electron Dependencies
```bash
cd electron
npm install
```

## Development

Run the app in development mode:
```bash
npm start
```

This will:
- Start the Go backend on port 3000
- Open an Electron window with DevTools enabled
- Create a system tray icon (menu bar on macOS)
- Store database in `../data/new-api.db`

## Building for Production

### Quick Build
```bash
# Ensure Go binary exists in parent directory
ls ../new-api  # Should exist

# Build for current platform
npm run build

# Platform-specific builds
npm run build:mac    # Creates .dmg and .zip
npm run build:win    # Creates .exe installer
npm run build:linux  # Creates .AppImage and .deb
```

### Build Output
- Built applications are in `electron/dist/`
- macOS: `.dmg` (installer) and `.zip` (portable)
- Windows: `.exe` (installer) and portable exe
- Linux: `.AppImage` and `.deb`

## Configuration

### Port
Default port is 3000. To change, edit `main.js`:
```javascript
const PORT = 3000; // Change to desired port
```

### Database Location
- **Development**: `../data/new-api.db` (project directory)
- **Production**:
  - macOS: `~/Library/Application Support/New API/data/`
  - Windows: `%APPDATA%/New API/data/`
  - Linux: `~/.config/New API/data/`
