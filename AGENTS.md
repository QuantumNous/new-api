# NexAI Project Analysis

## Overview
NexAI (formerly New API) is a next-generation LLM Gateway and AI Asset Management System built on Go with a React frontend. It's a fork of One API with enhanced features and modern architecture.

## Project Structure

### Backend (Go)
- **main.go**: Application entry point with Gin web framework
- **controller/**: HTTP request handlers and business logic
- **model/**: Database models and ORM (GORM)
- **service/**: Core business services and utilities
- **relay/**: AI model relay handlers (OpenAI, Claude, Gemini, etc.)
- **router/**: Route definitions and middleware
- **middleware/**: Custom middleware implementations
- **common/**: Shared utilities and constants
- **constant/**: Application constants
- **logger/**: Logging configuration
- **pkg/**: Internal packages
- **types/**: Type definitions
- **dto/**: Data Transfer Objects

### Frontend (React + TypeScript)
- **web/**: React frontend application
  - **src/**: Source code with components, pages, utils
  - **public/**: Static assets
  - **package.json**: Uses Vite, React 18, TypeScript, Tailwind CSS
  - **bun.lock**: Bun package manager lock file

### Configuration & Deployment
- **docker-compose.yml**: Multi-service deployment (PostgreSQL/MySQL, Redis, New-API)
- **Dockerfile**: Container build configuration
- **.env.example**: Environment variables template
- **makefile**: Build and development commands
- **new-api.service**: Systemd service file

### Documentation
- **docs/**: Comprehensive documentation
- **README.md**: Multi-language project documentation
- **LICENSE**: AGPLv3 license

## Key Features

### Core Capabilities
1. **Multi-model Gateway**: Supports OpenAI, Claude, Gemini, Midjourney, Suno API, Rerank models
2. **API Format Conversion**: Converts between OpenAI, Claude Messages, Google Gemini formats
3. **Intelligent Routing**: Weighted random channel selection with automatic retry
4. **Billing & Payment**: Online recharge (EPay, Stripe), pay-per-use pricing, cache billing
5. **User Management**: Token grouping, model restrictions, permission management

### Technical Features
1. **Multi-language Support**: Chinese, English, French, Japanese
2. **Modern UI**: React frontend with Semi UI components
3. **Database Compatibility**: Fully compatible with original One API database
4. **Caching**: Redis and memory cache support
5. **Monitoring**: Pyroscope integration for performance profiling
6. **Authentication**: Discord, LinuxDO, Telegram, OIDC unified authentication

### Deployment Options
1. **Docker Compose** (Recommended)
2. **Docker Commands**
3. **BaoTa Panel** one-click installation
4. **Multi-machine deployment** with shared Redis

## Architecture Patterns

### Backend Architecture
- **Gin Web Framework**: REST API implementation
- **GORM ORM**: Database abstraction layer
- **Repository Pattern**: Model layer with business logic
- **Service Layer**: Business logic separation
- **Middleware Chain**: Request processing pipeline
- **Embedded Filesystem**: Frontend assets bundled in binary

### Frontend Architecture
- **React 18**: Component-based UI
- **Vite**: Build tool and dev server
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **i18next**: Internationalization
- **React Router**: Client-side routing
- **Axios**: HTTP client

## Dependencies

### Backend Dependencies (Go)
- **gin-gonic/gin**: Web framework
- **gorm.io/gorm**: ORM
- **go-redis/redis**: Redis client
- **joho/godotenv**: Environment variable loader
- **tiktoken-go/tokenizer**: Token counting
- **stripe/stripe-go**: Payment processing
- **grafana/pyroscope-go**: Performance profiling

### Frontend Dependencies (React)
- **@douyinfe/semi-ui**: UI component library
- **axios**: HTTP client
- **i18next**: Internationalization
- **react-router-dom**: Routing
- **tailwindcss**: CSS framework
- **lucide-react**: Icons
- **@visactor/vchart**: Charting library

## Database Schema
- **SQLite** (default) or **PostgreSQL**/**MySQL**
- **Redis** for caching and session storage
- Key tables: users, tokens, channels, logs, subscriptions, payments

