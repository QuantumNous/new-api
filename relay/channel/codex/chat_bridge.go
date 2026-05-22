package codex

import (
	"bufio"
	"fmt"
	"io"
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

// ensureInstructionsField 保证上游 JSON body 包含 "instructions" key（Codex 后端硬性要求）。
// 由于 apicompat.ResponsesRequest.Instructions 是 string + omitempty，空字符串会被直接省略，
// 因此在序列化为 JSON 之后通过 map 注入空字符串。返回的 map 由 relay 层做最终序列化。
func ensureInstructionsField(req *apicompat.ResponsesRequest) (map[string]any, error) {
	raw, err := common.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal ResponsesRequest: %w", err)
	}
	m := map[string]any{}
	if err := common.Unmarshal(raw, &m); err != nil {
		return nil, fmt.Errorf("unmarshal to map: %w", err)
	}
	if _, ok := m["instructions"]; !ok {
		m["instructions"] = ""
	}
	return m, nil
}

// applyCodexConstraintsToMap 在已解析的 map 请求体上套用 Codex 后端约束。
// 走 map 而不是 apicompat.ResponsesRequest 的原因是：apicompat 类型是
// dto.OpenAIResponsesRequest 的严格子集，如果走 typed roundtrip，会丢掉 ~13 个
// dto 独有字段（Conversation/ContextManagement/Truncation/MaxToolCalls/Prompt/...），
// 同时还会因 dto.Instructions 是 json.RawMessage 而上游 apicompat 是 string 而炸掉。
//
// preserveSampling=true 时（compact 路径）保留 Temperature/TopP/MaxOutputTokens，
// 但仍会移除 user/metadata/stream_options 等 Codex 后端禁字段。
//
// 注：本函数不修改 store/stream。store 由调用方决定（compact 删除整个键），
// stream 在非 compact 路径必须保留客户端原意图。
func applyCodexConstraintsToMap(body map[string]any, info *relaycommon.RelayInfo, preserveSampling bool) {
	if body == nil {
		return
	}

	// 1) 禁字段（与 sub2api 对齐的完整名单）。
	bannedAlways := []string{
		"frequency_penalty", "presence_penalty",
		"user", "metadata", "stream_options",
		"prompt_cache_retention", "safety_identifier",
	}
	for _, k := range bannedAlways {
		delete(body, k)
	}
	if !preserveSampling {
		// chat bridge / 非 compact /v1/responses 都不接受 sampling 字段。
		for _, k := range []string{
			"max_output_tokens", "max_completion_tokens",
			"temperature", "top_p",
		} {
			delete(body, k)
		}
	}

	// 2) instructions 注入（与 applyCodexConstraints 行为对齐）。
	systemPrompt := ""
	override := false
	if info != nil {
		systemPrompt = info.ChannelSetting.SystemPrompt
		override = info.ChannelSetting.SystemPromptOverride
	}
	if systemPrompt != "" {
		existing, _ := body["instructions"].(string)
		switch {
		case strings.TrimSpace(existing) == "":
			body["instructions"] = systemPrompt
		case override:
			body["instructions"] = systemPrompt + "\n" + existing
		}
	}
	if _, ok := body["instructions"]; !ok {
		body["instructions"] = ""
	}
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
		// 上层一般会预过滤非 2xx，但本函数仍需带上 body 以便排障。
		body, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		// 必须同时保留 HTTP 状态码，否则上层重试 / 限流策略会失去信号
		// （如 429/5xx 不再触发应有的退避或切换上游）。
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("codex upstream status %d: %s", resp.StatusCode, string(body)),
			types.ErrorCodeBadResponse,
			resp.StatusCode,
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

	// 按 SSE 规范累积一个事件内的多行 data:，事件之间以空行分隔
	var dataLines []string
	flushEvent := func() {
		if len(dataLines) == 0 {
			return
		}
		payload := strings.Join(dataLines, "\n")
		dataLines = dataLines[:0]
		evt := &apicompat.ResponsesStreamEvent{}
		if err := common.Unmarshal([]byte(payload), evt); err == nil {
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
	}

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			flushEvent()
			continue
		}
		if strings.HasPrefix(line, "data:") {
			dataLines = append(dataLines, strings.TrimSpace(strings.TrimPrefix(line, "data:")))
		}
		// event: 行忽略——事件类型同样存在于 data JSON 里
	}
	flushEvent()

	// 扫描错误（包括单行超过 1MB 缓冲、上游中断等）需要落日志，避免静默丢数据
	if err := scanner.Err(); err != nil {
		common.SysError(fmt.Sprintf("codex chat bridge: SSE scan error: %v", err))
	}

	if streamToClient {
		for _, chunk := range apicompat.FinalizeResponsesChatStream(state) {
			if sse, err := apicompat.ChatChunkToSSE(chunk); err == nil {
				writeSSE(c, sse)
			}
		}
		// 终止行也是 "data: [DONE]\n\n"
		writeSSE(c, "data: [DONE]\n\n")
	} else {
		full := &apicompat.ResponsesResponse{}
		acc.SupplementResponseOutput(full)
		full.Status = "completed"
		// 上游通过 SSE 增量返回 usage，聚合在 lastUsage 里；
		// ResponsesToChatCompletions 依赖 ResponsesResponse.Usage 才能在 JSON body 中输出 usage 字段。
		full.Usage = lastUsage
		upstreamModel := ""
		if info != nil && info.ChannelMeta != nil {
			upstreamModel = info.UpstreamModelName
		}
		chatResp := apicompat.ResponsesToChatCompletions(full, upstreamModel)
		c.JSON(http.StatusOK, chatResp)
	}

	return buildUsage(lastUsage), nil
}

// buildUsage 把 Responses API 返回的 usage 翻译成 new-api 的 *dto.Usage。
// 始终返回 non-nil *dto.Usage：上游缺失 usage 事件时返回零值占位，避免调用方
// （relay/compatible_handler.go 等）对 nil 接口做类型断言时 panic。
func buildUsage(u *apicompat.ResponsesUsage) any {
	out := &dto.Usage{}
	if u == nil {
		return out
	}
	out.PromptTokens = u.InputTokens
	out.CompletionTokens = u.OutputTokens
	out.TotalTokens = u.TotalTokens
	out.InputTokens = u.InputTokens
	out.OutputTokens = u.OutputTokens
	if out.TotalTokens == 0 && (out.PromptTokens != 0 || out.CompletionTokens != 0) {
		out.TotalTokens = out.PromptTokens + out.CompletionTokens
	}
	if u.InputTokensDetails != nil {
		out.PromptTokensDetails = dto.InputTokenDetails{
			CachedTokens: u.InputTokensDetails.CachedTokens,
		}
		// 同步指针字段，方便下游 reasoning/responses 链路读取
		out.InputTokensDetails = &dto.InputTokenDetails{
			CachedTokens: u.InputTokensDetails.CachedTokens,
		}
		if u.InputTokensDetails.CachedTokens > 0 {
			out.PromptCacheHitTokens = u.InputTokensDetails.CachedTokens
		}
	}
	if u.OutputTokensDetails != nil {
		out.CompletionTokenDetails = dto.OutputTokenDetails{
			ReasoningTokens: u.OutputTokensDetails.ReasoningTokens,
		}
	}
	return out
}
