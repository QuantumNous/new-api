package claudemessages

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/reasonmap"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/internal/convdiag"
	sharedclaude "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/shared/claude"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

type ClaudeResponseInfo struct {
	ResponseId   string
	Created      int64
	Model        string
	ResponseText strings.Builder
	Usage        *dto.Usage
	Done         bool

	// Only snapshots synthesized from partial display usage may be refreshed by
	// later display deltas. Serialized BillingUsage always remains authoritative.
	billingUsageSynthesized bool
}

func StopReasonClaudeToOpenAI(reason string) string {
	return reasonmap.ClaudeStopReasonToOpenAIFinishReason(reason)
}

// StreamResponseClaude2OpenAI converts a single Claude stream event into a
// Chat Completions chunk. It is stateless: chunk identity (id/model/created)
// and merged usage are only filled in by the stateful ClaudeToChatStreamState
// path, which is what production converters use. The sparse Claude content
// block index passes through unchanged here.
func StreamResponseClaude2OpenAI(claudeResponse *dto.ClaudeResponse) *dto.ChatCompletionsStreamResponse {
	var response dto.ChatCompletionsStreamResponse
	response.Object = "chat.completion.chunk"
	response.Model = claudeResponse.Model
	response.Choices = make([]dto.ChatCompletionsStreamResponseChoice, 0)
	tools := make([]dto.ToolCallResponse, 0)
	fcIdx := 0
	if claudeResponse.Index != nil {
		fcIdx = *claudeResponse.Index
	}
	var choice dto.ChatCompletionsStreamResponseChoice
	if claudeResponse.Type == "message_start" {
		if claudeResponse.Message != nil {
			response.Id = claudeResponse.Message.Id
			response.Model = claudeResponse.Message.Model
		}
		choice.Delta.SetContentString("")
		choice.Delta.Role = "assistant"
	} else if claudeResponse.Type == "content_block_start" {
		if claudeResponse.ContentBlock != nil {
			if claudeResponse.ContentBlock.Type == "text" && claudeResponse.ContentBlock.Text != nil {
				choice.Delta.SetContentString(*claudeResponse.ContentBlock.Text)
				annotations, err := claudeCitationsToChat(claudeResponse.ContentBlock.Citations, *claudeResponse.ContentBlock.Text, 0)
				if err == nil {
					choice.Delta.Annotations, _ = marshalChatAnnotations(annotations)
				}
			}
			if claudeResponse.ContentBlock.Type == "tool_use" {
				tools = append(tools, dto.ToolCallResponse{
					Index: kitutil.GetPointer(fcIdx),
					ID:    claudeResponse.ContentBlock.Id,
					Type:  "function",
					Function: dto.FunctionResponse{
						Name:      claudeResponse.ContentBlock.Name,
						Arguments: "",
					},
				})
			}
		} else {
			return nil
		}
	} else if claudeResponse.Type == "content_block_delta" {
		if claudeResponse.Delta != nil {
			choice.Delta.Content = claudeResponse.Delta.Text
			switch claudeResponse.Delta.Type {
			case "input_json_delta":
				tools = append(tools, dto.ToolCallResponse{
					Type:  "function",
					Index: kitutil.GetPointer(fcIdx),
					Function: dto.FunctionResponse{
						Arguments: *claudeResponse.Delta.PartialJson,
					},
				})
			case "signature_delta":
				// Intentionally ignored: a signature is protocol state, not
				// reasoning content, and fabricating one would be rejected by
				// real Anthropic upstreams.
			case "thinking_delta":
				choice.Delta.ReasoningContent = claudeResponse.Delta.Thinking
			case "citations_delta":
				if len(claudeResponse.Delta.Citation) > 0 {
					raw, _ := kitutil.Marshal([]json.RawMessage{claudeResponse.Delta.Citation})
					annotations, err := claudeCitationsToChat(raw, "", 0)
					if err == nil {
						choice.Delta.Annotations, _ = marshalChatAnnotations(annotations)
					}
				}
			}
		}
	} else if claudeResponse.Type == "message_delta" {
		if claudeResponse.Delta != nil && claudeResponse.Delta.StopReason != nil {
			// Claude never sends a literal "null" stop_reason in
			// message_delta; an unmappable reason falls back to stop.
			finishReason := StopReasonClaudeToOpenAI(*claudeResponse.Delta.StopReason)
			if finishReason == "" {
				finishReason = "stop"
			}
			choice.FinishReason = &finishReason
		}
	} else if claudeResponse.Type == "message_stop" {
		return nil
	} else {
		return nil
	}
	if len(tools) > 0 {
		choice.Delta.Content = nil
		choice.Delta.ToolCalls = tools
	}
	response.Choices = append(response.Choices, choice)

	return &response
}

