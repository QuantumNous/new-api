package generationdebug

import (
	"bufio"
	"bytes"
	"fmt"
	"math"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

func BuildCacheStatsFromUsage(usage *dto.Usage) CacheStats {
	if usage == nil {
		return CacheStats{}
	}
	cachedTokens := max(
		usage.PromptTokensDetails.CachedTokens,
		usage.PromptCacheHitTokens,
	)
	if usage.InputTokensDetails != nil {
		cachedTokens = max(cachedTokens, usage.InputTokensDetails.CachedTokens)
	}
	cacheWriteTokens := usage.PromptTokensDetails.CachedCreationTokens
	splitCacheWriteTokens := usage.ClaudeCacheCreation5mTokens + usage.ClaudeCacheCreation1hTokens
	if splitCacheWriteTokens > cacheWriteTokens {
		cacheWriteTokens = splitCacheWriteTokens
	}
	return CacheStats{
		CachedTokens:     cachedTokens,
		CacheWriteTokens: cacheWriteTokens,
		CacheHitRate:     float64(cachedTokens) / float64(max(usage.PromptTokens, 1)),
	}
}

func ExtractPromptFromRequest(data []byte) PromptDebug {
	result := PromptDebug{
		RoleCounts: make(map[string]int),
		Estimated:  true,
	}
	var root map[string]any
	if err := common.Unmarshal(data, &root); err != nil {
		return result
	}
	result.Instructions = root["instructions"]
	if result.Instructions == nil {
		result.Instructions = root["instruction"]
	}
	result.Tools = root["tools"]
	if result.Tools == nil {
		result.Tools = root["functions"]
	}
	result.Units = appendRootUnits(result.Units, root)

	if messages, ok := root["messages"].([]any); ok {
		result.Messages = extractMessages(messages)
		result.Units = appendMessageUnits(result.Units, "messages", messages)
	} else if inputs, ok := root["input"].([]any); ok {
		result.Messages = extractMessages(inputs)
		result.Units = appendMessageUnits(result.Units, "input", inputs)
	} else if input, ok := root["input"].(string); ok {
		result.Messages = []PromptMessage{newPromptMessage("user", input, false, 0)}
		result.Units = appendTextUnit(result.Units, "input", "user", "text", input, 0)
	} else if prompt, ok := root["prompt"].(string); ok {
		result.Messages = []PromptMessage{newPromptMessage("user", prompt, false, 0)}
		result.Units = appendTextUnit(result.Units, "prompt", "user", "text", prompt, 0)
	}
	for _, message := range result.Messages {
		result.RoleCounts[message.Role]++
		result.TotalEstimatedTokens += message.EstimatedTokens
	}
	if result.Instructions != nil {
		result.TotalEstimatedTokens += estimateTokens(contentText(result.Instructions))
	}
	if result.Tools != nil {
		result.TotalEstimatedTokens += estimateTokens(contentText(result.Tools))
	}
	result.Units = finalizePromptUnits(result.Units)
	if len(result.Units) > 0 {
		result.TotalEstimatedTokens = result.Units[len(result.Units)-1].CumulativeEnd
	}
	return result
}

func ApplyPromptAccounting(prompt *PromptDebug, usage *dto.Usage, cache CacheStats, cacheWriteSource, cacheWriteConfidence string) {
	if prompt == nil {
		return
	}
	source := "local_estimate"
	confidence := "estimated"
	promptTokens := prompt.TotalEstimatedTokens
	completionTokens := 0
	if usage != nil {
		source = "provider_usage"
		confidence = "exact"
		promptTokens = usage.PromptTokens
		completionTokens = usage.CompletionTokens
	}
	if cacheWriteSource == "" {
		cacheWriteSource = source
	}
	if cacheWriteConfidence == "" {
		cacheWriteConfidence = confidence
	}
	prompt.TokenAccounting = &PromptTokenAccounting{
		PromptTokens:         promptTokens,
		CachedTokens:         cache.CachedTokens,
		CacheWriteTokens:     cache.CacheWriteTokens,
		CompletionTokens:     completionTokens,
		Source:               source,
		Confidence:           confidence,
		CacheWriteSource:     cacheWriteSource,
		CacheWriteConfidence: cacheWriteConfidence,
	}
	applyCacheBoundary(prompt, cache.CachedTokens, promptTokens)
}

func ExtractOutputFromRawResponse(data []byte) ExtractedOutput {
	var root map[string]any
	if err := common.Unmarshal(data, &root); err != nil {
		return ExtractedOutput{}
	}
	result := ExtractedOutput{
		GenerationID: stringValue(root["id"]),
	}
	if choices, ok := root["choices"].([]any); ok {
		for _, choiceValue := range choices {
			choice, ok := choiceValue.(map[string]any)
			if !ok {
				continue
			}
			result.FinishReason = firstNonEmpty(result.FinishReason, stringValue(choice["finish_reason"]))
			if message, ok := choice["message"].(map[string]any); ok {
				result.Output += contentText(message["content"])
				result.Reasoning += firstNonEmpty(
					contentText(message["reasoning_content"]),
					contentText(message["reasoning"]),
				)
			} else {
				result.Output += contentText(choice["text"])
			}
		}
	}
	if outputs, ok := root["output"].([]any); ok {
		result.Output += extractResponsesOutput(outputs)
	}
	if result.FinishReason == "" {
		result.FinishReason = responseFinishReason(root)
	}
	return result
}

func ExtractOutputFromSSE(data []byte) ExtractedOutput {
	var result ExtractedOutput
	scanner := bufio.NewScanner(bytes.NewReader(data))
	scanner.Buffer(make([]byte, 64<<10), max(len(data), 64<<10))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if payload == "" || payload == "[DONE]" {
			continue
		}
		var root map[string]any
		if err := common.UnmarshalJsonStr(payload, &root); err != nil {
			continue
		}
		result.GenerationID = firstNonEmpty(result.GenerationID, stringValue(root["id"]))
		eventType := stringValue(root["type"])
		switch eventType {
		case "response.output_text.delta":
			result.Output += stringValue(root["delta"])
		case "response.reasoning_summary_text.delta":
			result.Reasoning += stringValue(root["delta"])
		case "response.completed", "response.incomplete":
			if response, ok := root["response"].(map[string]any); ok {
				result.GenerationID = firstNonEmpty(result.GenerationID, stringValue(response["id"]))
				if outputs, ok := response["output"].([]any); ok && result.Output == "" {
					result.Output = extractResponsesOutput(outputs)
				}
				result.FinishReason = firstNonEmpty(result.FinishReason, responseFinishReason(response))
			}
		}
		if choices, ok := root["choices"].([]any); ok {
			for _, choiceValue := range choices {
				choice, ok := choiceValue.(map[string]any)
				if !ok {
					continue
				}
				result.FinishReason = firstNonEmpty(result.FinishReason, stringValue(choice["finish_reason"]))
				if delta, ok := choice["delta"].(map[string]any); ok {
					result.Output += contentText(delta["content"])
					result.Reasoning += firstNonEmpty(
						contentText(delta["reasoning_content"]),
						contentText(delta["reasoning"]),
					)
				}
			}
		}
	}
	return result
}

