<div align="center">

![new-api](/web/public/logo.png)

# New API

🍥 新一代大模型网关与 AI 资产管理系统

<p align="center">
  <a href="./README.zh_CN.md">简体中文</a> |
  <a href="./README.zh_TW.md">繁體中文</a> |
  <a href="./README.en.md">English</a> |
  <a href="./README.fr.md">Français</a> |
  <a href="./README.ja.md">日本語</a>
</p>

<p align="center">
  <a href="https://raw.githubusercontent.com/Calcium-Ion/new-api/main/LICENSE">
    <img src="https://img.shields.io/github/license/Calcium-Ion/new-api?color=brightgreen" alt="license">
  </a><!--
  --><a href="https://github.com/Calcium-Ion/new-api/releases/latest">
    <img src="https://img.shields.io/github/v/release/Calcium-Ion/new-api?color=brightgreen&include_prereleases" alt="release">
  </a><!--
  --><a href="https://hub.docker.com/r/CalciumIon/new-api">
    <img src="https://img.shields.io/badge/docker-dockerHub-blue" alt="docker">
  </a>
  <a href="https://atomgit.com/QuantumNous/new-api" target="_blank">
    <img alt="AtomGit G-Star" src="https://atomgit.com/QuantumNous/new-api/star/badge.svg"/>
  </a>
</p>

<p align="center">
  <a href="https://trendshift.io/repositories/20180" target="_blank">
    <img src="https://trendshift.io/api/badge/repositories/20180" alt="QuantumNous%2Fnew-api | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/>
  </a>
  <br>
  <a href="https://hellogithub.com/repository/QuantumNous/new-api" target="_blank">
    <img src="https://api.hellogithub.com/v1/widgets/recommend.svg?rid=539ac4217e69431684ad4a0bab768811&claim_uid=tbFPfKIDHpc4TzR" alt="Featured｜HelloGitHub" style="width: 250px; height: 54px;" width="250" height="54" />
  </a><!--
  -->
  <a href="https://atomgit.com/QuantumNous/new-api" target="_blank">
    <img alt="AtomGit G-Star" src="https://atomgit.com/QuantumNous/new-api/star/new_badge.svg" width="250" height="55" />
  </a>
</p>

</div>

---

## 📝 项目简介

