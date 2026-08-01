# 付费优化 API 线路分组限制实现方案

## 背景

New API 的 Dashboard 可以展示多个 API 地址。新增一台网络优化机器作为独立 API 入口，为所有外部模型 API 提供更好的网络线路，但不允许零倍率免费流量占用该机器。

站点当前通过令牌分组区分免费和付费流量：

- 分组倍率为 `0`：免费流量；
- 分组倍率大于 `0`：需要正常扣减额度的付费流量；
- 用户账号组目前通常为 `default`，创建令牌时选择的分组决定渠道路由和计费倍率。

因此，本功能不以用户账号组或购买记录判断权限，而是以当前令牌的实际计费分组倍率判断该请求能否使用优化线路。

## 目标

1. 只有实际计费分组倍率大于 `0` 的令牌可以调用付费优化线路。
2. 倍率为 `0` 的免费分组令牌在优化线路上返回 `403`。
3. 覆盖 OpenAI、Responses、Anthropic、Gemini、图片、音频、视频、Midjourney、Suno、Kling 和即梦等现有外部 API。
4. 普通 API 地址、现有渠道路由、计费、限流和管理后台保持不变。
5. 不增加数据库字段、第二套分组配置或额外的数据库查询。

## 非目标

- 不判断用户是否充值过或购买过订阅；
- 不修改用户账号组；
- 不改变令牌分组的现有创建和可用范围规则；
- 不开放优化域名下的 Dashboard 页面和 `/api/*` 管理接口；
- 不通过隐藏优化域名代替服务端权限校验。

## 识别方式

优化反代统一覆盖写入请求头：

```http
X-NewAPI-Route: paid-optimized
```

该请求头只是“启用更严格限制”的线路标记，不是授权凭证。客户端伪造该请求头只能让自己的请求受到额外限制，不能获得额外权限。正式优化反代必须覆盖客户端传入的同名请求头，不能按客户端原值透传。

New API 的 `TokenAuth()` 已经完成以下工作：

1. 验证 API Key；
2. 从令牌记录读取令牌分组；
3. 校验该用户是否有权使用所选令牌分组；
4. 将原始令牌分组写入 `ContextKeyTokenGroup`；
5. 将实际使用分组写入 `ContextKeyUsingGroup`；
6. 将用户账号组写入 `ContextKeyUserGroup`。

鉴权完成后调用 `service.GetUserGroupRatio(userGroup, usingGroup)` 获取与现有计费逻辑一致的实际分组倍率。该函数同时兼容用户组对计费分组的特殊倍率覆盖。检查集中在 `TokenAuth()` 中，因此当前和后续所有使用 API Key 鉴权的接口都会自动受到保护，不需要为每个协议重复挂载中间件。

## 请求流程

```text
客户端
  -> 付费优化反代（覆盖写入 X-NewAPI-Route）
  -> New API TokenAuth / TokenOrUserAuth
       -> 验证 API Key 或 Dashboard 会话
       -> 非优化线路：直接继续
       -> auto 令牌：只保留实际倍率 > 0 的候选组
       -> auto 没有付费候选组：403
       -> 实际分组倍率 <= 0：403
       -> 实际分组倍率 > 0：继续
  -> ModelRequestRateLimit / Distribute
  -> 上游服务
```

检查发生在现有令牌、用户和分组验证之后，并早于模型限流、渠道选择和上游连接。免费请求不会进入模型解析和渠道选择。

`/mj/image/:id` 在普通入口原本允许公开读取。为了不改变普通入口行为，该接口只在检测到付费优化线路标记时额外要求 API Key，然后复用相同的分组倍率检查。

## 覆盖接口

所有经过 `TokenAuth()` 的外部 API 都受限制，包括以下路由前缀及其 GET、POST、DELETE、WebSocket 和 SSE 请求：

