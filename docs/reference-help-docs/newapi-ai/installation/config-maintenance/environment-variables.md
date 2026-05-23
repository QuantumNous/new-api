# 环境变量配置指南

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/installation/config-maintenance/environment-variables.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/installation/config-maintenance/environment-variables.mdx

## 页面大纲

  - 基本配置
  - 数据库配置
  - 缓存配置
  - 多节点与安全配置
  - 用户及令牌配置
  - 请求限制配置
  - 中继与代理配置
  - 渠道管理配置
    - 渠道上游模型同步
  - 模型和请求处理配置
  - 异步任务配置
  - 特定模型配置
  - 订阅缓存配置
  - 其他配置
  - 分析统计
  - 元数据同步
  - 前端配置
  - Pyroscope 持续性能分析
  - LinuxDo OAuth
  - 调试相关
  - 已废弃的环境变量
  - 多机部署示例
    - 主节点配置
- 数据库配置 - 使用远程数据库
- 安全配置
- Redis缓存配置
    - 从节点配置
- 数据库配置 - 使用相同的远程数据库
- 安全配置 - 与主节点使用相同的密钥
- Redis缓存配置 - 与主节点使用相同的Redis
- 节点类型设置
- 可选：前端基础URL
- FRONTEND_BASE_URL=https://
- 可选：同步频率
  - Docker Compose中的环境变量示例

## 原文内容

---
title: 环境变量配置指南
---
本文档提供了New API支持的所有环境变量及其配置说明。您可以通过设置这些环境变量来自定义系统的行为。

<Callout type="info" title="提示">
  New API 支持从 `.env` 文件中读取环境变量，请参照 `.env.example`
  文件，使用时请将其重命名为 `.env`。
</Callout>

## 基本配置

| 环境变量 | 说明         | 默认值          | 示例                  |
| -------- | ------------ | --------------- | --------------------- |
| `PORT`   | 服务监听端口 | `3000`          | `PORT=8080`           |
| `TZ`     | 时区设置     | -               | `TZ=America/New_York` |
| `VERSION`| 覆盖运行版本号 | -              | `VERSION=1.2.3`       |

## 数据库配置

| 环境变量                | 说明                       | 默认值                   | 示例                                                                                                                             |
| ----------------------- | -------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `SQL_DSN`               | 数据库连接字符串           | SQLite (`one-api.db`) | MySQL: `SQL_DSN=root:123456@tcp(localhost:3306)/new-api` \| PostgreSQL: `SQL_DSN=postgresql://root:123456@postgres:5432/new-api` |
| `SQL_MAX_IDLE_CONNS`    | 空闲连接池最大连接数       | `100`                    | `SQL_MAX_IDLE_CONNS=50`                                                                                                          |
| `SQL_MAX_OPEN_CONNS`    | 连接池最大打开连接数       | `1000`                   | `SQL_MAX_OPEN_CONNS=500`                                                                                                         |
| `SQL_MAX_LIFETIME`      | 连接最大生命周期(秒)       | `60`                     | `SQL_MAX_LIFETIME=120`                                                                                                          |
| `LOG_SQL_DSN`           | 日志表独立数据库连接字符串 | -                        | `LOG_SQL_DSN=root:123456@tcp(localhost:3306)/oneapi_logs`                                                                        |
| `SQLITE_PATH`           | SQLite数据库路径           | `one-api.db`             | `SQLITE_PATH=/var/lib/new-api/new-api.db`                                                                                        |

## 缓存配置

