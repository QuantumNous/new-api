# Vertex AI 文件存储与渠道测试设计

## 背景

Vertex AI Gemini 可以通过 `fileData.fileUri` 引用 Google Cloud Storage 对象，例如 `gs://example-bucket/docs/report.pdf`。当前项目已经支持 Vertex AI 推理渠道，但没有提供管理这些对象的受限代理接口，也无法在渠道测试中验证服务账号对存储桶的真实读写权限。

本功能参考 `aihub-new` 已有实现，按照当前 new-api 的路由、中间件、渠道表单和测试流程重新适配。功能包括 Vertex AI 存储桶配置、Google Cloud Storage 文件代理，以及存储桶写入/读取/删除测试。

本文中的“对象存储”特指 Google Cloud Storage（GCS，URI scheme 为 `gs://`），不引入腾讯云 COS、S3 或通用对象存储抽象。

## 目标

1. Vertex AI 渠道可以独立配置一个或多个 GCS bucket。
2. API 客户端可以通过固定 `/vertexai` 前缀路由上传、列举、读取、下载和删除已授权 bucket 中的对象。
3. 渠道测试可以真实验证服务账号对指定 bucket 的写入、读取和删除权限。
4. 文件传输采用流式代理，不进入模型计费链路。
5. 最终变更按项目规范整理为一个计划 Commit，并创建 Pull Request。

## 非目标

- 不实现 OpenAI `/v1/files` 兼容层。
- 不新增文件记录、文件 ID、文件归属表或数据库迁移。
- 不支持 bucket 创建、删除、IAM、ACL、复制、组合或重写接口。
- 不支持目录前缀级授权；授权粒度固定为整个 bucket。
- 不支持 Vertex AI API Key 模式访问 GCS。
- 不新增 Google Cloud Storage SDK。
- 不建立 S3、腾讯云 COS 或其他对象存储的通用抽象。
- 不对文件上传、下载或存储桶测试收费。

## 渠道配置

仅 Vertex AI 渠道类型 41 显示“存储桶”字段。字段支持多值输入，但每一项必须是纯 bucket 名称，例如：

```text
example-bucket
archive-bucket-01
```

不接受 `gs://example-bucket`、`storage:gs:example-bucket`、`example-bucket/path` 或包含查询字符串、反斜杠、URL scheme 的值。

存储桶继续复用渠道现有 `models` 字段持久化：

```text
storage:gs:example-bucket
```

前端加载渠道时，将所有 `storage:gs:` 项从普通模型列表中拆出并去掉前缀回显；保存时重新添加前缀，与普通模型合并、去重后写回 `models`。切换到非 Vertex AI 类型时不主动删除已有存储桶项，避免临时切换造成数据丢失。

新增用户界面文案必须使用 `useTranslation()` 和 `t('English key')`，并同步维护 `en`、`zh`、`zh-TW`、`fr`、`ja`、`ru`、`vi` 七种前端语言。

## 对外路由

采用供应商前缀 `/vertexai`，固定开放以下路径：

| 方法 | 网关路径 | 上游语义 |
| --- | --- | --- |
| `POST` | `/vertexai/upload/storage/v1/b/:bucket/o` | 简单上传、multipart 上传或初始化 resumable 上传 |
| `PUT` | `/vertexai/upload/storage/v1/b/:bucket/o` | resumable 分片上传或完成上传 |
| `GET` | `/vertexai/storage/v1/b/:bucket/o` | 列举对象 |
| `GET` | `/vertexai/storage/v1/b/:bucket/o/*object` | 获取元数据；`alt=media` 时下载对象内容 |
| `DELETE` | `/vertexai/storage/v1/b/:bucket/o/*object` | 删除对象 |

路由组依次执行：

```text
RouteTag("relay")
→ SystemPerformanceCheck
→ TokenAuth
→ ModelRequestRateLimit
→ DistributeByChannelType(Vertex AI)
→ Controller 二次授权
→ GCS 流式代理
```

不得增加能够选择任意 Google API 路径、任意主机或任意 URL 的通配代理。

## 渠道分发与授权

中间件从路径参数读取 bucket，并构造分发模型：

```text
storage:gs:<bucket>
```

该值进入现有模型、用户组、Token、指定渠道和渠道选择流程，候选渠道同时被限制为 Vertex AI 类型 41。Controller 在发送上游请求前再次验证：

1. bucket 是合法的纯 GCS bucket 名称。
2. 所选渠道类型是 Vertex AI。
3. 所选渠道的 `models` 精确包含 `storage:gs:<bucket>`。
4. 渠道使用服务账号 JSON 凭证，而不是 Vertex AI API Key。