- `/v1/*`：OpenAI Chat Completions、Responses、Anthropic Messages、Realtime、模型、图片、音频、嵌入、重排和视频；
- `/v1beta/*`：Gemini 和 Gemini OpenAI 兼容接口；
- `/kling/v1/*`：Kling 视频任务；
- `/jimeng/*`：即梦任务；
- `/mj/*`、`/:mode/mj/*`：Midjourney 任务和结果；
- `/suno/*`：Suno 任务和结果。

Dashboard 的 `/api/*`、网页、登录、用户、渠道和管理员接口不属于外部模型 API，应由优化反代直接返回 `404`，不得代理到源站。`/pg/*` 是 Dashboard 游乐场接口，也不应在优化域名开放。

## 判定规则

| 场景 | 结果 |
| --- | --- |
| 普通 API 地址，任意令牌分组 | 保持原有行为 |
| 优化地址，分组倍率为 `0` | `403 access_denied` |
| 优化地址，分组倍率大于 `0` | 放行并按原逻辑计费 |
| 优化地址，令牌未指定分组 | 回退到现有实际使用分组并检查其倍率 |
| 优化地址，视频内容使用 Dashboard 会话 | 回退到用户账号组倍率 |
| 优化地址，用户特殊倍率为 `0` | `403 access_denied` |
| 优化地址，`auto` 令牌存在付费候选组 | 过滤免费组后继续选择和重试 |
| 优化地址，`auto` 令牌没有付费候选组 | `403 access_denied` |

免费账号如果创建了非零倍率分组的令牌，该令牌可以进入优化线路，但请求仍会按对应倍率扣减现有额度；额度不足时继续由 New API 原有额度检查拒绝。这项功能限制的是零倍率免费流量，不是用户的历史付费身份。

## `auto` 分组处理

`auto` 是令牌的一种分组选择方式，不是另一种 Key。管理员在系统设置中维护 Auto 分组顺序；令牌选择 `auto` 后，请求会按顺序查找用户有权使用、支持当前模型且存在可用渠道的分组。启用跨组重试后，当前分组的渠道失败时还可以继续尝试后面的分组，最终按实际选中的分组倍率计费。

优化线路完整支持同一个 `auto` Key，但使用请求级候选组过滤：

1. 普通入口继续使用完整 Auto 候选组列表，原有行为不变；
2. 优化入口根据用户组特殊倍率和分组倍率，删除实际倍率小于等于 `0` 的候选组；
3. 初次渠道选择、渠道亲和复用、跨组重试和模型列表共用过滤后的列表；
4. 即使全局 Auto 顺序中免费组排在前面，优化入口也会跳过它，只选择付费组；
5. 如果用户没有任何可用的付费 Auto 候选组，返回 `403 access_denied`。

该方案不是只检查第一次选中的分组，因此跨组重试不会重新进入免费组。普通入口仍可按完整 Auto 顺序使用免费组。

## OpenResty 反代配置

优化域名只允许模型 API 路径，不代理主站和 Dashboard：

```nginx
# 明确禁止 Dashboard 后端和旧版 Dashboard API。必须放在模型 API 正则之前。
location = /api { return 404; }
location ^~ /api/ { return 404; }
location = /pg { return 404; }
location ^~ /pg/ { return 404; }
location = /dashboard { return 404; }
location ^~ /dashboard/ { return 404; }

location ~ ^/(?:v1(?:/|$)|v1beta(?:/|$)|kling/v1(?:/|$)|mj(?:/|$)|suno(?:/|$)|jimeng(?:/|$)|[^/]+/mj(?:/|$)) {
    proxy_pass http://new-api:3000;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-NewAPI-Route "paid-optimized";

    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $http_connection;

    proxy_buffering off;
    proxy_request_buffering off;
    proxy_cache off;
    proxy_connect_timeout 30s;
    proxy_send_timeout 3600s;
    proxy_read_timeout 3600s;
}

location / {
    default_type application/json;
    return 404 '{"error":{"message":"API endpoint only","type":"not_found"}}';
}
```

