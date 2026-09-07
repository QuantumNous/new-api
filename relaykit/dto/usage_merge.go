package dto

import (
	"reflect"
	"strings"
)

// MergeUsageNonZero overlays usage snapshots: a later non-zero field
// overwrites the current value, while a later zero value never erases an
// earlier positive count. Compatible BillingUsage snapshots follow the same
// rule within their provider-native payload.
func MergeUsageNonZero(current *Usage, incoming *Usage) *Usage {
	if current == nil {
		current = &Usage{}
	}
	if incoming == nil {
		return current
	}

	if incoming.PromptTokens > 0 {
		current.PromptTokens = incoming.PromptTokens
	}
	if incoming.CompletionTokens > 0 {
		current.CompletionTokens = incoming.CompletionTokens
	}
	if incoming.TotalTokens > 0 {
		current.TotalTokens = incoming.TotalTokens
	}
	if incoming.PromptCacheHitTokens > 0 {
		current.PromptCacheHitTokens = incoming.PromptCacheHitTokens
	}
	if incoming.InputTokens > 0 {
		current.InputTokens = incoming.InputTokens
	}
	if incoming.OutputTokens > 0 {
		current.OutputTokens = incoming.OutputTokens
	}
	if incoming.ClaudeCacheCreation5mTokens > 0 {
		current.ClaudeCacheCreation5mTokens = incoming.ClaudeCacheCreation5mTokens
	}
	if incoming.ClaudeCacheCreation1hTokens > 0 {
		current.ClaudeCacheCreation1hTokens = incoming.ClaudeCacheCreation1hTokens
	}

	mergeInputTokenDetails(&current.PromptTokensDetails, incoming.PromptTokensDetails)
	if incoming.InputTokensDetails != nil {
		details := *incoming.InputTokensDetails
		if details.CachedTokens > 0 ||
			details.CachedCreationTokens > 0 ||
			details.CacheWriteTokens > 0 ||
			details.TextTokens > 0 ||
			details.AudioTokens > 0 ||
			details.ImageTokens > 0 {
			if current.InputTokensDetails == nil {
				current.InputTokensDetails = &InputTokenDetails{}
			}
			mergeInputTokenDetails(current.InputTokensDetails, details)
		}
	}

	if incoming.CompletionTokenDetails.TextTokens > 0 {
		current.CompletionTokenDetails.TextTokens = incoming.CompletionTokenDetails.TextTokens
	}
	if incoming.CompletionTokenDetails.AudioTokens > 0 {
		current.CompletionTokenDetails.AudioTokens = incoming.CompletionTokenDetails.AudioTokens
	}
	if incoming.CompletionTokenDetails.ImageTokens > 0 {
		current.CompletionTokenDetails.ImageTokens = incoming.CompletionTokenDetails.ImageTokens
	}
	if incoming.CompletionTokenDetails.ReasoningTokens > 0 {
		current.CompletionTokenDetails.ReasoningTokens = incoming.CompletionTokenDetails.ReasoningTokens
	}

	if incoming.UsageSemantic != "" {
		current.UsageSemantic = incoming.UsageSemantic
	}
	if incoming.UsageSource != "" {
		current.UsageSource = incoming.UsageSource
	}
	if incoming.BillingUsage != nil {
		current.BillingUsage = MergeBillingUsageNonZero(current.BillingUsage, incoming.BillingUsage)
	}
	if incoming.Cost != nil && !reflect.ValueOf(incoming.Cost).IsZero() {
		current.Cost = incoming.Cost
	}
	if total := current.PromptTokens + current.CompletionTokens; total > current.TotalTokens {
		current.TotalTokens = total
	}
	if total := current.InputTokens + current.OutputTokens; total > current.TotalTokens {
		current.TotalTokens = total
	}

	return current
}

