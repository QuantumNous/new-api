# Vertex AI 文件存储与渠道测试实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Vertex AI 渠道增加 GCS bucket 配置、固定 `/vertexai` 文件代理路由和真实写入/读取/删除渠道测试，并提交符合仓库规范的 Pull Request。

**Architecture:** 前端继续用 `models` 保存 `storage:gs:<bucket>`，但将普通模型和 bucket 分开编辑。后端从固定 `/vertexai` 路径提取 bucket，复用模型分发选择类型 41 渠道，再由 Controller 二次授权并通过现有 Vertex 服务账号 OAuth 流式访问固定的 `storage.googleapis.com`。渠道测试直接复用同一 Storage Proxy，不经过公开地址回环，也不进入计费链路。

**Tech Stack:** Go 1.22+、Gin、现有 Vertex JWT/OAuth、`net/http`、Testify、React 19、TypeScript、React Hook Form、Base UI、i18next、Vitest/React Testing Library、Bun。

## Global Constraints

- 设计依据：`docs/superpowers/specs/2026-08-09-vertex-ai-storage-and-channel-test-design.md`。
- 仅 Vertex AI 渠道类型 41 支持 Storage；Gemini 类型 24 和其他渠道不得进入。
- 对外前缀固定为 `/vertexai`，不得改成 `/v1/rawproxy/vertexai`。
- 只开放上传、续传、列举、读取、下载和删除对象的五组 method/path，不得增加任意目标通配代理。
- bucket 授权只接受纯 bucket 名称，并精确匹配渠道 `models` 中的 `storage:gs:<bucket>`；不支持目录前缀授权。
- 只支持服务账号 JSON；`dto.VertexKeyTypeAPIKey` 必须在访问 GCS 前拒绝。
- 上游固定为 `https://storage.googleapis.com`，客户端不得覆盖 Host 或 Authorization。
- 上传和下载必须流式传输，不得将完整文件读入内存。
- Resumable `Location` 必须改写到当前服务的 `/vertexai/upload/...`；系统服务地址为空时本地失败，不得泄露 Google Session URL。
- Storage 文件操作和渠道测试不执行价格查询、quota 预扣、结算、退款或模型消费日志。
- 不新增数据库字段或迁移，继续兼容 SQLite、MySQL 5.7.8+、PostgreSQL 9.6+。
- 后端 JSON 编解码使用 `common.*` 包装，不直接调用 `encoding/json` marshal/unmarshal。
- 新增或大改 Go 测试使用 `require` 做致命断言、`assert` 做非致命断言。
- 前端新增文案使用 `useTranslation()` 和 `t('English key')`，覆盖 `en`、`zh`、`zh-TW`、`fr`、`ja`、`ru`、`vi`。
- 前端依赖与命令使用 Bun；修改 TypeScript/TSX 后运行受影响测试、typecheck、涉及文件 lint 和生产构建。
- 每个任务保留原子提交用于评审；全部测试和最终评审完成后 squash 为一个计划 Commit：`feat: add Vertex AI storage integration`。
- 创建 PR 前比较当前 Git 用户与历史核心开发者，使用 `.github/PULL_REQUEST_TEMPLATE.md`，必要时在 PR 正文声明 AI 辅助。

---

## 文件结构

- `web/src/features/channels/lib/vertex-storage-models.ts`：bucket 校验、普通模型/Storage 标识拆分与合并。
- `web/src/features/channels/components/drawers/sections/vertex-storage-buckets-field.tsx`：类型 41 专属 bucket 多值字段。
- `relay/constant/vertex_storage.go`：`/vertexai` 固定路由、bucket 规范化和 `storage:gs:` 授权 helper。
- `middleware/distributor.go`：从 Storage 路径构造分发模型并保存渠道模型上下文。
- `relay/channel/vertex/storage_proxy.go`：固定 GCS URL、请求头过滤、代理请求和 resumable 地址改写。
- `controller/vertex_storage_proxy.go`：二次授权、本地错误、响应头复制和流式响应。
- `controller/vertex_storage_channel_probe.go`：唯一临时对象及写入/读取/删除测试。
- `router/relay-router.go`：注册五组固定 `/vertexai` method/path。
- `web/src/features/channels/components/data-table-row-actions.tsx`：统一打开渠道测试弹窗。
- `web/src/features/channels/components/dialogs/channel-test-dialog.tsx`：标记 GCS bucket 测试项。
- `docs/vertex-ai-storage.md`、`docs/openapi/relay.json`：用户说明和 OpenAPI 契约。