// ClaudeToChatStreamState translates Anthropic content block indexes into the
// independent, dense index space used by Chat Completions tool_calls. Text and
// thinking blocks therefore do not create holes in the downstream tool array.
type ClaudeToChatStreamState struct {
	toolIndexByContentBlock map[int]int
	blockTypeByContentBlock map[int]string
	nextToolIndex           int

	// Stream identity captured from message_start so every emitted chunk and
	// the synthesized terminal chunk carry consistent id/model/created.
	id      string
	model   string
	created int64

	// usage is the merged OpenAI-style usage from message_start and
	// message_delta; it is attached to chunks that carry a finish reason.
	usage *dto.Usage

	// terminalSent records that a stop event (message_delta stop_reason,
	// message_stop, or error) was already translated; FinalizeClaudeToChatStream
	// only synthesizes a terminal chunk when it is still false.
	terminalSent bool
	sawToolCall  bool
	sawError     bool
}

func NewClaudeToChatStreamState() *ClaudeToChatStreamState {
	return &ClaudeToChatStreamState{
		toolIndexByContentBlock: make(map[int]int),
		blockTypeByContentBlock: make(map[int]string),
		created:                 kitutil.GetTimestamp(),
	}
}

// StreamUsage exposes the merged usage so stream wrappers can settle billing
// even when no final usage chunk was emitted.
func (s *ClaudeToChatStreamState) StreamUsage() *dto.Usage {
	if s == nil {
		return nil
	}
	return s.usage
}

func (s *ClaudeToChatStreamState) SetStreamUsage(usage *dto.Usage) {
	if s != nil && usage != nil {
		s.usage = usage
	}
}

