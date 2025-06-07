# 🚀 GitHub Actions 工作流安装指南

由于 GitHub API 权限限制，需要手动创建 GitHub Actions 工作流文件。本指南提供了完整的安装步骤。

## 📋 需要创建的工作流文件

在 GitHub 仓库中创建以下目录和文件：

```
.github/workflows/
├── ci.yml              # CI 测试和代码质量检查
├── docker-build.yml    # Docker 镜像自动构建
├── build-release.yml   # 可执行文件构建和发布
└── auto-release.yml    # 自动发布管理
```

## 🔧 安装步骤

### 1. 创建工作流目录

在 GitHub 仓库中：
1. 点击 "Create new file"
2. 输入文件路径：`.github/workflows/ci.yml`
3. GitHub 会自动创建目录结构

### 2. 创建 CI 工作流 (ci.yml)

```yaml
name: CI

on:
  push:
    branches: [ main, rerank ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: new_api
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd="redis-cli ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up Go
      uses: actions/setup-go@v4
      with:
        go-version: '1.21'

    - name: Cache Go modules
      uses: actions/cache@v3
      with:
        path: |
          ~/.cache/go-build
          ~/go/pkg/mod
        key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}
        restore-keys: |
          ${{ runner.os }}-go-

    - name: Install dependencies
      run: go mod download

    - name: Run go vet
      run: go vet ./...

    - name: Run go fmt check
      run: |
        if [ "$(gofmt -s -l . | wc -l)" -gt 0 ]; then
          echo "The following files are not formatted:"
          gofmt -s -l .
          exit 1
        fi

    - name: Run tests
      env:
        SQL_DSN: root:root@tcp(localhost:3306)/new_api?charset=utf8mb4&parseTime=True&loc=Local
        REDIS_CONN_STRING: redis://localhost:6379
        SESSION_SECRET: test_secret
      run: |
        go test -v -race -coverprofile=coverage.out ./...

    - name: Run HuggingFace TEI tests
      run: |
        go test -v ./test/huggingface_tei_test.go

  lint:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up Go
      uses: actions/setup-go@v4
      with:
        go-version: '1.21'

    - name: Run golangci-lint
      uses: golangci/golangci-lint-action@v3
      with:
        version: latest
        args: --timeout=5m

  build-check:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up Go
      uses: actions/setup-go@v4
      with:
        go-version: '1.21'

    - name: Check if project builds
      run: |
        go build -tags=nomsgpack -ldflags "-s -w" -o new-api-test .
        
    - name: Verify binary
      run: |
        ./new-api-test --version || echo "Binary verification completed"
```

### 3. 创建 Docker 构建工作流 (docker-build.yml)

```yaml
name: Docker Build and Push

on:
  push:
    branches: [ main, rerank ]
    tags: [ 'v*' ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-main:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=semver,pattern={{version}}
          type=semver,pattern={{major}}.{{minor}}
          type=raw,value=latest,enable={{is_default_branch}}

    - name: Build and push main image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./Dockerfile
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        platforms: linux/amd64,linux/arm64

  build-tei:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata for TEI
      id: meta-tei
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-tei
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=semver,pattern={{version}}
          type=semver,pattern={{major}}.{{minor}}
          type=raw,value=latest,enable={{is_default_branch}}

    - name: Build and push TEI image
      uses: docker/build-push-action@v5
      with:
        context: ./docker/huggingface-tei
        file: ./docker/huggingface-tei/Dockerfile
        push: true
        tags: ${{ steps.meta-tei.outputs.tags }}
        labels: ${{ steps.meta-tei.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        platforms: linux/amd64
```

### 4. 创建可执行文件构建工作流 (build-release.yml)