### Task 1: 前端 Storage 模型边界与 bucket 字段

**Files:**
- Create: `web/src/features/channels/lib/vertex-storage-models.ts`
- Create: `web/src/features/channels/lib/__tests__/vertex-storage-models.test.ts`
- Modify: `web/src/features/channels/lib/index.ts`
- Create: `web/src/features/channels/components/drawers/sections/vertex-storage-buckets-field.tsx`
- Create: `web/src/features/channels/components/drawers/sections/__tests__/vertex-storage-buckets-field.test.tsx`
- Modify: `web/src/features/channels/components/drawers/sections/index.ts`
- Modify: `web/src/features/channels/components/drawers/channel-mutate-drawer.tsx`
- Modify: `web/scripts/add-missing-keys.mjs`
- Modify via i18n flow: `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json`

**Interfaces:**
- Produces: `VERTEX_STORAGE_MODEL_PREFIX`、`normalizeVertexStorageBucket()`、`splitVertexStorageModels()`、`mergeVertexStorageModels()`。
- Produces: `VertexStorageBucketsField({ channelType, models, onModelsChange })`。

- [ ] **Step 1: 写入失败的领域测试**

```ts
assert.deepEqual(
  splitVertexStorageModels([
    'gemini-2.5-pro',
    'storage:gs:bucket-a',
    'storage:gs:bucket-b',
  ]),
  { models: ['gemini-2.5-pro'], buckets: ['bucket-a', 'bucket-b'] }
)
assert.equal(normalizeVertexStorageBucket('bucket-a'), 'bucket-a')
assert.equal(normalizeVertexStorageBucket('bucket-a/path'), null)
assert.equal(normalizeVertexStorageBucket('storage:gs:bucket-a'), null)
assert.equal(normalizeVertexStorageBucket('gs://bucket-a'), null)
assert.deepEqual(
  mergeVertexStorageModels(['gemini-2.5-pro'], ['bucket-a', 'bucket-a']),
  ['gemini-2.5-pro', 'storage:gs:bucket-a']
)
```

- [ ] **Step 2: 运行测试并确认模块缺失**

```bash
cd web
bun test src/features/channels/lib/__tests__/vertex-storage-models.test.ts
```

Expected: FAIL，无法解析 `../vertex-storage-models`。

- [ ] **Step 3: 实现纯函数**

```ts
export const VERTEX_STORAGE_MODEL_PREFIX = 'storage:gs:'

export function normalizeVertexStorageBucket(value: string): string | null {
  const bucket = value.trim()
  if (!bucket || bucket === '.' || bucket === '..') return null
  if (bucket.startsWith(VERTEX_STORAGE_MODEL_PREFIX)) return null
  if (bucket.includes('://') || /[\\/?#]/.test(bucket)) return null
  return bucket
}
```

`splitVertexStorageModels()` 保序拆分、trim、去重并忽略无效 Storage 项；`mergeVertexStorageModels()` 去掉 models 中旧 Storage 项，仅编码合法且唯一的 bucket。

- [ ] **Step 4: 写入组件失败测试**