| 环境变量                | 说明                     | 默认值  | 示例                                                       |
| ----------------------- | ------------------------ | ------- | ---------------------------------------------------------- |
| `REDIS_CONN_STRING`     | Redis连接字符串          | -       | `REDIS_CONN_STRING=redis://default:redispw@localhost:6379` |
| `REDIS_POOL_SIZE`       | Redis连接池大小          | `10`    | `REDIS_POOL_SIZE=20`                                      |
| `MEMORY_CACHE_ENABLED`  | 是否启用内存缓存（启用Redis后自动启用） | `false` | `MEMORY_CACHE_ENABLED=true`                                |
| `SYNC_FREQUENCY`        | 缓存与数据库同步频率(秒) | `60`    | `SYNC_FREQUENCY=120`                                       |
| `BATCH_UPDATE_ENABLED`  | 启用数据库批量更新聚合   | `false` | `BATCH_UPDATE_ENABLED=true`                                |
| `BATCH_UPDATE_INTERVAL` | 批量更新聚合时间间隔(秒) | `5`     | `BATCH_UPDATE_INTERVAL=10`                                 |

## 多节点与安全配置

| 环境变量                    | 说明                         | 默认值   | 示例                                        |
| --------------------------- | ---------------------------- | -------- | ------------------------------------------- |
| `SESSION_SECRET`            | 会话密钥(多机部署必须)       | -        | `SESSION_SECRET=your_session_secret`        |
| `CRYPTO_SECRET`             | 加密密钥(加密数据库内容，默认回退到SESSION_SECRET) | -        | `CRYPTO_SECRET=your_crypto_secret`          |
| `FRONTEND_BASE_URL`         | 前端基础URL（从节点使用，将未匹配路由重定向到此地址） | -        | `FRONTEND_BASE_URL=https://<your-newapi-domain>` |
| `NODE_TYPE`                 | 节点类型                     | `master` | `NODE_TYPE=slave`                           |
| `TLS_INSECURE_SKIP_VERIFY`  | 全局跳过TLS证书验证         | `false`  | `TLS_INSECURE_SKIP_VERIFY=true`             |
| `TRUSTED_REDIRECT_DOMAINS`  | 受信任的重定向域名列表(逗号分隔) | -    | `TRUSTED_REDIRECT_DOMAINS=example.com,api.example.com` |

<Callout type="warn" title="SESSION_SECRET 注意事项">
  `SESSION_SECRET` 不可设置为 `random_string`，否则程序将拒绝启动。多机部署时所有节点必须使用相同的密钥。
</Callout>

<Callout type="info" title="集群部署">
  关于如何使用这些环境变量构建完整的集群部署，请参考[集群部署指南](/zh/docs/installation/deployment-methods/cluster-deployment)。
</Callout>

## 用户及令牌配置

| 环境变量                             | 说明                         | 默认值  | 示例                                    |
| ------------------------------------ | ---------------------------- | ------- | --------------------------------------- |
| `GENERATE_DEFAULT_TOKEN`             | 为新注册用户生成初始令牌     | `false` | `GENERATE_DEFAULT_TOKEN=true`           |
| `NOTIFICATION_LIMIT_DURATION_MINUTE` | 通知限制的持续时间(分钟)     | `10`    | `NOTIFICATION_LIMIT_DURATION_MINUTE=15` |
| `NOTIFY_LIMIT_COUNT`                 | 指定持续时间内的最大通知数量 | `2`     | `NOTIFY_LIMIT_COUNT=3`                  |

## 请求限制配置