双重校验用于防止未来路由、中间件或上下文变更绕过 bucket 授权。

## 上游鉴权与请求代理

上游主机固定为：

```text
https://storage.googleapis.com
```

代理复用 Vertex AI 已有服务账号解析、JWT 签名、`cloud-platform` scope、Access Token 缓存和渠道 Proxy 配置。缓存继续按渠道 ID 和多 Key 索引隔离。

发送上游请求前必须丢弃客户端 `Authorization`、`Host` 和 hop-by-hop headers，并设置服务端获取的 GCS Bearer Token。允许透传内容、Range、条件请求、`Content-Range`、`X-Goog-Hash` 和 `X-Goog-Meta-*` 等对象操作相关头。

对象名来自 `*object`，允许包含目录形式的 `/`，但构造 GCS JSON API URL 时必须将完整对象名编码为单个 path segment，不能将对象名解释成额外的上游路由层级。

查询参数在固定主机和固定路径语义下透传，包括 `uploadType`、`name`、`alt`、`prefix`、`delimiter`、`pageToken`、generation 条件和 resumable session 参数。查询参数不得改变 bucket 或上游主机。

## 流式传输与 Resumable 上传

上传直接使用入站 `Request.Body` 构造上游请求；下载直接从 GCS response body 流式复制到客户端。不得使用 `io.ReadAll` 将完整文件载入内存。请求取消时使用同一 context 取消上游请求，并在所有路径关闭上游 response body。

GCS resumable 初始化成功后返回的 `Location` 不能原样暴露。网关必须将其改写为当前服务的：

```text
/vertexai/upload/storage/v1/b/:bucket/o
```

并保留 `upload_id` 等 session 查询参数。绝对地址使用系统配置的服务地址构造，不信任客户端 `Host` 或转发头。后续每个 `PUT` 分片重新经过 Token 鉴权、限流、渠道分发和 bucket 二次授权。

## 响应与错误处理

GCS 返回的成功状态、4xx/5xx 状态、JSON 错误体、对象元数据、二进制内容和必要响应头原则上原样返回，同时过滤 hop-by-hop headers。

以下情况必须在访问 GCS 前返回本地错误：

- bucket 缺失、非法或包含路径/URL 语义。
- 没有可用的 Vertex AI 渠道配置目标 bucket。
- Token、用户组或指定渠道策略无权使用 `storage:gs:<bucket>`。
- 所选渠道类型错误或未配置目标 bucket。
- 渠道使用 Vertex AI API Key。
- 服务账号 JSON 无法解析或 OAuth Token 获取失败。
- 对象读取或删除路由缺少对象名。
- resumable 初始化需要改写绝对地址，但系统服务地址未配置。

本地错误沿用项目现有错误响应结构。错误不得包含服务账号 JSON、私钥、Access Token、文件内容或敏感响应头。

## 存储桶渠道测试

`testChannel` 完成测试项选择和空格清理后，仅在以下条件同时满足时进入 Storage 测试分支：

1. 渠道类型为 Vertex AI。
2. 测试项以 `storage:gs:` 开头。

普通模型继续走现有推理测试流程。Storage 测试在前置校验通过后生成唯一临时对象：

```text
.new-api-channel-test/<随机值>/test.txt
```

测试使用固定短文本作为内容，并按固定顺序各执行一次：

1. 使用 GCS media upload 写入临时对象。
2. 使用 `alt=media` 读取临时对象，并精确比较响应内容。
3. 删除临时对象。

任一步失败仍继续执行剩余步骤，尤其必须尽力执行删除。只有写入成功、读取成功、内容一致且删除成功时测试才通过。删除失败时，响应必须提供临时对象路径供管理员手动清理，但不得暴露凭证。

测试直接复用同一套 Access Token 获取和 Storage Proxy，不通过服务公开地址发起 HTTP 回环请求，不自动重试，不计费，也不生成模型消费日志。

## 前端测试入口

渠道列表仪表按钮、卡片测试按钮和行操作“测试连接”统一打开现有 `ChannelTestDialog`，不再由仪表按钮直接测试默认模型。用户在弹窗中选择普通模型或 `storage:gs:<bucket>` 测试项。

Storage 项需要显示明确的 GCS bucket 类型说明，使用户知道该测试会真实执行写入、读取和删除。单项测试与批量测试复用现有渠道测试 API 和结果区域；普通模型测试行为保持不变。