```tsx
const nonVertex = await renderField({ channelType: 24, models: [] })
expect(nonVertex.container).toBeEmptyDOMElement()

const vertex = await renderControlledField({
  channelType: 41,
  models: ['gemini-2.5-pro', 'storage:gs:bucket-a'],
})
expect(screen.getByText('bucket-a')).toBeInTheDocument()
await userEvent.type(screen.getByLabelText('Storage buckets'), 'bucket-b{enter}')
expect(screen.getByTestId('models-value')).toHaveTextContent(
  'gemini-2.5-pro,storage:gs:bucket-a,storage:gs:bucket-b'
)
```

- [ ] **Step 5: 实现字段并接入抽屉**

字段仅在 `channelType === 41` 渲染，使用现有 `MultiSelect`。普通模型选择器只展示拆分后的 `models`；填充、抓取、移除映射目标和清空普通模型时调用 `mergeVertexStorageModels(newModels, currentBuckets)`，不得静默删除 bucket。

- [ ] **Step 6: 按 i18n-translate 流程补齐七语言**

新增 key：`Storage buckets`、`Configure Google Cloud Storage buckets for this Vertex AI channel.`、`Enter storage bucket names`、`Add storage bucket "{{value}}"`、`Invalid storage bucket name`。

- [ ] **Step 7: 验证并提交**

```bash
cd web
bun test src/features/channels/lib/__tests__/vertex-storage-models.test.ts \
  src/features/channels/components/drawers/sections/__tests__/vertex-storage-buckets-field.test.tsx
bun run typecheck
bunx oxlint -c .oxlintrc.json src/features/channels/lib/vertex-storage-models.ts \
  src/features/channels/components/drawers/sections/vertex-storage-buckets-field.tsx \
  src/features/channels/components/drawers/channel-mutate-drawer.tsx
git add web
git commit -m "feat: add Vertex storage bucket configuration"
```

### Task 2: 后端 bucket 契约与类型限定分发

**Files:**
- Create: `relay/constant/vertex_storage.go`
- Create: `relay/constant/vertex_storage_test.go`
- Modify: `relay/constant/relay_mode.go`
- Modify: `constant/context_key.go`
- Modify: `middleware/distributor.go`
- Modify: `middleware/distributor_test.go`
- Modify: `service/channel_select.go`
- Modify: `model/ability.go`
- Modify: `model/channel_cache.go`
- Create: `service/channel_select_channel_type_test.go`
- Create: `model/channel_type_selection_test.go`

**Interfaces:**
- Produces: `VertexStorageRoutePrefix = "/vertexai"`、三条固定 route 常量、bucket/model helper、`ContextKeyChannelModels`、`RelayModeVertexStorage`。
- Produces: `DistributeByChannelType(requiredChannelType int)`；`service.RetryParam.RequiredChannelType` 向数据库和缓存选择器传递类型限制，值为 0 时保持现有行为。

- [ ] **Step 1: 写入失败测试**

```go
assert.Equal(t, "/vertexai", VertexStorageRoutePrefix)
assert.Equal(t, "/vertexai/upload/storage/v1/b/:bucket/o", VertexStorageUploadRoute)
for _, value := range []string{"", ".", "..", "bucket/path", `bucket\\path`, "storage:gs:bucket", "gs://bucket", "bucket?x=1"} {
    _, err := NormalizeVertexStorageBucket(value)
    require.Error(t, err, value)
}
assert.True(t, VertexStorageChannelSupports([]string{"storage:gs:bucket-a"}, "bucket-a"))
assert.False(t, VertexStorageChannelSupports([]string{"storage:gs:bucket-ab"}, "bucket-a"))
```

- [ ] **Step 2: 运行测试并确认函数缺失**

```bash
go test ./relay/constant -run 'VertexStorage|NormalizeVertexStorage' -count=1
```

- [ ] **Step 3: 实现常量和 helper**

```go
const (
    VertexStorageModelPrefix = "storage:gs:"
    VertexStorageRoutePrefix = "/vertexai"
    VertexStorageUploadRoute = VertexStorageRoutePrefix + "/upload/storage/v1/b/:bucket/o"
    VertexStorageListRoute = VertexStorageRoutePrefix + "/storage/v1/b/:bucket/o"
    VertexStorageObjectRoute = VertexStorageRoutePrefix + "/storage/v1/b/:bucket/o/*object"
)
```

