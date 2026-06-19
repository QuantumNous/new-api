# 异步图片生成

## 背景

部分上游 AI 提供商（如 GPT-image-2）的图片生成耗时较长（2-10 分钟），同步阻塞 HTTP 连接既不现实也不可靠。本功能将 `POST /v1/images/generations` 的同步流程改造为可选的异步模式：客户端提交请求后立即获得 `task_id`，随后通过轮询获取生成结果。

## 兼容性

- `async` 字段可选，不传或为 `false` 时走原有同步逻辑，完全向后兼容
- 仅当 `"async": true` 时触发异步模式

## API 接口

### 提交异步图片生成请求

```
POST /v1/images/generations
Content-Type: application/json
Authorization: Bearer <token>

{
  "model": "gpt-image-2",
  "prompt": "a cat wearing sunglasses",
  "async": true
}
```

**响应 (202 Accepted):**

```json
{
  "success": true,
  "data": {
    "task_id": "task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "status": "submitted",
    "created_at": 1718700000
  }
}
```

### 轮询任务状态

```
GET /v1/images/generations/{task_id}
Authorization: Bearer <token>
```

**进行中响应 (200):**

```json
{
  "success": true,
  "data": {
    "task_id": "task_xxx",
    "status": "processing",
    "progress": "50%",
    "created_at": 1718700000
  }
}
```

**完成响应 (200) — OpenAI Image API 格式:**

```json
{
  "data": [
    {
      "url": "https://..."
    }
  ],
  "created": 1718700000
}
```

**状态值映射:**

| 内部状态 | 返回状态 |
|---|---|
| `IN_PROGRESS` | `processing` |
| `SUCCESS` | `succeeded` |
| `FAILURE` | `failed` |
| `QUEUED` / `SUBMITTED` | `queued` |

## 架构设计

### 两阶段执行模型

```
客户端                     服务端                          上游提供商
  |                          |                               |
  |-- POST /images/generations (async:true) -->              |
  |                          |                               |
  |  [同步阶段]              |                               |
  |  1. 解析请求              |                               |
  |  2. 计费预扣              |                               |
  |  3. 选择渠道(含重试)      |                               |
  |  4. 创建 Task (IN_PROGRESS) |                             |
  |<-- 202 Accepted (task_id) |                               |
  |                          |                               |
  |  [异步阶段 - 后台协程]    |                               |
  |                          |-- DoRequest (同步阻塞) ------>|
  |                          |                               |
  |  GET /generations/:id    |                               |
  |<-- status: processing    |                               |
  |                          |                               |
  |                          |<-- 200 OK (图片数据) ----------|
  |                          |                               |
  |  GET /generations/:id    |                               |
  |<-- status: succeeded     |                               |
  |     + 图片 URL           |                               |
```

### 关键文件

| 文件 | 作用 |
|---|---|
| `dto/openai_image.go` | `ImageRequest` 新增 `Async *bool` 字段和 `IsAsync()` 方法 |
| `constant/task.go` | 新增 `TaskPlatformImage = "image"` 和 `TaskActionImageGenerate = "imageGenerate"` |
| `router/relay-router.go` | 路由分发：`isAsyncImageRequest` 检测 async 标志；新增 `GET /images/generations/:task_id` 路由 |
| `relay/async_image.go` | `ImageAsyncHelper`：绕过 `adaptor.DoResponse`（写客户端），直接读取上游响应体并返回 |
| `controller/async_image.go` | `RelayAsyncImage`（同步+异步两阶段）、`RelayAsyncImageFetch`（轮询）、`fakeResponseWriter`、`buildBackgroundContext` |

### 同步阶段（HTTP Handler 内执行）