func (s *ClaudeToChatStreamState) ConvertChunk(ctx context.Context, claudeResponse *dto.ClaudeResponse) (*dto.ChatCompletionsStreamResponse, error) {
	if s == nil {
		return nil, fmt.Errorf("Claude-to-Chat stream state is required")
	}
	if claudeResponse == nil {
		return nil, nil
	}
	if s.toolIndexByContentBlock == nil {
		s.toolIndexByContentBlock = make(map[int]int)
	}
	if s.blockTypeByContentBlock == nil {
		s.blockTypeByContentBlock = make(map[int]string)
	}

	converted := *claudeResponse
	switch claudeResponse.Type {
	case "message_start":
		if claudeResponse.Message != nil {
			if claudeResponse.Message.Id != "" {
				s.id = claudeResponse.Message.Id
			}
			if claudeResponse.Message.Model != "" {
				s.model = claudeResponse.Message.Model
			}
			if usage := usageFromClaudeAPIUsage(claudeResponse.Message.Usage); usage != nil {
				s.usage = dto.MergeUsageNonZero(s.usage, usage)
			}
		}
	case "message_delta":
		if usage := usageFromClaudeAPIUsage(claudeResponse.Usage); usage != nil {
			s.usage = dto.MergeUsageNonZero(s.usage, usage)
		}
		if claudeResponse.Delta == nil || claudeResponse.Delta.StopReason == nil {
			// A message_delta without a stop reason carries no chunk-visible
			// state; emitting an empty choice would only confuse clients.
			return nil, nil
		}
		s.terminalSent = true
	case "message_stop":
		s.terminalSent = true
	case "error":
		s.sawError = true
		s.terminalSent = true
	case "content_block_start":
		if claudeResponse.ContentBlock == nil {
			break
		}
		blockType := strings.TrimSpace(claudeResponse.ContentBlock.Type)
		if blockType == "" {
			break
		}
		if claudeResponse.Index == nil {
			// A block we cannot track would emit a tool delta in the wrong
			// index space; drop it instead of failing the whole stream.
			convdiag.Add(ctx, claudeStreamDiagnostic("stream_index_missing", "Claude content block stream start is missing index"))
			return nil, nil
		}
		contentBlockIndex := *claudeResponse.Index
		s.blockTypeByContentBlock[contentBlockIndex] = blockType
		if blockType != "tool_use" {
			if isClaudeHostedToolStreamBlock(blockType) {
				return nil, nil
			}
			break
		}
		toolIndex, exists := s.toolIndexByContentBlock[contentBlockIndex]
		if !exists {
			toolIndex = s.nextToolIndex
			s.nextToolIndex++
			s.toolIndexByContentBlock[contentBlockIndex] = toolIndex
		}
		converted.Index = kitutil.GetPointer(toolIndex)
		s.sawToolCall = true
	case "content_block_delta":
		if claudeResponse.Delta != nil && claudeResponse.Delta.Type == "signature_delta" {
			// A signature is protocol state, not user-visible reasoning
			// content. Never synthesize one: real Anthropic upstreams reject
			// fabricated signatures harder than missing ones.
			return nil, nil
		}
		if claudeResponse.Delta == nil || claudeResponse.Delta.Type != "input_json_delta" {
			break
		}
		if claudeResponse.Index == nil {
			convdiag.Add(ctx, claudeStreamDiagnostic("stream_index_missing", "Claude tool-use stream delta is missing content block index"))
			return nil, nil
		}
		if claudeResponse.Delta.PartialJson == nil {
			convdiag.Add(ctx, claudeStreamDiagnostic("stream_index_missing", "Claude tool-use stream delta is missing partial JSON"))
			return nil, nil
		}
		contentBlockIndex := *claudeResponse.Index
		toolIndex, exists := s.toolIndexByContentBlock[contentBlockIndex]
		if !exists {
			if isClaudeHostedToolStreamBlock(s.blockTypeByContentBlock[contentBlockIndex]) {
				return nil, nil
			}
			convdiag.Add(ctx, claudeStreamDiagnostic("stream_unknown_block_index", fmt.Sprintf("Claude tool-use stream delta references unknown content block index %d", contentBlockIndex)))
			return nil, nil
		}
		converted.Index = kitutil.GetPointer(toolIndex)
	case "content_block_stop":
		if claudeResponse.Index != nil {
			delete(s.blockTypeByContentBlock, *claudeResponse.Index)
		}
	}

	chunk := StreamResponseClaude2OpenAI(&converted)
	if chunk != nil {
		// Backfill stream identity on every chunk (mirrors the Gemini
		// converter) so clients see a consistent id/model/created even when
		// the upstream omits them on individual events.
		if s.id != "" {
			chunk.Id = s.id
		}
		if s.model != "" {
			chunk.Model = s.model
		}
		if s.created != 0 {
			chunk.Created = s.created
		}
		// Terminal chunks carry the merged usage; the registry only backfills
		// chunks the state did not populate.
		if chunk.Choices != nil {
			for _, choice := range chunk.Choices {
				if choice.FinishReason != nil && s.usage != nil {
					chunk.Usage = s.usage
					break
				}
			}
		}
	}
	return chunk, nil
}

// FinalizeClaudeToChatStream synthesizes the terminal chunk when the upstream
// stream ended without a stop event. It is a no-op once a terminal chunk was
// emitted, mirroring GeminiToChatStreamState.Finalize.
func FinalizeClaudeToChatStream(state *ClaudeToChatStreamState) *dto.ChatCompletionsStreamResponse {
	if state == nil || state.terminalSent {
		return nil
	}
	state.terminalSent = true
	finishReason := "stop"
	if state.sawToolCall {
		finishReason = "tool_calls"
	}
	return &dto.ChatCompletionsStreamResponse{
		Id:      state.id,
		Object:  "chat.completion.chunk",
		Created: state.created,
		Model:   state.model,
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta:        dto.ChatCompletionsStreamResponseChoiceDelta{},
				FinishReason: &finishReason,
			},
		},
		Usage: state.usage,
	}
}

func claudeStreamDiagnostic(code string, message string) types.ConversionDiagnostic {
	return types.ConversionDiagnostic{
		Code:     code,
		Message:  message,
		Severity: types.ConversionDiagnosticWarning,
		From:     types.RelayFormatClaude,
		To:       types.RelayFormatOpenAI,
	}
}

