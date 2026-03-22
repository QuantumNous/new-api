# 运维操作手册

本文档定义阶段 2.1 的正式升级方案：服务器通过 SSH 手动执行升级，且生产升级链路固定使用 Docker 镜像。仓库仍可保留 git tag、GitHub Release 等发布产物，但运维升级入口以 Docker 镜像为准。

## 1. 目标与范围

- 目标：让生产环境可以从一个已发布版本稳定升级到另一个已发布版本。
- 范围：单机或单节点 Docker Compose 部署。
- 升级来源：`calciumion/new-api:<tag>`。
- 执行方式：运维人员 SSH 登录服务器后，执行仓库内脚本完成升级。
- 基线要求：升级必须具备预检查、执行、健康检查、失败处理、回滚入口。

## 2. 目录与文件约定

建议服务器部署目录统一为一个独立目录，例如 `/opt/new-api`：

```text
/opt/new-api
├── docker-compose.yml
├── docker-compose.release.yml
├── .env                   # 可选，若使用环境文件
├── data/                  # 持久化数据
├── logs/                  # 应用日志
├── .upgrade-state/        # 升级状态文件
├── .upgrade-backups/      # 升级前配置备份
└── scripts/release/docker-image-upgrade.sh
```

说明：

- `docker-compose.yml` 作为基础部署文件，保留稳定配置。
- `docker-compose.release.yml` 由升级脚本生成，仅覆盖应用镜像 tag，不直接改基础 compose。
- `.upgrade-state/current.env` 记录最近一次升级或回滚的状态，供排障和手动回滚使用。
- `.upgrade-backups/<timestamp>/` 保存升级前的 compose 与环境文件备份。

## 3. 前置条件

升级脚本默认面向当前仓库里的 `docker-compose.yml`，并依赖以下条件：

- 服务器已安装 Docker。
- 服务器已安装 Docker Compose v2，或兼容的 `docker-compose`。
- `curl`、`awk`、`cp`、`df` 可用。
- 线上部署目录内已有可运行的 `docker-compose.yml`。
- 应用服务名为 `new-api`。
- 线上健康检查地址可访问：`http://127.0.0.1:3000/api/status`。

如果你使用环境文件而不是直接把变量写进 compose，可通过环境变量指定：

```bash
ENV_FILE=.env bash scripts/release/docker-image-upgrade.sh status
```

## 4. 升级脚本

脚本路径：

```text
scripts/release/docker-image-upgrade.sh
```

支持三个命令：

```bash
bash scripts/release/docker-image-upgrade.sh status
bash scripts/release/docker-image-upgrade.sh upgrade --tag <image-tag>
bash scripts/release/docker-image-upgrade.sh rollback [--tag <image-tag>]
```

默认参数：

- 镜像仓库：`calciumion/new-api`
- 基础 compose：`docker-compose.yml`
- release override：`docker-compose.release.yml`
- 健康检查：`http://127.0.0.1:3000/api/status`
- 磁盘最小空闲：`1024MB`
- 健康检查超时：`180s`
- 健康检查轮询间隔：`5s`
- 失败后自动回滚：开启

可以按需覆盖，例如：

```bash
MIN_FREE_MB=2048 \
STATUS_URL=http://127.0.0.1:3000/api/status \
ENV_FILE=.env \
bash scripts/release/docker-image-upgrade.sh upgrade --tag v1.0.1
```

## 5. 升级前检查

脚本在真正拉取新镜像前，会执行以下检查：

### 5.1 配置检查

- `docker-compose.yml` 是否存在。
- `docker-compose.yml + docker-compose.release.yml` 合并后能否通过 `docker compose config -q` 校验。
- 升级状态目录和备份目录能否创建。

### 5.2 磁盘检查

- 检查部署目录所在文件系统的可用空间。
- 默认要求至少 `1024MB` 可用空间。

### 5.3 数据库检查

脚本会按 compose 中是否存在数据库服务决定检查方式：

- 存在 `postgres` 服务：执行 `pg_isready`。
- 存在 `mysql` 服务：执行 `mysqladmin ping`。
- 两者都不存在：跳过内置数据库容器检查，说明数据库由外部服务提供，此时应由运维补充外部数据库可用性确认。