1. **解析请求** — `helper.GetAndValidateRequest` 解析并校验 `ImageRequest`
2. **生成 RelayInfo** — `relaycommon.GenRelayInfo` 构建中继上下文
3. **Token 估算与定价** — 敏感词检查、token 估算、模型定价
4. **预扣费** — `service.PreConsumeBilling` 冻结用户额度
5. **渠道选择（含重试）** — `getChannel` 在重试循环中选择可用渠道，同时通过 `bodyStorage.Bytes()` 捕获请求体字节（因为 `doRequest` 可能关闭 body）
6. **创建 Task** — 状态设为 `IN_PROGRESS`，写入计费上下文快照
7. **返回 202** — 立即响应客户端

### 异步阶段（`gopool.Go` 后台协程内执行）

1. **构建后台 Context** — `buildBackgroundContext` 从原始 `gin.Context` 复制所有中间件设置的 Keys，用捕获的字节创建新请求体，挂载 `fakeResponseWriter`
2. **执行图片生成** — `relay.ImageAsyncHelper` 构建请求、调用 `adaptor.DoRequest`、直接读取上游响应体（不调用 `DoResponse`）
3. **成功路径** — CAS 更新 Task 为 `SUCCESS`，写入图片数据和 ResultURL，结算差额（`SettleBilling`），记录性能指标
4. **失败路径** — CAS 更新 Task 为 `FAILURE`，记录失败原因，退还预扣费（`Billing.Refund`），收取违规费（如有）
5. **Panic 恢复** — `defer recover` 捕获协程 panic，更新 Task 为 FAILURE 并退还预扣费

### fakeResponseWriter

后台协程不能直接使用原始的 `gin.ResponseWriter`（客户端连接已关闭）。`fakeResponseWriter` 实现了 `gin.ResponseWriter` 接口的全部方法，将写操作静默丢弃或转发到底层 `http.ResponseWriter`，避免 panic。

```go
type fakeResponseWriter struct {
    http.ResponseWriter
    status int
    size   int
}
```

### buildBackgroundContext

为后台协程构造一个最小化的 `gin.Context`：

- 复制原始 Context 的所有 Keys（认证信息、渠道选择结果、分组信息等）
- 用捕获的请求体字节创建新的 `*http.Request`（避免 body 被关闭的问题）
- 挂载 `fakeResponseWriter` 防止意外写入

### CAS 任务更新

`Task.UpdateWithStatus(fromStatus)` 使用 Compare-And-Swap 语义，确保只有一个协程能将任务从 `IN_PROGRESS` 转换为 `SUCCESS` 或 `FAILURE`，防止重复结算或退款。

```go
func (t *Task) UpdateWithStatus(fromStatus TaskStatus) (bool, error) {
    result := DB.Model(t).Where("status = ?", fromStatus).Select("*").Updates(t)
    return result.RowsAffected > 0, result.Error
}
```

### 计费生命周期

```
提交请求 ──> PreConsumeBilling (冻结额度)
                │
    ┌───────────┴───────────┐
    │                       │
  成功                    失败
    │                       │
SettleBilling          Billing.Refund
(差额结算)             (全额退还)
```

- **预扣费**：在同步阶段的 HTTP Handler 中执行，确保 202 返回前额度已冻结
- **结算**：在后台协程成功完成后执行，按实际消耗多退少补
- **退款**：在后台协程失败或 panic 时执行，全额退还预扣额度

### ImageAsyncHelper 核心逻辑

`relay.ImageAsyncHelper` 是异步图片生成的核心，与同步版 `ImageHelper` 的关键区别：

- 调用 `adaptor.DoRequest` 获取上游 `*http.Response`
- **绕过 `adaptor.DoResponse`**（该函数会将响应写入 `c.Writer`），改为直接 `io.ReadAll(httpResp.Body)` 读取原始响应
- 解析 `dto.SimpleResponse` 提取 usage 信息用于计费
- 返回 `AsyncImageResult{TaskID, RawBody}` 供 Task 存储

## 向后兼容

- 不带 `async` 字段或 `"async": false` 的请求走原有同步路径 `controller.Relay`
- `isAsyncImageRequest` 通过 peek 请求体检测 async 标志，读取后恢复 body 供后续 handler 使用
- 所有现有路由、中间件、认证、计费逻辑不受影响