## 计费、日志与数据库

Storage Proxy 和 Storage 渠道测试均不得：

- 查询模型价格；
- 执行 quota 预扣；
- 执行结算或退款；
- 将字节数作为计费乘数；
- 生成模型消费日志。

可以记录请求 ID、渠道 ID、bucket、HTTP 方法、上游状态码、耗时和安全处理后的错误类别，用于故障排查。不得记录文件内容、服务账号凭证或 Access Token。

本功能不修改数据库结构，继续兼容 SQLite、MySQL 5.7.8+ 和 PostgreSQL 9.6+。

## 测试策略

### 前端存储桶字段

- 测试 `storage:gs:` 拆分、规范化、合并和去重。
- 测试仅类型 41 显示存储桶字段。
- 测试多个 bucket 的添加、删除和 `models` 同步。
- 测试非法 bucket、空值、完整前缀和包含路径的输入不会形成有效配置。
- 测试切换渠道类型不会静默删除已有 bucket 配置。

### 分发与代理

- 测试 bucket 映射为 `storage:gs:<bucket>`。
- 测试类型限定、精确 bucket 匹配和指定渠道策略。
- 测试固定生成 `storage.googleapis.com` URL，且对象名中的 `/` 正确编码。
- 测试客户端不能覆盖主机和 Authorization。
- 测试请求/响应必要头保留，hop-by-hop headers 移除。
- 测试上传与下载 body 保持流式语义。
- 测试 GCS 状态码、错误体、Range 和 `Content-Range` 保持一致。
- 测试 resumable `Location` 改写，且系统服务地址缺失时不会泄露 Google Session URL。
- 测试 Vertex AI API Key、非法 bucket 和未授权 bucket 在访问上游前失败。

### 渠道测试

- 测试 Storage 项进入专用分支，普通模型保持原流程。
- 测试写入、读取、删除严格按顺序且各执行一次。
- 测试任一步失败后仍执行剩余步骤。
- 测试读取内容不一致和删除失败均判定失败。
- 测试删除失败时返回临时对象路径。
- 测试成功条件为三步成功且内容一致。
- 测试不进入计费和模型消费日志路径。

### 前端测试弹窗

- 测试所有单渠道测试入口统一打开测试弹窗。
- 测试 Storage 项可以被选择并显示类型说明。
- 测试单项和批量测试能够展示 Storage 汇总错误。
- 测试普通模型测试行为不回归。

### 验证

- 运行受影响 Go 单元测试，并使用 `testify/require` 与 `testify/assert` 编写新增或大幅重写的后端测试。
- 运行受影响 Vitest/React Testing Library 测试。
- 在 `web/` 执行 `bun run typecheck`。
- 对涉及的前端文件执行 lint。
- 执行 `bun run build` 生产构建 Smoke Test。
- 执行相关 Go 包测试和根模块构建。

## Pull Request 要求

实现完成并通过评审后，将本任务产生的提交 squash 为一个计划 Commit，再推送分支并创建 PR。

创建 PR 前：

1. 比较当前 `git config user.name`、`git config user.email` 与仓库历史核心开发者。
2. 使用 `.github/PULL_REQUEST_TEMPLATE.md` 的结构撰写 PR 内容。
3. 如果当前 Git 用户不是历史核心开发者，在 PR 正文明确说明代码由 AI 生成或 AI 辅助。
4. PR 中说明 `/vertexai` 路由、安全边界、非计费行为、验证命令和测试结果。

## 验收标准

1. Vertex AI 渠道可以配置多个合法纯 bucket 名称，并正确持久化为 `storage:gs:<bucket>`。
2. 已授权客户端可以通过固定 `/vertexai` 路由上传、列举、读取、下载和删除对象。
3. 未配置目标 bucket 的渠道、非 Vertex AI 渠道和 API Key 模式不能访问 GCS。
4. 对象名可包含目录形式的 `/`，但不会造成上游路径或主机逃逸。
5. 大文件上传和下载采用流式传输。
6. Resumable 上传全过程都经过网关鉴权和 bucket 授权，Google Session URL 不会泄露。
7. Storage 渠道测试真实执行写入、读取校验和删除，失败时仍尽力清理。
8. Storage 文件操作和渠道测试均不计费、不生成模型消费日志。
9. 所有新增文案完成七种语言翻译。
10. Go 测试、前端测试、类型检查、lint、生产构建和相关模块构建通过。
11. 最终变更整理为一个计划 Commit，并按仓库模板创建 PR。