bucket 规范化与前端保持同一拒绝集合；渠道授权逐项 trim 后精确匹配。

- [ ] **Step 4: 写入分发失败测试**

```go
c.Request = httptest.NewRequest(http.MethodGet, "/vertexai/storage/v1/b/bucket-a/o", nil)
c.Params = gin.Params{{Key: "bucket", Value: "bucket-a"}}
got, shouldSelect, err := getModelRequest(c)
require.NoError(t, err)
assert.True(t, shouldSelect)
assert.Equal(t, "storage:gs:bucket-a", got.Model)
assert.Equal(t, relayconstant.RelayModeVertexStorage, c.GetInt("relay_mode"))
```

增加指定渠道测试：只有类型 41 且精确配置 bucket 才运行下游；类型 24、非法 bucket、未配置 bucket 均提前失败。增加缓存和数据库选择测试：相同 group/model 同时存在类型 24 与 41 时，`RequiredChannelType: 41` 只能返回类型 41；值为 0 时保持原有选择集合。

- [ ] **Step 5: 实现分发与上下文**

`Distribute()` 改为 `return distribute(0)`，新增 `DistributeByChannelType(requiredChannelType)`。类型限制必须覆盖 Token 指定渠道、Affinity 首选渠道、Redis/内存缓存选择和数据库回退选择；`service.RetryParam`、`model.GetChannelByType()` 与 `model.GetRandomSatisfiedChannelByType()` 负责把限制传到底层。`getModelRequest()` 优先识别 `IsVertexStoragePath()`；指定渠道路径增加精确 bucket 检查；`SetupContextForSelectedChannel()` 写入：

```go
common.SetContextKey(c, constant.ContextKeyChannelModels, channel.GetModels())
```

- [ ] **Step 6: 验证并提交**

```bash
gofmt -w relay/constant/vertex_storage.go relay/constant/vertex_storage_test.go \
  relay/constant/relay_mode.go constant/context_key.go middleware/distributor.go middleware/distributor_test.go \
  service/channel_select.go model/ability.go model/channel_cache.go
go test ./relay/constant ./middleware ./service ./model -run 'VertexStorage|NormalizeVertexStorage|RequiredChannelType' -count=1
git add relay/constant constant/context_key.go middleware/distributor.go middleware/distributor_test.go \
  service/channel_select.go service/channel_select_channel_type_test.go model/ability.go model/channel_cache.go model/channel_type_selection_test.go
git commit -m "feat: route Vertex storage buckets"
```

### Task 3: 可复用 Vertex OAuth 与固定 GCS Proxy

**Files:**
- Modify: `relay/channel/vertex/service_account.go`
- Create: `relay/channel/vertex/service_account_test.go`
- Create: `relay/channel/vertex/storage_proxy.go`
- Create: `relay/channel/vertex/storage_proxy_test.go`

**Interfaces:**
- Produces: `CachedAccessTokenRequest`、`AcquireCachedAccessToken()`、`StorageOperation`、`StorageProxyRequest`、`DoStorageProxy()`、`SanitizeStorageResponseHeader()`、`RewriteStorageResumableLocation()`。

- [ ] **Step 1: 写入 OAuth 缓存与固定 URL 失败测试**

测试同一渠道/多 Key 索引复用缓存、不同索引不共享，以及：

```go
req, err := buildStorageRequest(context.Background(), StorageProxyRequest{
    Operation: StorageOperationGet,
    Method: http.MethodGet,
    Bucket: "bucket-a",
    Object: "docs/a b.pdf",
    RawQuery: "alt=media",
    AccessToken: "secret",
})
require.NoError(t, err)
assert.Equal(t, "storage.googleapis.com", req.URL.Host)
assert.Contains(t, req.URL.EscapedPath(), "docs%2Fa%20b.pdf")
assert.Equal(t, "Bearer secret", req.Header.Get("Authorization"))
```

