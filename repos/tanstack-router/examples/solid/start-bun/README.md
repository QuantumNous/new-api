# TanStack Start + Bun Production Server

An optimized production server for TanStack Start applications using Bun, implementing intelligent static asset loading with configurable memory management.

## 🚀 Features

- **Hybrid Loading Strategy**: Small files are preloaded into memory, large files are served on-demand
- **Configurable File Filtering**: Include/Exclude patterns for precise control
- **Memory-efficient Response Generation**: Optimized for high performance
- **Production-ready Caching Headers**: Automatic Cache-Control headers for optimal performance
- **Detailed Logging**: Vite-like output for better overview

## 📦 Installation

This project was created with TanStack Start:

```bash
bunx create-start-app@latest
```

Install dependencies:

```bash
bun install
```

## 🏃‍♂️ Development

For development:

```bash
bun run dev
```

## 🔨 Production Build

Build the application for production:

```bash
bun run build
```

## 🚀 Production Server with server.ts

### Quick Start - Use in Your Project

You can easily use this production server in your own TanStack Start project:

1. **Copy the `server.ts` file** into your project root
2. **Build your project** with `bun run build`
3. **Start the server** directly with:
   ```bash
   bun run server.ts
   ```

Or add it to your `package.json` scripts:

```json
{
  "scripts": {
    "start": "bun run server.ts"
  }
}
```

Then run with:

```bash
bun run start
```

### Server Features

The `server.ts` implements a high-performance production server with the following features:

#### 1. Intelligent Asset Loading

The server automatically decides which files to preload into memory and which to serve on-demand:

- **In-Memory Loading**: Small files (default < 5MB) are loaded into memory at startup
- **On-Demand Loading**: Large files are loaded from disk only when requested
- **Optimized Performance**: Frequently used assets are served from memory

#### 2. Configuration via Environment Variables

```bash
# Server Port (default: 3000)
PORT=3000

# Maximum file size for in-memory loading (in bytes, default: 5MB)
STATIC_PRELOAD_MAX_BYTES=5242880

# Include patterns (comma-separated, only these files will be preloaded)
STATIC_PRELOAD_INCLUDE="*.js,*.css,*.woff2"

# Exclude patterns (comma-separated, these files will be excluded)
STATIC_PRELOAD_EXCLUDE="*.map,*.txt"

# Enable detailed logging
STATIC_PRELOAD_VERBOSE=true
```

### Example Configurations

#### Minimal Memory Footprint

```bash
# Preload only critical assets
STATIC_PRELOAD_MAX_BYTES=1048576 \
STATIC_PRELOAD_INCLUDE="*.js,*.css" \
STATIC_PRELOAD_EXCLUDE="*.map,vendor-*" \
bun run start
```

#### Maximum Performance

```bash
# Preload all small assets
STATIC_PRELOAD_MAX_BYTES=10485760 \
bun run start
```

#### Debug Mode

```bash
# With detailed logging
STATIC_PRELOAD_VERBOSE=true \
bun run start
```

### Server Output

The server displays a clear overview of all loaded assets at startup:

```txt
📦 Loading static assets from ./dist/client...
   Max preload size: 5.00 MB
   Include patterns: *.js,*.css,*.woff2

📁 Preloaded into memory:
   /assets/index-a1b2c3d4.js           45.23 kB │ gzip:  15.83 kB
   /assets/index-e5f6g7h8.css           12.45 kB │ gzip:   4.36 kB

💾 Served on-demand:
   /assets/vendor-i9j0k1l2.js          245.67 kB │ gzip:  86.98 kB

✅ Preloaded 2 files (57.68 KB) into memory
ℹ️  1 files will be served on-demand (1 too large, 0 filtered)

🚀 Server running at http://localhost:3000
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. You can run the tests with:

```bash
bun run test
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

## Linting & Formatting

This project uses [eslint](https://eslint.org/) and [prettier](https://prettier.io/) for linting and formatting. Eslint is configured using [tanstack/eslint-config](https://tanstack.com/config/latest/docs/eslint). The following scripts are available:

```bash
bun run lint
bun run format
bun run check
```
