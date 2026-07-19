package openai

// Responses API SSE fallback: synthesize a terminal event when the upstream
// stream closes without ever emitting response.completed / response.failed /
// response.incomplete.
//
// Background: the OpenAI Codex CLI (and openai-python helpers) treat the
// absence of a terminal event as a hard error ("stream disconnected before
// completion: stream closed before response.completed"), then retry the turn
// up to 5 times. Reasoning-heavy models (gpt-5.x family) are the most
// affected because long silent reasoning windows are easy targets for
// gateway-level idle timeouts. When the upstream forgets to emit a terminal
// event (a known OpenAI bug — codex#3267, codex#14753), or when we ourselves
// have to cut the connection (STREAMING_TIMEOUT, scanner error, ping fail),
// we synthesize one so the client gets a clean termination.

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// responsesStreamCtx accumulates everything we need to synthesize a faithful
// terminal event if the upstream never sends one.
type responsesStreamCtx struct {
	seenTerminal     bool // response.{completed,failed,incomplete} was written downstream
	responseID       string
	model            string
	createdAt        int64
	outputTextLen    int // len of accumulated output_text — for "had any output?" branch
	reasoningTextLen int // len of accumulated reasoning_text — for usage estimation
	outputText       strings.Builder
	reasoningText    strings.Builder
	usage            *dto.Usage // any usage observed upstream (incomplete/in_progress sometimes carry partial usage)
	pendingType      string
	pendingData      string
}

func newResponsesStreamCtx() *responsesStreamCtx {
	return &responsesStreamCtx{}
}

// observe inspects one parsed upstream SSE event after it was written
// downstream, so seenTerminal only represents a terminal the client received.
func (ctx *responsesStreamCtx) observe(ev dto.ResponsesStreamResponse) {
	switch ev.Type {
	case "response.completed", "response.failed", "response.incomplete":
		ctx.seenTerminal = true
		ctx.pendingType = ""
		ctx.pendingData = ""
	case "response.output_text.delta":
		if ev.Delta != "" {
			ctx.outputText.WriteString(ev.Delta)
			ctx.outputTextLen += len(ev.Delta)
		}
	case "response.reasoning_text.delta", "response.reasoning_summary_text.delta":
		if ev.Delta != "" {
			ctx.reasoningText.WriteString(ev.Delta)
			ctx.reasoningTextLen += len(ev.Delta)
		}
	}

	ctx.captureResponseMetadata(ev)
}

func (ctx *responsesStreamCtx) captureResponseMetadata(ev dto.ResponsesStreamResponse) {
	if ev.Response != nil {
		if ev.Response.ID != "" {
			ctx.responseID = ev.Response.ID
		}
		if ev.Response.Model != "" {
			ctx.model = ev.Response.Model
		}
		if ev.Response.CreatedAt != 0 {
			ctx.createdAt = int64(ev.Response.CreatedAt)
		}
		if ev.Response.Usage != nil {
			ctx.mergeUsage(ev.Response.Usage)
		}
	}
}