| 环境变量                         | 说明                           | 默认值 | 示例                                     |
| -------------------------------- | ------------------------------ | ------ | ---------------------------------------- |
| `GLOBAL_API_RATE_LIMIT_ENABLE`   | 全局API速率限制开关            | `true` | `GLOBAL_API_RATE_LIMIT_ENABLE=false`     |
| `GLOBAL_API_RATE_LIMIT`          | 全局API速率限制(单IP)          | `180`  | `GLOBAL_API_RATE_LIMIT=100`              |
| `GLOBAL_API_RATE_LIMIT_DURATION` | 全局API速率限制窗口(秒)        | `180`  | `GLOBAL_API_RATE_LIMIT_DURATION=120`     |
| `GLOBAL_WEB_RATE_LIMIT_ENABLE`   | 全局Web速率限制开关            | `true` | `GLOBAL_WEB_RATE_LIMIT_ENABLE=false`     |
| `GLOBAL_WEB_RATE_LIMIT`          | 全局Web速率限制(单IP)          | `60`   | `GLOBAL_WEB_RATE_LIMIT=30`               |
| `GLOBAL_WEB_RATE_LIMIT_DURATION` | 全局Web速率限制窗口(秒)        | `180`  | `GLOBAL_WEB_RATE_LIMIT_DURATION=120`     |
| `CRITICAL_RATE_LIMIT_ENABLE`     | 关键操作速率限制开关           | `true` | `CRITICAL_RATE_LIMIT_ENABLE=false`       |
| `CRITICAL_RATE_LIMIT`            | 关键操作速率限制次数           | `20`   | `CRITICAL_RATE_LIMIT=10`                 |
| `CRITICAL_RATE_LIMIT_DURATION`   | 关键操作速率限制窗口(秒)       | `1200` | `CRITICAL_RATE_LIMIT_DURATION=600`       |

## 中继与代理配置

| 环境变量                       | 说明                                        | 默认值 | 示例                             |
| ------------------------------ | ------------------------------------------- | ------ | -------------------------------- |
| `RELAY_TIMEOUT`                | 中继请求超时时间(秒)，0为不限               | `0`    | `RELAY_TIMEOUT=60`               |
| `STREAMING_TIMEOUT`            | 流式一次回复的超时时间(秒)                  | `300`  | `STREAMING_TIMEOUT=120`          |
| `RELAY_MAX_IDLE_CONNS`         | 中继HTTP客户端池最大空闲连接数              | `500`  | `RELAY_MAX_IDLE_CONNS=1000`      |
| `RELAY_MAX_IDLE_CONNS_PER_HOST`| 中继HTTP客户端池每主机最大空闲连接数        | `100`  | `RELAY_MAX_IDLE_CONNS_PER_HOST=200` |
| `MAX_FILE_DOWNLOAD_MB`         | 最大文件下载大小(MB)                        | `64`   | `MAX_FILE_DOWNLOAD_MB=128`       |
| `MAX_REQUEST_BODY_MB`          | 最大请求体大小(MB，解压后计；防止zip bomb/OOM) | `128`  | `MAX_REQUEST_BODY_MB=256`        |
| `STREAM_SCANNER_MAX_BUFFER_MB` | SSE流扫描缓冲区最大大小(MB)                 | `64`   | `STREAM_SCANNER_MAX_BUFFER_MB=128` |

<Callout type="warn" title="RELAY_TIMEOUT 设置警告">
  设置 `RELAY_TIMEOUT` 环境变量时请谨慎，如果设置过短可能导致以下问题：
</Callout>

    - 上游API已经完成请求并计费，但本地因超时而未完成计费

    - 造成计费不同步，可能导致系统亏损

    - 建议不设置，除非您知道自己在做什么

## 渠道管理配置

| 环境变量                        | 说明                       | 默认值                             | 示例                                |
| ------------------------------- | -------------------------- | ---------------------------------- | ----------------------------------- |
| `CHANNEL_UPDATE_FREQUENCY`      | 定期更新渠道余额(分钟)     | -（不设置则禁用）                  | `CHANNEL_UPDATE_FREQUENCY=1440`     |
| `CHANNEL_TEST_FREQUENCY`        | 定期检查渠道(分钟)，覆盖数据库设置 | -（不设置则使用数据库设置）  | `CHANNEL_TEST_FREQUENCY=1440`       |
| `POLLING_INTERVAL`              | 请求轮询间隔(秒)           | `0`                                | `POLLING_INTERVAL=5`                |

### 渠道上游模型同步

