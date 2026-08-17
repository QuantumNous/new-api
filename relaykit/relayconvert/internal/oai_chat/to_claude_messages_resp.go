package oaichat

import (
	"fmt"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/reasonmap"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/samber/lo"
)

// maxToolCallBlockIndex bounds upstream-provided tool_call.index values so a
// malicious or malformed huge index cannot grow conversion state without
// limit. Upstream indexes are lookup keys only and are never exposed as Claude
// content-block indexes.
const maxToolCallBlockIndex = 1024

// maxToolCallBufferBytes caps all tool metadata/argument bytes observed during
// one converted stream. Buffering tool segments is required for correctness,
// but must not allow a malformed upstream to grow memory without bound.
const maxToolCallBufferBytes = 8 << 20

const ambiguousToolPosition = -1

func isIgnorableTrailingToolText(state *convmeta.ClaudeConvertInfo, content string) bool {
	return state != nil &&
		state.LastMessagesType == convmeta.LastMessageTypeTools &&
		content != "" &&
		strings.TrimSpace(content) == ""
}

func generateStopBlock(index int) *dto.ClaudeResponse {
	return &dto.ClaudeResponse{
		Type:  "content_block_stop",
		Index: kitutil.GetPointer[int](index),
	}
}

// mergeMetadataFragment is intentionally limited to id/name metadata. Tool
// arguments use lossless fragment storage and JSON validation instead of
// guessing whether a prefix is a delta or a cumulative snapshot.
func mergeMetadataFragment(current string, fragment string) string {
	if fragment == "" {
		return current
	}
	if current == "" {
		return fragment
	}
	if strings.HasPrefix(fragment, current) {
		return fragment
	}
	if strings.HasPrefix(current, fragment) {
		return current
	}
	return current + fragment
}

func resetPendingToolCalls(state *convmeta.ClaudeConvertInfo) {
	if state == nil {
		return
	}
	state.PendingToolCalls = nil
	state.PendingToolOrder = nil
	state.ToolCallByIndex = nil
	state.ToolCallByID = nil
	state.ToolCallByPos = nil
	state.LastMessagesType = convmeta.LastMessageTypeNone
}

func ensurePendingToolState(state *convmeta.ClaudeConvertInfo) {
	if state.PendingToolCalls == nil {
		state.PendingToolCalls = make(map[int]*convmeta.ClaudeToolCallBuffer)
	}
	if state.ToolCallByIndex == nil {
		state.ToolCallByIndex = make(map[int]int)
	}
	if state.ToolCallByID == nil {
		state.ToolCallByID = make(map[string]int)
	}
	if state.ToolCallByPos == nil {
		state.ToolCallByPos = make(map[int]int)
	}
}

func newPendingToolCall(state *convmeta.ClaudeConvertInfo) (int, *convmeta.ClaudeToolCallBuffer) {
	key := state.NextToolCallKey
	state.NextToolCallKey++
	buffer := &convmeta.ClaudeToolCallBuffer{}
	state.PendingToolCalls[key] = buffer
	state.PendingToolOrder = append(state.PendingToolOrder, key)
	return key, buffer
}

func looksLikeStableToolID(value string) bool {
	return (strings.HasPrefix(value, "call_") && len(value) > len("call_")) ||
		(strings.HasPrefix(value, "tool_") && len(value) > len("tool_")) ||
		(strings.HasPrefix(value, "toolu_") && len(value) > len("toolu_")) ||
		len(value) >= 16
}

func toolKeyHasDifferentPosition(state *convmeta.ClaudeConvertInfo, key int, position int) bool {
	for knownPosition, knownKey := range state.ToolCallByPos {
		if knownKey == key && knownPosition != position {
			return true
		}
	}
	return false
}

func pendingNoIndexToolCount(state *convmeta.ClaudeConvertInfo) int {
	count := 0
	for _, buffer := range state.PendingToolCalls {
		if buffer != nil && buffer.UpstreamIndex == nil {
			count++
		}
	}
	return count
}

func hasMetadataPrefixRelation(current string, incoming string) bool {
	return current == incoming || strings.HasPrefix(current, incoming) || strings.HasPrefix(incoming, current)
}