New API 是基于 [One API](https://github.com/songquanpeng/one-api) 二次开发的 LLM 网关与 AI 资产管理系统，聚合多家上游 AI 服务，提供统一的 API 接口、令牌与额度管理、计费统计以及可视化控制台。

> [!IMPORTANT]
> 本项目仅用于合法、获授权的 AI API 网关、组织级鉴权、多模型管理、用量统计与私有化部署场景。使用者需合法获取上游 API 密钥与服务权限，并遵守上游服务条款及相关法律法规。

## ✨ 主要特性

- 🎨 现代化 UI，多语言支持
- 🔄 完全兼容原 One API 数据库
- 📈 可视化控制台与用量统计
- 🔒 令牌分组、模型限制、用户管理
- 💰 按次 / 按量 / 缓存命中计费
- 🔀 多种 API 格式支持与互转（OpenAI / Claude / Gemini 等）
- ⚖️ 渠道加权、失败自动重试、用户级限流

> 更多功能详见[官方文档](https://docs.newapi.pro/docs)。

## 🚀 部署

镜像发布在私有阿里云容器镜像仓库：`registry.cn-hongkong.aliyuncs.com/catalyst_clan/new-api`。

### 部署要求

| 组件 | 要求 |
|------|------|
| 本地数据库 | SQLite（需挂载 `/data` 目录）|
| 远程数据库 | MySQL ≥ 5.7.8 或 PostgreSQL ≥ 9.6 |
| 容器引擎 | Docker / Docker Compose |
| 系统架构 | 仅支持 64 位（amd64 / arm64）|

### 登录私有仓库

镜像为私有仓库，首次部署需先登录：

```bash
docker login registry.cn-hongkong.aliyuncs.com
```

### 方式一：Docker Compose（推荐）

```bash
git clone https://github.com/QuantumNous/new-api.git
cd new-api

# 按需编辑 docker-compose.yml（数据库、密码等）
docker compose up -d
```

### 方式二：Docker 命令

使用 SQLite：

```bash
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  registry.cn-hongkong.aliyuncs.com/catalyst_clan/new-api:latest
```

使用 MySQL：

```bash
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  registry.cn-hongkong.aliyuncs.com/catalyst_clan/new-api:latest
```

> 💡 `-v ./data:/data` 会将数据保存在当前目录的 `data` 文件夹，也可改为绝对路径，如 `-v /your/path:/data`。

部署完成后访问 `http://localhost:3000` 即可开始使用。

### 常用环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SESSION_SECRET` | 鉴权签名密钥，多机部署时所有节点必须一致 | - |
| `SQL_DSN` | 数据库连接字符串 | - |
| `REDIS_CONN_STRING` | Redis 连接字符串 | - |
| `STREAMING_TIMEOUT` | 流式超时（秒）| `300` |
| `TZ` | 时区 | `Asia/Shanghai` |

> 完整配置见[环境变量文档](https://docs.newapi.pro/docs/installation/config-maintenance/environment-variables)。

> [!WARNING]
> 多机部署时，所有节点必须使用同一主数据库与相同的 `SESSION_SECRET`；共享 Redis 的节点还需使用相同的 `CRYPTO_SECRET`，否则鉴权与缓存无法一致。

## 🛠️ 开发

### 环境要求

| 依赖 | 版本 |
|------|------|
| Go | ≥ 1.25.1 |
| Bun | 1.4.0（前端包管理与运行）|
| Docker | 用于本地数据库（PostgreSQL）|

### 快速开始

```bash
# 启动本地依赖（PostgreSQL + 后端，基于 docker-compose.dev.yml）
make dev-api

# 启动前端开发服务器（http://localhost:5173）
make dev-web

# 或一步启动前后端
make dev
```

也可以手动分别启动：

```bash
# 前端
cd web && bun install && bun run dev

# 后端
go run main.go
```

### 构建

前端会构建到 `web/dist`，并由 Go 二进制内嵌打包：

```bash
make build-web   # 构建前端
make start-api   # 启动后端（等价于 go run main.go）

# 或一次性构建前端并启动后端
make all
```

### 测试与检查

```bash
make test                     # 测试 root 与 relaykit 两个 Go 模块
cd web && bun run test        # 前端单元测试
cd web && bun run typecheck   # 前端类型检查
```

## 🚢 发布

发布完全由 **git tag** 驱动：创建并推送一个版本 tag，即会自动触发 GitHub Actions 构建。版本号无需手动改文件，CI 会用 tag 名写入 `VERSION` 并注入二进制。

### 版本号规范

采用语义化版本 `vX.Y.Z`，预发布可加后缀，例如 `v1.0.1`、`v1.0.0-rc.1`、`v1.0.0-alpha.1`。

### 创建并推送新版本

推荐使用发布脚本 [`release.sh`](./release.sh)，它会校验工作区、生成版本号、预览 changelog，并打 tag、推送：

```bash
./release.sh            # 交互式菜单：根据最新 tag 给出候选版本
./release.sh v1.0.1     # 指定版本
./release.sh patch      # 从最新 tag 递增（patch / minor / major）
./release.sh release    # 将最新预发布提升为正式版（如 v1.0.0-rc.26 → v1.0.0）
./release.sh rc         # 下一个预发布（如 v1.0.0-rc.26 → v1.0.0-rc.27）
```

无参数运行时会按语义化版本给出候选项，例如当前最新为 `v1.0.0-rc.26` 时：

```text
Latest tag: v1.0.0-rc.26
Select the new version:
  1) v1.0.0-rc.27       next pre-release
  2) v1.0.0             promote to release
  3) v1.0.1             patch
  4) v1.1.0             minor
  5) v2.0.0             major
  6) custom (enter manually)
```

或手动执行：

```bash
git checkout main && git pull
git tag v1.0.1
git push origin v1.0.1
```

### 推送 tag 会触发

| Workflow | 触发范围 | 产物 |
|----------|----------|------|
| `docker-build.yml` | 除 `nightly*` 外的所有 tag | 多架构镜像（amd64/arm64）推送到私有仓库 `registry.cn-hongkong.aliyuncs.com/catalyst_clan/new-api:<tag>`，并更新 `latest` |
| `release.yml` | 除 `*-alpha*` 外的所有 tag | Linux/macOS 二进制 + GitHub Release，Release 说明为从提交自动生成的 changelog |

> 💡 `-alpha` 预发布只会构建 Docker 镜像，不会发布 GitHub Release。

### 手动触发

也可在 GitHub → **Actions → Publish Docker image (Multi-arch) → Run workflow**，输入一个**已存在**的 tag 重新构建镜像。

> [!IMPORTANT]
> 首次发布前，需在仓库 **Settings → Secrets and variables → Actions** 配置以下密钥，否则推送私有仓库会失败：
> - `ALIYUN_REGISTRY_USERNAME` — 阿里云容器镜像仓库用户名
> - `ALIYUN_REGISTRY_PASSWORD` — 对应密码/访问凭证

## 📚 文档

- 官方文档：<https://docs.newapi.pro/docs>
- DeepWiki：[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/QuantumNous/new-api)

## 📜 开源协议

本项目基于 [GNU AGPLv3](./LICENSE) 开源。

依据 AGPLv3 第 7 条附加条款：修改版本必须在相应法律声明，以及界面中显著的关于、法律、页脚或署名位置，保留作者署名 `Frontend design and development by New API contributors.`，并保留指向原始项目的可见链接：<https://github.com/QuantumNous/new-api>。

本项目基于 [One API](https://github.com/songquanpeng/one-api)（MIT 协议）二次开发。

## 🌟 Star History

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=Calcium-Ion/new-api&type=Date)](https://star-history.com/#Calcium-Ion/new-api&Date)

</div>

---

<div align="center">

<sub>Built with ❤️ by QuantumNous</sub>

</div>
