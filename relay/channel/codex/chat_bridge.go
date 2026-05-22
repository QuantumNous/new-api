package codex

import (
	"bufio"
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/apicompat"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// ToCompatChatRequest 把 new-api 的 *dto.GeneralOpenAIRequest 转成
// apicompat 的 ChatCompletionsRequest。通过一次 JSON 中转：双方的字段命名
// 都遵循 OpenAI 官方 JSON tag，能直接相互序列化对接。
func ToCompatChatRequest(req *dto.GeneralOpenAIRequest) (*apicompat.ChatCompletionsRequest, error) {
	if req == nil {
		return nil, fmt.Errorf("ToCompatChatRequest: nil request")
	}
	raw, err := common.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("ToCompatChatRequest: marshal dto: %w", err)
	}
	out := &apicompat.ChatCompletionsRequest{}
	if err := common.Unmarshal(raw, out); err != nil {
		return nil, fmt.Errorf("ToCompatChatRequest: unmarshal compat: %w", err)
	}
	return out, nil
}

// applyCodexConstraints 把 Codex 后端的硬性限制套到一个 Responses 请求体上：
//   - 强制 store=false、stream=true
//   - 清空 Codex 不接受的字段（与 sub2api 对齐的完整名单）
//   - 注入 instructions（按 channel 设置或保留客户端原值；不再用 JSON 字面量包裹，
//     因为 apicompat.ResponsesRequest.Instructions 是 string 类型）
//
// 这个函数是 ChatCompletions 入口和原 Responses 入口的共享钳制点。
func applyCodexConstraints(req *apicompat.ResponsesRequest, info *relaycommon.RelayInfo) {
	if req == nil {
		return
	}
	// 1) 禁字段（其他禁字段如 frequency_penalty / presence_penalty / user / metadata /
	// prompt_cache_retention / safety_identifier / stream_options 在 apicompat.ResponsesRequest
	// 上没有对应字段，apicompat.ChatCompletionsToResponses 已过滤）
	req.MaxOutputTokens = nil
	req.Temperature = nil
	req.TopP = nil

	// 2) 强制 store=false、stream=true
	storeFalse := false
	req.Store = &storeFalse
	req.Stream = true

	// 3) instructions
	systemPrompt := ""
	override := false
	if info != nil {
		systemPrompt = info.ChannelSetting.SystemPrompt
		override = info.ChannelSetting.SystemPromptOverride
	}

	if systemPrompt != "" {
		existing := strings.TrimSpace(req.Instructions)
		switch {
		case existing == "":
			req.Instructions = systemPrompt
		case override:
			req.Instructions = systemPrompt + "\n" + existing
		}
	}
	// 不再补默认空字符串：apicompat.ResponsesRequest.Instructions 的 json tag 为
	// `omitempty`，空字符串会被自然省略。Codex 后端要求出现该字段时，由调用方
	// 在序列化之后做 raw JSON 注入或迁就上游约定。
}

// writeSSE 将 apicompat.ChatChunkToSSE 生成的整段 SSE 数据原样写到客户端。
// 不能用 helper.StringData：后者会再追加一次 "data: " 前缀。
func writeSSE(c *gin.Context, sse string) {
	if c == nil || c.Writer == nil {
		return
	}
	_, _ = c.Writer.WriteString(sse)
	_ = helper.FlushWriter(c)
}

// RelayChatOverCodex 接收 Codex 上游返回的 Responses SSE 流，并按客户端的
// stream 意图（info.UserWantsStream）选择回写形式：
//   - true:  逐事件转换为 Chat Completions SSE chunk，并以 [DONE] 结束
//   - false: 聚合所有 delta 后一次性返回 ChatCompletionsResponse JSON
//
// 返回值 usage 满足 BillingSettler 后续结算需要。
func RelayChatOverCodex(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (any, *types.NewAPIError) {
	if resp == nil {
		return nil, types.NewError(fmt.Errorf("codex upstream: nil response"), types.ErrorCodeBadResponse)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, types.NewError(
			fmt.Errorf("codex upstream status %d", resp.StatusCode),
			types.ErrorCodeBadResponse,
		)
	}
	defer func() { _ = resp.Body.Close() }()

	state := apicompat.NewResponsesEventToChatState()
	acc := apicompat.NewBufferedResponseAccumulator()
	var lastUsage *apicompat.ResponsesUsage

	streamToClient := info != nil && info.UserWantsStream
	if streamToClient {
		helper.SetEventStreamHeaders(c)
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	var dataLine string
	flushEvent := func() {
		if dataLine == "" {
			return
		}
		evt := &apicompat.ResponsesStreamEvent{}
		if err := common.Unmarshal([]byte(dataLine), evt); err == nil {
			acc.ProcessEvent(evt)
			if (evt.Type == "response.completed" || evt.Type == "response.done") && evt.Response != nil && evt.Response.Usage != nil {
				lastUsage = evt.Response.Usage
			}
			if streamToClient {
				for _, chunk := range apicompat.ResponsesEventToChatChunks(evt, state) {
					if sse, err := apicompat.ChatChunkToSSE(chunk); err == nil {
						writeSSE(c, sse)
					}
				}
			}
		}
		dataLine = ""
	}

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			flushEvent()
			continue
		}
		if strings.HasPrefix(line, "data:") {
			dataLine = strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		}
		// event: 行忽略——事件类型同样存在于 data JSON 里
	}
	flushEvent()

	if streamToClient {
		for _, chunk := range apicompat.FinalizeResponsesChatStream(state) {
			if sse, err := apicompat.ChatChunkToSSE(chunk); err == nil {
				writeSSE(c, sse)
			}
		}
		// 终止行也是 "data: [DONE]\n\n"
		writeSSE(c, "data: [DONE]\n\n")
	} else {
		// Task 8 将在此实现非流式聚合
	}

	return buildUsage(lastUsage, info), nil
}

// buildUsage placeholder; Task 9 将替换为 *dto.Usage 映射
func buildUsage(u *apicompat.ResponsesUsage, info *relaycommon.RelayInfo) any {
	_ = u
	_ = info
	return nil
}