| 环境变量                                              | 说明                           | 默认值 | 示例 |
| ----------------------------------------------------- | ------------------------------ | ------ | ---- |
| `CHANNEL_UPSTREAM_MODEL_UPDATE_TASK_ENABLED`          | 启用定期同步上游供应商模型列表 | `true` | `CHANNEL_UPSTREAM_MODEL_UPDATE_TASK_ENABLED=false` |
| `CHANNEL_UPSTREAM_MODEL_UPDATE_TASK_INTERVAL_MINUTES` | 模型列表同步间隔(分钟)        | `30`   | `CHANNEL_UPSTREAM_MODEL_UPDATE_TASK_INTERVAL_MINUTES=60` |
| `CHANNEL_UPSTREAM_MODEL_UPDATE_MIN_CHECK_INTERVAL_SECONDS` | 单渠道最小检查间隔(秒)   | `300`  | `CHANNEL_UPSTREAM_MODEL_UPDATE_MIN_CHECK_INTERVAL_SECONDS=600` |

## 模型和请求处理配置

| 环境变量                     | 说明                                                 | 默认值  | 示例                                 |
| ---------------------------- | ---------------------------------------------------- | ------- | ------------------------------------ |
| `FORCE_STREAM_OPTION`        | 覆盖客户端stream_options参数，强制获取流式用量信息   | `true`  | `FORCE_STREAM_OPTION=false`          |
| `CountToken`                 | 是否启用本地token计数                                | `true`  | `CountToken=false`                   |
| `GET_MEDIA_TOKEN`            | 流式模式下是否统计图片/音频token                     | `true`  | `GET_MEDIA_TOKEN=false`              |
| `GET_MEDIA_TOKEN_NOT_STREAM` | 非流模式下是否统计图片/音频token                     | `false` | `GET_MEDIA_TOKEN_NOT_STREAM=true`    |

## 异步任务配置

| 环境变量               | 说明                                                        | 默认值  | 示例                               |
| ---------------------- | ----------------------------------------------------------- | ------- | ---------------------------------- |
| `UPDATE_TASK`          | 是否启用异步任务轮询更新(MJ、Suno等)                       | `true`  | `UPDATE_TASK=false`                |
| `TASK_QUERY_LIMIT`     | 每次轮询查询的最大任务数                                    | `1000`  | `TASK_QUERY_LIMIT=500`             |
| `TASK_TIMEOUT_MINUTES` | 异步任务超时(分钟)，超时后标记失败并退款，0为禁用           | `1440`  | `TASK_TIMEOUT_MINUTES=720`         |
| `TASK_PRICE_PATCH`     | 任务价格补丁，设置的模型仅按次计费，模型名用英文逗号隔开    | -       | `TASK_PRICE_PATCH=sora-2,sora-2-pro` |

## 特定模型配置

| 环境变量                      | 说明                         | 默认值               | 示例                                   |
| ----------------------------- | ---------------------------- | -------------------- | -------------------------------------- |
| `AZURE_DEFAULT_API_VERSION`   | Azure渠道默认API版本         | `2025-04-01-preview` | `AZURE_DEFAULT_API_VERSION=2023-05-15` |
| `COHERE_SAFETY_SETTING`       | Cohere模型安全设置           | `NONE`               | `COHERE_SAFETY_SETTING=CONTEXTUAL`     |
| `DIFY_DEBUG`                  | Dify渠道输出工作流和节点信息 | `true`               | `DIFY_DEBUG=false`                     |

## 订阅缓存配置

| 环境变量                          | 说明                       | 默认值  | 示例 |
| --------------------------------- | -------------------------- | ------- | ---- |
| `SUBSCRIPTION_PLAN_CACHE_TTL`     | 订阅计划缓存TTL(秒)       | `300`   | `SUBSCRIPTION_PLAN_CACHE_TTL=600`      |
| `SUBSCRIPTION_PLAN_INFO_CACHE_TTL`| 订阅计划详情缓存TTL(秒)   | `120`   | `SUBSCRIPTION_PLAN_INFO_CACHE_TTL=300` |
| `SUBSCRIPTION_PLAN_CACHE_CAP`     | 订阅计划缓存最大容量       | `5000`  | `SUBSCRIPTION_PLAN_CACHE_CAP=10000`    |
| `SUBSCRIPTION_PLAN_INFO_CACHE_CAP`| 订阅计划详情缓存最大容量   | `10000` | `SUBSCRIPTION_PLAN_INFO_CACHE_CAP=20000` |

