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
	seenTerminal     bool // response.{completed,failed,incomplete} or error arrived upstream
	responseID       string
	model            string
	createdAt        int64
	outputTextLen    int // len of accumulated output_text — for "had any output?" branch
	reasoningTextLen int // len of accumulated reasoning_text — for usage estimation
	outputText       strings.Builder
	reasoningText    strings.Builder
	usage            *dto.Usage // any usage observed upstream (incomplete/in_progress sometimes carry partial usage)
}

func newResponsesStreamCtx() *responsesStreamCtx {
	return &responsesStreamCtx{}
}

// observe inspects one parsed upstream SSE event and updates state.
// Call this before the existing switch-case in the handler so the snapshot
// is up-to-date when synthesis runs.
func (ctx *responsesStreamCtx) observe(ev dto.ResponsesStreamResponse) {
	switch ev.Type {
	case "response.completed", "response.failed", "response.incomplete", "error":
		ctx.seenTerminal = true
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
			ctx.usage = ev.Response.Usage
		}
	}
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
	usage := ctx.buildUsage(info)
	responseID := ctx.resolveResponseID(c)
	model := ctx.resolveModel(info)
	createdAt := ctx.resolveCreatedAt()

	normalEnd := info == nil || info.StreamStatus == nil || info.StreamStatus.IsNormalEnd()
	hadOutput := ctx.outputTextLen > 0 || ctx.reasoningTextLen > 0

	var err error
	if normalEnd && hadOutput {
		err = ctx.writeCompletedEvent(c, responseID, model, createdAt, usage)
	} else {
		err = ctx.writeFailedEvent(c, responseID, model, createdAt, usage, info)
	}
	if err != nil {
		return nil, err
	}
	return usage, nil
}

func (ctx *responsesStreamCtx) buildUsage(info *relaycommon.RelayInfo) *dto.Usage {
	// Prefer any upstream-reported usage we managed to capture, then fall back
	// to a local estimate from the accumulated text.
	if ctx.usage != nil {
		u := *ctx.usage
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
func (ctx *responsesStreamCtx) writeCompletedEvent(c *gin.Context, id, model string, createdAt int64, usage *dto.Usage) error {
	response := map[string]any{
		"id":         id,
		"object":     "response",
		"status":     "completed",
		"model":      model,
		"created_at": createdAt,
		"output":     []any{},
		"usage":      usageToResponsesPayload(usage),
	}
	return ctx.writeSyntheticEvent(c, "response.completed", response)
}

// writeFailedEvent emits a response.failed event with an error object that
// Codex's parser maps to a human-readable error message.
func (ctx *responsesStreamCtx) writeFailedEvent(c *gin.Context, id, model string, createdAt int64, usage *dto.Usage, info *relaycommon.RelayInfo) error {
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
	return ctx.writeSyntheticEvent(c, "response.failed", response)
}

// writeSyntheticEvent serializes the payload and writes the
// `event:` + `data:` SSE pair using the same format helper.ResponseChunkData
// uses for upstream-passthrough events.
func (ctx *responsesStreamCtx) writeSyntheticEvent(c *gin.Context, eventType string, response map[string]any) error {
	payload := map[string]any{
		"type":     eventType,
		"response": response,
	}
	data, err := common.Marshal(payload)
	if err != nil {
		logger.LogError(c, fmt.Sprintf("synthesize %s: marshal failed: %s", eventType, err.Error()))
		return err
	}

	syntheticEvent := dto.ResponsesStreamResponse{Type: eventType}
	if err := sendResponsesStreamData(c, syntheticEvent, string(data)); err != nil {
		logger.LogError(c, fmt.Sprintf("synthesize %s: write failed: %s", eventType, err.Error()))
		return err
	}
	return nil
}

func ensureResponsesTerminalOutputField(streamResponse dto.ResponsesStreamResponse, data string) string {
	switch streamResponse.Type {
	case "response.completed", "response.failed", "response.incomplete":
	default:
		return data
	}
	if streamResponse.Response == nil || streamResponse.Response.Output != nil {
		return data
	}

	var payload map[string]any
	if err := common.UnmarshalJsonStr(data, &payload); err != nil {
		return data
	}
	response, ok := payload["response"].(map[string]any)
	if !ok {
		return data
	}
	if _, ok := response["output"]; ok {
		return data
	}
	response["output"] = []any{}
	patched, err := common.Marshal(payload)
	if err != nil {
		return data
	}
	return string(patched)
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
	if usage.InputTokensDetails != nil {
		payload["input_tokens_details"] = map[string]any{
			"cached_tokens": usage.InputTokensDetails.CachedTokens,
		}
	} else if usage.PromptTokensDetails.CachedTokens != 0 {
		payload["input_tokens_details"] = map[string]any{
			"cached_tokens": usage.PromptTokensDetails.CachedTokens,
		}
	}
	if usage.CompletionTokenDetails.ReasoningTokens != 0 {
		payload["output_tokens_details"] = map[string]any{
			"reasoning_tokens": usage.CompletionTokenDetails.ReasoningTokens,
		}
	}
	return payload
}