func (ctx *responsesStreamCtx) mergeUsage(incoming *dto.Usage) {
	if incoming == nil {
		return
	}
	if ctx.usage == nil {
		usage := *incoming
		if incoming.InputTokensDetails != nil {
			details := *incoming.InputTokensDetails
			usage.InputTokensDetails = &details
		}
		if incoming.OutputTokensDetails != nil {
			details := *incoming.OutputTokensDetails
			usage.OutputTokensDetails = &details
		}
		ctx.usage = &usage
		return
	}

	usage := ctx.usage
	if incoming.PromptTokens != 0 {
		usage.PromptTokens = incoming.PromptTokens
	}
	if incoming.CompletionTokens != 0 {
		usage.CompletionTokens = incoming.CompletionTokens
	}
	if incoming.TotalTokens != 0 {
		usage.TotalTokens = incoming.TotalTokens
	}
	if incoming.PromptCacheHitTokens != 0 {
		usage.PromptCacheHitTokens = incoming.PromptCacheHitTokens
	}
	if incoming.InputTokens != 0 {
		usage.InputTokens = incoming.InputTokens
	}
	if incoming.OutputTokens != 0 {
		usage.OutputTokens = incoming.OutputTokens
	}
	if incoming.UsageSemantic != "" {
		usage.UsageSemantic = incoming.UsageSemantic
	}
	if incoming.UsageSource != "" {
		usage.UsageSource = incoming.UsageSource
	}
	if incoming.BillingUsage != nil {
		usage.BillingUsage = incoming.BillingUsage
	}
	if incoming.ClaudeCacheCreation5mTokens != 0 {
		usage.ClaudeCacheCreation5mTokens = incoming.ClaudeCacheCreation5mTokens
	}
	if incoming.ClaudeCacheCreation1hTokens != 0 {
		usage.ClaudeCacheCreation1hTokens = incoming.ClaudeCacheCreation1hTokens
	}
	if incoming.Cost != nil {
		usage.Cost = incoming.Cost
	}

	if incoming.PromptTokensDetails.CachedTokens != 0 {
		usage.PromptTokensDetails.CachedTokens = incoming.PromptTokensDetails.CachedTokens
	}
	if incoming.PromptTokensDetails.CachedCreationTokens != 0 {
		usage.PromptTokensDetails.CachedCreationTokens = incoming.PromptTokensDetails.CachedCreationTokens
	}
	if incoming.PromptTokensDetails.CacheWriteTokens != 0 {
		usage.PromptTokensDetails.CacheWriteTokens = incoming.PromptTokensDetails.CacheWriteTokens
	}
	if incoming.PromptTokensDetails.TextTokens != 0 {
		usage.PromptTokensDetails.TextTokens = incoming.PromptTokensDetails.TextTokens
	}
	if incoming.PromptTokensDetails.AudioTokens != 0 {
		usage.PromptTokensDetails.AudioTokens = incoming.PromptTokensDetails.AudioTokens
	}
	if incoming.PromptTokensDetails.ImageTokens != 0 {
		usage.PromptTokensDetails.ImageTokens = incoming.PromptTokensDetails.ImageTokens
	}
	if incoming.CompletionTokenDetails.TextTokens != 0 {
		usage.CompletionTokenDetails.TextTokens = incoming.CompletionTokenDetails.TextTokens
	}
	if incoming.CompletionTokenDetails.AudioTokens != 0 {
		usage.CompletionTokenDetails.AudioTokens = incoming.CompletionTokenDetails.AudioTokens
	}
	if incoming.CompletionTokenDetails.ImageTokens != 0 {
		usage.CompletionTokenDetails.ImageTokens = incoming.CompletionTokenDetails.ImageTokens
	}
	if incoming.CompletionTokenDetails.ReasoningTokens != 0 {
		usage.CompletionTokenDetails.ReasoningTokens = incoming.CompletionTokenDetails.ReasoningTokens
	}

	if incoming.InputTokensDetails != nil {
		if usage.InputTokensDetails == nil {
			usage.InputTokensDetails = &dto.InputTokenDetails{}
		}
		if incoming.InputTokensDetails.CachedTokens != 0 {
			usage.InputTokensDetails.CachedTokens = incoming.InputTokensDetails.CachedTokens
		}
		if incoming.InputTokensDetails.CachedCreationTokens != 0 {
			usage.InputTokensDetails.CachedCreationTokens = incoming.InputTokensDetails.CachedCreationTokens
		}
		if incoming.InputTokensDetails.CacheWriteTokens != 0 {
			usage.InputTokensDetails.CacheWriteTokens = incoming.InputTokensDetails.CacheWriteTokens
		}
		if incoming.InputTokensDetails.TextTokens != 0 {
			usage.InputTokensDetails.TextTokens = incoming.InputTokensDetails.TextTokens
		}
		if incoming.InputTokensDetails.AudioTokens != 0 {
			usage.InputTokensDetails.AudioTokens = incoming.InputTokensDetails.AudioTokens
		}
		if incoming.InputTokensDetails.ImageTokens != 0 {
			usage.InputTokensDetails.ImageTokens = incoming.InputTokensDetails.ImageTokens
		}
	}
	if incoming.OutputTokensDetails != nil {
		if usage.OutputTokensDetails == nil {
			usage.OutputTokensDetails = &dto.OutputTokenDetails{}
		}
		if incoming.OutputTokensDetails.TextTokens != 0 {
			usage.OutputTokensDetails.TextTokens = incoming.OutputTokensDetails.TextTokens
		}
		if incoming.OutputTokensDetails.AudioTokens != 0 {
			usage.OutputTokensDetails.AudioTokens = incoming.OutputTokensDetails.AudioTokens
		}
		if incoming.OutputTokensDetails.ImageTokens != 0 {
			usage.OutputTokensDetails.ImageTokens = incoming.OutputTokensDetails.ImageTokens
		}
		if incoming.OutputTokensDetails.ReasoningTokens != 0 {
			usage.OutputTokensDetails.ReasoningTokens = incoming.OutputTokensDetails.ReasoningTokens
		}
	}
}

