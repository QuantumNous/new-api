# RelayKit

RelayKit 是一个 Go 模块，在 OpenAI Chat Completions、OpenAI Responses、Anthropic Messages 和 Gemini `generateContent` 四种协议之间转换请求、非流式响应和流式事件。

它从 [new-api](https://github.com/QuantumNous/new-api) 中拆出，模块路径是 `github.com/QuantumNous/new-api/relaykit`，运行时依赖是 uuid、lo、gjson 和 sjson 四个包。它做协议数据的建模和转换，HTTP 收发、SSE 读写、渠道选择、鉴权和计费由宿主程序完成，所以可以嵌进其他 Go 网关或代理。

## 支持矩阵

四种协议两两之间都能转换，请求、非流式响应和流式响应覆盖同一张表：

| 源格式 \ 目标格式 | OpenAI Chat | OpenAI Responses | Claude Messages | Gemini |
|---|---:|---:|---:|---:|
| OpenAI Chat | | `good` | `fair` | `fair` |
| OpenAI Responses | `good` | | `fair` | `fair` |
| Claude Messages | `fair` | `fair` | | `discouraged` |
| Gemini | `fair` | `fair` | `discouraged` | |

`good` 表示两种协议结构接近，字段基本一一对应。`fair` 表示主要内容都能转，协议独有的字段以诊断报告。其中 Gemini 转 Responses 的请求和响应、Claude 转 Responses 的响应、Responses 转 Gemini 的响应经 OpenAI Chat 中转。`discouraged` 表示 Claude 和 Gemini 之间请求和响应都经 OpenAI Chat 中转两跳，丢字段的机会更多。实际走的路径在转换结果的 `Steps` 里，等级在 `Quality` 里。

## 功能

### 自动选路

`ConvertRequest` 和 `ConvertResponse` 按传入 DTO 的具体类型判断源协议，`NewResponseStreamState` 按参数里的源格式和目标格式，都查表选直接转换器或多跳路径。结果里有源格式、目标格式、转换器 ID、质量等级、实际经过的每一步和诊断列表。要固定路径时用 `ConvertRequestVia`，要按 ID 执行时用 `ConvertRequestByID`、`ConvertResponseByID` 和 `NewResponseStreamStateByID`。

### 工具调用

function tool 的定义、调用和结果在四种协议之间互转。Responses 的 custom tool 和带 namespace 的工具发往 Chat、Claude、Gemini 上游时改成普通 function tool，编码方式记在 `convmeta.ResponsesToolState` 里，响应转换时按这份记录还原成 Responses 的形状。托管 web search 按目标协议重新编码：Chat 用 `web_search_options`，Responses、Claude 和 Gemini 各用自己协议的 web search 工具定义，宿主可以通过 `Options.WebSearch` 为某个上游改写编码。其他托管工具在目标协议里表达不了的部分，转换照常完成，缺失写进诊断。

### 推理设置

reasoning effort、thinking budget 和是否返回思考内容用 `dto.ReasoningConversionState` 在转换步骤之间传递，多跳路径上的每一步都能读到精确的 budget 和 effort。Claude 的 max_tokens 和 budget 超出模型范围时会调整，Gemini 的 thinkingConfig 按模型归一化，这些改动都以诊断返回，例如 `claude_max_tokens_raised` 和 `claude_budget_adjusted`。

### 多模态

图片和文件内容块在协议之间转换。需要下载 URL 或解析 data URL 时，RelayKit 调用宿主用 `SetMediaResolver` 注册的函数，未注册时转换返回错误。

### Usage

每个响应转换都返回统一的 `dto.Usage`，含输入、输出、缓存命中，以及 Claude 缓存写入按 5 分钟和 1 小时的拆分。`Usage.BillingUsage` 同时带着上游原始的 usage 结构和它来自哪个协议，宿主可以按上游的计量规则计费。流式转换把分散在多个事件里的 usage 累加到 `ResponseStreamState`。`dto.MergeUsageNonZero` 一类函数合并两份 usage 时，后到的非零字段覆盖已有值，后到的零值保留已有的计数。

### 流式

每条上游流对应一个 `ResponseStreamState`，跨事件的工具调用拼接、usage 和结束状态都存在这里。上游结束后调用 `FinalizeStreamResponse`，转换器在这一步补发终止事件和最终 usage。目标是 Responses 时，上游中途出错可以调用 `FailResponsesStream` 生成 Responses 协议的错误事件，`ResponseStreamOptions.EmitSequenceNumber` 打开后每个事件带 `sequence_number`。

### 宿主钩子

JSON 编解码默认用 `encoding/json`，宿主可以在启动时用 `kitutil.SetCodec` 换成别的实现，DTO 上自定义的 `MarshalJSON` 和 `UnmarshalJSON` 也走同一个编解码器。数据形状异常的日志通过 `kitutil.SetLogging` 和 `kitutil.SetSystemErrorLogging` 交给宿主，默认写到 stderr。

## 安装

RelayKit 要求 Go 1.25.1 或更高版本。tag 的形式是 `relaykit/vX.Y.Z`，`@latest` 解析到最新的一个。

```bash
go get github.com/QuantumNous/new-api/relaykit@latest
```

| 包 | 内容 |
|---|---|
| `relaykit/dto` | 四种协议的请求、响应、流式事件和 usage 结构，以及 new-api 宿主共用的渠道、定价和用户设置结构 |
| `relaykit/types` | 协议格式、错误、诊断、文件来源等共享类型 |
| `relaykit/relayconvert` | 请求、响应和流式转换入口 |
| `relaykit/relayconvert/convmeta` | 转换上下文接口 `Meta`、默认实现 `Values` 和选项 `Options` |
| `relaykit/relayconvert/reasoning` | 推理设置的解析、合并和渲染，包括模型名尾缀解析 |
| `relaykit/relayconvert/kitutil` | JSON 编解码和日志钩子 |
| `relaykit/reasonmap` | Claude 和 OpenAI 之间的结束原因映射 |

## 快速开始

下面把 OpenAI Chat Completions 请求转换成 Claude Messages 请求：

```go
package main

import (
	"context"
	"fmt"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/types"
)

func main() {
	maxTokens := uint(1024)
	request := &dto.GeneralOpenAIRequest{
		Model: "claude-sonnet-4-5",
		Messages: []dto.Message{
			{Role: "user", Content: "Hello!"},
		},
		MaxTokens: &maxTokens,
	}

	meta := &convmeta.Values{
		OriginModelName:     "client-model",
		UpstreamModelName:   request.Model,
		ChannelMetaAttached: true,
	}

	result, err := relayconvert.ConvertRequest(
		context.Background(),
		meta,
		types.RelayFormatClaude,
		request,
	)
	if err != nil {
		panic(err)
	}

	claudeRequest, ok := result.Value.(*dto.ClaudeRequest)
	if !ok {
		panic(fmt.Sprintf("unexpected result type %T", result.Value))
	}

	fmt.Printf("model=%s messages=%d\n", claudeRequest.Model, len(claudeRequest.Messages))
}
```

`ConvertRequest` 按请求的具体 DTO 类型推断源格式。传入 nil、原始 JSON、`map[string]any` 或其他类型时返回错误。

### 非流式响应

响应转换用同一套目标格式参数：

```go
result, err := relayconvert.ConvertResponse(
	ctx,
	meta,
	types.RelayFormatOpenAI,
	claudeResponse,
)
if err != nil {
	return err
}

openAIResponse := result.Value.(*dto.OpenAITextResponse)
usage := result.Usage
```

支持的响应 DTO：

| 格式 | 非流式响应 | 流式事件 |
|---|---|---|
| OpenAI Chat | `dto.OpenAITextResponse` | `dto.ChatCompletionsStreamResponse` |
| OpenAI Responses | `dto.OpenAIResponsesResponse` | `dto.ResponsesStreamResponse` |
| Claude Messages | `dto.ClaudeResponse` | `dto.ClaudeResponse` |
| Gemini | `dto.GeminiChatResponse` | `dto.GeminiChatResponse` |

### 流式响应

每条上游流创建一个 `ResponseStreamState`，上游结束后调用 `FinalizeStreamResponse`：

```go
state, err := relayconvert.NewResponseStreamState(
	types.RelayFormatOpenAI,
	types.RelayFormatOpenAIResponses,
	relayconvert.ResponseStreamOptions{
		ID:                 "resp_123",
		Model:              "gpt-4.1",
		IncludeUsage:       true,
		EmitSequenceNumber: true,
	},
)
if err != nil {
	return err
}

for _, chunk := range upstreamChunks {
	results, err := relayconvert.ConvertStreamResponseChunk(ctx, meta, state, chunk)
	if err != nil {
		return err
	}
	for _, result := range results {
		emit(result.Value)
	}
}

finalResults, err := relayconvert.FinalizeStreamResponse(ctx, meta, state)
if err != nil {
	return err
}
for _, result := range finalResults {
	emit(result.Value)
}

usage := state.Usage()
diagnostics := state.Diagnostics()
```

SSE 的读取和写入由宿主完成：把每个上游事件解析成对应的 DTO 传进来，再把转换结果编码后发给下游。`FinalizeStreamResponse` 每条流都要调用，部分转换器在这一步才补发终止事件和最终 usage。

## 转换上下文

大多数基础转换的 `convmeta.Meta` 参数可以传 `nil`。需要模型名、推理设置、工具编码记录或流式状态时，用 `convmeta.Values`，或者在宿主里实现 `convmeta.Meta`。自己实现时，指针类型的每个方法都要能在 nil receiver 上返回零值，接口注释写了原因。

按请求传入的选项放在 `convmeta.Options`：

```go
meta := &convmeta.Values{
	Options: &convmeta.Options{
		Claude: convmeta.ClaudeOptions{
			DefaultMaxTokens: func(model string) int {
				return 4096
			},
		},
		Gemini: convmeta.GeminiOptions{
			ThinkingAdapterEnabled: true,
		},
	},
}
```

| 选项 | 作用 |
|---|---|
| `Claude.DefaultMaxTokens` | 源请求没有 max_tokens 时，转 Claude 用这个函数取值 |
| `Claude.ThinkingAdapterEnabled`、`Gemini.ThinkingAdapterEnabled` | 模型名尾缀适配开关，见下文 |
| `Claude.ThinkingAdapterBudgetTokensPercentage`、`Gemini.ThinkingAdapterBudgetTokensPercentage` | 尾缀适配触发时，thinking budget 占 max_tokens 的比例 |
| `Claude.WebSearchToolVersion` | 转 Claude 时 web search 工具的版本，空值用 `web_search_20250305` |
| `Gemini.FunctionCallThoughtSignatureEnabled` | 给 function call 部分附加 thoughtSignature |
| `Gemini.SupportsImagine` | 判断模型是否支持生图，支持时切换响应模态 |
| `Gemini.SafetySetting` | 按分类返回 safetySettings 的阈值 |
| `ToolLossPolicy` | 跨协议丢失工具行为时的处理，见下文 |
| `OpenRouterDialect` | 上游是 OpenRouter 时打开，转换器会输出它额外接受的字段 |
| `WebSearch` | 为某个上游改写托管 web search 的编码 |
| `PreserveThinkingSuffix`、`PreserveEffortTail` | 判断哪些模型名要原样保留尾缀 |

转 Claude 时请求需要 `max_tokens`。源请求没有时，RelayKit 调用 `Claude.DefaultMaxTokens` 取值，两者都没有时返回错误。

RelayKit 按请求里的 `Model` 生成上游请求，调用前把它设成上游使用的模型名。带 `-thinking`、`-nothinking`、`-thinking-<budget>` 或 `-high` 这类尾缀的 Claude、Gemini 模型名由调用方在转换前解析：调用 `reasoning.ParseClaudeModelSuffix` 或 `reasoning.ParseGeminiModelSuffix`，`allowSuffixAlias` 参数传 `ThinkingAdapterEnabled`，把返回的 `Intent` 用 `reasoning.StateFromIntent` 写进 `Values.ReasoningConversion`，再把裁掉尾缀的模型名放进请求。开关关闭时这两个函数原样返回模型名，推理设置来自请求字段。

## 诊断与损耗策略

每个转换结果都带 `Diagnostics`，每条诊断有代码、字段路径、说明、级别和源目标格式。级别 `warning` 表示展示层面的差异，`error` 表示工具行为或内容发生了变化。常见代码有 `hosted_web_search_omitted`、`trailing_assistant_omitted` 和 `unsupported_media_type`。

`Options.ToolLossPolicy` 决定请求阶段怎么处理诊断：

- `allow` 是默认值，转换完成，所有损耗以诊断返回。
- `safe` 在请求阶段遇到 `error` 级诊断时返回 `*types.ConversionLossError`。
- `strict` 在请求阶段遇到任何诊断都返回这个错误。

响应和流式转换在三种策略下都完成转换并返回诊断。流式用 `state.Diagnostics()` 读到目前为止累计的诊断，包括没有产生下游事件的那些。

## 媒体解析

跨协议的图片转换有时需要下载 URL 内容或解析 data URL。宿主在启动时注册解析函数：

```go
relayconvert.SetMediaResolver(relayconvert.MediaResolver{
	GetBase64Data:        getBase64Data,
	DecodeBase64FileData: decodeBase64FileData,
})
```

两个函数的签名见 `relayconvert.MediaResolver`。需要媒体解析而没有注册时，转换返回错误。网络请求由这两个函数发起。

## 转换结果

请求转换返回 `relayconvert.RequestResult`，响应转换返回 `relayconvert.ResponseResult`，字段有：

- `Value`：转换后的 DTO
- `From`、`To`：源格式和目标格式
- `Converter`：转换器 ID
- `Quality`：质量等级
- `Steps`：实际经过的每一步
- `Diagnostics`：诊断列表
- `Usage`、`Stream`：响应结果独有，统一 usage 和是否来自流式转换

## 开发

在 `relaykit` 目录运行：

```bash
GOWORK=off go build ./...
GOWORK=off go test ./...
```

`GOWORK=off` 让模块脱离仓库的 workspace 单独构建，这是 new-api 对 RelayKit 改动的检查项。转换矩阵由 golden test 覆盖，协议输出变化确认是预期行为后更新快照：

```bash
GOWORK=off go test ./relayconvert -run TestGolden -update
```

## 版本

RelayKit 处于 `v0.x`。公开 API 和 DTO 可能在小版本里变化，升级前对照发布说明和序列化结果。每对协议都有对方没有的字段，建议对业务里用到的工具调用、多模态、推理和流式场景加端到端测试。

## 许可证

RelayKit 是 new-api 项目的一部分，遵循项目根目录中的 [GNU Affero General Public License v3.0](../LICENSE)。