- [ ] **Step 2: 写入 Location 与头部失败测试**

```go
got, err := RewriteStorageResumableLocation(
    "https://storage.googleapis.com/upload/storage/v1/b/bucket-a/o?upload_id=abc",
    "https://gateway.example.com",
    "bucket-a",
)
require.NoError(t, err)
assert.Equal(t, "https://gateway.example.com/vertexai/upload/storage/v1/b/bucket-a/o?upload_id=abc", got)
```

空 ServerAddress、非 Google Location、bucket 不一致必须失败；客户端 Authorization、Host、hop-by-hop headers 必须移除，内容/Range/条件请求/`X-Goog-Meta-*` 必须保留。

- [ ] **Step 3: 运行失败测试**

```bash
go test ./relay/channel/vertex -run 'CachedAccessToken|Storage|RewriteStorage' -count=1
```

- [ ] **Step 4: 实现 OAuth 接口和 Storage Proxy**

```go
type StorageProxyRequest struct {
    Operation StorageOperation
    Method string
    Bucket string
    Object string
    RawQuery string
    Header http.Header
    Body io.Reader
    ContentLength int64
    AccessToken string
    Proxy string
}
```

URL 只由 operation、bucket、object 构造，主机固定；object 使用 `url.PathEscape` 成为单一 segment。`DoStorageProxy` 使用项目现有 Proxy HTTP client、调用方 context 和原始 body，不读取完整 body。

- [ ] **Step 5: 验证并提交**

```bash
gofmt -w relay/channel/vertex/service_account.go relay/channel/vertex/service_account_test.go \
  relay/channel/vertex/storage_proxy.go relay/channel/vertex/storage_proxy_test.go
go test ./relay/channel/vertex -count=1
git add relay/channel/vertex
git commit -m "feat: add Vertex GCS storage proxy"
```

### Task 4: `/vertexai` Controller、路由与公共文档

**Files:**
- Create: `controller/vertex_storage_proxy.go`
- Create: `controller/vertex_storage_proxy_test.go`
- Modify: `router/relay-router.go`
- Modify: `router/relay_router_test.go`
- Create: `docs/vertex-ai-storage.md`
- Modify: `docs/openapi/relay.json`

**Interfaces:**
- Produces: `RelayVertexStorageUpload`、`RelayVertexStorageList`、`RelayVertexStorageObject`。

- [ ] **Step 1: 写入 Controller 与精确路由失败测试**

本地校验失败不得调用上游；合法请求必须透传渠道 ID、多 Key 索引、Proxy、GCS 状态/body/Range/ETag 并关闭 body。路由集合必须精确等于：

```go
map[string]bool{
    "POST /vertexai/upload/storage/v1/b/:bucket/o": true,
    "PUT /vertexai/upload/storage/v1/b/:bucket/o": true,
    "GET /vertexai/storage/v1/b/:bucket/o": true,
    "GET /vertexai/storage/v1/b/:bucket/o/*object": true,
    "DELETE /vertexai/storage/v1/b/:bucket/o/*object": true,
}
```

- [ ] **Step 2: 实现 Controller 二次授权**

依赖边界：

```go
type vertexStorageProxyDependencies struct {
    acquireAccessToken func(vertex.CachedAccessTokenRequest) (string, error)
    doProxy func(context.Context, vertex.StorageProxyRequest) (*http.Response, error)
}
```

早退顺序：bucket → 渠道类型 → 精确授权 → Key 类型 → 服务账号 JSON → object → Access Token → Storage Proxy。成功响应使用 `io.Copy`；不得建立 RelayInfo 或调用计费服务。

- [ ] **Step 3: 注册独立路由组**

