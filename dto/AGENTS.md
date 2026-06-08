<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

# dto

## Purpose
数据传输对象（DTO）层，定义客户端与服务端之间、服务端与上游 AI 提供商之间的请求/响应结构体。涵盖 OpenAI 兼容格式、Claude、Gemini、Embedding、Rerank、图片、音频、视频、实时对话、任务等多种 API 类型。

**关键约束（Rule 5）**：可选标量字段必须使用指针类型（`*int`、`*float64`、`*bool`）配合 `omitempty`，以区分"字段缺失"和"字段显式设为零值"两种语义，避免零值在 marshal 时被丢弃导致上游行为异常。

## Key Files
| File | Description |
|------|-------------|
| `openai_request.go` | 核心：`GeneralOpenAIRequest` 结构体，统一的 OpenAI 兼容请求 DTO，覆盖 chat、completion、embedding 等场景；可选参数全部使用指针类型 |
| `openai_response.go` | OpenAI 格式响应结构体：`TextResponse`、`Usage`、`ChoiceWithMessage`、流式 delta 等 |
| `openai_image.go` | 图片生成/编辑请求与响应结构体 |
| `openai_compaction.go` | Responses API compaction 请求结构体 |
| `openai_responses_compaction_request.go` | Responses compaction 专用 DTO |
| `openai_video.go` | 视频生成请求与响应结构体 |
| `claude.go` | Anthropic Claude API 原生请求/响应结构体 |
| `gemini.go` | Google Gemini API 请求/响应结构体 |
| `embedding.go` | Embedding 请求/响应结构体 |
| `audio.go` | 音频转录/合成请求与响应结构体 |
| `realtime.go` | OpenAI Realtime API 事件结构体 |
| `rerank.go` | Rerank 请求/响应结构体 |
| `midjourney.go` | Midjourney 代理请求/响应结构体 |
| `task.go` | 异步任务通用结构体 |
| `suno.go` | Suno 音乐生成请求/响应结构体 |
| `video.go` | 通用视频任务结构体 |
| `video_seedance.go` | **Seedance 视频生成 DTO**：`SeedanceVideoRequest`（统一 provider-neutral 入站格式，含多模态 `content[]`；可选标量字段均为指针类型符合 Rule 5）、`SeedanceContentItem`、`SeedanceURLObject`、`SeedanceMedia`；内容类型常量（`SeedanceContentText/Image/Video/Audio`）和媒体角色常量（`SeedanceRoleFirstFrame/LastFrame/ReferenceImage/Video/Audio`）；Helper 方法 `PromptText()`、`Images()`、`Videos()`、`Audios()`、`HasFirstLastFrame()`、`Validate()` |
| `channel_settings.go` | 渠道设置相关 DTO |
| `user_settings.go` | 用户设置 DTO |
| `notify.go` | 通知推送 DTO |
| `playground.go` | Playground 调试请求结构体 |
| `pricing.go` | 定价信息 DTO |
| `ratio_sync.go` | 比率同步 DTO |
| `request_common.go` | 请求公共字段（`StreamOptions` 等） |
| `sensitive.go` | 敏感词检测相关 DTO |
| `values.go` | 通用值类型定义 |
| `error.go` | DTO 层错误结构体 |

## For AI Agents

### Working In This Directory
- **Rule 5 强制**：新增可选请求参数时，必须使用指针类型 + `omitempty`（如 `Temperature *float64 \`json:"temperature,omitempty"\``），不得使用非指针标量，否则零值会在 marshal 时被静默丢弃，影响上游行为。
- **Rule 1**：DTO 文件中若有自定义 `MarshalJSON`/`UnmarshalJSON`，内部调用必须走 `common.Marshal`/`common.Unmarshal`。
- 修改 `GeneralOpenAIRequest` 时注意其被 relay 层广泛引用，字段名变更会影响所有 provider adapter。
- 新增字段若无对应引用，必须使用 `json.RawMessage` 类型并加 `omitempty`（参见 `openai_request.go` 中的注释规范）。
- **Seedance 渠道共享入站格式**：所有 seedance 系渠道（kuaizi、doubao video、blockrun seedance 等）统一使用 `SeedanceVideoRequest` 作为客户端入站格式，各渠道 adapter 只负责将其转换为各自的上游 wire format，不得发明新的 per-channel 入站格式。详见 `relay/channel/task/AGENTS.md` 的 SOP。

### Testing Requirements
- `gemini_generation_config_test.go`：Gemini 生成配置序列化测试。
- `gemini_isstream_test.go`：Gemini 流式标志解析测试。
- `openai_request_zero_value_test.go`：**零值指针序列化测试**，验证 Rule 5 合规性。修改任何请求 DTO 后必须运行。
- `video_seedance_test.go`：`SeedanceVideoRequest` 的 JSON 解析（含 explicit-false 指针语义）、`PromptText`/`Images`/`Videos`/`Audios`/`HasFirstLastFrame` helper 方法、`Validate` 边界条件测试。修改 `video_seedance.go` 后必须运行。
- 运行命令：`go test ./dto/...`

### Common Patterns
- 可选标量字段统一使用指针：`*int`、`*float64`、`*bool`、`*uint`。
- 无强引用的透传字段使用 `json.RawMessage`，避免结构体过度膨胀。
- 复杂嵌套对象（如 `Tools`、`Messages`）使用具名结构体切片，不使用 `any`。

## Dependencies

### Internal
- `common` — JSON 工具、类型工具
- `types` — `FileSource`、`RelayFormat` 等基础类型

### External
- `encoding/json` — `json.RawMessage`、`json.Number` 类型定义（仅类型，不用于 marshal/unmarshal）
- `github.com/gin-gonic/gin` — `c.ShouldBindJSON` 等绑定函数（部分 DTO 含绑定方法）
- `github.com/samber/lo` — 切片工具

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