func extractMessages(values []any) []PromptMessage {
	messages := make([]PromptMessage, 0, len(values))
	for _, value := range values {
		message, ok := value.(map[string]any)
		if !ok {
			continue
		}
		role := stringValue(message["role"])
		if role == "" {
			role = "user"
		}
		content := contentText(message["content"])
		if content == "" {
			content = contentText(message["text"])
		}
		cached := containsCacheMarker(message)
		messages = append(messages, newPromptMessage(role, content, cached, len(messages)))
	}
	return messages
}

func appendRootUnits(units []PromptUnit, root map[string]any) []PromptUnit {
	for _, key := range []string{"instructions", "instruction", "system", "developer"} {
		if value, ok := root[key]; ok && value != nil {
			units = appendValueUnit(units, key, key, "text", value, -1)
		}
	}
	for _, key := range []string{"tools", "functions"} {
		if value, ok := root[key]; ok && value != nil {
			units = appendValueUnit(units, key, "", "tool_schema", value, -1)
		}
	}
	if value, ok := root["tool_choice"]; ok && value != nil {
		units = appendValueUnit(units, "tool_choice", "", "tool_choice", value, -1)
	}
	if value, ok := root["response_format"]; ok && value != nil {
		units = appendValueUnit(units, "response_format", "", "response_format", value, -1)
	}
	return units
}

