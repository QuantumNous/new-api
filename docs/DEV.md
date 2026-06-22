# 94 本机 new-api 开发指南

本文档固化 **94 本机（hostname: `aioc`，内网 IP: `192.168.18.94`）** 上经实测的 new-api 开发基线。内容均来自当前运行中的 Docker 栈与仓库配置，供 `ui-redesign-ai-platform` 分支日常开发使用。

**最后核对方式**：只读检查 `docker compose ps`、`ss -lntp`、`GET /api/status`，未对容器做任何启停操作。

---

## 工作目录与分支

| 项 | 值 |
|----|-----|
| **唯一推荐工作目录** | `/home/laohaoaioc/projects/new-api` |
| **当前开发分支** | `ui-redesign-ai-platform` |
| **远程仓库** | `https://github.com/QuantumNous/new-api.git` |
| **Compose 项目名** | `new-api`（配置文件：`docker-compose.dev.yml`） |

### 禁止使用的旧目录

**`/home/laohaoaioc/new-api` 不是当前实际运行的 dev 栈目录。**

- 运行中容器由 `projects/new-api` 下的 `docker-compose.dev.yml` 创建（Compose `working_dir` 指向本目录）。
- `new-api-dev-web` 的前端 bind mount 为 `/home/laohaoaioc/projects/new-api/web/default`。
- **后续功能开发、文档更新、验收脚本均应在 `projects/new-api` 进行**，不要在 `new-api` 目录改代码。

---

## new-api dev 栈端口与 URL

### 宿主机映射（`docker-compose.dev.yml` 中唯一的 `ports`）

| 服务 | 容器名 | 宿主机:容器 | 说明 |
|------|--------|-------------|------|
| `new-api` | `new-api-dev` | **3000:3000** | 后端 API |
| `web-dev` | `new-api-dev-web` | **3001:3001** | default 前端 Rsbuild dev |
| `postgres` | `new-api-dev-pg` | **无** | 仅 `dev-network` 内 `5432` |
| `redis` | `new-api-dev-redis` | **无** | 仅 `dev-network` 内 `6379` |

### 访问地址（94 本机）

| 用途 | URL |
|------|-----|
| **后端 API** | `http://192.168.18.94:3000` |
| **健康检查** | `http://192.168.18.94:3000/api/status` |
| **前端 dev（日常入口）** | `http://192.168.18.94:3001` |
| 本机回环（同机浏览器） | `http://127.0.0.1:3000`、`http://127.0.0.1:3001` |

**容器内连接串（勿改为宿主机 `5432`/`6379`）：**

- `SQL_DSN=postgresql://root:123456@postgres:5432/new-api`
- `REDIS_CONN_STRING=redis://redis`

### 容器名、网络、数据卷（实测 Docker 名）

| compose 定义 | 实际 Docker 名称 |
|--------------|------------------|
| `container_name: new-api-dev` 等 | 与 compose 一致 |
| `networks: dev-network` | `new-api_dev-network` |
| `dev_data` | `new-api_dev_data` |
| `dev_pg_data` | `new-api_dev_pg_data` |
| `web_dev_node_modules` | `new-api_web_dev_node_modules` |

后端镜像 **不挂载** Go 源码；前端 bind mount `./web/default` → `/app`，改 `src` 热更新，**无需重建镜像**。

---

## 与 Dify 并行运行（94 本机）

94 本机同时运行 **new-api dev 栈** 与 **两套 Dify 相关栈**，当前 **无端口、容器名、网络名、卷名冲突**。

### 端口分工（宿主机）

| 系统 | 栈 / 项目 | 占用宿主机端口 | 说明 |
|------|-----------|----------------|------|
| **new-api dev** | `new-api` | **3000、3001** | 本仓库开发环境 |
| **Dify 主栈** | `docker` | **80、443**（及 **5003** plugin） | `docker-nginx-1` 等 |
| **Dify dev 栈** | `aioc-dev` | **8080、8443、15001、15002、15003** | `aioc-dev-nginx-1` 等 |

Dify 的 PostgreSQL（`5432`）、Redis（`6379`）、API（`5001`）、Web（`3000`）均在 **各自 Docker 网络内**，未映射到宿主机上述冲突端口。

### 保护规则（开发期间必须遵守）

1. **不得停止、重启、删除** Dify 相关容器（`docker-*`、`aioc-dev-*`）。
2. **不得修改** Dify 的宿主机端口（80/443/8080/8443/1500x 等）。
3. **不得** 在 `docker-compose.dev.yml` 中为 new-api 的 PostgreSQL / Redis 增加 `5432:5432`、`6379:6379` 等宿主机映射。
4. **若未来出现端口冲突，优先调整 new-api**（例如将 `3000`/`3001` 改为 `3100`/`3101`），**不调整 Dify**。
5. 停止/重建仅限 new-api 栈：`docker compose -f docker-compose.dev.yml ...`（见下文）。

---

## `web-dev` 服务说明

`web-dev` 在 Docker 内运行 **default 主题**（`web/default`）的 Rsbuild 开发服务器：

- 镜像：`new-api-web-dev:local`（`web/default/Dockerfile.dev`）
- 环境变量：`VITE_REACT_APP_SERVER_URL=http://new-api:3000`（代理 `/api` 到后端容器）
- 与数据库 `theme.frontend` **无关**；始终挂载并编译 `web/default`

日常 UI 开发请打开 **3001**，不要指望 **3000** 返回完整前端（dev 后端镜像内为占位 `index.html`）。

