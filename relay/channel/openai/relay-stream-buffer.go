package openai

import (
	"bufio"
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// OaiStreamBufferHandler consumes a streaming SSE response from an upstream
// that only supports streaming, buffers it entirely, and returns a single
// non-streaming JSON response to the client. It is used when the channel has
// ForceStream enabled and the client sent a non-streaming request.
func OaiStreamBufferHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	defer service.CloseResponseBodyGracefully(resp)

	acc := newStreamAccumulator()

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 256*1024), 10*1024*1024)
	for scanner.Scan() {
		data, ok := parseSSEData(scanner.Text())
		if !ok {
			continue
		}

		info.ReceivedResponseCount++
		info.SetFirstResponseTime()

		oaiErr, err := acc.mergeChunk(data)
		if err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
		if oaiErr != nil {
			return nil, types.WithOpenAIError(*oaiErr, http.StatusBadGateway)
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, types.NewOpenAIError(fmt.Errorf("error reading stream: %w", err), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if acc.isEmpty() {
		return nil, types.NewOpenAIError(fmt.Errorf("empty stream response"), types.ErrorCodeBadResponse, http.StatusBadGateway)
	}

	usage := acc.usage
	if !acc.hasUsage {
		usage = service.ResponseText2Usage(c, acc.fullText(), info.UpstreamModelName, info.GetEstimatePromptTokens())
		usage.CompletionTokens += acc.toolCount() * 7
	}
	applyUsagePostProcessing(info, usage, common.StringToByteSlice(acc.lastUsageRawData))

	textResponse := acc.assemble(info.UpstreamModelName, usage)

	markContentFilterReject(c, textResponse.Choices)

	responseBody, marshalErr := marshalTextResponse(&textResponse, info)
	if marshalErr != nil {
		return nil, types.NewError(marshalErr, types.ErrorCodeBadResponseBody)
	}

	if info.StreamStatus == nil {
		info.StreamStatus = relaycommon.NewStreamStatus()
	}
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonDone, nil)

	// Write as a standard JSON response. Do NOT copy upstream headers (which
	// are text/event-stream for this forced-stream response) — the client
	// expects application/json.
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.Header().Set("Content-Length", fmt.Sprintf("%d", len(responseBody)))
	c.Writer.WriteHeader(http.StatusOK)
	_, _ = c.Writer.Write(responseBody)
	c.Writer.Flush()

	return usage, nil
}

// ---------------------------------------------------------------------------
// Delta accumulator
// ---------------------------------------------------------------------------

type accumulatedChoice struct {
	index            int
	role             string
	content          strings.Builder
	reasoningContent strings.Builder
	finishReason     string
	toolCalls        []*dto.ToolCallResponse
	toolCallIndexMap map[int]int // maps delta tool-call index -> position in toolCalls slice
}

type streamAccumulator struct {
	responseId         string
	model              string
	created            int64
	choices            map[int]*accumulatedChoice
	choiceOrder        []int
	usage              *dto.Usage
	hasUsage           bool
	lastUsageRawData   string // raw SSE data of the chunk that carried usage, for cached-token extraction
	maxToolCallsPerChk int    // max len(Delta.ToolCalls) across all chunks/choices (matches ProcessStreamResponse semantics)
	textForUsage       strings.Builder
}

func newStreamAccumulator() *streamAccumulator {
	return &streamAccumulator{
		choices: make(map[int]*accumulatedChoice),
		usage:   &dto.Usage{},
	}
}

func (a *streamAccumulator) isEmpty() bool {
	return len(a.choices) == 0
}

func (a *streamAccumulator) getOrCreateChoice(index int) *accumulatedChoice {
	ch, ok := a.choices[index]
	if !ok {
		ch = &accumulatedChoice{
			index:            index,
			toolCallIndexMap: make(map[int]int),
		}
		a.choices[index] = ch
		a.choiceOrder = append(a.choiceOrder, index)
	}
	return ch
}

// streamChunk embeds ChatCompletionsStreamResponse and adds an optional Error
// field so each SSE data payload is parsed exactly once.
type streamChunk struct {
	dto.ChatCompletionsStreamResponse
	Error any `json:"error"`
}

// mergeChunk parses and accumulates a single SSE data payload. It also probes
// for an upstream error in the same pass. Returns (oaiError, parseErr): when
// oaiError is non-nil the chunk contained an upstream error that should be
// surfaced to the client.
func (a *streamAccumulator) mergeChunk(data string) (*types.OpenAIError, error) {
	var chunk streamChunk
	if err := common.UnmarshalJsonStr(data, &chunk); err != nil {
		return nil, err
	}

	if oaiErr := dto.GetOpenAIError(chunk.Error); oaiErr != nil && oaiErr.Type != "" {
		return oaiErr, nil
	}

	if a.responseId == "" {
		a.responseId = chunk.Id
	}
	if a.model == "" {
		a.model = chunk.Model
	}
	if a.created == 0 {
		a.created = chunk.Created
	}

	if service.ValidUsage(chunk.Usage) {
		a.usage = chunk.Usage
		a.hasUsage = true
		a.lastUsageRawData = data
	}

	for i := range chunk.Choices {
		choice := &chunk.Choices[i]
		ch := a.getOrCreateChoice(choice.Index)

		if choice.Delta.Role != "" {
			ch.role = choice.Delta.Role
		}

		contentStr := choice.Delta.GetContentString()
		if contentStr != "" {
			ch.content.WriteString(contentStr)
			a.textForUsage.WriteString(contentStr)
		}

		reasoningStr := choice.Delta.GetReasoningContent()
		if reasoningStr != "" {
			ch.reasoningContent.WriteString(reasoningStr)
			a.textForUsage.WriteString(reasoningStr)
		}

		if len(choice.Delta.ToolCalls) > 0 {
			if len(choice.Delta.ToolCalls) > a.maxToolCallsPerChk {
				a.maxToolCallsPerChk = len(choice.Delta.ToolCalls)
			}
			for j := range choice.Delta.ToolCalls {
				a.mergeToolCall(ch, &choice.Delta.ToolCalls[j])
			}
		}

		if choice.FinishReason != nil && *choice.FinishReason != "" {
			ch.finishReason = *choice.FinishReason
		}
	}

	return nil, nil
}

func (a *streamAccumulator) mergeToolCall(ch *accumulatedChoice, tc *dto.ToolCallResponse) {
	deltaIdx := 0
	if tc.Index != nil {
		deltaIdx = *tc.Index
	}

	pos, exists := ch.toolCallIndexMap[deltaIdx]
	if !exists {
		newTC := &dto.ToolCallResponse{
			Function: dto.FunctionResponse{},
		}
		ch.toolCalls = append(ch.toolCalls, newTC)
		pos = len(ch.toolCalls) - 1
		ch.toolCallIndexMap[deltaIdx] = pos
	}

	target := ch.toolCalls[pos]
	if tc.ID != "" {
		target.ID = tc.ID
	}
	if tc.Type != nil {
		target.Type = tc.Type
	}
	if tc.Function.Name != "" {
		target.Function.Name = tc.Function.Name
	}
	if tc.Function.Description != "" {
		target.Function.Description = tc.Function.Description
	}
	if tc.Function.Arguments != "" {
		target.Function.Arguments += tc.Function.Arguments
	}
	a.textForUsage.WriteString(tc.Function.Name)
	a.textForUsage.WriteString(tc.Function.Arguments)
}

// assemble builds the final non-streaming OpenAITextResponse from accumulated
// deltas.
func (a *streamAccumulator) assemble(model string, usage *dto.Usage) dto.OpenAITextResponse {
	choices := make([]dto.OpenAITextResponseChoice, 0, len(a.choiceOrder))
	for _, idx := range a.choiceOrder {
		ch := a.choices[idx]
		msg := dto.Message{
			Role:    ch.role,
			Content: ch.content.String(),
		}
		if ch.reasoningContent.Len() > 0 {
			rc := ch.reasoningContent.String()
			msg.ReasoningContent = &rc
		}
		if len(ch.toolCalls) > 0 {
			msg.SetToolCalls(ch.toolCalls)
		}

		choices = append(choices, dto.OpenAITextResponseChoice{
			Index:        ch.index,
			Message:      msg,
			FinishReason: ch.finishReason,
		})
	}

	respModel := a.model
	if respModel == "" {
		respModel = model
	}

	return dto.OpenAITextResponse{
		Id:      a.responseId,
		Model:   respModel,
		Object:  "chat.completion",
		Created: a.created,
		Choices: choices,
		Usage:   *usage,
	}
}

func (a *streamAccumulator) fullText() string {
	return a.textForUsage.String()
}

func (a *streamAccumulator) toolCount() int {
	return a.maxToolCallsPerChk
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// parseSSEData extracts the JSON payload from an SSE "data:" line. Returns
// ("", false) for non-data lines, empty data, or [DONE].
func parseSSEData(line string) (string, bool) {
	if !strings.HasPrefix(line, "data:") {
		return "", false
	}
	data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
	if data == "" || data == "[DONE]" {
		return "", false
	}
	return data, true
}

// accumulateSSEChunks is a pure helper that feeds SSE data payloads extracted
// from rawSSE into a fresh accumulator. Used by tests to exercise delta merging
// without HTTP plumbing.
func accumulateSSEChunks(rawSSE string) (*streamAccumulator, error) {
	acc := newStreamAccumulator()
	scanner := bufio.NewScanner(strings.NewReader(rawSSE))
	scanner.Buffer(make([]byte, 0, 256*1024), 10*1024*1024)
	for scanner.Scan() {
		data, ok := parseSSEData(scanner.Text())
		if !ok {
			continue
		}
		oaiErr, err := acc.mergeChunk(data)
		if err != nil {
			return nil, err
		}
		if oaiErr != nil {
			return acc, nil
		}
	}
	return acc, nil
}