func appendMessageUnits(units []PromptUnit, basePath string, values []any) []PromptUnit {
	for messageIndex, value := range values {
		message, ok := value.(map[string]any)
		if !ok {
			units = appendValueUnit(units, fmt.Sprintf("%s[%d]", basePath, messageIndex), "user", "text", value, messageIndex)
			continue
		}
		role := stringValue(message["role"])
		if role == "" {
			role = "user"
		}
		if content, ok := message["content"]; ok {
			units = appendContentUnits(units, fmt.Sprintf("%s[%d].content", basePath, messageIndex), role, content, messageIndex)
			continue
		}
		if text, ok := message["text"]; ok {
			units = appendContentUnits(units, fmt.Sprintf("%s[%d].text", basePath, messageIndex), role, text, messageIndex)
			continue
		}
		units = appendValueUnit(units, fmt.Sprintf("%s[%d]", basePath, messageIndex), role, "metadata", message, messageIndex)
	}
	return units
}

func appendContentUnits(units []PromptUnit, path, role string, value any, messageIndex int) []PromptUnit {
	switch typed := value.(type) {
	case string:
		return appendTextUnit(units, path, role, "text", typed, messageIndex)
	case []any:
		for partIndex, part := range typed {
			partPath := fmt.Sprintf("%s[%d]", path, partIndex)
			partKind := "text"
			partText := contentText(part)
			if partMap, ok := part.(map[string]any); ok {
				partType := stringValue(partMap["type"])
				if partType != "" {
					partKind = partType
				}
				for _, key := range []string{"text", "input_text", "content"} {
					if text := contentText(partMap[key]); text != "" {
						partText = text
						partPath = fmt.Sprintf("%s.%s", partPath, key)
						break
					}
				}
			}
			units = appendTextUnit(units, partPath, role, partKind, partText, messageIndex)
		}
		return units
	default:
		return appendValueUnit(units, path, role, "metadata", value, messageIndex)
	}
}

func appendValueUnit(units []PromptUnit, path, role, kind string, value any, messageIndex int) []PromptUnit {
	return appendTextUnit(units, path, role, kind, contentText(value), messageIndex)
}

func appendTextUnit(units []PromptUnit, path, role, kind, content string, messageIndex int) []PromptUnit {
	content = sanitizeString(content)
	if strings.TrimSpace(content) == "" {
		return units
	}
	return append(units, PromptUnit{
		Index:           len(units),
		MessageIndex:    messageIndex,
		Path:            path,
		Role:            role,
		Kind:            kind,
		ContentPreview:  truncatePreview(content, 240),
		EstimatedTokens: estimateTokens(content),
		TokenSource:     "local_estimate",
		CacheSource:     "cache_boundary_inference",
		Confidence:      "estimated",
	})
}

func finalizePromptUnits(units []PromptUnit) []PromptUnit {
	total := 0
	for index := range units {
		units[index].Index = index
		units[index].CumulativeStart = total
		total += units[index].EstimatedTokens
		units[index].CumulativeEnd = total
		if units[index].CacheStatus == "" {
			units[index].CacheStatus = "unknown"
		}
	}
	return units
}