// MergeBillingUsageNonZero preserves non-zero provider-native fields across
// partial stream snapshots. A snapshot from a different billing dialect
// remains authoritative and replaces the previous payload.
func MergeBillingUsageNonZero(current *BillingUsage, incoming *BillingUsage) *BillingUsage {
	if incoming == nil {
		return CloneBillingUsage(current)
	}
	if current == nil || !sameBillingUsageDialect(current, incoming) {
		return CloneBillingUsage(incoming)
	}

	merged := CloneBillingUsage(current)
	if incoming.Source != "" {
		merged.Source = incoming.Source
	}
	if incoming.Semantic != "" {
		merged.Semantic = incoming.Semantic
	}
	merged.Estimated = current.Estimated || incoming.Estimated

	switch {
	case current.OpenAIUsage != nil && incoming.OpenAIUsage != nil:
		merged.OpenAIUsage = MergeUsageNonZero(
			cloneOpenAIUsage(current.OpenAIUsage),
			cloneOpenAIUsage(incoming.OpenAIUsage),
		)
	case current.ClaudeUsage != nil && incoming.ClaudeUsage != nil:
		merged.ClaudeUsage = mergeClaudeUsageNonZero(current.ClaudeUsage, incoming.ClaudeUsage)
	case current.GeminiUsageMetadata != nil && incoming.GeminiUsageMetadata != nil:
		merged.GeminiUsageMetadata = MergeGeminiUsageMetadataNonZero(current.GeminiUsageMetadata, incoming.GeminiUsageMetadata)
	}

	return merged
}

func sameBillingUsageDialect(current *BillingUsage, incoming *BillingUsage) bool {
	if current.Source != "" && incoming.Source != "" && !strings.EqualFold(current.Source, incoming.Source) {
		return false
	}
	if current.Semantic != "" && incoming.Semantic != "" && !strings.EqualFold(current.Semantic, incoming.Semantic) {
		return false
	}
	return current.OpenAIUsage != nil && incoming.OpenAIUsage != nil ||
		current.ClaudeUsage != nil && incoming.ClaudeUsage != nil ||
		current.GeminiUsageMetadata != nil && incoming.GeminiUsageMetadata != nil
}

func mergeClaudeUsageNonZero(current *ClaudeUsage, incoming *ClaudeUsage) *ClaudeUsage {
	merged := cloneClaudeUsage(current)
	if merged == nil {
		merged = &ClaudeUsage{}
	}
	if incoming == nil {
		return merged
	}
	if incoming.InputTokens > 0 {
		merged.InputTokens = incoming.InputTokens
	}
	if incoming.CacheCreationInputTokens > 0 {
		merged.CacheCreationInputTokens = incoming.CacheCreationInputTokens
	}
	if incoming.CacheReadInputTokens > 0 {
		merged.CacheReadInputTokens = incoming.CacheReadInputTokens
	}
	if incoming.OutputTokens > 0 {
		merged.OutputTokens = incoming.OutputTokens
	}
	if incoming.ClaudeCacheCreation5mTokens > 0 {
		merged.ClaudeCacheCreation5mTokens = incoming.ClaudeCacheCreation5mTokens
	}
	if incoming.ClaudeCacheCreation1hTokens > 0 {
		merged.ClaudeCacheCreation1hTokens = incoming.ClaudeCacheCreation1hTokens
	}
	if incoming.CacheCreation != nil {
		cacheCreation := *incoming.CacheCreation
		merged.CacheCreation = &cacheCreation
	}
	if incoming.ServerToolUse != nil {
		if merged.ServerToolUse == nil {
			merged.ServerToolUse = &ClaudeServerToolUse{}
		}
		if incoming.ServerToolUse.WebSearchRequests > 0 {
			merged.ServerToolUse.WebSearchRequests = incoming.ServerToolUse.WebSearchRequests
		}
		if incoming.ServerToolUse.WebFetchRequests > 0 {
			merged.ServerToolUse.WebFetchRequests = incoming.ServerToolUse.WebFetchRequests
		}
		if incoming.ServerToolUse.CodeExecutionRequests > 0 {
			merged.ServerToolUse.CodeExecutionRequests = incoming.ServerToolUse.CodeExecutionRequests
		}
		if incoming.ServerToolUse.ToolSearchRequests > 0 {
			merged.ServerToolUse.ToolSearchRequests = incoming.ServerToolUse.ToolSearchRequests
		}
	}
	return merged
}