func validatePositionOnlyToolIdentity(buffer *convmeta.ClaudeToolCallBuffer, toolCall dto.ToolCallResponse, position int) error {
	if buffer == nil {
		return fmt.Errorf("missing tool buffer at position %d", position)
	}
	if buffer.ID != "" && toolCall.ID != "" {
		if buffer.ID != toolCall.ID &&
			(looksLikeStableToolID(buffer.ID) && looksLikeStableToolID(toolCall.ID) ||
				!hasMetadataPrefixRelation(buffer.ID, toolCall.ID)) {
			return fmt.Errorf("ambiguous position-only tool ids %q and %q at position %d", buffer.ID, toolCall.ID, position)
		}
		if buffer.Name != "" && toolCall.Function.Name != "" && !hasMetadataPrefixRelation(buffer.Name, toolCall.Function.Name) {
			return fmt.Errorf("conflicting names for position-only tool id %q at position %d", buffer.ID, position)
		}
		return nil
	}
	if buffer.ID == "" && toolCall.ID == "" && buffer.Name != "" && toolCall.Function.Name != "" && buffer.Name != toolCall.Function.Name {
		return fmt.Errorf("ambiguous position-only tool names %q and %q at position %d", buffer.Name, toolCall.Function.Name, position)
	}
	return nil
}

func resolvePendingToolCall(state *convmeta.ClaudeConvertInfo, position int, chunkSize int, toolCall dto.ToolCallResponse, duplicateID bool) (int, *convmeta.ClaudeToolCallBuffer, error) {
	ensurePendingToolState(state)
	if toolCall.Index == nil && position > maxToolCallBlockIndex {
		return 0, nil, fmt.Errorf("invalid no-index tool position %d", position)
	}

	indexKey, hasIndexKey := 0, false
	if toolCall.Index != nil {
		if *toolCall.Index < 0 || *toolCall.Index > maxToolCallBlockIndex {
			return 0, nil, fmt.Errorf("invalid upstream tool index %d", *toolCall.Index)
		}
		indexKey, hasIndexKey = state.ToolCallByIndex[*toolCall.Index]
	}
	idKey, hasIDKey := 0, false
	useIDIdentity := toolCall.ID != "" && !duplicateID && (toolCall.Index == nil || looksLikeStableToolID(toolCall.ID))
	if useIDIdentity {
		idKey, hasIDKey = state.ToolCallByID[toolCall.ID]
		if hasIDKey && idKey == ambiguousToolPosition {
			hasIDKey = false
		}
		if hasIDKey && toolCall.Index == nil && !looksLikeStableToolID(toolCall.ID) && toolKeyHasDifferentPosition(state, idKey, position) {
			return 0, nil, fmt.Errorf("ambiguous fragmented tool id %q at position %d", toolCall.ID, position)
		}
	}
	if hasIndexKey && hasIDKey && indexKey != idKey {
		return 0, nil, fmt.Errorf("conflicting tool identity for index %d and id %q", *toolCall.Index, toolCall.ID)
	}

	key := 0
	var buffer *convmeta.ClaudeToolCallBuffer
	matchedByPositionOnly := false
	switch {
	case hasIndexKey:
		key = indexKey
		buffer = state.PendingToolCalls[key]
	case hasIDKey:
		key = idKey
		buffer = state.PendingToolCalls[key]
	case toolCall.Index == nil:
		positionKey, ok := state.ToolCallByPos[position]
		if ok && positionKey == ambiguousToolPosition {
			return 0, nil, fmt.Errorf("ambiguous no-index tool fragment at position %d", position)
		}
		noIndexCount := pendingNoIndexToolCount(state)
		if ok && !hasIDKey && noIndexCount > 1 && chunkSize < noIndexCount {
			return 0, nil, fmt.Errorf("cannot disambiguate %d no-index tools from a %d-call subset", noIndexCount, chunkSize)
		}
		if ok {
			key = positionKey
			buffer = state.PendingToolCalls[key]
			matchedByPositionOnly = true
		} else {
			key, buffer = newPendingToolCall(state)
		}
	default:
		key, buffer = newPendingToolCall(state)
	}
	if buffer == nil {
		return 0, nil, fmt.Errorf("missing tool buffer for internal key %d", key)
	}
	if matchedByPositionOnly {
		if err := validatePositionOnlyToolIdentity(buffer, toolCall, position); err != nil {
			return 0, nil, err
		}
	}

	if toolCall.Index != nil {
		if buffer.UpstreamIndex != nil && *buffer.UpstreamIndex != *toolCall.Index {
			return 0, nil, fmt.Errorf("tool id %q changed upstream index from %d to %d", toolCall.ID, *buffer.UpstreamIndex, *toolCall.Index)
		}
		index := *toolCall.Index
		buffer.UpstreamIndex = &index
		state.ToolCallByIndex[index] = key
	} else {
		positionKey, ok := state.ToolCallByPos[position]
		if !ok {
			state.ToolCallByPos[position] = key
		} else if positionKey != key {
			// An exact id can safely relocate when a provider emits only a subset
			// of parallel calls in a later chunk. Future id-less fragments at this
			// position are no longer distinguishable and therefore fail closed.
			state.ToolCallByPos[position] = ambiguousToolPosition
		}
	}

	if toolCall.ID != "" {
		oldID := buffer.ID
		if buffer.ID != "" &&
			looksLikeStableToolID(buffer.ID) &&
			looksLikeStableToolID(toolCall.ID) &&
			!strings.HasPrefix(buffer.ID, toolCall.ID) &&
			!strings.HasPrefix(toolCall.ID, buffer.ID) {
			return 0, nil, fmt.Errorf("conflicting tool ids %q and %q", buffer.ID, toolCall.ID)
		}
		buffer.ID = mergeMetadataFragment(buffer.ID, toolCall.ID)
		if oldID != "" && oldID != buffer.ID {
			if oldKey, exists := state.ToolCallByID[oldID]; exists && oldKey == key {
				delete(state.ToolCallByID, oldID)
			}
		}
		registerCurrentID := !duplicateID && (toolCall.Index == nil || looksLikeStableToolID(buffer.ID))
		if registerCurrentID {
			if otherKey, exists := state.ToolCallByID[buffer.ID]; exists && otherKey != key {
				return 0, nil, fmt.Errorf("tool id %q resolves to multiple calls", buffer.ID)
			}
			state.ToolCallByID[buffer.ID] = key
		}
	}
	buffer.Name = mergeMetadataFragment(buffer.Name, toolCall.Function.Name)
	return key, buffer, nil
}

