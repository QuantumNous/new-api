# `deploy/newapi-local` 使用说明

这个目录同时服务两类场景：

- 本地开发 / 本地联调
- `104.xx.xx.xx` 生产环境运维

这个目录现在建议分两层使用：

- [deploy/newapi-local/README.md](./README.md)
  - 日常操作入口
  - 告诉你平时优先跑什么命令
- [deploy/newapi-local/104_SERVER_DEPLOYMENT.md](./104_SERVER_DEPLOYMENT.md)
  - 104 机器完整部署手册
  - 记录线上真实结构、风险点、验收和恢复方式

## 1. 推荐入口

如果你是在发 104，优先使用：

```bash
./deploy/newapi-local/release.sh <command>
```

支持的命令：

- `build [image_tag]`
- `verify-image [image_tag]`
- `backup-env`
- `upload [image_tag]`
- `deploy [image_tag]`
- `deploy-existing <image_tag>`
- `release [image_tag]`
- `list-remote-images`
- `status`
- `rollback <image_tag>`

查看帮助：

```bash
./deploy/newapi-local/release.sh help
```

使用提醒：

- `REMOTE_HOST` 需要显式传入
- 其他环境变量不要直接按本地脚本默认值假定，先上机器核对当前实际部署目录、远端用户名、临时目录和校验方式，再决定是否覆盖
- 只有在远端用户名、部署目录、临时目录、备份目录或本地校验端口需要覆盖默认行为时，才需要额外设置

## 2. 日常推荐流程

### 2.1 最推荐的发布方式

```bash
REMOTE_HOST='104.xx.xx.xx' REMOTE_PASS='your-password' ./deploy/newapi-local/release.sh release
```

这个命令会按顺序执行：

1. `build`
2. `verify-image`
3. 停在确认步骤
4. 只有你输入 `yes`，才继续 `upload` 和 `deploy`

### 2.2 只改了后端代码

```bash
./deploy/newapi-local/release.sh build
REMOTE_HOST='104.xx.xx.xx' ./deploy/newapi-local/release.sh upload
REMOTE_HOST='104.xx.xx.xx' REMOTE_PASS='your-password' ./deploy/newapi-local/release.sh deploy
```

### 2.3 改了前端页面或静态资源

```bash
./deploy/newapi-local/release.sh build
./deploy/newapi-local/release.sh verify-image
REMOTE_HOST='104.xx.xx.xx' ./deploy/newapi-local/release.sh upload
REMOTE_HOST='104.xx.xx.xx' REMOTE_PASS='your-password' ./deploy/newapi-local/release.sh deploy
```

### 2.4 发布前先备份线上环境变量

```bash
REMOTE_HOST='104.xx.xx.xx' REMOTE_PASS='your-password' ./deploy/newapi-local/release.sh backup-env
```

### 2.5 看线上当前状态

```bash
REMOTE_HOST='104.xx.xx.xx' REMOTE_PASS='your-password' ./deploy/newapi-local/release.sh status
```

### 2.6 回滚到远端已有旧镜像

```bash
REMOTE_HOST='104.xx.xx.xx' REMOTE_PASS='your-password' ./deploy/newapi-local/release.sh rollback deploy-dev-c9c8b1e7
```

如果你要看 104 机器当前真实状态、当前线上容器名、以及当前最安全的发布方式，优先看：

- [deploy/newapi-local/104_SERVER_DEPLOYMENT.md](./104_SERVER_DEPLOYMENT.md)

## 3. 本地开发模式

这个目录可以在本地跑一套 `New API`，包含：

- `calciumion/new-api:latest`
- SQLite 持久化到 `./data`
- 日志目录 `./logs`
- HTTP 暴露到 `http://localhost:3000`
- 本地 metadata 服务暴露到 `http://localhost:8088`

启动：

```bash
docker compose up -d
```

停止：

```bash
docker compose down
```

首次访问时，打开 `http://localhost:3000`，完成初始化页面来创建管理员账号和密码。

## 4. 本地 PostgreSQL 模式

当你希望 `New API` 把主数据库存到 PostgreSQL，而不是 `./data/one-api.db` 时，使用 `docker-compose.postgres.yml`。

先创建本地 env 文件：

```bash
cp .env.postgres.example .env.postgres
```

然后编辑 `.env.postgres` 中的 `NEWAPI_POSTGRES_PASSWORD`，再启动：

```bash
docker compose --env-file .env.postgres -f docker-compose.postgres.yml up -d --build
```

停止：

```bash
docker compose --env-file .env.postgres -f docker-compose.postgres.yml down
```

这个模式使用：

```env
SQL_DSN=postgresql://<user>:<password>@postgres:5432/<db>?sslmode=disable
```

PostgreSQL 数据保存在 Docker volume `newapi_pg_data` 中。现有的 SQLite 文件 `./data/one-api.db` 不会自动迁移；切到 PostgreSQL 模式会创建一套新的数据库，除非你另行做数据迁移。

## 5. 本地 metadata

这个目录包含一份可维护的 NewAPI upstream metadata：

- `metadata/api/newapi/models.json`
- `metadata/api/newapi/vendors.json`

`new-api` 服务默认配置：

```yaml
SYNC_UPSTREAM_BASE: "http://metadata"
```

在这套 compose 里，NewAPI 会从下面地址同步：

```text
http://metadata/api/newapi/models.json
http://metadata/api/newapi/vendors.json
```

同时这些文件也可以通过本机对外暴露：

```text
http://<this-host>:8088/api/newapi/models.json
http://<this-host>:8088/api/newapi/vendors.json
```

如果另一套 `New API` 也要复用这一份 metadata，可以配置：

```env
SYNC_UPSTREAM_BASE=http://<this-host>:8088
```

## 6. 104 生产环境说明

104 线上环境不要直接套用上面的“本地开发”步骤。

当前 104 的标准入口已经统一为：

- 工作目录：`./deploy/newapi-local/`
- compose 文件：`./deploy/newapi-local/docker-compose.postgres.yml`
- env 文件：`./deploy/newapi-local/.env.postgres`

当前实机状态和本地 compose 使用方式有几个关键差异：

- 当前生产应用容器名是 `new-api`
- 当前生产网关容器名是 `new-api-gateway`
- 当前生产 Redis 已启用
- 当前生产 PostgreSQL 与 Redis 都保留现有容器，不在普通发版里重建
- 当前普通发布应只更新应用容器，不要顺手重建整套服务

已废弃、不要再用：

- `/root/new-api/deploy/newapi-local/docker-compose.yml`
- `/root/new-api/docker-compose.yml`
- `/root/sub2api/deploy/newapi-local/docker-compose.postgres.yml`

所以 104 上的更新、回滚、验收，应以 [deploy/newapi-local/104_SERVER_DEPLOYMENT.md](./104_SERVER_DEPLOYMENT.md) 为准，不要直接照搬本 README 的本地命令。