// usageFromClaudeAPIUsage is a nil-safe alias so stream state capture never
// synthesizes an all-zero usage entry.
func usageFromClaudeAPIUsage(usage *dto.ClaudeUsage) *dto.Usage {
	if usage == nil {
		return nil
	}
	return UsageFromClaudeAPIUsage(usage)
}

func isClaudeHostedToolStreamBlock(blockType string) bool {
	switch blockType {
	case "server_tool_use", "mcp_tool_use", "web_search_tool_result", "mcp_tool_result", "code_execution_tool_result", "web_fetch_tool_result":
		return true
	default:
		return false
	}
}

func ResponseClaude2OpenAI(claudeResponse *dto.ClaudeResponse) *dto.OpenAITextResponse {
	choices := make([]dto.OpenAITextResponseChoice, 0)
	fullTextResponse := dto.OpenAITextResponse{
		Id:      fmt.Sprintf("chatcmpl-%s", kitutil.GetUUID()),
		Object:  "chat.completion",
		Created: kitutil.GetTimestamp(),
	}
	var responseText strings.Builder
	responseTextOffset := 0
	var thinkingContent strings.Builder
	tools := make([]dto.ToolCallResponse, 0)
	annotations := make([]any, 0)

	// Keep the generated chatcmpl-uuid when the upstream did not provide an id.
	if claudeResponse.Id != "" {
		fullTextResponse.Id = claudeResponse.Id
	}
	for _, message := range claudeResponse.Content {
		switch message.Type {
		case "tool_use":
			args, _ := kitutil.Marshal(message.Input)
			tools = append(tools, dto.ToolCallResponse{
				ID:   message.Id,
				Type: "function",
				Function: dto.FunctionResponse{
					Name:      message.Name,
					Arguments: string(args),
				},
			})
		case "thinking":
			// Accumulate every thinking block; multiple blocks are common
			// when a response interleaves reasoning and tool use.
			if message.Thinking != nil {
				thinkingContent.WriteString(*message.Thinking)
			}
		case "text":
			text := message.GetText()
			offset := responseTextOffset
			responseText.WriteString(text)
			responseTextOffset += utf8.RuneCountInString(text)
			converted, err := claudeCitationsToChat(message.Citations, text, offset)
			if err == nil {
				annotations = append(annotations, converted...)
			}
		}
	}
	choice := dto.OpenAITextResponseChoice{
		Index: 0,
		Message: dto.Message{
			Role: "assistant",
		},
		FinishReason: StopReasonClaudeToOpenAI(claudeResponse.StopReason),
	}
	if choice.FinishReason == "" {
		choice.FinishReason = "stop"
	}
	choice.SetStringContent(responseText.String())
	if encodedAnnotations, err := marshalChatAnnotations(annotations); err == nil && len(encodedAnnotations) > 0 {
		choice.Message.Annotations = encodedAnnotations
	}
	if len(tools) > 0 {
		choice.Message.SetToolCalls(tools)
	}
	if thinkingContent.Len() > 0 {
		accumulated := thinkingContent.String()
		choice.ReasoningContent = &accumulated
	}
	fullTextResponse.Model = claudeResponse.Model
	choices = append(choices, choice)
	fullTextResponse.Choices = choices
	return &fullTextResponse
}

func UsageFromClaudeAPIUsage(usage *dto.ClaudeUsage) *dto.Usage {
	if usage == nil {
		return &dto.Usage{}
	}
	semanticUsage := &dto.Usage{
		PromptTokens:     usage.InputTokens,
		CompletionTokens: usage.OutputTokens,
		UsageSemantic:    "anthropic",
		UsageSource:      "anthropic",
		BillingUsage:     dto.CloneBillingUsage(usage.BillingUsage),
	}
	if semanticUsage.BillingUsage == nil {
		semanticUsage.BillingUsage = dto.NewClaudeMessagesBillingUsage(usage)
	}
	semanticUsage.PromptTokensDetails.CachedTokens = usage.CacheReadInputTokens
	semanticUsage.PromptTokensDetails.CachedCreationTokens = usage.CacheCreationInputTokens
	semanticUsage.ClaudeCacheCreation5mTokens = usage.GetCacheCreation5mTokens()
	semanticUsage.ClaudeCacheCreation1hTokens = usage.GetCacheCreation1hTokens()
	return UsageFromClaudeUsage(semanticUsage)
}