## 其他配置

| 环境变量            | 说明                         | 默认值 | 示例                               |
| ------------------- | ---------------------------- | ------ | ---------------------------------- |
| `ERROR_LOG_ENABLED` | 是否记录并在前端显示错误日志 | `false` | `ERROR_LOG_ENABLED=true`           |

## 分析统计

| 环境变量 | 说明 | 默认值 | 示例 |
|---------|------|-------|------|
| `UMAMI_WEBSITE_ID` | Umami站点ID | - | `UMAMI_WEBSITE_ID=xxxx-xxxx` |
| `UMAMI_SCRIPT_URL` | Umami脚本地址 | `https://analytics.umami.is/script.js` | `UMAMI_SCRIPT_URL=https://umami.example.com/script.js` |
| `GOOGLE_ANALYTICS_ID` | Google Analytics 4站点ID | - | `GOOGLE_ANALYTICS_ID=G-XXXXXXX` |

## 元数据同步

| 环境变量 | 说明 | 默认值 | 示例 |
|---------|------|-------|------|
| `SYNC_UPSTREAM_BASE` | 模型/厂商元数据上游地址 | `https://basellm.github.io/llm-metadata` | `SYNC_UPSTREAM_BASE=https://mirror.example.com/llm-metadata` |
| `SYNC_HTTP_TIMEOUT_SECONDS` | 同步HTTP超时(秒) | `10` | `SYNC_HTTP_TIMEOUT_SECONDS=15` |
| `SYNC_HTTP_RETRY` | 同步重试次数 | `3` | `SYNC_HTTP_RETRY=5` |
| `SYNC_HTTP_MAX_MB` | 响应体最大大小(MB) | `10` | `SYNC_HTTP_MAX_MB=20` |

## 前端配置

| 环境变量 | 说明 | 默认值 | 示例 |
|---------|------|-------|------|
| `VITE_REACT_APP_SERVER_URL` | 前端请求后端的基础地址（编译时生效） | - | `VITE_REACT_APP_SERVER_URL=https://api.example.com` |

<Callout type="info" title="编译时变量">
  `VITE_REACT_APP_SERVER_URL` 是 Vite 编译时注入的前端变量，仅在构建前端时生效，运行时无法修改。
</Callout>

## Pyroscope 持续性能分析

| 环境变量 | 说明 | 默认值 | 示例 |
|---------|------|-------|------|
| `PYROSCOPE_URL` | Pyroscope服务器地址，留空禁用 | - | `PYROSCOPE_URL=http://pyroscope:4040` |
| `PYROSCOPE_APP_NAME` | 上报的应用名称 | `new-api` | `PYROSCOPE_APP_NAME=my-api` |
| `PYROSCOPE_BASIC_AUTH_USER` | Pyroscope Basic Auth用户名 | - | `PYROSCOPE_BASIC_AUTH_USER=admin` |
| `PYROSCOPE_BASIC_AUTH_PASSWORD` | Pyroscope Basic Auth密码 | - | `PYROSCOPE_BASIC_AUTH_PASSWORD=secret` |
| `HOSTNAME` | 上报的主机名标签 | `new-api` | `HOSTNAME=node-1` |
| `PYROSCOPE_MUTEX_RATE` | 互斥锁分析采样率 | `5` | `PYROSCOPE_MUTEX_RATE=10` |
| `PYROSCOPE_BLOCK_RATE` | 阻塞分析采样率 | `5` | `PYROSCOPE_BLOCK_RATE=10` |