// MergeGeminiUsageMetadataNonZero overlays Gemini's cumulative usage
// snapshots: a later non-zero field overwrites the current value without
// dropping fields omitted by a later chunk.
func MergeGeminiUsageMetadataNonZero(current *GeminiUsageMetadata, incoming *GeminiUsageMetadata) *GeminiUsageMetadata {
	if current == nil && incoming == nil {
		return nil
	}
	if current == nil {
		metadata := cloneGeminiUsageMetadata(*incoming)
		metadata.BillingUsage = CloneBillingUsage(incoming.BillingUsage)
		return &metadata
	}

	merged := cloneGeminiUsageMetadata(*current)
	merged.BillingUsage = CloneBillingUsage(current.BillingUsage)
	if incoming == nil {
		return &merged
	}
	if incoming.PromptTokenCount > 0 {
		merged.PromptTokenCount = incoming.PromptTokenCount
	}
	if incoming.ToolUsePromptTokenCount > 0 {
		merged.ToolUsePromptTokenCount = incoming.ToolUsePromptTokenCount
	}
	if incoming.CandidatesTokenCount > 0 {
		merged.CandidatesTokenCount = incoming.CandidatesTokenCount
		merged.ThoughtsTokenCount = incoming.ThoughtsTokenCount
	} else if incoming.ThoughtsTokenCount > 0 {
		merged.ThoughtsTokenCount = incoming.ThoughtsTokenCount
	}
	if incoming.TotalTokenCount > 0 {
		merged.TotalTokenCount = incoming.TotalTokenCount
	}
	if incoming.CachedContentTokenCount > 0 {
		merged.CachedContentTokenCount = incoming.CachedContentTokenCount
	}
	merged.PromptTokensDetails = mergeGeminiTokenDetails(merged.PromptTokensDetails, incoming.PromptTokensDetails)
	merged.ToolUsePromptTokensDetails = mergeGeminiTokenDetails(merged.ToolUsePromptTokensDetails, incoming.ToolUsePromptTokensDetails)
	merged.CandidatesTokensDetails = mergeGeminiTokenDetails(merged.CandidatesTokensDetails, incoming.CandidatesTokensDetails)
	if incoming.BillingUsage != nil {
		merged.BillingUsage = MergeBillingUsageNonZero(merged.BillingUsage, incoming.BillingUsage)
	}
	if total := merged.PromptTokenCount + merged.ToolUsePromptTokenCount + merged.CandidatesTokenCount + merged.ThoughtsTokenCount; total > merged.TotalTokenCount {
		merged.TotalTokenCount = total
	}
	return &merged
}

func mergeGeminiTokenDetails(current []GeminiPromptTokensDetails, incoming []GeminiPromptTokensDetails) []GeminiPromptTokensDetails {
	merged := append([]GeminiPromptTokensDetails{}, current...)
	indexes := make(map[string]int, len(merged))
	for index, detail := range merged {
		indexes[strings.ToUpper(strings.TrimSpace(detail.Modality))] = index
	}
	for _, detail := range incoming {
		if detail.TokenCount <= 0 {
			continue
		}
		key := strings.ToUpper(strings.TrimSpace(detail.Modality))
		if index, ok := indexes[key]; ok {
			merged[index] = detail
			continue
		}
		indexes[key] = len(merged)
		merged = append(merged, detail)
	}
	return merged
}

func mergeInputTokenDetails(current *InputTokenDetails, incoming InputTokenDetails) {
	if incoming.CachedTokens > 0 {
		current.CachedTokens = incoming.CachedTokens
	}
	if incoming.CachedCreationTokens > 0 {
		current.CachedCreationTokens = incoming.CachedCreationTokens
	}
	if incoming.CacheWriteTokens > 0 {
		current.CacheWriteTokens = incoming.CacheWriteTokens
	}
	if incoming.TextTokens > 0 {
		current.TextTokens = incoming.TextTokens
	}
	if incoming.AudioTokens > 0 {
		current.AudioTokens = incoming.AudioTokens
	}
	if incoming.ImageTokens > 0 {
		current.ImageTokens = incoming.ImageTokens
	}
}