func (ctx *responsesStreamCtx) stageTerminal(ev dto.ResponsesStreamResponse, data string) {
	if !isResponsesTerminalEvent(ev.Type) {
		return
	}
	ctx.pendingType = ev.Type
	ctx.pendingData = data
	ctx.captureResponseMetadata(ev)
}

// shouldSynthesize decides whether to emit a synthetic terminal event.
// Skip if upstream already terminated, or if the client is gone (nothing to
// write to), or if the writer cannot accept more bytes.
func (ctx *responsesStreamCtx) shouldSynthesize(c *gin.Context, info *relaycommon.RelayInfo) bool {
	if ctx.seenTerminal {
		return false
	}
	if c == nil || c.Request == nil {
		return false
	}
	if c.Request.Context().Err() != nil {
		return false
	}
	if info != nil && info.StreamStatus != nil &&
		info.StreamStatus.EndReason == relaycommon.StreamEndReasonClientGone {
		return false
	}
	return true
}

// emitTerminal writes a synthesized response.completed or response.failed
// event to the SSE response. Returns the usage that callers should use for
// billing.
//
// Decision: if any output (text or reasoning) was produced AND the stream
// ended normally (EOF / [DONE] / handler-stop), emit response.completed so
// the client preserves partial output. Otherwise emit response.failed with a
// diagnostic message reflecting the EndReason.
func (ctx *responsesStreamCtx) emitTerminal(c *gin.Context, info *relaycommon.RelayInfo) (*dto.Usage, error) {
	usage, _, err := ctx.emitTerminalWithWriter(c, info, NewResponsesStreamWriter(c))
	return usage, err
}

func (ctx *responsesStreamCtx) emitTerminalWithWriter(c *gin.Context, info *relaycommon.RelayInfo, writer *ResponsesStreamWriter) (*dto.Usage, string, error) {
	if ctx.pendingType != "" && ctx.pendingData != "" {
		if err := writer.WriteData(ctx.pendingType, ctx.pendingData); err != nil {
			return nil, "", err
		}
		terminalType := ctx.pendingType
		ctx.seenTerminal = true
		ctx.pendingType = ""
		ctx.pendingData = ""
		return ctx.buildUsage(info), terminalType, nil
	}

	usage := ctx.buildUsage(info)
	responseID := ctx.resolveResponseID(c)
	model := ctx.resolveModel(info)
	createdAt := ctx.resolveCreatedAt()

	normalEnd := info == nil || info.StreamStatus == nil || info.StreamStatus.IsNormalEnd()
	hadOutput := ctx.outputTextLen > 0 || ctx.reasoningTextLen > 0

	var err error
	terminalType := "response.failed"
	if normalEnd && hadOutput {
		terminalType = "response.completed"
		err = ctx.writeCompletedEvent(c, writer, responseID, model, createdAt, usage)
	} else {
		err = ctx.writeFailedEvent(c, writer, responseID, model, createdAt, usage, info)
	}
	if err != nil {
		return nil, "", err
	}
	ctx.seenTerminal = true
	return usage, terminalType, nil
}