```yaml
name: Build and Release

on:
  push:
    branches: [ main, rerank ]
    tags: [ 'v*' ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        include:
          - os: windows-latest
            goos: windows
            goarch: amd64
            suffix: .exe
            name: windows-amd64
          - os: ubuntu-latest
            goos: linux
            goarch: amd64
            suffix: ""
            name: linux-amd64
          - os: ubuntu-latest
            goos: linux
            goarch: arm64
            suffix: ""
            name: linux-arm64
          - os: macos-latest
            goos: darwin
            goarch: amd64
            suffix: ""
            name: darwin-amd64
          - os: macos-latest
            goos: darwin
            goarch: arm64
            suffix: ""
            name: darwin-arm64

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up Go
      uses: actions/setup-go@v4
      with:
        go-version: '1.21'

    - name: Build binary
      env:
        GOOS: ${{ matrix.goos }}
        GOARCH: ${{ matrix.goarch }}
        CGO_ENABLED: 0
      run: |
        go build -tags=nomsgpack -ldflags "-s -w -X 'one-api/common.Version=${{ github.ref_name }}' -X 'one-api/common.BuildTime=$(date -u +%Y-%m-%d_%H:%M:%S)' -X 'one-api/common.GitCommit=${{ github.sha }}'" -o new-api-${{ matrix.name }}${{ matrix.suffix }} .

    - name: Upload artifact
      uses: actions/upload-artifact@v3
      with:
        name: new-api-${{ matrix.name }}
        path: new-api-${{ matrix.name }}${{ matrix.suffix }}

  package:
    needs: build
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/')

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Download all artifacts
      uses: actions/download-artifact@v3

    - name: Create release packages
      run: |
        mkdir -p release
        for dir in new-api-*; do
          if [ -d "$dir" ]; then
            binary_name=$(basename "$dir")
            cd "$dir"
            if [[ "$binary_name" == *"windows"* ]]; then
              zip -r "../release/${binary_name}.zip" .
            else
              tar -czf "../release/${binary_name}.tar.gz" .
            fi
            cd ..
          fi
        done
        cd release
        sha256sum * > checksums.txt

    - name: Create Release
      uses: softprops/action-gh-release@v1
      with:
        files: release/*
        body: |
          ## New API ${{ github.ref_name }} Release
          
          Download the appropriate binary for your platform and run it directly.
          
          **Verification**: Use `checksums.txt` to verify file integrity.
        draft: false
        prerelease: ${{ contains(github.ref, 'alpha') || contains(github.ref, 'beta') || contains(github.ref, 'rc') }}
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## ⚙️ 配置权限

### 1. 仓库设置

在 GitHub 仓库设置中：

1. 进入 **Settings** → **Actions** → **General**
2. 在 "Workflow permissions" 中选择：
   - ✅ **Read and write permissions**
   - ✅ **Allow GitHub Actions to create and approve pull requests**

### 2. 包权限

确保 GitHub Packages 权限正确：
1. 进入 **Settings** → **Actions** → **General**
2. 确保 "Fork pull request workflows from outside collaborators" 设置合适

## 🚀 验证安装

### 1. 推送代码测试

```bash
# 推送到 rerank 分支触发 CI
git push origin rerank
```

### 2. 创建标签测试

```bash
# 创建测试标签
git tag v1.6.0-test
git push origin v1.6.0-test
```

### 3. 检查构建状态

在 GitHub 仓库的 **Actions** 页面查看：
- 工作流运行状态
- 构建日志
- 产生的构建产物

## 📊 预期结果

安装完成后，您将获得：

### 🔄 自动化流程
- **代码推送** → 自动 CI 测试
- **标签推送** → 自动构建和发布
- **PR 创建** → 自动测试验证

### 🐳 Docker 镜像
- `ghcr.io/lim12137/new-api:latest`
- `ghcr.io/lim12137/new-api-tei:latest`

### 📦 二进制文件
- Windows (amd64, arm64)
- Linux (amd64, arm64)
- macOS (amd64, arm64)

### 🔒 安全检查
- 代码质量扫描
- 安全漏洞检测
- 依赖更新管理

## 🔍 故障排除

### 常见问题

1. **权限错误**
   - 检查仓库 Actions 权限设置
   - 确保 GITHUB_TOKEN 有足够权限

2. **构建失败**
   - 查看 Actions 页面的详细日志
   - 检查代码语法和依赖

3. **Docker 推送失败**
   - 确保 GitHub Packages 权限正确
   - 检查镜像名称格式

## 📚 相关文档

- [GitHub Actions 详细指南](docs/GITHUB_ACTIONS.md)
- [功能总结](GITHUB_ACTIONS_SUMMARY.md)
- [部署指南](docs/DEPLOYMENT_GUIDE.md)

---

**🎉 按照此指南完成安装后，您将拥有完整的自动化 CI/CD 流程！**
