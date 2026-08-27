# 一键拉取更新（系统维护）

本文说明 new-api（fork 部署）在网页端「系统维护」中新增的**检查更新 / 拉取更新**能力与运维用法。

## 功能简介

在管理后台 **系统设置 → 系统维护** 中：

| 按钮 | 作用 |
|------|------|
| **检查更新** | 由后端查询配置仓库的 GitHub Latest Release，展示版本与 release notes |
| **拉取更新** | 在有新版本时，按当前部署模式真正应用更新 |

仅 **Root** 用户可调用相关 API（`RootAuth`）。

## 更新源（Fork 优先）

运行时**只从 fork 取可部署产物**，默认：

- GitHub 仓库：`ChinaToyHunter/new-api`（环境变量 `NEWAPI_UPDATE_REPO`）
- 不会在应用内自动把上游 `QuantumNous/new-api` merge 进 fork

推荐流程：

1. 在 GitHub 将上游变更合入你的 fork，**保留自改功能**
2. 在 fork 上打 tag / 发布 Release（含二进制 + checksum），或构建/推送 Docker 镜像
3. 在线上管理后台点「检查更新」→「拉取更新」

## 版本号规范（fork 自建）

**格式（固定）：**

```text
v{上游ReleaseTag}-th.{x}
```

示例：

- `v1.0.0-rc.21-th.1`
- `v1.0.0-rc.21-th.2`
- `v1.0.0-rc.22-th.1`

| 段 | 含义 | 何时变 |
|----|------|--------|
| `v{上游ReleaseTag}` | 与 **QuantumNous/new-api** 最新（或你已合入的）**Release tag** 对齐，如 `v1.0.0-rc.21` | 上游打了新 Release，且你已把对应代码合进 fork 后再发版 |
| `-th` | ToyHunter fork 自建标记（含一键更新等自改） | 固定，不要改成 `oneclick` 等其它后缀 |
| `.{x}` | 同一上游基线之下的自建序号，从 **1** 起 | 仅自改 / 修 bug / 重发时 **x+1**；换上游基线时 **x 归 1** |

### 硬性约定

1. **四者一致：** 仓库 `VERSION` 文件 = git tag = GitHub Release tag = 线上 `common.Version` / `X-New-Api-Version`（Docker 镜像 tag 建议同名，如 `local/new-api:v1.0.0-rc.21-th.2`）。
2. **不要**在已合入上游 rc.21 代码后仍使用 `v1.0.0-rc.20-th.*` 或历史 `*-oneclick.*` 标记。
3. **一键更新只认 fork Release**（`NEWAPI_UPDATE_REPO=ChinaToyHunter/new-api`）。不要把更新源改成上游官方仓，否则会装上**没有自改**的官方包。
4. 上游 `main` 有 commit 但尚未打新 Release 时：基线仍用**最近已合入的上游 Release tag**；等上游发 tag 并合入后再升基线。
5. GitHub 显示 fork「not behind upstream main」只说明 **git 提交**同步情况，**不等于** Release 号或线上版本号。

### 只改 x（同基线重发）

```bash
UP=$(gh api repos/QuantumNous/new-api/releases/latest --jq -r .tag_name)   # e.g. v1.0.0-rc.21
BASE="${UP}-th"
MAX=$(gh api repos/ChinaToyHunter/new-api/releases --jq '.[].tag_name' \
  | sed -n "s/^${BASE}\\.\\([0-9]\\+\\)$/\\1/p" | sort -n | tail -1)
NEXT=$(( ${MAX:-0} + 1 ))
NEW="${BASE}.${NEXT}"
echo "$NEW" > VERSION
# 构建 → git tag → gh release create → 部署
```

### 上游新 Release 后（换基线）

```bash
git fetch upstream
git checkout main
git merge upstream/main   # 解决冲突，保留 selfupdate 等自改
UP=$(gh api repos/QuantumNous/new-api/releases/latest --jq -r .tag_name)
NEW="${UP}-th.1"
echo "$NEW" > VERSION
# 构建 → tag → Release → 部署
```

