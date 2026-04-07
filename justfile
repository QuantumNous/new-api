version := `cat VERSION`
image   := "calciumion/new-api"

# Build Go binary (without frontend)
build:
    CGO_ENABLED=0 GOEXPERIMENT=greenteagc \
    go build -ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version={{version}}'" \
    -o new-api .

# Build frontend (web/dist)
build-frontend:
    cd web && bun install && DISABLE_ESLINT_PLUGIN=true VITE_REACT_APP_VERSION={{version}} bun run build

# Build frontend + binary
build-all: build-frontend build

# Build docker image (local, current platform)
docker tag=version:
    docker build --platform linux/amd64 -t {{image}}:{{tag}} .

# Build & push multi-arch docker image
docker-push tag=version:
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        -t {{image}}:{{tag}} \
        --push .

# Cross-compile linux/amd64 binary (for bake)
build-linux: build-frontend
    CGO_ENABLED=0 GOEXPERIMENT=greenteagc GOOS=linux GOARCH=amd64 \
    go build -ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version={{version}}'" \
    -o new-api .

# Build & push develop image to ghcr.io/wenertech/new-api:develop
bake: build-linux
    docker buildx bake --push

# Build develop image into local docker daemon (no push)
bake-local: build-linux
    docker buildx bake local

# Run locally
run:
    go run main.go
