# 一键拉取更新（系统维护）设计说明

**日期:** 2026-07-16  
**仓库:** [ChinaToyHunter/new-api](https://github.com/ChinaToyHunter/new-api)（fork of QuantumNous/new-api）  
**状态:** 待用户审阅后进入实现计划  
**参考实现:** [ChinaToyHunter/sub2api](https://github.com/ChinaToyHunter/sub2api) 的 `UpdateService` + 管理端系统更新 API

---

## 1. 背景与目标

### 1.1 现状

- 默认主题系统设置 → 系统维护区（`web/default/src/features/system-settings/maintenance/update-checker-section.tsx`）仅有「检查更新」。
- 检查更新由**浏览器直连** GitHub：`Calcium-Ion/new-api/releases/latest`，只展示 changelog / 打开 Release 页，**不能**在部署环境内完成升级。
- 线上（ali-server）为 Docker 镜像部署（`calciumion/new-api:latest`）；上游与 fork 亦发布带 checksum 的多平台二进制 Release。
- 运维目标：网页端一键完成「有版本 → 拉取 → 应用 → 恢复服务」，按钮与「检查更新」**并列**。

### 1.2 目标

在系统维护区为 **Root** 提供与「检查更新」并列的「拉取更新」，支持：

1. **二进制部署**：从配置的 GitHub 仓库 Release 下载匹配平台资产 → checksum → 原子替换 → 可选重启（对齐 sub2api）。
2. **Docker 部署**：经挂载的 `docker.sock` 对**当前容器**执行 `pull` + recreate（保留 env / 挂载 / 网络 / restart policy）。
3. **Fork 优先的更新源**：运行时只从 fork（默认 `ChinaToyHunter/new-api`）取可部署产物；上游 `QuantumNous/new-api` 合入 fork、保留自改，在 **GitHub / CI 侧**完成，不在应用内自动 merge。

### 1.3 非目标（首版）

- classic 主题完整 UI 对齐（API 可先共用，UI 可后续补）。
- 指定历史版本回滚列表 / 一键回滚（sub2api 有，首版不做）。
- 应用内「上游 → fork」自动同步、开 PR、解决冲突。
- Watchtower、任意外部 webhook、多服务 compose 编排。
- 非 Root 角色开放更新。
- 在 `has_update=false` 时强制 pull（避免误操作）。

### 1.4 成功标准

1. Root 在维护页看到「检查更新」与「拉取更新」同一行并列；非 Root 不可用。
2. 二进制：有新版本时可一键替换并可提示/触发重启，版本号变化。
3. Docker（已挂 sock）：可 pull 并 recreate，新容器使用新镜像 digest。
4. 无更新、权限不足、sock 不可用、checksum 失败时有明确错误；不半残杀进程。
5. 并发二次点击不会并行执行两次更新。
6. 交付**独立 Markdown 使用文档**（见 §8），说明功能增加与使用方法（含 fork 发版与 Docker 挂载）。

---

## 2. 更新源与 Fork 策略

| 层级 | 来源 | 负责方 |
|------|------|--------|
| 上游功能演进 | `QuantumNous/new-api` | 仓库侧 merge/PR 到 `ChinaToyHunter/new-api`，冲突时手保自改 |
| 可部署产物 | fork 的 **Release**（二进制）或 **镜像**（Docker） | CI / 维护者在 fork 打 tag、出包 |
| 线上实例 | 当前二进制或运行中镜像 ref | 网页一键更新只动这一层 |

**原则：**

- 默认 `NEWAPI_UPDATE_REPO=ChinaToyHunter/new-api`（替换前端原先直连的 `Calcium-Ion/new-api` 作为**权威检查源**；检查与下载走**后端**，避免浏览器 CORS/限流不一致）。
- 一键更新**不会**改 GitHub 上的代码或自动合上游；自改是否保留取决于发版前 fork 是否正确保留 patch。
- UI 可用次要说明：「部署源为 fork；上游请在 GitHub 合入后再发版。」

---

## 3. 架构

### 3.1 部署模式探测

启动时及 check 接口内判定 `deploy_mode`：

1. `NEWAPI_DEPLOY_MODE=binary|docker` 强制覆盖  
2. 否则：存在 `/.dockerenv` 或 cgroup 含 docker/containerd → `docker`  
3. 否则 → `binary`

### 3.2 二进制更新流（sub2api 同款）

```
Root 点击「拉取更新」
  → 二次确认
  → POST /api/system/update
  → 获取单飞锁
  → 拉取 fork latest release（可 force 刷新缓存）
  → 无更新 → already_up_to_date
  → 选择平台资产 + checksum 文件
  → HTTPS + 域名白名单校验 URL
  → 下载到可执行文件同目录临时目录
  → SHA256 校验（有 checksum 文件时强制）
  → rename 当前 → .backup；新文件 → 当前路径（失败则从 backup 恢复）
  → 返回 need_restart
  → 可选 POST /api/system/restart（延迟约 500ms 后退出，由 systemd 等拉起）
```

### 3.3 Docker 更新流（docker.sock）

```
Root 点击「拉取更新」
  → 二次确认
  → 单飞锁
  → 通过 sock 识别本容器（HOSTNAME 与容器 ID 前缀等）
  → Inspect 当前镜像引用（默认沿用当前 image；可用 NEWAPI_DOCKER_IMAGE 覆盖）
  → ImagePull
  → 对比 pull 前后 Image ID；相同 → already_up_to_date
  → Recreate：
      - 复制 Config / HostConfig / NetworkingConfig
      - rename 旧容器 → *-updating-old
      - 创建并启动同名新容器
      - 新容器健康后删除旧容器；失败则尽量 rename/启动回滚
  → 连接可能短暂断开；前端轮询 /api/status 直至恢复并读取新 version
```

**镜像与版本关系：**

- `has_update` 以 fork Release 的语义版本为主（与现有「检查更新」心智一致）。
- Docker 执行以 image pull + digest 变化为准。
- 可选读取镜像 label `org.opencontainers.image.version` 辅助展示。

### 3.4 模块划分

| 模块 | 职责 |
|------|------|
| `service/update`（或等价路径） | 版本比较、缓存、二进制下载替换、Docker pull/recreate 抽象 |
| `controller/system_update.go` | HTTP：check / perform / status / restart |
| `router/api-router.go` | `RootAuth` 下注册 `/api/system/*` |
| `web/default/.../update-checker-section.tsx` | 并列按钮、确认框、进度、断连重连 |
| `docs/one-click-update.md`（名称可微调） | **独立使用说明**（用户明确要求单独 README 式 md） |

---

## 4. API 设计

均需 **RootAuth**。建议挂在 `/api/system` 下，与现有 `/api/system-task`、`/api/system-info` 并列。

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/system/update/check?force=true` | 当前/最新版本、是否有更新、deploy_mode、release 摘要、docker/binary 能力 |
| POST | `/api/system/update` | 执行更新；可选 Idempotency-Key |
| GET | `/api/system/update/status` | 是否在更新、阶段、错误信息 |
| POST | `/api/system/restart` | 主要服务二进制模式；Docker 更新本身 recreate |

### 4.1 check 响应示例

```json
{
  "success": true,
  "data": {
    "deploy_mode": "docker",
    "current_version": "v0.0.0",
    "latest_version": "v1.0.0-rc.21",
    "has_update": true,
    "release_info": {
      "tag_name": "v1.0.0-rc.21",
      "name": "...",
      "body": "...",
      "html_url": "https://github.com/ChinaToyHunter/new-api/releases/...",
      "published_at": "..."
    },
    "docker": {
      "image": "calciumion/new-api:latest",
      "socket_available": true
    },
    "binary": {
      "platform": "linux/amd64",
      "asset_found": true
    },
    "update_source": "ChinaToyHunter/new-api",
    "enabled": true,
    "cached": false,
    "warning": ""
  }
}
```

### 4.2 perform 成功 / 已最新

```json
{
  "success": true,
  "data": {
    "message": "Update completed. Please restart the service.",
    "need_restart": true,
    "deploy_mode": "binary",
    "from_version": "v1.0.0-rc.20",
    "to_version": "v1.0.0-rc.21"
  }
}
```

```json
{
  "success": true,
  "data": {
    "message": "Already up to date",
    "already_up_to_date": true,
    "current_version": "v1.0.0-rc.21",
    "latest_version": "v1.0.0-rc.21"
  }
}
```

### 4.3 更新阶段（status）

`idle` → `checking` → `downloading` | `pulling` → `verifying` → `applying` | `recreating` → `restarting` → `done` | `failed`

---

## 5. 配置（环境变量）

| 变量 | 默认 | 含义 |
|------|------|------|
| `NEWAPI_UPDATE_ENABLED` | `true` | 总开关；false 时按钮禁用 |
| `NEWAPI_DEPLOY_MODE` | 自动探测 | `binary` / `docker` |
| `NEWAPI_UPDATE_REPO` | `ChinaToyHunter/new-api` | 检查与下载 Release 的仓库 `owner/name` |
| `NEWAPI_DOCKER_HOST` | `unix:///var/run/docker.sock` | Docker API 地址 |
| `NEWAPI_DOCKER_IMAGE` | 空（用当前容器 image） | pull 目标镜像引用 |
| `NEWAPI_GITHUB_TOKEN` | 空 | 可选，提高 GitHub API 限额；**不**用于改仓库代码 |

Docker compose 示例（使用文档中展开）：

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
environment:
  - NEWAPI_UPDATE_REPO=ChinaToyHunter/new-api
  # - NEWAPI_DOCKER_IMAGE=ghcr.io/example/new-api:latest
```

---

## 6. 安全

- 仅 **Root** 可调用更新相关 API。
- 下载仅 **HTTPS**，host 白名单：`github.com`、`*.github.com`、`objects.githubusercontent.com` 及后缀形式（与 sub2api 同思路）。
- 存在 checksum 资产时 **强制** SHA256 校验；缺失则拒绝更新（首版不提供「允许未签名」开关，避免误开）。
- Docker 路径仅允许操作**本容器**（识别失败则中止），禁止列举后随意删除无关容器。
- 进程内单飞锁；超时失败释放锁。
- 审计：`SysLog` 记录操作者（Root user id）、mode、前后版本 / 镜像 ID。
- 挂载 `docker.sock` 等同高权限：文档中明确风险，建议仅受信管理网络 + Root 账号强认证。

---

## 7. 前端 UX

- 位置：系统设置 → 系统维护 → `UpdateCheckerSection`。
- 「检查更新」与「拉取更新」**同一行 flex 并列**（检查在左或保持现有主按钮样式；拉取为明确动作按钮）。
- 检查更新：改为调用后端 `/api/system/update/check`（可保留打开 Release 详情 Dialog）。
- 拉取更新：
  - `has_update=false` → disabled 或点击 toast「已是最新」
  - Docker 且 `socket_available=false` → disabled + 文案提示未挂载 sock
  - `enabled=false` → disabled
  - 点击 → 确认 Dialog（当前版本 / 目标版本 / deploy_mode）→ POST update
- 执行中 loading；Docker 断连后每 ~2s 轮询 `/api/status` 或 check，成功后 toast 并刷新展示版本。
- i18n：中英文键与现有 system settings 一致风格。

---

## 8. 独立使用文档（用户要求）

实现时新增**单独** Markdown，建议路径：

`docs/one-click-update.md`

（若项目已有运维文档目录惯例，可放在 `docs/` 下同级；**不要**只写在本 design spec 或代码注释里。）

文档至少包含：

1. 功能简介（检查更新 vs 拉取更新）
2. 权限要求（Root）
3. 更新源说明（默认 fork；上游如何合入后再发版）
4. 二进制部署：发版资产命名、checksum、systemd 重启预期
5. Docker 部署：`docker.sock` 挂载示例、`NEWAPI_DOCKER_IMAGE`、安全注意
6. 环境变量表
7. 常见失败与处理（无更新、checksum、sock、权限）
8. 与上游 / fork 协作推荐流程（简图或步骤列表）

主 README 可加一行链接指向该文档，但**主体说明在独立 md**。

---

## 9. 错误处理矩阵

| 场景 | 行为 |
|------|------|
| 已是最新 | `already_up_to_date`，成功 toast，不重启/不 recreate |
| GitHub API 失败 | 有缓存则带 `warning`；无缓存则失败，不改系统 |
| Release 无本平台资产 | binary 失败提示 |
| checksum 缺失或不匹配 | 拒绝；清理临时文件；保留原二进制 |
| 原子替换失败 | 从 `.backup` 恢复 |
| 更新中再次请求 | 返回进行中 + status |
| 非 Root | 401/403 |
| 功能关闭 | check 标记 disabled；按钮灰掉 |
| Docker sock 不可用 | 拉取禁用 + 说明 |
| Docker pull 失败 | 不 stop 旧容器 |
| Docker recreate 中途失败 | 尽量恢复旧容器；详记日志 |
| 二进制 restart 失败 | 提示手动重启；若文件已替换则单独说明 |
| 超时 | API ~15s；下载/pull 更长上限（如 10min） |

---

## 10. 测试计划

1. **单元**：版本比较、URL 白名单、deploy mode 探测、checksum 解析  
2. **二进制（mock HTTP）**：无更新 / 成功替换 / checksum 失败回滚  
3. **Docker（mock client 或集成）**：sock 缺失、pull 失败不伤旧容器、digest 不变  
4. **API 权限**：非 Root 拒绝  
5. **前端**：并列布局、disabled 态、确认框、断连轮询恢复  

---

## 11. 实现分期建议

| 阶段 | 内容 |
|------|------|
| P0 | 后端 check + binary perform + status + Root 路由；前端并列按钮与确认；独立 `docs/one-click-update.md` |
| P1 | Docker sock 探测 + pull/recreate + 前端断连重连 |
| P2（可选后续） | classic UI、回滚、Idempotency-Key 完整对齐 sub2api、Redis 分布式锁 |

首版交付以 **P0 + P1** 为完整「方案 B」；文档与 P0 同步落地。

---

## 12. 风险与缓解

| 风险 | 缓解 |
|------|------|
| docker.sock 权限过大 | 文档警示；仅本容器；Root only |
| 更新自己导致失控 | recreate 顺序 + 失败回滚；不先删后建无备份名 |
| fork 落后上游导致「装不上新功能」 | 文档强调仓库侧合入；UI 次要提示 |
| Windows 运行中替换失败 | 主要验证 Linux；Windows 失败时明确手动步骤 |
| GitHub 限流 | 可选 token；20min 级缓存（对齐 sub2api 量级） |

---

## 13. 已确认决策记录

- 更新方式参考 sub2api，且 **binary + Docker 双模式**。
- Docker 通过 **挂载 docker.sock、容器内操作**。
- 运行时 **只从 fork 拉取**；上游 → fork 在仓库侧手动/CI。
- 需 **单独 md 使用文档**说明功能与用法。
- 方案选型：**方案 B**（双模式完整版，首版不做完整回滚体系）。