### 与「检查更新 / 拉取更新」的关系

| 步骤 | 作用 |
|------|------|
| 合上游到 fork | 代码与自改并存 |
| `VERSION` + 构建 | 二进制/镜像带正确版本字符串 |
| fork 上 **打 tag + 创建 GitHub Release** | `releases/latest` 有内容，「检查更新」才能看到新版本 |
| 线上「拉取更新」 | 按部署模式装上 fork 产物 |

fork **没有任何 Release** 时：检查更新会提示「当前是最新版本，无需更新」（无 404 硬错误），因为没有可部署的更新包。

---

## 部署模式

启动时自动探测（可用 `NEWAPI_DEPLOY_MODE` 强制）：

| 模式 | 探测 | 拉取更新行为 |
|------|------|----------------|
| `binary` | 非容器 / 强制 | 下载匹配平台的 Release 资产 → SHA256 校验 → 原子替换可执行文件 → 可选重启 |
| `docker` | `/.dockerenv` 或 cgroup 含 docker/containerd | 经 docker.sock 对**当前容器** `pull` 镜像并 recreate |

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `NEWAPI_UPDATE_ENABLED` | `true` | 总开关 |
| `NEWAPI_DEPLOY_MODE` | 自动 | `binary` / `docker` |
| `NEWAPI_UPDATE_REPO` | `ChinaToyHunter/new-api` | Release 检查与下载仓库 |
| `NEWAPI_DOCKER_HOST` | `unix:///var/run/docker.sock` | Docker Engine 地址 |
| `NEWAPI_DOCKER_IMAGE` | 空（用当前容器 image） | pull 目标镜像引用 |
| `NEWAPI_COMPOSE_SYNC_ENABLED` | `false` | 是否在 GitHub Release 生成本地镜像的 Docker 更新中同步 Compose 服务的 `image:` 声明；默认不修改 Compose |
| `NEWAPI_COMPOSE_FILE` | 空 | 开启声明同步时必填：容器内的绝对 `.yml` / `.yaml` 路径，且必须位于已有的可写 bind mount 内 |
| `NEWAPI_COMPOSE_SERVICE` | 空 | 可选 Compose 服务名；优先使用当前容器的 `com.docker.compose.service` 标签，两者同时设置时必须一致 |
| `NEWAPI_GITHUB_TOKEN` | 空 | 可选，提高 GitHub API 限额（不用于改仓库） |

## 二进制部署

### 发版资产建议

与当前 Release tag **精确匹配**的资产命名如下（不匹配的名称不会用于自更新）：

- `new-api-vX.Y.Z`（linux/amd64）
- `new-api-arm64-vX.Y.Z`（linux/arm64）
- `new-api-macos-vX.Y.Z`（macOS/amd64）
- `new-api-vX.Y.Z.exe`（Windows/amd64）
- `checksums-linux.txt` / `checksums-macos.txt` / `checksums-windows.txt`（或 `checksums.txt`）

当前 release workflow 只发布上述 amd64/arm64 组合；未由 workflow 发布的操作系统或架构会拒绝二进制自更新，而不是猜测选择相似名称的资产。

checksum 行为：`hex  filename`（SHA256）。二进制更新（包括 Docker 的 GitHub 本地镜像路径）必须找到对应 checksum；缺失或不匹配时拒绝更新。

### 重启

替换成功后接口返回 `need_restart: true`。网页可调用 `POST /api/system/restart`（进程约 500ms 后退出）。请用 **systemd / 进程管理器** 保证自动拉起，例如 `new-api.service` 的 `Restart=always`。

## Docker 部署

### 挂载 docker.sock（必需）

```yaml
services:
  new-api:
    image: calciumion/new-api:latest   # 或你的 fork 镜像
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - NEWAPI_UPDATE_REPO=ChinaToyHunter/new-api
      # - NEWAPI_DOCKER_IMAGE=ghcr.io/you/new-api:latest
```

### 安全注意