```go
vertexStorageRouter := router.Group("/vertexai")
vertexStorageRouter.Use(middleware.RouteTag("relay"))
vertexStorageRouter.Use(middleware.SystemPerformanceCheck())
vertexStorageRouter.Use(middleware.TokenAuth())
vertexStorageRouter.Use(middleware.ModelRequestRateLimit())
vertexStorageRouter.Use(middleware.DistributeByChannelType(constant.ChannelTypeVertexAi))
```

- [ ] **Step 4: 补充文档与 OpenAPI**

文档包含 bucket 配置、五组路由、上传/下载/删除 cURL、`fileData.fileUri`、IAM、resumable 和非计费说明。OpenAPI tag 为 `文件/Vertex AI Cloud Storage`，所有路径以 `/vertexai` 开头。

- [ ] **Step 5: 验证并提交**

```bash
gofmt -w controller/vertex_storage_proxy.go controller/vertex_storage_proxy_test.go \
  router/relay-router.go router/relay_router_test.go
go test ./controller ./router -run 'VertexStorage' -count=1
git add controller/vertex_storage_proxy.go controller/vertex_storage_proxy_test.go \
  router/relay-router.go router/relay_router_test.go docs/vertex-ai-storage.md docs/openapi/relay.json
git commit -m "feat: expose Vertex storage routes"
```

### Task 5: Storage 渠道真实读写探测

**Files:**
- Create: `controller/vertex_storage_channel_probe.go`
- Create: `controller/vertex_storage_channel_probe_test.go`
- Modify: `controller/channel-test.go`

**Interfaces:**
- Produces: `vertexStorageChannelProbeDependencies`、`testVertexStorageChannel()`、`testChannelWithVertexStorageDependencies()`。

- [ ] **Step 1: 写入三步与失败不中断测试**

成功用例断言 operation 严格为 Upload、Get、Delete 且各一次。失败用例覆盖写入 403 后仍读取/删除、内容不一致后仍删除、删除失败返回对象路径、非法配置不调用上游、普通模型不进入分支、Storage 分支不产生消费日志。

- [ ] **Step 2: 运行失败测试**

```bash
go test ./controller -run 'VertexStorageChannelProbe|ChannelTestRoutesVertexStorage' -count=1
```

- [ ] **Step 3: 实现唯一对象和三步聚合**

```go
const vertexStorageChannelTestContent = "new-api Vertex AI Storage channel test\n"

newObjectName: func() string {
    return ".new-api-channel-test/" + uuid.NewString() + "/test.txt"
}
```

使用最长 30 秒的独立 cleanup context，各步骤不重试并关闭 response body。写入使用 `uploadType=media&name=...`，读取使用 `alt=media`，删除失败必须附对象路径。

- [ ] **Step 4: 在计费前分流**

```go
if channel.Type == constant.ChannelTypeVertexAi &&
    strings.HasPrefix(testModel, relayconstant.VertexStorageModelPrefix) {
    err := testVertexStorageChannel(ctx, c, testModel, storageDeps)
    return storageTestResult(startedAt, err)
}
```

分流点必须位于 RelayInfo、价格和日志逻辑之前。

- [ ] **Step 5: 验证并提交**

```bash
gofmt -w controller/channel-test.go controller/vertex_storage_channel_probe.go \
  controller/vertex_storage_channel_probe_test.go
go test ./controller -run 'VertexStorage|ChannelTest' -count=1
git add controller/channel-test.go controller/vertex_storage_channel_probe.go \
  controller/vertex_storage_channel_probe_test.go
git commit -m "feat: test Vertex storage buckets"
```

### Task 6: 统一前端测试入口并标识 Storage 项

**Files:**
- Modify: `web/src/features/channels/components/data-table-row-actions.tsx`
- Create: `web/src/features/channels/components/__tests__/channel-test-routing.test.tsx`
- Modify: `web/src/features/channels/components/dialogs/channel-test-dialog.tsx`
- Create: `web/src/features/channels/components/dialogs/__tests__/channel-test-storage.test.tsx`
- Modify: `web/scripts/add-missing-keys.mjs`
- Modify via i18n flow: `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json`