func (ctx *responsesStreamCtx) buildUsage(info *relaycommon.RelayInfo) *dto.Usage {
	// Prefer any upstream-reported usage we managed to capture, then fall back
	// to a local estimate from the accumulated text.
	if ctx.usage != nil {
		u := *ctx.usage
		inputTokens := u.InputTokens
		if inputTokens == 0 {
			inputTokens = u.PromptTokens
		}
		outputTokens := u.OutputTokens
		if outputTokens == 0 {
			outputTokens = u.CompletionTokens
		}
		u.InputTokens = inputTokens
		u.PromptTokens = inputTokens
		u.OutputTokens = outputTokens
		u.CompletionTokens = outputTokens
		if inputTokens != 0 || outputTokens != 0 {
			u.TotalTokens = inputTokens + outputTokens
		}

		if u.InputTokensDetails != nil {
			details := *u.InputTokensDetails
			u.InputTokensDetails = &details
			if details.CachedTokens != 0 {
				u.PromptTokensDetails.CachedTokens = details.CachedTokens
			}
			if details.CachedCreationTokens != 0 {
				u.PromptTokensDetails.CachedCreationTokens = details.CachedCreationTokens
			}
			if details.CacheWriteTokens != 0 {
				u.PromptTokensDetails.CacheWriteTokens = details.CacheWriteTokens
			}
			if details.TextTokens != 0 {
				u.PromptTokensDetails.TextTokens = details.TextTokens
			}
			if details.AudioTokens != 0 {
				u.PromptTokensDetails.AudioTokens = details.AudioTokens
			}
			if details.ImageTokens != 0 {
				u.PromptTokensDetails.ImageTokens = details.ImageTokens
			}
		}
		if u.OutputTokensDetails != nil {
			details := *u.OutputTokensDetails
			u.OutputTokensDetails = &details
			if details.TextTokens != 0 {
				u.CompletionTokenDetails.TextTokens = details.TextTokens
			}
			if details.AudioTokens != 0 {
				u.CompletionTokenDetails.AudioTokens = details.AudioTokens
			}
			if details.ImageTokens != 0 {
				u.CompletionTokenDetails.ImageTokens = details.ImageTokens
			}
			if details.ReasoningTokens != 0 {
				u.CompletionTokenDetails.ReasoningTokens = details.ReasoningTokens
			}
		}
		return &u
	}

	model := ctx.resolveModel(info)
	outputTokens := service.CountTextToken(ctx.outputText.String(), model)
	reasoningTokens := service.CountTextToken(ctx.reasoningText.String(), model)
	completion := outputTokens + reasoningTokens

	prompt := 0
	if info != nil {
		prompt = info.GetEstimatePromptTokens()
	}

	return &dto.Usage{
		PromptTokens:     prompt,
		CompletionTokens: completion,
		TotalTokens:      prompt + completion,
		InputTokens:      prompt,
		OutputTokens:     completion,
		CompletionTokenDetails: dto.OutputTokenDetails{
			ReasoningTokens: reasoningTokens,
		},
	}
}

func (ctx *responsesStreamCtx) resolveResponseID(c *gin.Context) string {
	if ctx.responseID != "" {
		return ctx.responseID
	}
	if c == nil {
		return ""
	}
	return helper.GetResponseID(c)
}

func (ctx *responsesStreamCtx) resolveModel(info *relaycommon.RelayInfo) string {
	if ctx.model != "" {
		return ctx.model
	}
	if info != nil {
		return info.UpstreamModelName
	}
	return ""
}

func (ctx *responsesStreamCtx) resolveCreatedAt() int64 {
	if ctx.createdAt != 0 {
		return ctx.createdAt
	}
	return time.Now().Unix()
}

// writeCompletedEvent emits a response.completed event with the minimum
// shape required by Codex (id + usage) and the optional fields most other
// clients consult (model, created_at, status, output=[]).
func (ctx *responsesStreamCtx) writeCompletedEvent(c *gin.Context, writer *ResponsesStreamWriter, id, model string, createdAt int64, usage *dto.Usage) error {
	response := map[string]any{
		"id":         id,
		"object":     "response",
		"status":     "completed",
		"model":      model,
		"created_at": createdAt,
		"output":     []any{},
		"usage":      usageToResponsesPayload(usage),
	}
	return ctx.writeSyntheticEvent(c, writer, "response.completed", response)
}

// writeFailedEvent emits a response.failed event with an error object that
// Codex's parser maps to a human-readable error message.
func (ctx *responsesStreamCtx) writeFailedEvent(c *gin.Context, writer *ResponsesStreamWriter, id, model string, createdAt int64, usage *dto.Usage, info *relaycommon.RelayInfo) error {
	message := "upstream stream interrupted"
	code := "stream_disconnect"
	if info != nil && info.StreamStatus != nil {
		summary := info.StreamStatus.Summary()
		if summary != "" {
			message = "upstream stream interrupted: " + summary
		}
		if info.StreamStatus.EndReason != "" {
			code = string(info.StreamStatus.EndReason)
		}
	}
	response := map[string]any{
		"id":         id,
		"object":     "response",
		"status":     "failed",
		"model":      model,
		"created_at": createdAt,
		"output":     []any{},
		"error": map[string]any{
			"type":    "stream_error",
			"code":    code,
			"message": message,
		},
		"usage": usageToResponsesPayload(usage),
	}
	return ctx.writeSyntheticEvent(c, writer, "response.failed", response)
}

