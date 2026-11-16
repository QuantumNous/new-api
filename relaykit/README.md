# RelayKit

RelayKit is a Go module that converts requests, non-streaming responses, and streaming events between four protocols: OpenAI Chat Completions, OpenAI Responses, Anthropic Messages, and Gemini `generateContent`.

It is detached from [new-api](https://github.com/QuantumNous/new-api), the module path is `github.com/QuantumNous/new-api/relaykit`, and the runtime dependencies are the four packages uuid, lo, gjson and sjson. It models and converts protocol data. HTTP sending and receiving, SSE reading and writing, channel selection, authentication and accounting are completed by the host program, so it can be embedded in other Go gateways or proxies.

## Support matrix

Each of the four protocols can be converted, and requests, non-streaming responses and streaming responses cover the same table:

| Source Format \ Target Format | OpenAI Chat | OpenAI Responses | Claude Messages | Gemini |
|---|---:|---:|---:|---:|
| OpenAI Chat | | `good` | `fair` | `fair` |
| OpenAI Responses | `good` | | `fair` | `fair` |
| Claude Messages | `fair` | `fair` | | `discouraged` |
| Gemini | `fair` | `fair` | `discouraged` | |

`good` means that the structures of the two protocols are close and the fields are basically one-to-one correspondence. `fair` indicates that the main content can be transferred, and the fields unique to the protocol are reported in diagnostics. Among them, the requests and responses from Gemini to Responses, the responses from Claude to Responses, and the responses from Responses to Gemini are transferred through OpenAI Chat. `discouraged` means that requests and responses between Claude and Gemini are transferred through OpenAI Chat for two hops, and there are more opportunities to lose fields. The actual path is in `Steps` of the conversion result, and the level is in `Quality`.

## Function

### Automatic route selection

`ConvertRequest` and `ConvertResponse` determine the source protocol based on the specific type of the incoming DTO, and `NewResponseStreamState` looks up the table to select a direct converter or multi-hop path based on the source format and target format in the parameters. The results include the source format, target format, converter ID, quality level, actual steps taken and a list of diagnostics. Use `ConvertRequestVia` when you want to fix the path, and use `ConvertRequestByID`, `ConvertResponseByID` and `NewResponseStreamStateByID` when you want to execute by ID.

### Tool call

Function tool definitions, calls, and results are converted between the four protocols. Responses' custom tools and tools with namespace are changed to ordinary function tools when sent to the upstream of Chat, Claude, and Gemini. The encoding method is recorded in `convmeta.ResponsesToolState`. During response conversion, this record is used to restore the shape of Responses. Hosted web search is recoded according to the target protocol: Chat uses `web_search_options`, Responses, Claude, and Gemini are each defined by web search tools of their own protocols. The host can rewrite the encoding for an upstream through `Options.WebSearch`. For parts that other hosting tools cannot express in the target protocol, the conversion is completed as usual, and the missing parts are written into the diagnosis.

### Inference settings

Reasoning effort, thinking budget, and whether to return thinking content are passed between conversion steps using `dto.ReasoningConversionState`. The precise budget and effort can be read at each step on the multi-hop path. Claude's max_tokens and budget are adjusted when they exceed the model range, Gemini's thinkingConfig is normalized by the model, and these changes are returned as diagnostics, such as `claude_max_tokens_raised` and `claude_budget_adjusted`.

### Multimodal

Image and file content blocks are converted between protocols. When it is necessary to download a URL or parse a data URL, RelayKit calls the function registered by the host with `SetMediaResolver`. If it is not registered, the conversion returns an error.

### Usage

Each response transformation returns a uniform `dto.Usage` with input, output, cache hits, and a 5-minute and 1-hour split of Claude cache writes. `Usage.BillingUsage` also carries the upstream original usage structure and the protocol it comes from. The host can bill according to the upstream metering rules. Streaming conversion accumulates usage scattered across multiple events into `ResponseStreamState`. `dto.MergeUsageNonZero` When a type of function merges two usages, the non-zero field that arrives later overwrites the existing value, and the zero value that arrives later retains the existing count.

### Streaming

Each upstream stream corresponds to an `ResponseStreamState`, and cross-event tool call splicing, usage and end status are stored here. `FinalizeStreamResponse` is called after the upstream is completed, and the converter reissues the termination event and final usage in this step. When the target is Responses, if an error occurs in the upstream, you can call `FailResponsesStream` to generate an error event of the Responses protocol. After `ResponseStreamOptions.EmitSequenceNumber` is turned on, each event will contain `sequence_number`.

### Host hook

JSON encoding and decoding uses `encoding/json` by default. The host can use `kitutil.SetCodec` to change to other implementations at startup. The customized `MarshalJSON` and `UnmarshalJSON` on the DTO also use the same codec. Logs with abnormal data shape are sent to the host through `kitutil.SetLogging` and `kitutil.SetSystemErrorLogging`, and are written to stderr by default.

## Installation

RelayKit requires Go 1.25.1 or higher. The form of tag is `relaykit/vX.Y.Z`, `@latest` is parsed to the latest one.

```bash
go get github.com/QuantumNous/new-api/relaykit@latest
```

| Package | Contents |
|---|---|
| `relaykit/dto` | The request, response, streaming event and usage structures of the four protocols, as well as the channel, pricing and user settings structures shared by the new-api host |
| `relaykit/types` | Sharing types such as protocol format, errors, diagnostics, file sources, etc. |
| `relaykit/relayconvert` | Request, response and streaming conversion portal |
| `relaykit/relayconvert/convmeta` | Transformation context interface `Meta`, default implementation `Values`, and options `Options` |
| `relaykit/relayconvert/reasoning` | Parsing, merging and rendering of inference settings, including model name suffix parsing |
| `relaykit/relayconvert/kitutil` | JSON encoding and decoding and logging hooks |
| `relaykit/reasonmap` | Ending reason mapping between Claude and OpenAI |

## Quick start

Next, convert the OpenAI Chat Completions request into a Claude Messages request:

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

`ConvertRequest` Infers the source format by the specific DTO type requested. Returns an error when nil, raw JSON, `map[string]any`, or other types are passed in.

### Non-streaming response

Response conversion uses the same set of target format parameters:

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

Supported response DTOs:

| Format | Non-Streaming Response | Streaming Event |
|---|---|---|
| OpenAI Chat | `dto.OpenAITextResponse` | `dto.ChatCompletionsStreamResponse` |
| OpenAI Responses | `dto.OpenAIResponsesResponse` | `dto.ResponsesStreamResponse` |
| Claude Messages | `dto.ClaudeResponse` | `dto.ClaudeResponse` |
| Gemini | `dto.GeminiChatResponse` | `dto.GeminiChatResponse` |

### Streaming response

Each upstream stream creates an `ResponseStreamState`, and calls `FinalizeStreamResponse` after the upstream ends:

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

The reading and writing of SSE is completed by the host: each upstream event is parsed into the corresponding DTO and passed in, and then the conversion result is encoded and sent to the downstream. `FinalizeStreamResponse` must be called for each stream. Some converters reissue the termination event and final usage at this step.

##Convert context

`nil` can be passed as the `convmeta.Meta` parameter for most basic transformations. When you need a model name, inference settings, tool encoding records, or streaming state, use `convmeta.Values`, or implement `convmeta.Meta` in the host. When implementing it yourself, each method of the pointer type must be able to return a zero value on the nil receiver. The reason is written in the interface annotation.

Options passed in by request are placed in `convmeta.Options`:

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

| Options | Function |
|---|---|
| `Claude.DefaultMaxTokens` | When the source request does not have max_tokens, turn to Claude and use this function to get the value |
| `Claude.ThinkingAdapterEnabled`, `Gemini.ThinkingAdapterEnabled` | Model name suffix adaptation switch, see below |
| `Claude.ThinkingAdapterBudgetTokensPercentage`, `Gemini.ThinkingAdapterBudgetTokensPercentage` | When tailfix adaptation is triggered, the ratio of thinking budget to max_tokens |
| `Claude.WebSearchToolVersion` | The version of the web search tool when converting to Claude, use `web_search_20250305` for empty values |
| `Gemini.FunctionCallThoughtSignatureEnabled` | Attach thoughtSignature to the function call part |
| `Gemini.SupportsImagine` | Determine whether the model supports drawing, and switch the response mode if it supports |
| `Gemini.SafetySetting` | Return the threshold of safetySettings by category |
| `ToolLossPolicy` | Handling when tool behavior is lost across protocols, see below |
| `OpenRouterDialect` | Opened when the upstream is OpenRouter, the converter will output the additional fields it accepts |
| `WebSearch` | Rewrite the encoding of a hosted web search for an upstream |
| `PreserveThinkingSuffix`, `PreserveEffortTail` | Determine which model names should keep the suffix as they are |

The request requires `max_tokens` when transferring to Claude. When the source request does not exist, RelayKit calls `Claude.DefaultMaxTokens` to get the value. If neither of them exists, an error is returned.

RelayKit generates an upstream request based on `Model` in the request, and sets it to the model name used by the upstream before calling. Claude and Gemini model names with suffixes such as `-thinking`, `-nothinking`, `-thinking-<budget>` or `-high` are parsed by the caller before conversion: call `reasoning.ParseClaudeModelSuffix` or `reasoning.ParseGeminiModelSuffix`, pass the `allowSuffixAlias` parameter to `ThinkingAdapterEnabled`, and return the `Intent` uses `reasoning.StateFromIntent` to write `Values.ReasoningConversion`, and then puts the model name with the suffix cut off into the request. When the switch is off, these two functions return the model name unchanged, with the inferred settings coming from the request fields.

## Diagnosis and attrition strategies

Each conversion result comes with `Diagnostics`, and each diagnosis has a code, field path, description, level, and source target format. Level `warning` indicates a presentation-level difference, and `error` indicates a change in tool behavior or content. Common codes are `hosted_web_search_omitted`, `trailing_assistant_omitted`, and `unsupported_media_type`.

`Options.ToolLossPolicy` determines how diagnostics are handled during the request phase:

- `allow` is the default value, conversion is completed and all losses are returned with diagnostics.
- `safe` Returns `*types.ConversionLossError` when an `error` level diagnostic is encountered during the request phase.
- `strict` returns this error for any diagnostics encountered during the request phase.

Response and streaming conversions complete the conversion and return diagnostics under all three strategies. Streaming uses `state.Diagnostics()` to read the accumulated diagnostics so far, including those that did not generate downstream events.

## Media analysis

Cross-protocol image conversion sometimes requires downloading URL content or parsing data URLs. The host registers the parsing function at startup:

```go
relayconvert.SetMediaResolver(relayconvert.MediaResolver{
	GetBase64Data:        getBase64Data,
	DecodeBase64FileData: decodeBase64FileData,
})
```

See `relayconvert.MediaResolver` for the signatures of both functions. The conversion returns an error when media resolution is required but not registered. Network requests are initiated by these two functions.

## Conversion result

The request conversion returns `relayconvert.RequestResult`, and the response conversion returns `relayconvert.ResponseResult`. The fields are:

- `Value`: Converted DTO
- `From`, `To`: source format and target format
- `Converter`: converter ID
- `Quality`: quality level
- `Steps`: every step actually passed
- `Diagnostics`: diagnostic list
- `Usage`, `Stream`: the response results are unique, unified usage and whether they come from streaming conversion

## Development

Run in the `relaykit` directory:

```bash
GOWORK=off go build ./...
GOWORK=off go test ./...
```

`GOWORK=off` allows the module to be built separately from the workspace of the warehouse. This is a check item of new-api for RelayKit changes. The transformation matrix is covered by golden test, and the snapshot is updated after the protocol output changes are confirmed to be expected behavior:

```bash
GOWORK=off go test ./relayconvert -run TestGolden -update
```

## Version

RelayKit is at `v0.x`. The public API and DTO may change in minor versions. Please refer to the release notes and serialization results before upgrading. Each pair of protocols has fields that the other does not have. It is recommended to add end-to-end testing for tool calls, multi-modal, reasoning and streaming scenarios used in the business.

## License

RelayKit is part of the new-api project and complies with the [GNU Affero General Public License v3.0](../LICENSE) in the project root directory.