**Interfaces:**
- Consumes: `VERTEX_STORAGE_MODEL_PREFIX`。
- Produces: 所有单渠道测试按钮统一执行 `setCurrentRow(channel); setOpen('test-channel')`。

- [ ] **Step 1: 写入入口一致性失败测试**

表格 Gauge、卡片按钮、下拉菜单只打开 `test-channel`，不调用 `handleTestChannel`；卡片不得重复显示两个测试按钮。

- [ ] **Step 2: 实现统一入口**

删除直接请求、`isTesting` 和 Loader 状态。Gauge 点击阻止行事件后调用 `handleTest()`；删除卡片额外 PlugZap 按钮。

- [ ] **Step 3: 写入 Storage 标识失败测试**

```tsx
renderDialog({ models: 'gemini-2.5-pro,storage:gs:bucket-a' })
expect(screen.getByText('storage:gs:bucket-a')).toBeInTheDocument()
expect(
  screen.getByText('GCS bucket: writes, reads, and deletes a temporary object')
).toBeInTheDocument()
```

- [ ] **Step 4: 实现说明并补七语言**

Storage 行通过 `model.startsWith(VERTEX_STORAGE_MODEL_PREFIX)` 识别，显示 badge 和 `t('GCS bucket: writes, reads, and deletes a temporary object')`；普通模型保持原样。

- [ ] **Step 5: 验证并提交**

```bash
cd web
bun test src/features/channels/components/__tests__/channel-test-routing.test.tsx \
  src/features/channels/components/dialogs/__tests__/channel-test-storage.test.tsx
bun run typecheck
bunx oxlint -c .oxlintrc.json src/features/channels/components/data-table-row-actions.tsx \
  src/features/channels/components/dialogs/channel-test-dialog.tsx
git add web
git commit -m "feat: expose Vertex bucket tests in channel UI"
```

### Task 7: 全量验证、安全评审、单 Commit 与 PR

**Files:**
- Review: 本计划涉及的全部文件。
- Read: `.github/PULL_REQUEST_TEMPLATE.md`。

**Interfaces:**
- Produces: 一个通过验证的计划 Commit和按模板创建的 PR。

- [ ] **Step 1: 运行后端验证**

```bash
go test ./relay/constant ./middleware ./relay/channel/vertex ./controller ./router -count=1
go test ./...
go build ./...
```

- [ ] **Step 2: 运行前端验证**

```bash
cd web
bun run i18n:sync
bun run typecheck
bun run lint
bun run build
```

- [ ] **Step 3: 安全与规范自检**

```bash
rg -n 'io\.ReadAll|Authorization|storage\.googleapis\.com|/vertexai|storage:gs:' \
  controller/vertex_storage* relay/channel/vertex/storage_proxy.go \
  relay/constant/vertex_storage.go router/relay-router.go
git diff --check main...HEAD
git status --short
```

确认无任意 URL/Host 输入、无 Google Session URL 泄露、无计费调用、无敏感日志、无 `/v1/rawproxy/vertexai` 残留，对象名编码和 bucket 精确授权均有回归测试。

- [ ] **Step 4: squash 为一个计划 Commit**

```bash
base=$(git merge-base HEAD main)
git reset --soft "$base"
git commit -m "feat: add Vertex AI storage integration"
```

随后重新运行定向测试和 `git diff --check main...HEAD`。

- [ ] **Step 5: 按模板创建 PR**

```bash
git config user.name
git config user.email
git shortlog -sne --all | head -n 20
sed -n '1,260p' .github/PULL_REQUEST_TEMPLATE.md
git push -u origin codex/vertexai-storage
```

PR 标题使用 `feat: add Vertex AI storage integration`。正文保留模板结构，说明 `/vertexai` 路由、bucket 授权、服务账号限制、流式传输、真实渠道探测、非计费行为和验证结果；若当前 Git 用户不是历史核心开发者，明确说明本变更由 AI 辅助完成。
