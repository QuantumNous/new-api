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
| `NEWAPI_GITHUB_TOKEN` | 空 | 可选，提高 GitHub API 限额（不用于改仓库） |

## 二进制部署

### 发版资产建议

与上游类似的命名，例如：

- `new-api-vX.Y.Z`（linux/amd64）
- `new-api-arm64-vX.Y.Z`
- `new-api-macos-vX.Y.Z`
- `new-api-vX.Y.Z.exe` / windows 资产
- `checksums-linux.txt` / `checksums-macos.txt` / `checksums-windows.txt`（或 `checksums.txt`）

checksum 行为：`hex  filename`（SHA256）。**有 checksum 文件时强制校验**；找不到对应 checksum 则拒绝更新。

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

- 默认 pull **当前容器正在使用的 image:tag**
- 可用 `NEWAPI_DOCKER_IMAGE` 覆盖为你的 fork 镜像
- 「是否有更新」主要依据 GitHub Release 语义版本；真正 recreate 以 pull 后镜像 digest 是否变化为准

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