// writeSyntheticEvent serializes the payload and writes the
// `event:` + `data:` SSE pair using the same format helper.ResponseChunkData
// uses for upstream-passthrough events.
func (ctx *responsesStreamCtx) writeSyntheticEvent(c *gin.Context, writer *ResponsesStreamWriter, eventType string, response map[string]any) error {
	payload := map[string]any{
		"type":     eventType,
		"response": response,
	}
	if err := writer.WritePayload(eventType, payload); err != nil {
		logger.LogError(c, fmt.Sprintf("synthesize %s: write failed: %s", eventType, err.Error()))
		return err
	}
	return nil
}

func ensureResponsesTerminalOutputField(streamResponse dto.ResponsesStreamResponse, data string) string {
	_, normalized, _ := normalizeResponsesTerminalEvent(nil, nil, newResponsesStreamCtx(), streamResponse, data)
	return normalized
}

func normalizeResponsesTerminalEvent(c *gin.Context, info *relaycommon.RelayInfo, streamCtx *responsesStreamCtx, streamResponse dto.ResponsesStreamResponse, data string) (dto.ResponsesStreamResponse, string, error) {
	switch streamResponse.Type {
	case "response.completed", "response.failed", "response.incomplete":
	default:
		return streamResponse, data, nil
	}

	var payload map[string]any
	if err := common.UnmarshalJsonStr(data, &payload); err != nil {
		return streamResponse, data, fmt.Errorf("normalize responses terminal: %w", err)
	}
	response, ok := payload["response"].(map[string]any)
	if !ok {
		response = make(map[string]any)
		payload["response"] = response
	}

	responseID, _ := response["id"].(string)
	if responseID == "" && streamResponse.Response != nil {
		responseID = streamResponse.Response.ID
	}
	if responseID == "" {
		responseID = streamCtx.resolveResponseID(c)
	}
	response["id"] = responseID
	response["object"] = "response"
	switch streamResponse.Type {
	case "response.completed":
		response["status"] = "completed"
	case "response.failed":
		response["status"] = "failed"
		errorPayload, ok := response["error"].(map[string]any)
		if !ok {
			errorPayload = make(map[string]any)
			if streamResponse.Response != nil {
				if upstreamErr := streamResponse.Response.GetOpenAIError(); upstreamErr != nil {
					errorPayload["type"] = upstreamErr.Type
					errorPayload["code"] = upstreamErr.Code
					errorPayload["message"] = upstreamErr.Message
					errorPayload["param"] = upstreamErr.Param
				}
			}
		}
		if errorType, _ := errorPayload["type"].(string); errorType == "" {
			errorPayload["type"] = "stream_error"
		}
		errorCode, hasErrorCode := errorPayload["code"]
		errorCodeString, errorCodeIsString := errorCode.(string)
		if !hasErrorCode || errorCode == nil || (errorCodeIsString && errorCodeString == "") {
			errorPayload["code"] = string(relaycommon.StreamEndReasonUpstreamFailed)
		}
		if message, _ := errorPayload["message"].(string); message == "" {
			errorPayload["message"] = "upstream responses stream failed"
		}
		response["error"] = errorPayload
	case "response.incomplete":
		response["status"] = "incomplete"
	}

	model, _ := response["model"].(string)
	if model == "" {
		model = streamCtx.resolveModel(info)
	}
	response["model"] = model
	if createdAt, ok := response["created_at"].(float64); !ok || createdAt == 0 {
		response["created_at"] = streamCtx.resolveCreatedAt()
	}
	if _, ok := response["output"].([]any); !ok {
		response["output"] = []any{}
	}

	normalizedUsage := usageToResponsesPayload(streamCtx.buildUsage(info))
	usagePayload, ok := response["usage"].(map[string]any)
	if !ok {
		usagePayload = make(map[string]any)
	}
	for _, key := range []string{"input_tokens", "output_tokens", "total_tokens"} {
		if _, ok := usagePayload[key].(float64); !ok {
			usagePayload[key] = normalizedUsage[key]
		}
	}
	for _, key := range []string{"input_tokens_details", "output_tokens_details"} {
		normalizedDetails, ok := normalizedUsage[key].(map[string]any)
		if !ok {
			continue
		}
		details, ok := usagePayload[key].(map[string]any)
		if !ok {
			details = make(map[string]any)
		}
		for detailKey, value := range normalizedDetails {
			if _, exists := details[detailKey]; !exists {
				details[detailKey] = value
			}
		}
		usagePayload[key] = details
	}
	response["usage"] = usagePayload

	patched, err := common.Marshal(payload)
	if err != nil {
		return streamResponse, data, fmt.Errorf("normalize responses terminal: %w", err)
	}
	var normalizedResponse dto.ResponsesStreamResponse
	if err := common.Unmarshal(patched, &normalizedResponse); err != nil {
		return streamResponse, data, fmt.Errorf("normalize responses terminal: %w", err)
	}
	return normalizedResponse, string(patched), nil
}