func bufferToolCallDeltas(state *convmeta.ClaudeConvertInfo, toolCalls []dto.ToolCallResponse) error {
	idCounts := make(map[string]int, len(toolCalls))
	for _, toolCall := range toolCalls {
		if toolCall.ID != "" {
			idCounts[toolCall.ID]++
		}
	}
	for position, toolCall := range toolCalls {
		addedBytes := len(toolCall.ID) + len(toolCall.Function.Name) + len(toolCall.Function.Arguments)
		if addedBytes > maxToolCallBufferBytes-state.ToolBufferBytes {
			return fmt.Errorf("tool-call buffer exceeds %d bytes", maxToolCallBufferBytes)
		}
		state.ToolBufferBytes += addedBytes
		_, buffer, err := resolvePendingToolCall(state, position, len(toolCalls), toolCall, toolCall.ID != "" && idCounts[toolCall.ID] > 1)
		if err != nil {
			return err
		}
		if toolCall.Function.Arguments != "" {
			buffer.ArgumentFragments = append(buffer.ArgumentFragments, toolCall.Function.Arguments)
		}
	}
	return nil
}

func parseJSONObject(value string) bool {
	var object map[string]any
	if err := kitutil.Unmarshal([]byte(value), &object); err != nil {
		return false
	}
	return object != nil
}

func resolveToolArguments(fragments []string) (string, error) {
	if len(fragments) == 0 {
		return "", nil
	}
	joined := strings.Join(fragments, "")
	if strings.TrimSpace(joined) == "" {
		return "", nil
	}
	if parseJSONObject(joined) {
		return joined, nil
	}

	best := ""
	for _, fragment := range fragments {
		if !parseJSONObject(fragment) {
			continue
		}
		// Prefer the longest valid cumulative snapshot; equal-length later
		// snapshots win, matching providers that replay corrected JSON.
		if len(fragment) >= len(best) {
			best = fragment
		}
	}
	if best != "" {
		return best, nil
	}
	return "", fmt.Errorf("tool arguments do not form a JSON object")
}

