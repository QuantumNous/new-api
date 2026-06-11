# Development Guide

<p align="center">
  <a href="./DEVELOPMENT.zh_CN.md">简体中文</a> |
  <a href="./DEVELOPMENT.zh_TW.md">繁體中文</a> |
  <strong>English</strong> |
  <a href="./DEVELOPMENT.fr.md">Français</a> |
  <a href="./DEVELOPMENT.ja.md">日本語</a>
</p>

This document is for developers to explain how to run and develop the new-api project locally.

## Requirements

- **Go**: 1.22+ (project uses 1.25.1)
- **Bun**: Frontend package manager (preferred over npm/yarn)
- **Database**: SQLite (default) / MySQL ≥ 5.7.8 / PostgreSQL ≥ 9.6
- **Docker** (optional): For containerized development environment

## Quick Start

### Method 1: Local Development (Recommended)

> **Prerequisites**: Since Go uses `//go:embed` to embed frontend files, you must build the frontend once before the first startup, otherwise an error will occur.

#### 1. First-Time Setup

```bash
# Build frontend (generate dist directory to avoid go:embed error)
cd web/default
bun install
bun run build
cd ../..

```

#### 2. Start Backend

```bash
# Install Go dependencies
go mod download

# Start backend service (using SQLite)
go run main.go
```

Backend runs on `http://localhost:3000` by default, data stored in `one-api.db`

#### 3. Start Frontend

```bash
# Enter frontend directory
cd web/default

# Install dependencies
bun install

# Start development server
bun run dev
```

Frontend development server runs on `http://localhost:5173` and automatically proxies backend requests to port 3000.

### Method 2: Using Makefile

```bash
# Start both backend and frontend (Docker + frontend dev server)
make dev

# Start backend only (Docker Compose)
make dev-api

# Start frontend only
make dev-web

# Start classic frontend
make dev-web-classic
```

## Frontend Development

### Available Commands

In `web/default/` directory:

```bash
bun run dev          # Start development server (http://localhost:5173)
bun run build        # Production build
bun run preview      # Preview production build
bun run typecheck    # TypeScript type checking
bun run lint         # ESLint code checking
bun run format       # Prettier code formatting
bun run format:check # Check code format
bun run i18n:sync    # Sync internationalization translations
```

### Tech Stack

- **React 19** + **TypeScript**
- **Rsbuild** - Build tool
- **Base UI** - Component library
- **Tailwind CSS** - Styling
- **TanStack Router** - Routing
- **TanStack Query** - Data fetching
- **i18next** - Internationalization (supports en/zh/fr/ru/ja/vi)

### Internationalization Development

Translation files are located in `web/default/src/i18n/locales/{lang}.json`. After adding or modifying translations, run:

```bash
bun run i18n:sync
```

## Backend Development

### Database Configuration

#### SQLite (Default)

No configuration needed, just run `go run main.go`.

#### MySQL

```bash
# Set environment variable
export SQL_DSN="root:password@tcp(localhost:3306)/newapi"

# Start backend
go run main.go
```

#### PostgreSQL (Docker Development Environment)

```bash
# Start using docker-compose.dev.yml
make dev-api
```

### Project Structure

```
.
├── router/        # HTTP routing
├── controller/    # Request handlers
├── service/       # Business logic
├── model/         # Data models (GORM)
├── relay/         # AI API relay/proxy
│   └── channel/   # Provider-specific adapters (openai/, claude/, gemini/, etc.)
├── middleware/    # Middleware (auth, rate limiting, CORS, etc.)
├── setting/       # Configuration management
├── common/        # Utility functions
├── dto/           # Data transfer objects
├── constant/      # Constant definitions
├── i18n/          # Backend internationalization (en/zh)
└── web/           # Frontend projects
    ├── default/   # Default frontend (React 19)
    └── classic/   # Classic frontend (React 18)
```

### Development Guidelines

See [CLAUDE.md](../../CLAUDE.md) for details, key points:

1. **JSON Operations**: Must use wrapper functions in `common/json.go`
2. **Database Compatibility**: Code must be compatible with SQLite/MySQL/PostgreSQL
3. **Package Manager**: Frontend prioritizes Bun

## Build Production Version

```bash
# Build frontend
make build-all-frontends

# Build backend
go build -o new-api main.go

# Or use Docker
docker build -t new-api .
```

## Debugging Tools

### Reset Setup Wizard

```bash
make reset-setup
```

This command clears settings and admin accounts in the database for retesting the initialization wizard.

## Common Issues

### go:embed Error: no matching files found

**Problem**: Backend startup error `pattern web/*/dist: no matching files found`

**Cause**: `main.go` uses `//go:embed` to embed frontend files at compile time, if `dist` directory doesn't exist it will error.

**Solution**:
```bash
# First build frontend to generate dist
cd web/default && bun install && bun run build && cd ../..


# Start backend
go run main.go
```

### Port Conflict

- Backend default port: 3000
- Frontend development server: 5173
- Classic frontend: 5174

**Problem**: Frontend startup shows `Port 3000 is occupied`

**Cause**: Rsbuild tries to use port 3000 by default, but it's occupied by backend.

**Solution**: Already configured `port: 5173` in `rsbuild.config.ts`, just run `bun run dev`.

### Database Migration

GORM automatically performs migrations. All tables are created automatically on first run.

### Frontend Proxy Configuration

Frontend development server is configured with proxy, API requests are automatically forwarded to backend `http://localhost:3000`.

## Related Documentation

- [Project Conventions (CLAUDE.md)](../../CLAUDE.md)
- [User Documentation](https://docs.newapi.pro/en/docs)
- [API Documentation](https://docs.newapi.pro/en/docs/api)

## Contribution Guide

Contributions are welcome! Before submitting a PR, please ensure:

1. Code passes lint checks
2. Follows project conventions (see CLAUDE.md)
3. Tests pass
4. Clear commit messages

---

**Technical Support**: [support@quantumnous.com](mailto:support@quantumnous.com)