// usageToResponsesPayload converts an internal dto.Usage into the JSON shape
// the Responses API uses (input_tokens / output_tokens / total_tokens with
// nested details), which is what Codex's ResponseCompletedUsage deserializer
// reads.
func usageToResponsesPayload(usage *dto.Usage) map[string]any {
	if usage == nil {
		return map[string]any{
			"input_tokens":  0,
			"output_tokens": 0,
			"total_tokens":  0,
		}
	}

	input := usage.InputTokens
	if input == 0 {
		input = usage.PromptTokens
	}
	output := usage.OutputTokens
	if output == 0 {
		output = usage.CompletionTokens
	}
	total := usage.TotalTokens
	if total == 0 {
		total = input + output
	}

	payload := map[string]any{
		"input_tokens":  input,
		"output_tokens": output,
		"total_tokens":  total,
	}
	inputDetails := usage.PromptTokensDetails
	if usage.InputTokensDetails != nil {
		inputDetails = *usage.InputTokensDetails
		if inputDetails.CachedTokens == 0 {
			inputDetails.CachedTokens = usage.PromptTokensDetails.CachedTokens
		}
		if inputDetails.CachedCreationTokens == 0 {
			inputDetails.CachedCreationTokens = usage.PromptTokensDetails.CachedCreationTokens
		}
		if inputDetails.CacheWriteTokens == 0 {
			inputDetails.CacheWriteTokens = usage.PromptTokensDetails.CacheWriteTokens
		}
		if inputDetails.TextTokens == 0 {
			inputDetails.TextTokens = usage.PromptTokensDetails.TextTokens
		}
		if inputDetails.AudioTokens == 0 {
			inputDetails.AudioTokens = usage.PromptTokensDetails.AudioTokens
		}
		if inputDetails.ImageTokens == 0 {
			inputDetails.ImageTokens = usage.PromptTokensDetails.ImageTokens
		}
	}
	if inputDetails != (dto.InputTokenDetails{}) {
		payload["input_tokens_details"] = map[string]any{
			"cached_tokens":          inputDetails.CachedTokens,
			"cached_creation_tokens": inputDetails.CachedCreationTokens,
			"cache_write_tokens":     inputDetails.CacheWriteTokens,
			"text_tokens":            inputDetails.TextTokens,
			"audio_tokens":           inputDetails.AudioTokens,
			"image_tokens":           inputDetails.ImageTokens,
		}
	}
	outputDetails := usage.CompletionTokenDetails
	if usage.OutputTokensDetails != nil {
		outputDetails = *usage.OutputTokensDetails
		if outputDetails.TextTokens == 0 {
			outputDetails.TextTokens = usage.CompletionTokenDetails.TextTokens
		}
		if outputDetails.AudioTokens == 0 {
			outputDetails.AudioTokens = usage.CompletionTokenDetails.AudioTokens
		}
		if outputDetails.ImageTokens == 0 {
			outputDetails.ImageTokens = usage.CompletionTokenDetails.ImageTokens
		}
		if outputDetails.ReasoningTokens == 0 {
			outputDetails.ReasoningTokens = usage.CompletionTokenDetails.ReasoningTokens
		}
	}
	if outputDetails != (dto.OutputTokenDetails{}) {
		payload["output_tokens_details"] = map[string]any{
			"text_tokens":      outputDetails.TextTokens,
			"audio_tokens":     outputDetails.AudioTokens,
			"image_tokens":     outputDetails.ImageTokens,
			"reasoning_tokens": outputDetails.ReasoningTokens,
		}
	}
	return payload
}