type preparedClaudeToolCall struct {
	buffer    *convmeta.ClaudeToolCallBuffer
	arguments string
}

// flushPendingToolCalls emits only complete tool calls. Each valid call is
// emitted atomically as start -> optional delta -> stop, and downstream indexes
// are allocated contiguously regardless of upstream identity/index shape.
func flushPendingToolCalls(state *convmeta.ClaudeConvertInfo) ([]*dto.ClaudeResponse, error) {
	if state == nil || len(state.PendingToolCalls) == 0 {
		if state != nil {
			resetPendingToolCalls(state)
		}
		return nil, nil
	}

	orderedKeys := append([]int(nil), state.PendingToolOrder...)
	allExplicit := len(orderedKeys) > 0
	for _, key := range orderedKeys {
		if buffer := state.PendingToolCalls[key]; buffer == nil || buffer.UpstreamIndex == nil {
			allExplicit = false
			break
		}
	}
	if allExplicit {
		sort.SliceStable(orderedKeys, func(i, j int) bool {
			return *state.PendingToolCalls[orderedKeys[i]].UpstreamIndex < *state.PendingToolCalls[orderedKeys[j]].UpstreamIndex
		})
	}

	prepared := make([]preparedClaudeToolCall, 0, len(orderedKeys))
	for _, key := range orderedKeys {
		buffer := state.PendingToolCalls[key]
		if buffer == nil || strings.TrimSpace(buffer.ID) == "" || strings.TrimSpace(buffer.Name) == "" {
			return nil, fmt.Errorf("incomplete tool call missing id or name")
		}
		arguments, err := resolveToolArguments(buffer.ArgumentFragments)
		if err != nil {
			return nil, fmt.Errorf("tool %q: %w", buffer.Name, err)
		}
		prepared = append(prepared, preparedClaudeToolCall{buffer: buffer, arguments: arguments})
	}

	responses := make([]*dto.ClaudeResponse, 0, len(prepared)*3)
	for _, toolCall := range prepared {
		blockIndex := state.Index
		responses = append(responses, &dto.ClaudeResponse{
			Index: &blockIndex,
			Type:  "content_block_start",
			ContentBlock: &dto.ClaudeMediaMessage{
				Id:    toolCall.buffer.ID,
				Type:  "tool_use",
				Name:  toolCall.buffer.Name,
				Input: map[string]interface{}{},
			},
		})
		if toolCall.arguments != "" {
			arguments := toolCall.arguments
			responses = append(responses, &dto.ClaudeResponse{
				Index: &blockIndex,
				Type:  "content_block_delta",
				Delta: &dto.ClaudeMediaMessage{
					Type:        "input_json_delta",
					PartialJson: &arguments,
				},
			})
		}
		responses = append(responses, generateStopBlock(blockIndex))
		state.Index++
	}
	resetPendingToolCalls(state)
	return responses, nil
}

func closeActiveClaudeBlocks(state *convmeta.ClaudeConvertInfo) ([]*dto.ClaudeResponse, error) {
	if state == nil {
		return nil, nil
	}
	switch state.LastMessagesType {
	case convmeta.LastMessageTypeText, convmeta.LastMessageTypeThinking:
		responses := []*dto.ClaudeResponse{generateStopBlock(state.Index)}
		state.Index++
		state.LastMessagesType = convmeta.LastMessageTypeNone
		return responses, nil
	case convmeta.LastMessageTypeTools:
		return flushPendingToolCalls(state)
	default:
		return nil, nil
	}
}

func claudeConversionError(message string) *dto.ClaudeResponse {
	return &dto.ClaudeResponse{
		Type: "error",
		Error: types.ClaudeError{
			Type:    "api_error",
			Message: "relay stream conversion error: " + message,
		},
	}
}