## API Endpoints

### Main Categories
1. **Authentication**: Login, OAuth, 2FA
2. **User Management**: CRUD operations, quotas, billing
3. **Channel Management**: AI model endpoints configuration
4. **Relay APIs**: AI model proxy endpoints
5. **Administration**: System configuration, monitoring
6. **Payment**: Stripe, EPay integration

### Relay Interfaces
- `/v1/chat/completions` (OpenAI compatible)
- `/v1/responses` (OpenAI Responses format)
- `/v1/images/generations` (Image generation)
- `/v1/audio/*` (Audio processing)
- `/v1/embeddings` (Embeddings)
- `/v1/messages` (Claude format)
- `/v1beta/*` (Gemini format)

## Development Workflow

### Backend Development
```bash
# Run locally
go run main.go

# Build
go build -o new-api

# Test
go test ./...
```

### Frontend Development
```bash
cd web
# Install dependencies
bun install

# Development server
bun run dev

# Build
bun run build
```

### Docker Deployment
```bash
# Quick start
docker-compose up -d

# Build custom image
docker build -t new-api .
```

## Configuration

### Environment Variables
- `SQL_DSN`: Database connection string
- `REDIS_CONN_STRING`: Redis connection
- `SESSION_SECRET`: Session encryption (multi-node)
- `CRYPTO_SECRET`: Data encryption (Redis required)
- `PORT`: HTTP port (default: 3000)
- `TZ`: Timezone

### Performance Tuning
- `STREAMING_TIMEOUT`: Streaming response timeout
- `BATCH_UPDATE_ENABLED`: Enable batch processing
- `SYNC_FREQUENCY`: Cache sync frequency
- `MAX_REQUEST_BODY_MB`: Request size limit

## Security Features
1. **Session Management**: Cookie-based sessions with encryption
2. **API Key Security**: Token encryption and validation
3. **Rate Limiting**: User and model-level rate limits
4. **Input Validation**: Request sanitization and validation
5. **CORS Configuration**: Cross-origin resource sharing
6. **HTTPS Support**: TLS/SSL configuration

## Monitoring & Observability
1. **Logging**: Structured logging with levels
2. **Metrics**: Pyroscope performance profiling
3. **Health Checks**: Container health monitoring
4. **Error Tracking**: Error log collection and reporting
5. **Analytics**: Google Analytics and Umami integration

## Scaling Considerations
1. **Stateless Design**: Session storage in Redis
2. **Database Pooling**: Connection pool configuration
3. **Caching Strategy**: Multi-level caching (Redis, memory)
4. **Load Balancing**: Horizontal scaling support
5. **Queue Processing**: Background job processing

## Testing Strategy
1. **Unit Tests**: Individual component testing
2. **Integration Tests**: API endpoint testing
3. **Load Testing**: Performance and stress testing
4. **End-to-End Tests**: Complete workflow testing

## CI/CD Pipeline
1. **GitHub Actions**: Automated testing and deployment
2. **Docker Hub**: Container image publishing
3. **Version Tagging**: Semantic versioning
4. **Release Automation**: Changelog generation

## Community & Ecosystem
1. **Upstream**: Based on One API project
2. **Extensions**: neko-api-key-tool, new-api-horizon
3. **Integration**: Midjourney-Proxy, Suno API
4. **Documentation**: Comprehensive docs at docs.newapi.pro

## Future Development Areas
1. **Plugin System**: Extensible architecture
2. **Advanced Analytics**: Usage patterns and insights
3. **Mobile App**: Native mobile applications
4. **Enterprise Features**: SSO, audit logging, compliance

## Contribution Guidelines
1. **Code Style**: Go standard formatting, React best practices
2. **Testing**: Write tests for new features
3. **Documentation**: Update docs for API changes
4. **Pull Requests**: Follow PR template and review process

## License & Compliance
- **License**: GNU Affero General Public License v3.0 (AGPLv3)
- **Compliance**: Follow AI service regulations and terms of use
- **Commercial Use**: Contact for alternative licensing options