func UsageFromClaudeUsage(usage *dto.Usage) *dto.Usage {
	mapped := buildOpenAIStyleUsageFromClaudeUsage(usage)
	return &mapped
}

func cacheCreationTokensForOpenAIUsage(usage *dto.Usage) int {
	if usage == nil {
		return 0
	}
	splitCacheCreationTokens := usage.ClaudeCacheCreation5mTokens + usage.ClaudeCacheCreation1hTokens
	if splitCacheCreationTokens == 0 {
		return usage.PromptTokensDetails.CachedCreationTokens
	}
	if usage.PromptTokensDetails.CachedCreationTokens > splitCacheCreationTokens {
		return usage.PromptTokensDetails.CachedCreationTokens
	}
	return splitCacheCreationTokens
}

func buildOpenAIStyleUsageFromClaudeUsage(usage *dto.Usage) dto.Usage {
	if usage == nil {
		return dto.Usage{}
	}
	clone := *usage
	clone.BillingUsage = dto.CloneBillingUsage(usage.BillingUsage)
	clone.ClaudeCacheCreation5mTokens, clone.ClaudeCacheCreation1hTokens = sharedclaude.NormalizeCacheCreationSplit(
		usage.PromptTokensDetails.CachedCreationTokens,
		usage.ClaudeCacheCreation5mTokens,
		usage.ClaudeCacheCreation1hTokens,
	)
	cacheCreationTokens := cacheCreationTokensForOpenAIUsage(usage)
	// Expose the standard OpenAI cache-write field alongside the legacy
	// cached_creation_tokens so OpenAI-format clients can bill cache writes.
	clone.PromptTokensDetails.CacheWriteTokens = cacheCreationTokens
	totalInputTokens := usage.PromptTokens + usage.PromptTokensDetails.CachedTokens + cacheCreationTokens
	clone.PromptTokens = totalInputTokens
	clone.InputTokens = totalInputTokens
	clone.TotalTokens = totalInputTokens + usage.CompletionTokens
	clone.UsageSemantic = "openai"
	clone.UsageSource = "anthropic"
	return clone
}

func BuildMessageDeltaPatchUsage(claudeResponse *dto.ClaudeResponse, claudeInfo *ClaudeResponseInfo) *dto.ClaudeUsage {
	usage := &dto.ClaudeUsage{}
	if claudeResponse != nil && claudeResponse.Usage != nil {
		*usage = *claudeResponse.Usage
	}

	if claudeInfo == nil || claudeInfo.Usage == nil {
		return usage
	}

	if usage.InputTokens == 0 && claudeInfo.Usage.PromptTokens > 0 {
		usage.InputTokens = claudeInfo.Usage.PromptTokens
	}
	if usage.CacheReadInputTokens == 0 && claudeInfo.Usage.PromptTokensDetails.CachedTokens > 0 {
		usage.CacheReadInputTokens = claudeInfo.Usage.PromptTokensDetails.CachedTokens
	}
	if usage.CacheCreationInputTokens == 0 && claudeInfo.Usage.PromptTokensDetails.CachedCreationTokens > 0 {
		usage.CacheCreationInputTokens = claudeInfo.Usage.PromptTokensDetails.CachedCreationTokens
	}
	cacheCreation5m := 0
	cacheCreation1h := 0
	if usage.CacheCreation != nil {
		cacheCreation5m = usage.CacheCreation.Ephemeral5mInputTokens
		cacheCreation1h = usage.CacheCreation.Ephemeral1hInputTokens
	} else {
		cacheCreation5m = claudeInfo.Usage.ClaudeCacheCreation5mTokens
		cacheCreation1h = claudeInfo.Usage.ClaudeCacheCreation1hTokens
	}
	cacheCreation5m, cacheCreation1h = sharedclaude.NormalizeCacheCreationSplit(
		usage.CacheCreationInputTokens,
		cacheCreation5m,
		cacheCreation1h,
	)
	if usage.CacheCreation == nil && (cacheCreation5m > 0 || cacheCreation1h > 0) {
		usage.CacheCreation = &dto.ClaudeCacheCreationUsage{}
	}
	if usage.CacheCreation != nil {
		usage.CacheCreation.Ephemeral5mInputTokens = cacheCreation5m
		usage.CacheCreation.Ephemeral1hInputTokens = cacheCreation1h
	}
	return usage
}

