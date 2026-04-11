# Fork + Governor 验证环境方案

这份文档用于把当前 governor 改动整理成一个可长期维护的 fork 工作流，并且提供一套独立的 `lab` 验证环境。目标不是继续扩大对 `new-api` 核心代码的改动，而是让后续验证、部署、回滚、升级都围绕镜像和环境来做。

本地验证优先推荐 `WSL`，Docker 不是本地验证的必须条件。更准确地说：

- `WSL` 适合做日常开发、构建和 governor 行为验证。
- Docker 更适合做可复制部署和 CI 制品发布。
- governor 的分布式并发控制真正必须的运行时依赖是 `Redis`，不是 Docker。

## 推荐的仓库拓扑

推荐把你的 GitHub fork 设为 `origin`，官方仓库设为 `upstream`：

```bash
git remote rename origin upstream
git remote add origin git@github.com:<your-account>/new-api.git
git fetch --all --prune
```

推荐的分支职责：

- `main`：fork 的稳定线，用于准备 canary 或更稳定的环境。
- `lab`：用于快速验证 governor 与部署链，允许更频繁地发布镜像。
- `feature/*`：短期功能分支，验证通过后并入 `lab`。

## 为什么这样更稳

- governor 的关键逻辑仍然留在应用内部，能感知渠道、key、重试与 `Retry-After`。
- fork 额外新增的内容主要放在 `docs/`、`deploy/`、`.github/workflows/`，升级时冲突面更小。
- 部署直接消费镜像，比每台机器 `git pull && 本地构建` 更稳定。
- `lab` 和未来 `canary` 共享同一条交付链，只是流量级别不同。

## 环境分层

### `lab`

用途：

- 做合成流量验证。
- 验证 Redis 下的 governor 行为。
- 验证 `429`、冷却、并发占用释放、前后端构建链是否正常。

特点：

- 不接正式生产流量。
- 可以频繁替换镜像。
- 优先验证“功能正确”和“部署可重复”。
- 可以分成两种运行方式：
  - `WSL` 原生运行：适合本地快速验证。
  - Docker Compose 运行：适合做接近部署形态的复现。

### `canary`

用途：

- 在 `lab` 通过后，承接一小部分真实流量。
- 验证真实渠道限制、真实峰值行为、真实风控反馈。

特点：

- 尽量复用 `lab` 已经验证过的镜像摘要。
- 只调配置和流量比例，不重新构建产物。

## 推荐的交付模型

推荐顺序：

1. 在 fork 分支上完成改动。
2. 由 fork 的 GitHub Actions 跑验证工作流。
3. 由 fork 的 GitHub Actions 构建并推送 GHCR 镜像。
4. `lab` 环境拉取镜像并启动。
5. 在 `lab` 中导入带 governor 的渠道配置并跑并发验证。
6. 验证通过后，将同一个镜像摘要提升到 `canary`。

这样做的好处是：`lab` 和 `canary` 的差异主要来自配置与流量，而不是“重新构建了一次，结果产物已经变了”。

## 本地验证优先级

我现在更推荐这样分层：

1. `WSL` 原生验证
2. 远端 `lab` 环境验证
3. `canary` 真实流量验证
4. Docker 镜像验证与发布

其中第 1 层和第 2 层是功能验证主线，第 4 层更偏向交付和复现能力，不必把它误解成 governor 功能验证本身的前置条件。

## `lab` 环境目录

仓库里新增的 `deploy/lab` 包含：

- `.env.example`：示例环境变量。
- `compose.yml`：最小可运行的 `new-api + redis + postgres` 组合。
- `channel-settings.governor.example.json`：可直接参考的渠道 governor 配置。
- `verify-governor.sh`：合成并发验证脚本。
- `start-wsl-lab.sh`：后台启动 WSL 本地 lab，并等待健康检查通过。
- `status-wsl-lab.sh`：查看 WSL lab 的进程、端口和健康状态。
- `stop-wsl-lab.sh`：停止 WSL lab 的 `new-api` 与 Redis 进程。
- `run-wsl-lab.sh`：WSL 原生启动脚本，默认使用 `SQLite + Redis`。
- `test-stop-wsl-lab.sh`：验证 `stop-wsl-lab.sh` 在 pid 文件缺失时仍能清理遗留 Redis 进程。

## WSL 原生验证

如果你的目标是先验证 governor，而不是先验证容器编排，那么 WSL 是更轻的路线。

推荐在 WSL 里单独 clone 一份仓库，而不是直接在 `/mnt/c/...` 下操作当前 Windows worktree：

- Linux 侧 clone 的文件系统性能更稳。
- Git 元数据路径更干净，不容易遇到 worktree 的 Windows 路径兼容问题。
- 后续装依赖、跑构建、起服务都会更顺手。

WSL 最小依赖建议：