func abortClaudeConversion(state *convmeta.ClaudeConvertInfo, message string) []*dto.ClaudeResponse {
	var responses []*dto.ClaudeResponse
	if state != nil {
		if state.LastMessagesType == convmeta.LastMessageTypeText || state.LastMessagesType == convmeta.LastMessageTypeThinking {
			responses = append(responses, generateStopBlock(state.Index))
			state.Index++
		}
		resetPendingToolCalls(state)
		state.Done = true
	}
	return append(responses, claudeConversionError(message))
}

func buildClaudeUsageFromOpenAIUsage(oaiUsage *dto.Usage) *dto.ClaudeUsage {
	if oaiUsage == nil {
		return nil
	}
	if billingUsage := dto.CloneBillingUsage(oaiUsage.BillingUsage); billingUsage != nil && billingUsage.ClaudeUsage != nil {
		if billingUsage.Source == dto.BillingUsageSourceClaudeMessages || billingUsage.Semantic == dto.BillingUsageSemanticAnthropic {
			return billingUsage.ClaudeUsage
		}
	}
	billingUsage := dto.NewOpenAIChatBillingUsage(oaiUsage)
	if existingBillingUsage := dto.CloneBillingUsage(oaiUsage.BillingUsage); existingBillingUsage != nil && existingBillingUsage.OpenAIUsage != nil {
		if existingBillingUsage.Source == dto.BillingUsageSourceOAIChat ||
			existingBillingUsage.Source == dto.BillingUsageSourceOAIResponses ||
			existingBillingUsage.Semantic == dto.BillingUsageSemanticOpenAI {
			billingUsage = existingBillingUsage
		}
	}
	cacheCreation5m, cacheCreation1h := NormalizeCacheCreationSplit(
		oaiUsage.PromptTokensDetails.CachedCreationTokens,
		oaiUsage.ClaudeCacheCreation5mTokens,
		oaiUsage.ClaudeCacheCreation1hTokens,
	)
	cacheCreationTokens := oaiUsage.PromptTokensDetails.CacheCreationTokensTotal()
	inputTokens := oaiUsage.PromptTokens
	if oaiUsage.PromptTokensDetails.CacheWriteTokens > 0 {
		// OpenAI native cache-write usage counts cached and cache-write tokens
		// inside prompt_tokens, while Claude semantics reports input_tokens
		// excluding both. Both counts are unadjusted prefixes and may overlap,
		// so clamp a negative remainder at zero.
		inputTokens = oaiUsage.PromptTokens - oaiUsage.PromptTokensDetails.CachedTokens - cacheCreationTokens
		if inputTokens < 0 {
			inputTokens = 0
		}
	}
	usage := &dto.ClaudeUsage{
		InputTokens:              inputTokens,
		OutputTokens:             oaiUsage.CompletionTokens,
		CacheCreationInputTokens: cacheCreationTokens,
		CacheReadInputTokens:     oaiUsage.PromptTokensDetails.CachedTokens,
		BillingUsage:             billingUsage,
	}
	if cacheCreation5m > 0 || cacheCreation1h > 0 {
		usage.CacheCreation = &dto.ClaudeCacheCreationUsage{
			Ephemeral5mInputTokens: cacheCreation5m,
			Ephemeral1hInputTokens: cacheCreation1h,
		}
	}
	return usage
}

func NormalizeCacheCreationSplit(totalTokens int, tokens5m int, tokens1h int) (int, int) {
	remainder := lo.Max([]int{totalTokens - tokens5m - tokens1h, 0})
	return tokens5m + remainder, tokens1h
}