---

## 启动

在仓库根目录 `/home/laohaoaioc/projects/new-api`：

```bash
./scripts/dev/start-dev-stack.sh
```

等价于：

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

`start-dev-stack.sh` 健康检查地址（脚本内硬编码）：

- 后端：`http://127.0.0.1:3000/api/status`
- 前端：`http://127.0.0.1:3001/`
- 成功后另打印：`http://<hostname -I 首地址>:3001/`（94 本机上为 `http://192.168.18.94:3001/`）

若 3001 被占用（例如宿主机曾手动跑 Rsbuild）：

```bash
pkill -f 'rsbuild dev.*3001' || true
```

**仅停止 new-api 栈（不影响 Dify）：**

```bash
docker compose -f docker-compose.dev.yml down
```

**清空 new-api 数据卷（慎用，不影响 Dify 卷）：**

```bash
docker compose -f docker-compose.dev.yml down -v
```

---

## 重建命令

### 后端 Go 代码改动后

```bash
docker compose -f docker-compose.dev.yml up -d --build new-api
```

（`makefile` 亦提供：`make dev-api-rebuild`。）

### 前端依赖改动后

修改 `web/default/package.json` 或 `pnpm-lock.yaml` 后：

```bash
docker compose -f docker-compose.dev.yml up -d --build web-dev
```

仅修改 `web/default/src` 时，保存即可热更新，一般 **不需要** 重建。

---

## 查看日志

```bash
docker compose -f docker-compose.dev.yml logs -f new-api
```

```bash
docker compose -f docker-compose.dev.yml logs -f web-dev
```

---

## UI 验收

一键审计（健康检查 → 源码扫描 → Playwright 页面验收 → 汇总）：

```bash
bash scripts/dev/ui-audit/run-ui-audit.sh
```

`scripts/dev/ui-audit/run-ui-audit.sh` 行为：

- 默认 `BASE_URL=http://192.168.18.92:3001`（脚本内写死默认值）
- **94 本机实际前端在 `192.168.18.94:3001`**，验收时请显式覆盖：

```bash
BASE_URL=http://192.168.18.94:3001 \
UI_AUDIT_USERNAME=aioc_demo_zhang \
UI_AUDIT_PASSWORD='DevUi@123456' \
bash scripts/dev/ui-audit/run-ui-audit.sh
```

同机也可用 `BASE_URL=http://127.0.0.1:3001`。报告目录：`scripts/dev/ui-audit/reports/`（不提交 Git）。

演示数据与测试账号见 `scripts/dev/README.md`。

---

## classic / default 双主题注意事项

项目有两套前端，运行时由 `theme.frontend`（数据库 `options`）控制后端嵌入哪一套：

| 主题 | 目录 | 技术栈 | 代码默认值 |
|------|------|--------|------------|
| **classic** | `web/classic` | React 18、Vite、Semi Design | **是** |
| **default** | `web/default` | React 19、Rsbuild、Base UI + Tailwind | UI 重设计目标 |

**94 本机当前实测**（`GET http://127.0.0.1:3000/api/status`）：

- `theme: classic`
- `server_address: http://localhost:3000`

**与 dev 栈的关系（易混淆，开发前必读）：**

| 入口 | 实际加载 | 说明 |
|------|----------|------|
| **:3001 `web-dev`** | **default**（`web/default`） | UI 重设计日常开发入口 |
| **:3000 API + 嵌入页** | 数据库为 **classic** | dev 后端镜像内前端为占位页，非完整 UI |
| 生产式 classic UI | 需 `theme.frontend=classic` 且构建嵌入 `web/classic` | 非当前 3001 dev 路径 |

**后续做 UI 功能前，请先确认：**

1. 目标主题是 **classic** 还是 **default**；
2. 访问入口是 **3001（default dev）** 还是需切换数据库主题并走 classic 构建；
3. 验收与截图使用的 `BASE_URL` 是否与目标入口一致。

`common.ThemeAwarePath` 在 default 主题下会将部分 `/console/*` 映射为新路由（如 `/wallet`、`/usage-logs`）。

---

## 开发注意事项（摘要）

1. **工作目录**：仅 `/home/laohaoaioc/projects/new-api`；勿用 `/home/laohaoaioc/new-api`。
2. **分支**：当前在 `ui-redesign-ai-platform`；合入 `main` 按团队流程，本文档不自动提交。
3. **后端**：改 Go 后必须 `--build new-api`。
4. **前端**：改 `web/default/src` 热更新；改依赖后 `--build web-dev`。
5. **Dify**：并行运行，遵守上文保护规则，勿动 Dify 容器与端口。
6. **密码**：compose 中 `123456` 仅本地 dev。
7. **规范**：`AGENTS.md` / `CLAUDE.md`（后端）、`web/default/AGENTS.md`（default 前端）、`UI_REDESIGN_RULES.md`（UI 重设计）。

---

## 相关文件

| 文件 | 用途 |
|------|------|
| `docker-compose.dev.yml` | Dev 栈定义（3000/3001、容器名、网络、卷） |
| `Dockerfile.dev` | 后端 dev 镜像 |
| `web/default/Dockerfile.dev` | `web-dev` 镜像 |
| `scripts/dev/start-dev-stack.sh` | 一键启动与健康检查 |
| `scripts/dev/README.md` | 种子数据、测试账号 |
| `scripts/dev/ui-audit/` | UI 验收工具链 |
| `makefile` | `dev-api`、`dev-api-rebuild` 等 |