func applyCacheBoundary(prompt *PromptDebug, cachedTokens, promptTokens int) {
	if cachedTokens < 0 {
		cachedTokens = 0
	}
	if promptTokens < 0 {
		promptTokens = 0
	}
	cacheHitRate := float64(cachedTokens) / float64(max(promptTokens, 1))
	cacheHitRate = min(max(cacheHitRate, 0), 1)
	estimatedCachedTokens := cachedTokens
	if prompt.TotalEstimatedTokens > 0 && promptTokens > 0 {
		estimatedCachedTokens = int(math.Round(cacheHitRate * float64(prompt.TotalEstimatedTokens)))
	}
	estimatedCachedTokens = min(max(estimatedCachedTokens, 0), prompt.TotalEstimatedTokens)
	breakIndex := -1
	breakPath := ""
	breakRole := ""
	breakOffset := 0
	units := prompt.Units
	for index := range units {
		unit := &units[index]
		overlap := min(max(estimatedCachedTokens-unit.CumulativeStart, 0), unit.EstimatedTokens)
		unit.CacheOverlapTokens = overlap
		unit.CacheSource = "cache_boundary_inference"
		if unit.EstimatedTokens == 0 {
			if estimatedCachedTokens > 0 && unit.CumulativeStart <= estimatedCachedTokens ||
				(estimatedCachedTokens > 0 && estimatedCachedTokens >= prompt.TotalEstimatedTokens) {
				unit.CacheStatus = "hit"
			} else {
				unit.CacheStatus = "miss"
			}
		} else if overlap <= 0 {
			unit.CacheStatus = "miss"
		} else if overlap >= unit.EstimatedTokens {
			unit.CacheStatus = "hit"
		} else {
			unit.CacheStatus = "partial"
		}
		unit.Confidence = "inferred"
		if breakIndex == -1 && unit.EstimatedTokens > 0 && unit.CumulativeEnd > estimatedCachedTokens {
			breakIndex = unit.Index
			breakPath = unit.Path
			breakRole = unit.Role
			breakOffset = max(estimatedCachedTokens-unit.CumulativeStart, 0)
		}
	}
	prompt.Units = units
	if breakIndex == -1 && len(units) > 0 {
		last := units[len(units)-1]
		breakIndex = last.Index
		breakPath = last.Path
		breakRole = last.Role
		breakOffset = last.EstimatedTokens
	}
	prompt.CacheBoundary = &CacheBoundary{
		CachedTokens:          cachedTokens,
		PromptTokens:          promptTokens,
		CacheHitRate:          cacheHitRate,
		EstimatedCachedTokens: estimatedCachedTokens,
		BreakUnitIndex:        breakIndex,
		BreakUnitPath:         breakPath,
		BreakUnitRole:         breakRole,
		BreakOffsetTokens:     breakOffset,
		Source:                "cache_boundary_inference",
		Confidence:            "inferred",
	}
}

func newPromptMessage(role, content string, cached bool, index int) PromptMessage {
	return PromptMessage{
		Role:            role,
		Content:         content,
		EstimatedTokens: estimateTokens(content),
		Cached:          cached,
		Index:           index,
	}
}

func containsCacheMarker(value any) bool {
	switch typed := value.(type) {
	case map[string]any:
		for key, child := range typed {
			lower := strings.ToLower(key)
			if lower == "cache_control" || lower == "cached" || lower == "prompt_cache_key" {
				return true
			}
			if containsCacheMarker(child) {
				return true
			}
		}
	case []any:
		for _, child := range typed {
			if containsCacheMarker(child) {
				return true
			}
		}
	}
	return false
}

func contentText(value any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case string:
		return sanitizeString(typed)
	case []any:
		parts := make([]string, 0, len(typed))
		for _, child := range typed {
			if text := contentText(child); text != "" {
				parts = append(parts, text)
			}
		}
		return strings.Join(parts, "\n")
	case map[string]any:
		for _, key := range []string{"text", "content", "input_text", "output_text"} {
			if text := contentText(typed[key]); text != "" {
				return text
			}
		}
		if mediaType := stringValue(typed["type"]); mediaType != "" {
			return fmt.Sprintf("[%s omitted]", mediaType)
		}
		data, err := common.Marshal(sanitizeValue(typed, ""))
		if err == nil {
			return string(data)
		}
	default:
		return fmt.Sprint(value)
	}
	return ""
}

func extractResponsesOutput(outputs []any) string {
	var builder strings.Builder
	for _, outputValue := range outputs {
		output, ok := outputValue.(map[string]any)
		if !ok {
			continue
		}
		builder.WriteString(contentText(output["content"]))
	}
	return builder.String()
}

func responseFinishReason(root map[string]any) string {
	if details, ok := root["incomplete_details"].(map[string]any); ok {
		if reason := stringValue(details["reason"]); reason != "" {
			return reason
		}
		if reason := stringValue(details["reasoning"]); reason != "" {
			return reason
		}
	}
	status := stringValue(root["status"])
	if status == "completed" {
		return "stop"
	}
	return status
}

func estimateTokens(text string) int {
	if text == "" {
		return 0
	}
	return int(math.Ceil(float64(utf8.RuneCountInString(text)) / 4))
}

func truncatePreview(text string, maxRunes int) string {
	runes := []rune(text)
	if len(runes) <= maxRunes {
		return text
	}
	return string(runes[:maxRunes]) + "..."
}

func stringValue(value any) string {
	if value == nil {
		return ""
	}
	if text, ok := value.(string); ok {
		return text
	}
	return fmt.Sprint(value)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
