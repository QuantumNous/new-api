# `deploy/newapi-local` 使用说明

这个目录同时服务两类场景：

- 本地开发 / 本地联调
- `104.225.153.184` 生产环境运维

如果你要看 104 机器当前真实状态、当前线上容器名、以及当前最安全的发布方式，优先看：

- [104_SERVER_DEPLOYMENT.md](/mnt/c/Users/shaoq/go/src/new-api/deploy/newapi-local/104_SERVER_DEPLOYMENT.md)

## 1. 本地开发模式

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

## 2. 本地 PostgreSQL 模式

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

## 3. 本地 metadata

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

## 4. 104 生产环境说明

104 线上环境不要直接套用上面的“本地开发”步骤。

当前实机状态和本地 compose 使用方式有几个关键差异：

- 当前生产应用容器名是 `new-api`
- 当前生产网关容器名是 `new-api-gateway`
- 当前生产 Redis 已启用
- 当前生产 PostgreSQL 仍处于历史混合接管状态
- 当前普通发布应只更新应用容器，不要顺手重建整套服务

所以 104 上的更新、回滚、验收，应以 [104_SERVER_DEPLOYMENT.md](/mnt/c/Users/shaoq/go/src/new-api/deploy/newapi-local/104_SERVER_DEPLOYMENT.md) 为准，不要直接照搬本 README 的本地命令。