### 5.4 Redis 检查

- 存在 `redis` 服务时，执行 `redis-cli ping`，要求返回 `PONG`。
- 不存在 `redis` 服务时跳过，说明 Redis 可能由外部服务提供，此时应由运维补充外部 Redis 可用性确认。

### 5.5 当前运行状态检查

- 读取当前 `new-api` 容器状态。
- 记录当前运行镜像与 tag，用于失败后自动回滚或手动回滚。

## 6. 标准升级流程

进入服务器部署目录后执行：

```bash
cd /opt/new-api
bash scripts/release/docker-image-upgrade.sh status
bash scripts/release/docker-image-upgrade.sh upgrade --tag v1.0.1
```

升级脚本执行顺序如下：

1. 做升级前检查。
2. 备份 `docker-compose.yml`、`docker-compose.release.yml` 和可选的 `.env`。
3. 将目标镜像 tag 写入 `docker-compose.release.yml`。
4. 拉取指定镜像：`calciumion/new-api:<tag>`。
5. 执行 `docker compose up -d --no-deps new-api` 重启应用服务。
6. 对 `http://127.0.0.1:3000/api/status` 做轮询健康检查。
7. 将结果写入 `.upgrade-state/current.env`。

这种方式的关键点是：

- 数据库和 Redis 容器不会因为应用升级被一并重建。
- 升级只切换 `new-api` 服务的镜像 tag。
- 基础 compose 配置保持稳定，可重复执行。

## 7. 失败处理

如果升级后健康检查未通过，脚本会：

1. 将失败状态写入 `.upgrade-state/current.env`。
2. 在 `AUTO_ROLLBACK=1` 且存在上一个 tag 的情况下，自动回滚到上一个运行版本。
3. 回滚后再次执行健康检查。

失败时优先查看：

- `.upgrade-state/current.env`
- `docker compose ps`
- `docker compose logs --tail=200 new-api`
- `docker compose logs --tail=200 redis`
- `docker compose logs --tail=200 postgres`
- `docker compose logs --tail=200 mysql`

常见失败原因：

- 指定 tag 不存在或未推送成功。
- 应用启动后无法连接数据库。
- 应用启动后无法连接 Redis。
- 新版本启动成功但 `/api/status` 未在超时时间内恢复。
- 服务器磁盘不足，导致镜像拉取或容器重建失败。

## 8. 回滚入口

### 8.1 自动回滚

升级失败且满足条件时，脚本默认会自动回滚到升级前的 tag。

### 8.2 手动回滚到最近一次升级前版本

```bash
cd /opt/new-api
bash scripts/release/docker-image-upgrade.sh rollback
```

该命令会读取 `.upgrade-state/current.env` 中记录的 `PREVIOUS_TAG`。

### 8.3 手动回滚到指定版本

```bash
cd /opt/new-api
bash scripts/release/docker-image-upgrade.sh rollback --tag v1.0.0
```

### 8.4 回滚边界

当前阶段的回滚定义为“应用镜像版本回退”，不等价于数据库 schema 强制回退。需要明确：

- 版本发布前必须继续依赖现有升级兼容性验证基线。
- 若新版本包含不可逆数据迁移，必须在发布说明中显式声明。
- 没有通过升级兼容性验证的版本，不应进入此 SSH 升级链路。

## 9. 生产变更执行模板

建议一次标准变更按下面的固定顺序执行：

```bash
cd /opt/new-api

bash scripts/release/docker-image-upgrade.sh status

bash scripts/release/docker-image-upgrade.sh upgrade --tag v1.0.1

curl -fsS http://127.0.0.1:3000/api/status
docker compose ps
docker compose logs --tail=100 new-api
```

变更记录至少保留以下信息：

- 升级时间
- 执行人
- 升级前版本
- 目标版本
- 是否自动回滚
- 健康检查结果

## 10. 运维约束

- 阶段 2.1 只允许 Docker 镜像作为升级来源。
- 正式升级必须指定明确 tag，禁止在生产升级时使用漂移标签作为唯一依据。
- 基础发布能力仍以已发布镜像和既有验证基线为前提。
- 若服务器环境偏离本文档约定，应先收敛部署结构，再接入统一升级脚本。