- `go`
- `bun`
- `redis-server`
- `git`
- `curl`

本地 `lab` 不一定需要 PostgreSQL。为了验证 governor，并不要求数据库必须是 PostgreSQL；使用 `SQLite + Redis` 就已经足够覆盖大部分并发治理逻辑。

启动方式：

```bash
cd deploy/lab
./start-wsl-lab.sh
```

后台启动脚本会：

- 启动后台 lab 进程
- 等待 `/api/status` 健康检查通过
- 把日志写到 `deploy/lab/runtime/wsl/lab-start.log`

前台脚本 `run-wsl-lab.sh` 会：

- 检查 `go`、`bun`、`redis-server`
- 构建前端
- 构建后端
- 启动一个本地 Redis
- 使用 `SQLite` 作为数据库启动 `new-api`

常用命令：

```bash
cd deploy/lab
./start-wsl-lab.sh
./status-wsl-lab.sh
./stop-wsl-lab.sh
```

如果你上一次异常退出，或者你手工删过 `deploy/lab/runtime/wsl` 里的文件，推荐先做一次干净重启：

```bash
cd deploy/lab
./stop-wsl-lab.sh
rm -rf runtime/wsl
./start-wsl-lab.sh
```

现在的 `stop-wsl-lab.sh` 会优先按 pid 文件停进程；如果 Redis 的 pid 文件已经丢失，它还会按当前 lab 记录的 Redis 端口兜底清理遗留进程，避免下一次启动时误连到旧实例。

如果你的 Windows 宿主机无法通过 `http://127.0.0.1:<port>` 访问 WSL 里的服务，不一定是 `new-api` 没起来，也可能只是当前 WSL 没启用本地端口回流。此时可以在 WSL 中执行：

```bash
hostname -I
```

然后从 Windows 宿主访问第一个 WSL IP，例如：

```text
http://<wsl-ip>:3000/api/status
```

启动步骤：

```bash
cd deploy/lab
cp .env.example .env
docker compose -f compose.yml up -d
```

如果你使用的是另一台服务器，只需要：

1. `git clone` 你的 fork。
2. 修改 `deploy/lab/.env` 中的镜像地址与密码。
3. `docker compose -f deploy/lab/compose.yml up -d`。

如果你在另一台 Linux 服务器上暂时不想用 Docker，也可以直接参考 `deploy/lab/run-wsl-lab.sh` 的环境变量方式，用 `systemd` 或 `supervisor` 管理二进制进程。

## Governor 配置建议

当前 governor 配置并不是环境变量，而是渠道 `settings` 里的 JSON。这样做反而更升级友好，因为不会再往全局配置层塞新的行为分支。

建议从 [deploy/lab/channel-settings.governor.example.json](../../deploy/lab/channel-settings.governor.example.json) 开始，先只给一小组测试渠道开启 governor，不要一开始全量铺开。

建议验证这些点：

- 相同渠道在并发过高时是否出现 `governor:selection_rejected`。
- `429` 是否表现为 governor 本地拒绝，而不是误判成泛化的 `503`。
- 失败后的冷却期是否生效。
- 请求结束后 lease 是否释放，后续请求能否恢复。
- 多个相同优先级渠道是否会在 governor 拒绝后继续尝试后续候选项。

## 并发验证方式

在 `lab` 中至少准备：

- 一个可用的测试 token。
- 一个已绑定真实上游的测试模型。
- 至少一个开启 governor 的渠道。
- Redis 正常连接。

然后执行：

```bash
BASE_URL=http://localhost:3000 \
API_KEY=<your-token> \
MODEL=<your-model> \
TOTAL_REQUESTS=20 \
CONCURRENCY=5 \
./deploy/lab/verify-governor.sh
```

输出里重点看：

- `HTTP 200` 的数量。
- `HTTP 429` 的数量。
- `governor:selection_rejected` 的出现次数。

如果你后续准备了真实流量环境，建议先在 `lab` 里把这套命令跑通，再把同一个镜像摘要推进到 `canary`。

## Upstream 升级节奏

推荐一个固定节奏：

1. `git fetch upstream`
2. 将 `upstream/main` 合入 fork 的 `main`
3. 运行 fork 验证工作流
4. 如需验证 governor，发布新的 `lab` 镜像
5. `lab` 通过后再推进 `canary`

这样未来如果 `new-api` 原生支持更好的并发治理，你只需要比较两套能力，再决定是否收缩 fork 差异，而不是先解决一堆混杂的部署脚本问题。

## 当前已知注意点

- governor 的分布式行为依赖 Redis；没有 Redis 时会退回默认选 key 行为。
- 仓库中的 `VERSION` 文件当前为空，所以 fork workflow 里会在构建前写入一个临时版本号。
- 对本地验证来说，Docker 不是必须条件。
- 对跨机器稳定部署来说，镜像仍然是更稳的制品形态。