func StreamResponseOpenAI2Claude(openAIResponse *dto.ChatCompletionsStreamResponse, info convmeta.Meta) []*dto.ClaudeResponse {
	if info == nil {
		info = &convmeta.Values{}
	}
	state := info.EnsureClaudeConvertInfo()
	if state.Done || openAIResponse == nil {
		return nil
	}

	var claudeResponses []*dto.ClaudeResponse
	fail := func(err error) []*dto.ClaudeResponse {
		return append(claudeResponses, abortClaudeConversion(state, err.Error())...)
	}
	closeBlocks := func() error {
		responses, err := closeActiveClaudeBlocks(state)
		claudeResponses = append(claudeResponses, responses...)
		return err
	}

	if !state.MessageStarted {
		msg := &dto.ClaudeMediaMessage{
			Id:    openAIResponse.Id,
			Model: openAIResponse.Model,
			Type:  "message",
			Role:  "assistant",
			Usage: &dto.ClaudeUsage{
				InputTokens:  info.GetEstimatePromptTokens(),
				OutputTokens: 0,
			},
		}
		msg.SetContent(make([]any, 0))
		claudeResponses = append(claudeResponses, &dto.ClaudeResponse{
			Type:    "message_start",
			Message: msg,
		})
		state.MessageStarted = true
	}

	if len(openAIResponse.Choices) == 0 {
		// Some OpenAI-compatible upstreams end with a usage-only SSE chunk.
		oaiUsage := openAIResponse.Usage
		if oaiUsage == nil {
			oaiUsage = state.Usage
		}
		if oaiUsage == nil {
			return claudeResponses
		}
		if err := closeBlocks(); err != nil {
			return fail(err)
		}
		stopReason := stopReasonOpenAI2Claude(state.FinishReason)
		if stopReason == "" {
			stopReason = "end_turn"
		}
		claudeResponses = append(claudeResponses,
			&dto.ClaudeResponse{
				Type:  "message_delta",
				Usage: buildClaudeUsageFromOpenAIUsage(oaiUsage),
				Delta: &dto.ClaudeMediaMessage{StopReason: kitutil.GetPointer[string](stopReason)},
			},
			&dto.ClaudeResponse{Type: "message_stop"},
		)
		state.Done = true
		return claudeResponses
	}

	chosenChoice := openAIResponse.Choices[0]
	doneChunk := chosenChoice.FinishReason != nil && *chosenChoice.FinishReason != ""
	if doneChunk {
		state.FinishReason = *chosenChoice.FinishReason
	}

	// Preserve all fields from mixed provider chunks in deterministic semantic
	// order: reasoning -> tools -> text. The finish flag is handled only after
	// every delta field, so a final tool-argument fragment cannot be dropped.
	reasoning := chosenChoice.Delta.GetReasoningContent()
	if reasoning != "" {
		if state.LastMessagesType != convmeta.LastMessageTypeThinking {
			if err := closeBlocks(); err != nil {
				return fail(err)
			}
			blockIndex := state.Index
			claudeResponses = append(claudeResponses, &dto.ClaudeResponse{
				Index: &blockIndex,
				Type:  "content_block_start",
				ContentBlock: &dto.ClaudeMediaMessage{
					Type:     "thinking",
					Thinking: kitutil.GetPointer[string](""),
				},
			})
			state.LastMessagesType = convmeta.LastMessageTypeThinking
		}
		blockIndex := state.Index
		claudeResponses = append(claudeResponses, &dto.ClaudeResponse{
			Index: &blockIndex,
			Type:  "content_block_delta",
			Delta: &dto.ClaudeMediaMessage{Type: "thinking_delta", Thinking: &reasoning},
		})
	}

	if len(chosenChoice.Delta.ToolCalls) > 0 {
		if state.LastMessagesType != convmeta.LastMessageTypeTools {
			if err := closeBlocks(); err != nil {
				return fail(err)
			}
			state.LastMessagesType = convmeta.LastMessageTypeTools
		}
		if err := bufferToolCallDeltas(state, chosenChoice.Delta.ToolCalls); err != nil {
			return fail(err)
		}
	}

	textContent := chosenChoice.Delta.GetContentString()
	if isIgnorableTrailingToolText(state, textContent) {
		textContent = ""
	}
	if textContent != "" {
		if state.LastMessagesType != convmeta.LastMessageTypeText {
			if err := closeBlocks(); err != nil {
				return fail(err)
			}
			blockIndex := state.Index
			claudeResponses = append(claudeResponses, &dto.ClaudeResponse{
				Index: &blockIndex,
				Type:  "content_block_start",
				ContentBlock: &dto.ClaudeMediaMessage{
					Type: "text",
					Text: kitutil.GetPointer[string](""),
				},
			})
			state.LastMessagesType = convmeta.LastMessageTypeText
		}
		blockIndex := state.Index
		claudeResponses = append(claudeResponses, &dto.ClaudeResponse{
			Index: &blockIndex,
			Type:  "content_block_delta",
			Delta: &dto.ClaudeMediaMessage{Type: "text_delta", Text: &textContent},
		})
	}

	if !doneChunk {
		return claudeResponses
	}

	oaiUsage := openAIResponse.Usage
	if oaiUsage == nil {
		oaiUsage = state.Usage
	}
	// Finish is a protocol boundary for buffered tools even when usage comes in
	// a later chunk: flush them now, after the final delta above. Text/thinking
	// may remain open until the usage chunk/finalizer to preserve the established
	// terminal-tail contract.
	if state.LastMessagesType == convmeta.LastMessageTypeTools {
		if err := closeBlocks(); err != nil {
			return fail(err)
		}
	}
	if oaiUsage == nil {
		return claudeResponses
	}
	if err := closeBlocks(); err != nil {
		return fail(err)
	}
	stopReason := stopReasonOpenAI2Claude(state.FinishReason)
	claudeResponses = append(claudeResponses,
		&dto.ClaudeResponse{
			Type:  "message_delta",
			Usage: buildClaudeUsageFromOpenAIUsage(oaiUsage),
			Delta: &dto.ClaudeMediaMessage{StopReason: kitutil.GetPointer[string](stopReason)},
		},
		&dto.ClaudeResponse{Type: "message_stop"},
	)
	state.Done = true
	return claudeResponses
}

