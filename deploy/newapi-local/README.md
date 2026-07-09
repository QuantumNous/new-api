# `deploy/newapi-local` 使用说明

这个目录同时服务两类场景：

- 本地开发 / 本地联调
- `104.xx.xx.xx` 海外生产环境运维
- `120.xx.xx.xx` 国内生产环境运维

## 0. 环境约定

当前部署约定如下：

- `104` 为海外环境
- `120` 为国内环境
- `web/classic` 首页入口使用构建时参数 `VITE_HOME_ENTRY` 固定切换

当前推荐值：

- `104` 使用 `VITE_HOME_ENTRY=en`
- `120` 使用 `VITE_HOME_ENTRY=cn`

说明：

- 这里使用的是 Docker build 阶段的 `ARG VITE_HOME_ENTRY`
- 不建议把它当作容器运行时环境变量来切换，因为 `web/classic` 是 Vite 静态构建产物，运行时改环境变量不会重新生成前端代码

这个目录现在建议分两层使用：

- [deploy/newapi-local/README.md](./README.md)
  - 日常操作入口
  - 告诉你平时优先跑什么命令
- [deploy/newapi-local/104_SERVER_DEPLOYMENT.md](./104_SERVER_DEPLOYMENT.md)
  - 104 机器完整部署手册
  - 记录线上真实结构、风险点、验收和恢复方式

## 1. 推荐入口

如果你是在发 104，优先先看：

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

- 这个脚本现在只是“操作手册入口”，不会执行真实的 `docker`、`ssh`、`scp`、发布、回滚或状态查询
- 正确用法是先运行它查看对应 SOP，再手工执行命令
- 线上环境一定先以远端机器上的真实 compose、env、容器名和目录为准，不要把本地模板文件直接当生产真相

## 2. 日常推荐流程

### 2.1 最推荐的发布方式

```bash
./deploy/newapi-local/release.sh release
```

这个命令现在只会打印推荐发布检查清单。实际发布建议按下面顺序手工执行：

1. `build`
2. `verify-image`
3. `backup-env`
4. `upload`
5. `deploy`

### 2.2 只改了后端代码

```bash
./deploy/newapi-local/release.sh build
./deploy/newapi-local/release.sh upload
./deploy/newapi-local/release.sh deploy
```

### 2.3 改了前端页面或静态资源

```bash
./deploy/newapi-local/release.sh build
./deploy/newapi-local/release.sh verify-image
./deploy/newapi-local/release.sh upload
./deploy/newapi-local/release.sh deploy
```

### 2.4 发布前先备份线上环境变量

```bash
./deploy/newapi-local/release.sh backup-env
```

### 2.5 看线上当前状态

```bash
./deploy/newapi-local/release.sh status
```

### 2.6 回滚到远端已有旧镜像

```bash
./deploy/newapi-local/release.sh rollback
```

上面的命令都只输出说明，不会实际执行。

如果你要看 104 机器当前真实状态、当前线上容器名、以及当前最安全的发布方式，优先看：

- [deploy/newapi-local/104_SERVER_DEPLOYMENT.md](./104_SERVER_DEPLOYMENT.md)
- [deploy/newapi-local/120_SERVER_DEPLOYMENT.local.md](./120_SERVER_DEPLOYMENT.local.md)

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

本地几个 compose 文件目前职责如下：

- `docker-compose.yml`：本地 SQLite 开发环境
- `docker-compose.postgres.yml`：本地 PostgreSQL 开发环境
- `docker-compose.devtools.yml`：固定开发/测试工具容器
- `docker-compose.dev.mock.yml`：独立阿里视频 mock 容器

## 4.1 本地 devtools 测试容器

如果你希望固定一个带 `Go + Bun` 的开发/测试容器，避免每次临时 `docker run` 重复拉镜像、重复安装依赖，可以使用 `docker-compose.devtools.yml`。

启动：
```bash
docker compose -f deploy/newapi-local/docker-compose.devtools.yml up -d --build devtools
```

进入容器：
```bash
docker compose -f deploy/newapi-local/docker-compose.devtools.yml exec devtools bash
```

容器里已经预设：
- `GOPROXY=https://goproxy.cn,direct`
- `GOSUMDB=sum.golang.google.cn`
- `npm_config_registry=https://registry.npmmirror.com`
- `bun install` 使用 `https://registry.npmmirror.com`

同时会持久化这些缓存/依赖，避免重复下载：
- Go 模块缓存：`newapi_devtools_go_pkg`
- Go build 缓存：`newapi_devtools_go_build`
- Bun 安装缓存：`newapi_devtools_bun_cache`
- `web/default/node_modules`
- `web/classic/node_modules`

首次进入容器后，常用命令示例：
```bash
cd /workspace/web/classic
bun install
bun test src/pages/Setting/Ratio/modelPricingVideoSecondsPrice.test.js src/helpers/pricingTaskConditionPrice.test.js
bun run build

cd /workspace
go test ./relay/channel/task/ali ./relay/channel/task/taskcommon ./relay/helper ./relay ./setting/ratio_setting ./model
```

## 4.2 阿里视频本地 mock

本地开发提供一个独立的 `ali-video-mock` compose 文件，专门给 HappyHorse / Kling 做零成本联调。

启动：

```bash
docker compose -f docker-compose.dev.mock.yml up -d --build
```

健康检查：

```bash
curl http://localhost:18080/healthz
```

给 `new-api` 里的阿里渠道配置本地 mock 时，把渠道 `base_url` 改成：

```text
http://ali-video-mock:8080
```

如果你在宿主机直接调 mock，也可以使用：

```text
http://127.0.0.1:18080
```

当前 mock 只实现两个百炼异步接口：

- `POST /api/v1/services/aigc/video-generation/video-synthesis`
- `GET /api/v1/tasks/:id`

行为约定：

- 只支持 HappyHorse 和 Kling 模型
- 默认快速成功
- 第 1 次轮询返回 `RUNNING`
- 第 2 次轮询默认返回 `SUCCEEDED`
- 会返回 `usage.duration`、`usage.SR`、`usage.audio`，方便验证本地计费链路

可选失败率：

- 通过环境变量 `ALI_VIDEO_MOCK_FAIL_RATE` 控制轮询终态随机失败概率
- 取值范围 `0` 到 `1`
- `0` 表示全部成功
- `1` 表示全部失败
- 例如 `0.5` 表示大约一半任务会在第 2 次轮询时返回 `FAILED`

用于验证失败退款链路时，推荐：

```bash
ALI_VIDEO_MOCK_FAIL_RATE=0.5 docker compose -f docker-compose.dev.mock.yml up -d --build
```

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