## LinuxDo OAuth

正常情况下无需修改。

| 环境变量 | 说明 | 默认值 | 示例 |
|---------|------|-------|------|
| `LINUX_DO_TOKEN_ENDPOINT` | LinuxDo 令牌端点 | `https://connect.linux.do/oauth2/token` | `LINUX_DO_TOKEN_ENDPOINT=https://connect.linux.do/oauth2/token` |
| `LINUX_DO_USER_ENDPOINT` | LinuxDo 用户端点 | `https://connect.linux.do/api/user` | `LINUX_DO_USER_ENDPOINT=https://connect.linux.do/api/user` |

## 调试相关

| 环境变量 | 说明 | 默认值 | 示例 |
|---------|------|-------|------|
| `DEBUG` | 启用调试模式（包括GORM调试输出） | `false` | `DEBUG=true` |
| `GIN_MODE` | Gin运行模式 | `release` | `GIN_MODE=debug` |
| `ENABLE_PPROF` | 启用pprof性能分析（端口8005） | `false` | `ENABLE_PPROF=true` |

## 已废弃的环境变量

以下环境变量已被废弃，请使用系统设置界面中的相应选项：

| 环境变量                  | 替代方式                        |
| ------------------------- | ------------------------------- |
| `GEMINI_MODEL_MAP`        | 请在系统设置-模型相关设置中设置 |
| `GEMINI_SAFETY_SETTING`   | 请在系统设置-模型相关设置中设置 |
| `GEMINI_VISION_MAX_IMAGE_NUM` | 请在系统设置-模型相关设置中设置 |

## 多机部署示例

在多机部署场景中，必须设置以下环境变量：

### 主节点配置

```bash
# 数据库配置 - 使用远程数据库
SQL_DSN=root:password@tcp(db-server:3306)/oneapi

# 安全配置
SESSION_SECRET=your_unique_session_secret
CRYPTO_SECRET=your_unique_crypto_secret

# Redis缓存配置
REDIS_CONN_STRING=redis://default:password@redis-server:6379
```

### 从节点配置

```bash
# 数据库配置 - 使用相同的远程数据库
SQL_DSN=root:password@tcp(db-server:3306)/oneapi

# 安全配置 - 与主节点使用相同的密钥
SESSION_SECRET=your_unique_session_secret
CRYPTO_SECRET=your_unique_crypto_secret

# Redis缓存配置 - 与主节点使用相同的Redis
REDIS_CONN_STRING=redis://default:password@redis-server:6379

# 节点类型设置
NODE_TYPE=slave

# 可选：前端基础URL
# FRONTEND_BASE_URL=https://<your-newapi-domain>

# 可选：同步频率
SYNC_FREQUENCY=60
```

<Callout type="info" title="完整集群配置">
  这只是基本的多节点配置示例。完整的集群部署配置、架构说明和最佳实践，请参考[集群部署指南](/zh/docs/installation/deployment-methods/cluster-deployment)。
</Callout>

## Docker Compose中的环境变量示例

下面是一个在Docker Compose配置文件中设置环境变量的简要示例:

```yaml
services:
  new-api:
    image: calciumion/new-api:latest
    environment:
      - TZ=Asia/Shanghai
      - SQL_DSN=root:123456@tcp(mysql:3306)/oneapi
      - REDIS_CONN_STRING=redis://default:redispw@redis:6379
      - SESSION_SECRET=your_unique_session_secret
      - CRYPTO_SECRET=your_unique_crypto_secret
      - MEMORY_CACHE_ENABLED=true
      - GENERATE_DEFAULT_TOKEN=true
      - STREAMING_TIMEOUT=120
      - CHANNEL_UPDATE_FREQUENCY=1440
```

有关完整的Docker Compose配置，包括更多环境变量设置选项，请参考[Docker Compose配置说明](/zh/docs/installation/config-maintenance/docker-compose-yml)文档。
