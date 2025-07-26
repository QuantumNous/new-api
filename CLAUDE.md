# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend (Go)
- **Run development server**: `go run main.go`
- **Build**: Use makefile: `make all` (builds frontend then starts backend)

### Frontend (React)
- **Install dependencies**: `cd web && bun install`
- **Development server**: `cd web && bun run dev`
- **Build**: `cd web && bun run build`
- **Lint check**: `cd web && bun run lint`
- **Lint fix**: `cd web && bun run lint:fix`

### Full Stack
- **Build and run**: `make all` (builds frontend and starts backend)
- **Frontend only**: `make build-frontend`
- **Backend only**: `make start-backend`

## Architecture Overview

This is **New API**, a next-generation large model gateway and AI asset management system built on Go (backend) and React (frontend). It's a fork of One API with additional features.

### Backend Structure (Go)
- **Entry point**: `main.go` - initializes resources, database, cache, and HTTP server
- **Router layer**: `router/` - handles API routing and request delegation
- **Controller layer**: `controller/` - business logic for different resources
- **Service layer**: `service/` - core services and utilities
- **Model layer**: `model/` - database models and ORM interactions
- **Relay system**: `relay/` - core API gateway functionality with channel adapters
- **Middleware**: `middleware/` - authentication, rate limiting, logging, etc.
- **Settings**: `setting/` - configuration management for different components

### Frontend Structure (React)
- **Built with**: React 18, Semi UI components, Vite bundler
- **State management**: Context-based with reducers
- **Routing**: React Router DOM
- **Styling**: TailwindCSS + Semi UI theme
- **Features**: Dashboard, channel management, user management, settings, playground

### Key Concepts
- **Channels**: Different AI provider integrations (OpenAI, Claude, Gemini, etc.)
- **Relay**: Core gateway that routes requests to appropriate channels
- **Tokens**: API key management for users
- **Quotas**: Usage limits and billing management
- **Models**: Different AI models with pricing and capability settings

### Database
- **Default**: SQLite (requires `/data` directory mount for Docker)
- **Production**: Supports MySQL (≥5.7.8) and PostgreSQL (≥9.6)
- **ORM**: GORM for database operations
- **Caching**: Redis optional for multi-instance deployments
- 数据库的配置在 .env 中

### Environment Configuration
Key environment variables for development:
- `GIN_MODE=debug` - enables debug mode
- `SESSION_SECRET` - required for multi-instance deployments
- `CRYPTO_SECRET` - required for Redis encryption
- `PORT` - server port (default: 3000)
- `DEBUG=true` - enables debug logging

### File Organization
- **tests**: Place all test files in `test/` directory
- **docs**: Documentation in `docs/` directory
- **web**: Complete React frontend application
- **common**: Shared utilities and configuration
- **constant**: Application constants and enums
- 所有的测试文件都放在test目录下

### Key Files to Know
- `main.go:34` - Application entry point and initialization
- `router/main.go:13` - Main router setup
- `common/init.go:28` - Environment and configuration initialization
- `web/package.json` - Frontend dependencies and scripts
- `makefile` - Build automation for full-stack development

## Development Principles
- 开发的过程中,切记不要影响其他代码的功能

## Current Development Context
- 如果没有特别说明,我正在开发和调试的都是自定义透传渠道(custompass)的功能

## CustomPass Development Notes
- 我希望所有custompass的修改都应该在不入侵公共代码的前提下进行,关键是不要影响其他的功能

## Configuration
- 数据库的配置在 .env 中