func claudeBillingUsageFromSemanticUsage(usage *dto.Usage) *dto.BillingUsage {
	if usage == nil {
		return nil
	}
	cacheCreation5m, cacheCreation1h := sharedclaude.NormalizeCacheCreationSplit(
		usage.PromptTokensDetails.CachedCreationTokens,
		usage.ClaudeCacheCreation5mTokens,
		usage.ClaudeCacheCreation1hTokens,
	)
	claudeUsage := &dto.ClaudeUsage{
		InputTokens:              usage.PromptTokens,
		CacheCreationInputTokens: usage.PromptTokensDetails.CachedCreationTokens,
		CacheReadInputTokens:     usage.PromptTokensDetails.CachedTokens,
		OutputTokens:             usage.CompletionTokens,
	}
	if cacheCreation5m > 0 || cacheCreation1h > 0 {
		claudeUsage.CacheCreation = &dto.ClaudeCacheCreationUsage{
			Ephemeral5mInputTokens: cacheCreation5m,
			Ephemeral1hInputTokens: cacheCreation1h,
		}
	}
	return dto.NewClaudeMessagesBillingUsage(claudeUsage)
}

func updateClaudeStreamBillingUsage(claudeUsage *dto.ClaudeUsage, claudeInfo *ClaudeResponseInfo, terminal bool) {
	if claudeUsage == nil || claudeInfo == nil || claudeInfo.Usage == nil {
		return
	}
	if billingUsage := dto.CloneBillingUsage(claudeUsage.BillingUsage); billingUsage != nil {
		claudeInfo.Usage.BillingUsage = billingUsage
		if terminal || claudeUsage.OutputTokens > 0 {
			claudeInfo.billingUsageSynthesized = false
			return
		}
		claudeInfo.billingUsageSynthesized = true
		return
	}
	if claudeInfo.Usage.BillingUsage != nil && !claudeInfo.billingUsageSynthesized {
		return
	}
	claudeInfo.Usage.BillingUsage = claudeBillingUsageFromSemanticUsage(claudeInfo.Usage)
	claudeInfo.billingUsageSynthesized = claudeInfo.Usage.BillingUsage != nil
}

// FinalizeClaudeStreamBillingUsage refreshes only a locally synthesized
// snapshot after the host has applied its missing-usage fallback. A snapshot
// received on the wire remains authoritative and is never rewritten.
func FinalizeClaudeStreamBillingUsage(claudeInfo *ClaudeResponseInfo) {
	if claudeInfo == nil || claudeInfo.Usage == nil {
		return
	}
	if claudeInfo.Usage.BillingUsage != nil && !claudeInfo.billingUsageSynthesized {
		return
	}

	billingUsage := claudeBillingUsageFromSemanticUsage(claudeInfo.Usage)
	if billingUsage != nil && !claudeInfo.Done {
		billingUsage.Estimated = true
	}
	claudeInfo.Usage.BillingUsage = billingUsage
	claudeInfo.billingUsageSynthesized = billingUsage != nil
}

func PatchClaudeMessageDeltaUsageData(data string, usage *dto.ClaudeUsage) string {
	if data == "" || usage == nil {
		return data
	}

	data = setMessageDeltaUsageInt(data, "usage.input_tokens", usage.InputTokens)
	data = setMessageDeltaUsageInt(data, "usage.cache_read_input_tokens", usage.CacheReadInputTokens)
	data = setMessageDeltaUsageInt(data, "usage.cache_creation_input_tokens", usage.CacheCreationInputTokens)

	if usage.CacheCreation != nil {
		data = setMessageDeltaUsageInt(data, "usage.cache_creation.ephemeral_5m_input_tokens", usage.CacheCreation.Ephemeral5mInputTokens)
		data = setMessageDeltaUsageInt(data, "usage.cache_creation.ephemeral_1h_input_tokens", usage.CacheCreation.Ephemeral1hInputTokens)
	}

	return data
}

