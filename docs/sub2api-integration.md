# Sub2API 账号池集成

本集成将 Sub2API 作为独立的内部上游服务，New API 继续负责用户、令牌、计费和公网 API，Sub2API 只负责上游账号、OAuth 凭证、冷却与调度。两者通过兼容 API 连接，不复制或链接 Sub2API 源码。

```text
用户 -> New API -> Sub2API -> Claude / Codex / Gemini 账号
```

## 前置条件

- Docker Compose v2。
- New API 已通过 Docker Compose 启动。
- 已阅读 Sub2API 的 LGPL-3.0-or-later 许可证、合规声明及各上游服务条款。

当前部署文件固定使用 Sub2API `0.1.160`，不使用会无提示升级的 `latest` 标签。

## 1. 准备配置

```bash
cp deploy/sub2api/.env.example deploy/sub2api/.env
chmod 600 deploy/sub2api/.env
```

编辑 `deploy/sub2api/.env`，替换所有 `replace_with_...` 占位值。随机密钥可以通过下列命令分别生成：

```bash
openssl rand -hex 32
```

`NEW_API_DOCKER_NETWORK` 必须是 New API 容器已加入的 Docker 网络。当使用 `deploy/compose.staging.yml` 时，默认值 `new-api-async-staging_backend` 无需修改。其他部署可通过下列命令查询：

```bash
docker network ls
```

## 2. 启动账号池

```bash
docker compose \
  --env-file deploy/sub2api/.env \
  -f deploy/sub2api/compose.yml \
  up -d
```

检查健康状态：

```bash
docker compose \
  --env-file deploy/sub2api/.env \
  -f deploy/sub2api/compose.yml \
  ps

curl --fail http://127.0.0.1:38080/health
```

Sub2API 管理端默认只监听 `127.0.0.1:38080`。远程服务器上请使用 SSH 端口转发，不要直接暴露到公网。

本地账号测试台默认位于 `http://127.0.0.1:38081`。它通过同源反向代理调用 Sub2API，支持密钥验证、模型列表以及 OpenAI/Gemini 协议的真实生成测试。输入的 API Key 仅保留在当前页面内存中。

## 3. 配置 Sub2API

1. 打开 `http://127.0.0.1:38080`，使用 `.env` 中的管理员账号登录。
2. 添加你有权使用的上游账号或正式 API Key。
3. 建立对应平台的分组，并将账号加入分组。
4. 为 New API 生成一个 Sub2API 下游 API Key。

Sub2API 会根据 API Key 绑定分组的平台选择调度逻辑。不要用一个分组混合不相容的平台。建议为 Codex、Claude 和 Gemini 分别生成 Key，并在 New API 中分别建立渠道。

## 4. 在 New API 中新建渠道

在管理后台的渠道页面新建渠道：

| 字段 | 值 |
| --- | --- |
| 类型 | `Advanced Custom` |
| API 地址 | `http://sub2api-account-pool:8080` |
| 密钥 | Sub2API 生成的下游 API Key |
| 路由模板 | `Sub2API Gateway` |
| 模型 | 仅填写该 Sub2API Key 所在分组实际可用的模型 |

打开“高级自定义路由”，选择 `Sub2API Gateway` 后点击“填充模板”。模板会配置以下原生转发路由：

- OpenAI Chat Completions、Responses、Responses Compact、Embeddings 和 Images。
- Anthropic Messages。
- Gemini `generateContent`、`embedContent` 和 `batchEmbedContents`。

路由模板统一使用 `Authorization: Bearer <key>`，Sub2API 的 OpenAI、Anthropic 和 Gemini 鉴权中间件均支持此格式。

## 5. 验证

先直接验证 Sub2API Key：

```bash
curl --fail \
  -H 'Authorization: Bearer REPLACE_WITH_SUB2API_KEY' \
  http://127.0.0.1:38080/v1/models
```

然后在 New API 后台对新渠道执行“测试”。测试成功后，再用 New API 令牌调用相同模型，确认流式输出、用量记录和扣费结果。

## 运维与安全

- Sub2API 使用 `simple` 模式，避免与 New API 重复执行用户余额计费；账号和分组限制仍由 Sub2API 调度层执行。
- Sub2API 拥有独立的 PostgreSQL、Redis 和数据卷，不与 New API 共用表或缓存键空间。
- 禁止在日志、工单或聊天中粘贴 OAuth Refresh Token、Cookie 或账号密码。
- 使用会员订阅进行 API 中转可能受到上游条款、转售限制和当地监管影响；技术集成不等于获得上游授权。

备份以下命名卷：`new-api-sub2api_sub2api_data`、`new-api-sub2api_sub2api_postgres_data` 和 `new-api-sub2api_sub2api_redis_data`。升级时先阅读 Sub2API 发布说明，再修改 `.env` 中的 `SUB2API_IMAGE`。