挂载 `docker.sock` 等同于容器对 Docker 引擎的高权限。请：

- 仅 Root 可进管理后台
- 管理面不要对公网裸奔（VPN / 反代鉴权 / 防火墙）
- 应用仅 recreate **自身容器**，不操作无关容器

### 行为说明

- **Docker + GitHub 资产（推荐，ali 现网）**
  仅当 fork 的 Latest Release 含有与运行架构匹配的 `linux/<GOARCH>` new-api 二进制时，「拉取更新」才会进入 GitHub 本地镜像路径：
  1. 下载匹配的 linux 资产，并要求 `checksums-linux.txt`（或 `checksums.txt`）中包含该文件的 SHA256；匹配二进制但缺少可用 checksum 会**拒绝更新**，不会回退到 registry
  2. 基于当前运行镜像 commit 出 `local/new-api:{ReleaseTag}`
  3. 由独立辅助容器 recreate 当前容器到该本地镜像
  **不依赖**公有镜像仓库；Compose 声明同步仅可发生在这条已校验的本地镜像路径上。
- **Docker registry 回退**
  若 Release **没有**匹配 `linux/<GOARCH>` 的二进制，仍 pull 当前容器的 image 引用（或 `NEWAPI_DOCKER_IMAGE`）。仅改 tag、不推 registry 时无法更新；此回退路径保持历史 recreate 行为，**永不**同步 Compose 声明。
- **「是否有更新」** 依据 GitHub Release 语义版本（含 `-th.N` 比较）；Docker 真正是否 recreate 以新镜像构建/digest 为准。

### Compose 声明同步（可选）

默认情况下，Docker 一键更新**不会修改** Compose 文件。若希望更新后的容器和后续 `docker compose up -d` 使用同一镜像声明，可显式启用：

```yaml
services:
  new-api:
    image: calciumion/new-api:latest
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      # Compose 文件所在目录必须以 bind mount 方式挂到容器内。
      - /opt/new-api:/opt/new-api
    environment:
      - NEWAPI_COMPOSE_SYNC_ENABLED=true
      - NEWAPI_COMPOSE_FILE=/opt/new-api/docker-compose.yml
      # 可省略：优先读取 com.docker.compose.service 标签。
      - NEWAPI_COMPOSE_SERVICE=new-api
```

启用后的边界和回滚规则：