func setMessageDeltaUsageInt(data string, path string, localValue int) string {
	if localValue <= 0 {
		return data
	}

	upstreamValue := gjson.Get(data, path)
	if upstreamValue.Exists() && upstreamValue.Int() > 0 {
		return data
	}

	patchedData, err := sjson.Set(data, path, localValue)
	if err != nil {
		return data
	}
	return patchedData
}

func FormatClaudeResponseInfo(claudeResponse *dto.ClaudeResponse, oaiResponse *dto.ChatCompletionsStreamResponse, claudeInfo *ClaudeResponseInfo) bool {
	if claudeInfo == nil {
		return false
	}
	if claudeInfo.Usage == nil {
		claudeInfo.Usage = &dto.Usage{}
	}
	if claudeResponse.Type == "message_start" {
		if claudeResponse.Message != nil {
			claudeInfo.ResponseId = claudeResponse.Message.Id
			claudeInfo.Model = claudeResponse.Message.Model
		}

		if claudeResponse.Message != nil && claudeResponse.Message.Usage != nil {
			messageUsage := claudeResponse.Message.Usage
			claudeInfo.Usage.PromptTokens = messageUsage.InputTokens
			claudeInfo.Usage.UsageSemantic = "anthropic"
			claudeInfo.Usage.PromptTokensDetails.CachedTokens = messageUsage.CacheReadInputTokens
			claudeInfo.Usage.PromptTokensDetails.CachedCreationTokens = messageUsage.CacheCreationInputTokens
			claudeInfo.Usage.ClaudeCacheCreation5mTokens = messageUsage.GetCacheCreation5mTokens()
			claudeInfo.Usage.ClaudeCacheCreation1hTokens = messageUsage.GetCacheCreation1hTokens()
			claudeInfo.Usage.CompletionTokens = messageUsage.OutputTokens
			updateClaudeStreamBillingUsage(messageUsage, claudeInfo, false)
		}
	} else if claudeResponse.Type == "content_block_delta" {
		if claudeResponse.Delta != nil {
			if claudeResponse.Delta.Text != nil {
				claudeInfo.ResponseText.WriteString(*claudeResponse.Delta.Text)
			}
			if claudeResponse.Delta.Thinking != nil {
				claudeInfo.ResponseText.WriteString(*claudeResponse.Delta.Thinking)
			}
		}
	} else if claudeResponse.Type == "message_delta" {
		if claudeResponse.Usage != nil {
			claudeInfo.Usage.UsageSemantic = "anthropic"
			if claudeResponse.Usage.InputTokens > 0 {
				claudeInfo.Usage.PromptTokens = claudeResponse.Usage.InputTokens
			}
			if claudeResponse.Usage.CacheReadInputTokens > 0 {
				claudeInfo.Usage.PromptTokensDetails.CachedTokens = claudeResponse.Usage.CacheReadInputTokens
			}
			if claudeResponse.Usage.CacheCreationInputTokens > 0 {
				claudeInfo.Usage.PromptTokensDetails.CachedCreationTokens = claudeResponse.Usage.CacheCreationInputTokens
			}
			if cacheCreation5m := claudeResponse.Usage.GetCacheCreation5mTokens(); cacheCreation5m > 0 {
				claudeInfo.Usage.ClaudeCacheCreation5mTokens = cacheCreation5m
			}
			if cacheCreation1h := claudeResponse.Usage.GetCacheCreation1hTokens(); cacheCreation1h > 0 {
				claudeInfo.Usage.ClaudeCacheCreation1hTokens = cacheCreation1h
			}
			if claudeResponse.Usage.OutputTokens > 0 {
				claudeInfo.Usage.CompletionTokens = claudeResponse.Usage.OutputTokens
			}
			claudeInfo.Usage.TotalTokens = claudeInfo.Usage.PromptTokens + claudeInfo.Usage.CompletionTokens
			updateClaudeStreamBillingUsage(claudeResponse.Usage, claudeInfo, true)
		}

		claudeInfo.Done = true
	} else if claudeResponse.Type == "content_block_start" {
	} else {
		return false
	}
	if oaiResponse != nil {
		oaiResponse.Id = claudeInfo.ResponseId
		oaiResponse.Created = claudeInfo.Created
		oaiResponse.Model = claudeInfo.Model
	}
	return true
}
