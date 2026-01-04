# Frontend Dockerfile
# Build context must be the project root

FROM oven/bun:latest AS builder

WORKDIR /app

# Copy package files first for caching
COPY web/package.json web/bun.lock ./
RUN bun install

# Copy source code
COPY web .
# Copy version file from root
COPY VERSION .

# Build the application
# We use the version from the file for the environment variable
RUN DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(cat VERSION) bun run build

# Production Stage
FROM nginx:alpine

# Copy custom Nginx configuration
COPY web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