- Docker 一键更新（GitHub 本地镜像和 registry 回退两条路径）均由独立辅助容器完成，因而仅支持使用 **Unix Docker socket** 的 Linux/Unix Docker 部署；`npipe://` 和 `tcp://` Docker host 会在创建辅助容器前被拒绝。
- `NEWAPI_COMPOSE_FILE` 只能是容器内绝对 `.yml` / `.yaml` 文件，并且必须落在当前容器已有的**最具体的可写 bind mount** 内；具名卷、匿名卷、只读 bind mount，以及 host root (`/`) bind mount 都会被拒绝。
- 运行前必须把 Compose 文件放在稳定、受控的专用目录中：该 bind source、其父路径，以及 Docker daemon 解析它们的路径均不得含可变的符号链接、junction、mount/reparse point 或其他重定向。应用会检查可见文件路径中的常规符号链接，但无法替 Docker daemon 固定 host bind source 的对象身份。
- 服务名优先使用 Docker Compose 的 `com.docker.compose.service` 标签；若同时配置 `NEWAPI_COMPOSE_SERVICE`，两者不一致会拒绝更新，避免误改其他服务。
- 只改目标服务的字面量 `image:` 标量。多 YAML 文档，以及 `services`、目标服务或其 `image` 的重复键都会被拒绝；目标 `image:` 使用锚点/别名或 `${...}` 插值时也会拒绝。成功写回可能会规范化该 YAML 文件的格式。
- 应用会在准备阶段和辅助容器写入前比较 SHA-256，并通过 Unix `O_NOFOLLOW` 读取最终文件。这些检查可检测校验点上的意外修改，却**不是**对恶意或不协作并发写入者的完全 TOCTOU 防护：最终 rename、恢复和 Docker daemon 绑定路径之间仍有路径级竞态。因此不要在更新期间手工修改目标文件或其目录；需要抵御 hostile writer 时应关闭该功能并使用受控部署流程。
- GitHub Release 本地镜像更新会移除容器环境中的 `NEWAPI_DOCKER_IMAGE`，因此开启 Compose 同步时，旧容器若仍设置了**非空** `NEWAPI_DOCKER_IMAGE` 会在停止容器前拒绝更新；先从 Compose/部署环境中删除该变量并重新创建到不含该变量的版本后再更新。
- 原文件会在同目录保留为临时备份，直到新容器通过就绪检查、Compose 声明同步且旧容器删除后才删除。创建、启动、就绪或 Compose 同步失败时会恢复 Compose 声明并尝试恢复旧容器；若恢复动作也失败，错误会同时报告主失败和恢复失败，需立即人工检查 Docker 与 Compose 文件。
- 新容器健康后才写入 Compose 声明，随后删除旧容器。若删除旧容器失败，更新会报告“新容器健康且 Compose 已同步、但旧容器删除失败”的部分成功状态，并保留备份供人工处理；若旧容器已删除但备份清理失败，则服务已切换成功，只需人工清理备份。
- 辅助容器需要**整个 Compose 父目录**的读写 bind mount，而不是单文件权限；同目录的 `.env`、凭据、其他 Compose 文件和任何 sibling 均处于它的写入权限范围。务必使用不含秘密或无关文件的专用、受控目录。
- 写回文件只保留原文件的 Unix permission mode；不会保留 UID/GID、ACL、xattr、SELinux/其他安全标签或 Windows DACL。依赖这些元数据的部署应关闭同步或在更新后按既定运维流程恢复它们。

辅助容器使用 `network=none` 且会自动删除；不过 Docker socket 本身仍属于高权限能力，必须继续按前述安全措施保护管理面。

### 手动发版（使网页可拉取）清单

以 `v1.0.0-rc.21-th.4` 为例：

```bash
VER=v1.0.0-rc.21-th.4
echo "$VER" > VERSION
# 构建前端 + linux 二进制（VERSION 写入 ldflags）
# 资产名必须匹配：
#   new-api-${VER}
#   checksums-linux.txt   内容: "<sha256>  new-api-${VER}\n"

gh release upload "$VER" "dist-linux/new-api-${VER}" dist-linux/checksums-linux.txt --clobber
```

发版后 Root 在系统维护点「检查更新」应看到新 tag；「拉取更新」在 Docker 模式下会从该 Release 装包。

**注意：** 若线上仍是**旧二进制**（没有「GitHub→本地镜像」逻辑），需要**先手动部署一次**含此逻辑的版本，之后的 `th.5+` 才可纯网页一键更新。

## API（Root）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/system/update/check?force=true` | 检查更新 |
| POST | `/api/system/update` | 执行更新 |
| GET | `/api/system/update/status` | 进度/阶段 |
| POST | `/api/system/restart` | 二进制模式重启 |

## 常见问题

| 现象 | 处理 |
|------|------|
| 已是最新 | 正常；不会 pull/recreate |
| checksum 失败 / 缺失 | 检查 Release 资产命名与 checksums 文件 |
| Docker 按钮灰掉 / 提示 socket | 确认 compose 挂载 sock，且进程可访问 |
| 403 / 未授权 | 使用 Root 账号 |
| 功能关闭 | `NEWAPI_UPDATE_ENABLED=false` |
| 更新后服务起不来 | 看 docker logs / systemd status；二进制可从 `*.backup` 回退 |
| 并发重复点击 | 后端单飞锁，返回更新进行中 |

## 非目标（当前版本）

- classic 主题完整 UI
- 网页内一键回滚历史版本
- 应用内自动同步上游到 fork

## 相关设计

- 设计说明：`docs/superpowers/specs/2026-07-16-one-click-update-design.md`
- 实现计划：`docs/superpowers/plans/2026-07-16-one-click-update.md`