部署时将 `proxy_pass` 替换为实际 New API 源站。必须删除原来的 `location ^~ /` 全站代理，否则主站仍会暴露，且 `^~` 可能使 API 白名单正则不生效。显式拒绝规则不能省略：动态 Midjourney 路由 `/:mode/mj/*` 的第一段理论上可以匹配 `api`、`pg` 或 `dashboard`，前置的 `^~` 拒绝规则可以确保这些 Dashboard 路径不会被正则重新放行。优化入口必须始终经过该反代配置；如果同一优化域名还有其他代理层，需要确认自定义请求头最终能到达 New API。

## 安全边界

- 分组来自服务端验证后的令牌记录，不读取客户端自报的分组字段；
- 倍率来自 New API 当前内存配置，不读取客户端参数；
- 普通入口没有线路标记，不受新增限制；
- 直接访问普通入口不等于绕过，因为普通入口本来就是保留的非优化线路；
- 若优化反代漏写线路标记，限制不会生效，因此部署后必须执行免费令牌验证；
- 请求头不需要设计成秘密，因为它只开启限制，不授予权限；
- 新增外部 API 只要复用 `TokenAuth()` 就会自动受到相同限制；若新增公开无鉴权接口，需要像 Midjourney 图片接口一样补充优化线路条件鉴权。

## 性能影响

每个标记请求只增加：

1. 一次请求头字符串比较；
2. 数次 Gin Context 内存读取；
3. 一次内存倍率 Map 查询；
4. 一次浮点数大小判断。

不增加数据库、Redis 或外部 HTTP 请求。免费请求还会在渠道分发前提前结束。实际网络性能主要取决于优化反代和 New API 源站之间的链路，而不是该权限判断。

## 修改文件

- `middleware/auth.go`：在 API Key 和视频内容会话鉴权完成后统一执行线路权限检查；
- `middleware/paid_optimized_route.go`：线路权限判断，以及 Midjourney 公开图片接口的条件鉴权；
- `middleware/paid_optimized_route_test.go`：普通入口、免费、付费、GET、图片、会话回退、特殊倍率和 auto 回归测试；
- `router/relay-router.go`：在优化入口为 Midjourney 公开图片接口补充条件鉴权；
- `service/group.go`：按请求线路生成 Auto 候选组；
- `service/channel_select.go`、`middleware/distributor.go`：初选、亲和和跨组重试使用同一候选组；
- `controller/model.go`：优化入口的 Auto 模型列表只包含付费候选组模型；
- `i18n/keys.go`、`i18n/locales/*.yaml`：标准错误消息。

## 验证步骤

代码测试：

```bash
go test ./middleware ./service ./controller ./router
go build ./...
```

部署后至少验证以下请求：

```bash
# 优化入口：免费 Key 应返回 403
curl -i https://optimized-api.example.com/v1/models \
  -H 'Authorization: Bearer sk-free-example'

# 优化入口：付费 Key 应进入原有逻辑
curl -i https://optimized-api.example.com/v1/models \
  -H 'Authorization: Bearer sk-paid-example'

# 优化入口：Dashboard 应返回 404
curl -i https://optimized-api.example.com/api/status

# 普通入口：免费 Key 保持原有行为
curl -i https://api.example.com/v1/models \
  -H 'Authorization: Bearer sk-free-example'
```

还应分别抽查 Chat Completions、Responses、Gemini、图片生成、视频创建和 `/content`、Midjourney、Suno、Kling 与即梦接口。

## 回滚方式

紧急回滚可以先在优化反代删除 `X-NewAPI-Route` 请求头，立即恢复所有请求的原有行为。代码回滚则移除 `TokenAuth()` 和 `TokenOrUserAuth()` 中的 `rejectUnpaidOptimizedRoute()` 调用，并恢复 Midjourney 图片路由。

## 后续工作

1. Dashboard 的 API 信息目前来自公开 `/api/status`，而且登录面板不知道用户准备使用哪一个 API Key。后续可先向所有用户展示优化地址并注明“仅非零倍率分组令牌可用”；若必须隐藏，需要另行设计账号级权限或令牌选择交互。
