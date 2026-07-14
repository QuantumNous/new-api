# NEWAPI Deployment Example

本文提供一个独立的 `new-api` Docker Compose 部署示例，包含：

- `new-api`
- `PostgreSQL`
- `Redis`
- PostgreSQL 对宿主机开放端口，便于 `newapi-monitor-service` 从宿主机单独连接

## 目录结构示例

```text
deploy/
  docker-compose.yml
  data/
  logs/
  pg_data/
```

## Docker Compose 示例

```yaml
version: '3.4'

services:
  newapi:
    image: calciumion/new-api:latest
    container_name: newapi
    restart: always
    command: --log-dir /app/logs
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
      - ./logs:/app/logs
    environment:
      - SQL_DSN=postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@postgres:5432/new-api
      - REDIS_CONN_STRING=redis://redis
      - TZ=Asia/Shanghai
      - ERROR_LOG_ENABLED=true
      - BATCH_UPDATE_ENABLED=true
    depends_on:
      - redis
      - postgres
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O - http://localhost:3000/api/status | grep -o '\"success\":\\s*true' || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:latest
    container_name: redis-newapi
    restart: always

  postgres:
    image: postgres:15
    container_name: postgres-newapi
    restart: always
    ports:
      - "15432:5432"
    environment:
      POSTGRES_USER: YOUR_DB_USER
      POSTGRES_PASSWORD: YOUR_DB_PASSWORD
      POSTGRES_DB: new-api
    volumes:
      - ./pg_data:/var/lib/postgresql/data
```

说明：

- `./pg_data:/var/lib/postgresql/data`：将 PostgreSQL 容器内的数据目录映射到宿主机本地目录，用于数据持久化；即使容器重建，只要 `pg_data` 目录还在，数据库数据通常不会丢失

## 端口说明

- `3000:3000`：将 `new-api` Web 服务暴露到宿主机 `3000` 端口
- `15432:5432`：将 PostgreSQL 暴露到宿主机 `15432` 端口，供监控服务或其他外部程序连接

## 连接说明

### `new-api` 容器内部连接 PostgreSQL

在 Compose 网络内部，`new-api` 连接数据库时使用服务名 `postgres`：

```text
postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@postgres:5432/new-api
```

### `newapi-monitor-service` 部署在宿主机上

如果 `newapi-monitor-service` 跑在宿主机上，而不是跑在同一个 Compose 网络里，建议在 `.env` 中这样写：

```env
NEWAPI_DB_HOST=127.0.0.1
NEWAPI_DB_PORT=15432
NEWAPI_DB_USER=YOUR_DB_USER
NEWAPI_DB_PASSWORD=YOUR_DB_PASSWORD
NEWAPI_DB_NAME=new-api
NEWAPI_DB_SSL=false
```

### `newapi-monitor-service` 也在同一个 Compose 网络里

如果监控服务也部署在同一个 Compose 网络中，则可以直接使用容器内地址：

```env
NEWAPI_DB_HOST=postgres
NEWAPI_DB_PORT=5432
NEWAPI_DB_USER=YOUR_DB_USER
NEWAPI_DB_PASSWORD=YOUR_DB_PASSWORD
NEWAPI_DB_NAME=new-api
NEWAPI_DB_SSL=false
```

## 启动命令

```bash
docker compose up -d
```

## 检查状态

```bash
docker compose ps
docker compose logs -f newapi
docker compose logs -f postgres
```

## 安全建议

- 不要把真实数据库账号密码写进公开文档或仓库
- 生产环境建议使用更强密码
- 如果 PostgreSQL 只给宿主机本地使用，建议配合防火墙限制访问来源
- 如无必要，不要把数据库端口直接暴露到公网
