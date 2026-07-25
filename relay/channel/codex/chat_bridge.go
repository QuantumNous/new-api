package codex

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
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
// isCompact=true 时额外移除 compact 端点实测不接受的 sampling/tool-limit 字段。
// prompt_cache_options 在 responses 与 compact 两条 Codex 路径都会被真实上游拒绝，
// 因此仅在 Codex adaptor 层过滤；DTO 仍保留该字段供其他 provider 使用。
//
// 注：本函数不修改 store/stream。store 由调用方决定（compact 删除整个键），
// stream 在非 compact 路径必须保留客户端原意图。
func applyCodexConstraintsToMap(body map[string]any, info *relaycommon.RelayInfo, isCompact bool) {
	if body == nil {
		return
	}

	// 1) 禁字段（与 sub2api 对齐的完整名单）。
	bannedAlways := []string{
		"frequency_penalty", "presence_penalty",
		"user", "metadata", "stream_options",
		"prompt_cache_options", "prompt_cache_retention", "safety_identifier",
	}
	for _, k := range bannedAlways {
		delete(body, k)
	}
	unsupported := []string{
		"max_output_tokens", "max_completion_tokens",
		"temperature", "top_p",
	}
	if isCompact {
		unsupported = append(unsupported, "max_tool_calls", "top_logprobs")
	}
	for _, k := range unsupported {
		delete(body, k)
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
	helper.SetEventStreamHeaders(c)
	_, _ = c.Writer.WriteString(sse)
	_ = helper.FlushWriter(c)
}

func codexResponseFailedError(evt *apicompat.ResponsesStreamEvent, skipRetry bool) *types.NewAPIError {
	message := "codex upstream response failed"
	if evt != nil {
		if evt.Response != nil && evt.Response.Error != nil {
			switch {
			case strings.TrimSpace(evt.Response.Error.Message) != "":
				message = evt.Response.Error.Message
			case strings.TrimSpace(evt.Response.Error.Code) != "":
				message = evt.Response.Error.Code
			}
		} else if strings.TrimSpace(evt.Code) != "" {
			message = evt.Code
		}
	}
	if skipRetry {
		return types.NewOpenAIError(errors.New(message), types.ErrorCodeBadResponse, http.StatusInternalServerError, types.ErrOptionWithSkipRetry())
	}
	return types.NewOpenAIError(errors.New(message), types.ErrorCodeBadResponse, http.StatusInternalServerError)
}

func codexStreamProtocolError(err error, skipRetry bool) *types.NewAPIError {
	message := "codex upstream stream ended before a terminal event"
	if err != nil {
		message = fmt.Sprintf("codex upstream stream error: %v", err)
	}
	if skipRetry {
		return types.NewOpenAIError(errors.New(message), types.ErrorCodeBadResponse, http.StatusBadGateway, types.ErrOptionWithSkipRetry())
	}
	return types.NewOpenAIError(errors.New(message), types.ErrorCodeBadResponse, http.StatusBadGateway)
}

func writeOpenAIStreamError(c *gin.Context, apiErr *types.NewAPIError) {
	if c == nil || c.Writer == nil || apiErr == nil {
		return
	}
	openAIError := apiErr.ToOpenAIError()
	openAIError.Type = "upstream_error"
	openAIError.Param = ""
	openAIError.Code = strconv.Itoa(apiErr.StatusCode)
	if requestID := c.GetString(common.RequestIdKey); requestID != "" {
		openAIError.Message = common.MessageWithRequestId(openAIError.Message, requestID)
	}
	payload, err := common.Marshal(gin.H{"error": openAIError})
	if err != nil {
		return
	}
	writeSSE(c, fmt.Sprintf("data: %s\n\n", payload))
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
	// Fix 6 (Sweep-1): 把客户端的 stream_options.include_usage 透传到流式 chunk 发生器；
	// 没有这一行时即使客户端要求 usage chunk，bridge 也只会发普通 delta，结算上游需要的
	// usage payload 永远不会作为额外 chunk 抵达客户端。
	if info != nil {
		state.IncludeUsage = info.ShouldIncludeUsage
	}
	// Fix 8 (Finding J): 给流式 chunk 一个稳定的 model 名称。
	// Codex 上游 response.created 通常不携带 "model" 字段（与官方 Responses 不同），
	// 导致 state.Model 一直为空，每个 chat chunk 的 "model" 字段也是空字符串，破坏
	// OpenAI 兼容性。用 info.UpstreamModelName 作为起始值；若上游后续真的下发了 model
	// 仍然会被 resToChatHandleCreated 中的 "state.Model == "" " 守卫保留我们的值，
	// 但显式赋值是为了即便上游不发也始终有值。
	if info != nil && info.ChannelMeta != nil && info.UpstreamModelName != "" {
		state.Model = info.UpstreamModelName
	}
	acc := apicompat.NewBufferedResponseAccumulator()
	var lastUsage *apicompat.ResponsesUsage
	// Fix 7 (Sweep-2): 缓存最后一个 terminal 事件的 Response，便于非流式分支
	// 把真实的 status / incomplete_details 透传给上层，而不是硬编码 "completed"。
	var lastTerminal *apicompat.ResponsesResponse

	streamToClient := info != nil && info.UserWantsStream

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	var dataLines []string
	var pendingPrelude []string
	var terminalSeen bool
	var terminalErr *types.NewAPIError

	flushPendingPrelude := func() {
		for _, sse := range pendingPrelude {
			writeSSE(c, sse)
		}
		pendingPrelude = nil
	}

	// flushEvent returns true when a terminal event has been consumed.
	flushEvent := func() bool {
		if len(dataLines) == 0 {
			return false
		}
		payload := strings.Join(dataLines, "\n")
		dataLines = dataLines[:0]
		evt := &apicompat.ResponsesStreamEvent{}
		if err := common.Unmarshal([]byte(payload), evt); err != nil {
			return false
		}

		acc.ProcessEvent(evt)
		isTerminal := evt.Type == "response.completed" ||
			evt.Type == "response.done" ||
			evt.Type == "response.failed" ||
			evt.Type == "response.incomplete"
		if isTerminal && evt.Response != nil {
			if evt.Response.Usage != nil {
				lastUsage = evt.Response.Usage
			}
			lastTerminal = evt.Response
		}

		isFailed := evt.Type == "response.failed" ||
			(evt.Response != nil && evt.Response.Status == "failed")
		if isFailed {
			terminalSeen = true
			written := c != nil && c.Writer != nil && c.Writer.Written()
			terminalErr = codexResponseFailedError(evt, written)
			pendingPrelude = nil
			if streamToClient && written {
				writeOpenAIStreamError(c, terminalErr)
			}
			return true
		}

		if streamToClient {
			chunks := apicompat.ResponsesEventToChatChunks(evt, state)
			serialized := make([]string, 0, len(chunks))
			for _, chunk := range chunks {
				if sse, err := apicompat.ChatChunkToSSE(chunk); err == nil {
					serialized = append(serialized, sse)
				}
			}
			if evt.Type == "response.created" {
				pendingPrelude = append(pendingPrelude, serialized...)
			} else if len(serialized) > 0 {
				flushPendingPrelude()
				for _, sse := range serialized {
					writeSSE(c, sse)
				}
			}
		}

		if isTerminal {
			terminalSeen = true
			return true
		}
		return false
	}

	stop := false
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			if flushEvent() {
				stop = true
				break
			}
			continue
		}
		if strings.HasPrefix(line, "data:") {
			dataLines = append(dataLines, strings.TrimSpace(strings.TrimPrefix(line, "data:")))
		}
	}
	if !stop {
		_ = flushEvent()
	}

	if terminalErr != nil {
		return buildUsage(lastUsage), terminalErr
	}
	if scanErr := scanner.Err(); scanErr != nil {
		common.SysError(fmt.Sprintf("codex chat bridge: SSE scan error: %v", scanErr))
		written := c != nil && c.Writer != nil && c.Writer.Written()
		apiErr := codexStreamProtocolError(scanErr, written)
		pendingPrelude = nil
		if streamToClient && written {
			writeOpenAIStreamError(c, apiErr)
		}
		return buildUsage(lastUsage), apiErr
	}
	if !terminalSeen {
		written := c != nil && c.Writer != nil && c.Writer.Written()
		apiErr := codexStreamProtocolError(nil, written)
		pendingPrelude = nil
		if streamToClient && written {
			writeOpenAIStreamError(c, apiErr)
		}
		return buildUsage(lastUsage), apiErr
	}

	if streamToClient {
		flushPendingPrelude()
		writeSSE(c, "data: [DONE]\n\n")
	} else {
		full := &apicompat.ResponsesResponse{}
		acc.SupplementResponseOutput(full)
		// Fix 7 (Sweep-2): 把真实的上游 status / incomplete_details 透传给
		// ResponsesToChatCompletions，让 finish_reason 能正确反映 length 截断等场景
		// （否则 incomplete + max_output_tokens 永远被压成 stop）。
		if lastTerminal != nil {
			full.Status = lastTerminal.Status
			full.IncompleteDetails = lastTerminal.IncompleteDetails
			full.Error = lastTerminal.Error
		} else {
			full.Status = "completed"
		}
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
			CachedTokens:     u.InputTokensDetails.CachedTokens,
			CacheWriteTokens: u.InputTokensDetails.CacheWriteTokens,
		}
		// 同步指针字段，方便下游 reasoning/responses 链路读取
		out.InputTokensDetails = &dto.InputTokenDetails{
			CachedTokens:     u.InputTokensDetails.CachedTokens,
			CacheWriteTokens: u.InputTokensDetails.CacheWriteTokens,
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