func FinalizeStreamResponseOpenAI2Claude(info convmeta.Meta) []*dto.ClaudeResponse {
	if info == nil {
		info = &convmeta.Values{}
	}
	state := info.EnsureClaudeConvertInfo()
	if state.Done {
		return nil
	}

	responses, err := closeActiveClaudeBlocks(state)
	if err != nil {
		return abortClaudeConversion(state, err.Error())
	}
	stopReason := stopReasonOpenAI2Claude(state.FinishReason)
	if stopReason == "" {
		stopReason = "end_turn"
	}
	responses = append(responses,
		&dto.ClaudeResponse{
			Type:  "message_delta",
			Usage: buildClaudeUsageFromOpenAIUsage(state.Usage),
			Delta: &dto.ClaudeMediaMessage{
				StopReason: kitutil.GetPointer[string](stopReason),
			},
		},
		&dto.ClaudeResponse{Type: "message_stop"},
	)
	state.Done = true
	return responses
}

func ResponseOpenAI2Claude(openAIResponse *dto.OpenAITextResponse, info convmeta.Meta) *dto.ClaudeResponse {
	var stopReason string
	contents := make([]dto.ClaudeMediaMessage, 0)
	claudeResponse := &dto.ClaudeResponse{
		Id:    openAIResponse.Id,
		Type:  "message",
		Role:  "assistant",
		Model: openAIResponse.Model,
	}
	for _, choice := range openAIResponse.Choices {
		stopReason = stopReasonOpenAI2Claude(choice.FinishReason)
		textContent := choice.Message.StringContent()
		toolCalls := choice.Message.ParseToolCalls()
		if textContent != "" || len(toolCalls) == 0 {
			claudeContent := dto.ClaudeMediaMessage{}
			claudeContent.Type = "text"
			claudeContent.SetText(textContent)
			contents = append(contents, claudeContent)
		}
		for _, toolUse := range toolCalls {
			claudeContent := dto.ClaudeMediaMessage{}
			claudeContent.Type = "tool_use"
			claudeContent.Id = toolUse.ID
			claudeContent.Name = toolUse.Function.Name
			mapParams := map[string]interface{}{}
			if strings.TrimSpace(toolUse.Function.Arguments) != "" {
				var parsed map[string]interface{}
				if err := kitutil.Unmarshal([]byte(toolUse.Function.Arguments), &parsed); err == nil && parsed != nil {
					mapParams = parsed
				}
			}
			claudeContent.Input = mapParams
			contents = append(contents, claudeContent)
		}
	}
	claudeResponse.Content = contents
	claudeResponse.StopReason = stopReason
	claudeResponse.Usage = buildClaudeUsageFromOpenAIUsage(&openAIResponse.Usage)

	return claudeResponse
}

func stopReasonOpenAI2Claude(reason string) string {
	return reasonmap.OpenAIFinishReasonToClaudeStopReason(reason)
}
