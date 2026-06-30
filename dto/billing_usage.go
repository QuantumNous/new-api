package dto

const (
	BillingUsageSourceClaudeMessages = "claude_messages"
	BillingUsageSourceGeminiChat     = "gemini_chat"

	BillingUsageSemanticAnthropic = "anthropic"
	BillingUsageSemanticGemini    = "gemini"
)

type BillingUsage struct {
	Source        string               `json:"source,omitempty"`
	Semantic      string               `json:"semantic,omitempty"`
	Estimated     bool                 `json:"estimated,omitempty"`
	Usage         *ClaudeUsage         `json:"usage,omitempty"`
	UsageMetadata *GeminiUsageMetadata `json:"usage_metadata,omitempty"`
}

func NewClaudeMessagesBillingUsage(usage *ClaudeUsage) *BillingUsage {
	if usage == nil {
		return nil
	}
	return &BillingUsage{
		Source:   BillingUsageSourceClaudeMessages,
		Semantic: BillingUsageSemanticAnthropic,
		Usage:    cloneClaudeUsage(usage),
	}
}

func NewGeminiChatBillingUsage(metadata *GeminiUsageMetadata) *BillingUsage {
	return newGeminiChatBillingUsage(metadata, false)
}

func NewEstimatedGeminiChatBillingUsage(usage *Usage) *BillingUsage {
	if usage == nil {
		return nil
	}
	totalTokens := usage.TotalTokens
	if totalTokens == 0 {
		totalTokens = usage.PromptTokens + usage.CompletionTokens
	}
	return newGeminiChatBillingUsage(&GeminiUsageMetadata{
		PromptTokenCount:     usage.PromptTokens,
		CandidatesTokenCount: usage.CompletionTokens,
		TotalTokenCount:      totalTokens,
	}, true)
}

func newGeminiChatBillingUsage(metadata *GeminiUsageMetadata, estimated bool) *BillingUsage {
	if !HasGeminiUsageMetadataTokens(metadata) {
		return nil
	}
	usageMetadata := cloneGeminiUsageMetadata(*metadata)
	return &BillingUsage{
		Source:        BillingUsageSourceGeminiChat,
		Semantic:      BillingUsageSemanticGemini,
		Estimated:     estimated,
		UsageMetadata: &usageMetadata,
	}
}

func CloneBillingUsage(usage *BillingUsage) *BillingUsage {
	if usage == nil {
		return nil
	}
	clone := *usage
	clone.Usage = cloneClaudeUsage(usage.Usage)
	if usage.UsageMetadata != nil {
		metadata := cloneGeminiUsageMetadata(*usage.UsageMetadata)
		clone.UsageMetadata = &metadata
	}
	return &clone
}

func cloneClaudeUsage(usage *ClaudeUsage) *ClaudeUsage {
	if usage == nil {
		return nil
	}
	clone := *usage
	if usage.CacheCreation != nil {
		cacheCreation := *usage.CacheCreation
		clone.CacheCreation = &cacheCreation
	}
	if usage.ServerToolUse != nil {
		serverToolUse := *usage.ServerToolUse
		clone.ServerToolUse = &serverToolUse
	}
	return &clone
}

func cloneGeminiUsageMetadata(metadata GeminiUsageMetadata) GeminiUsageMetadata {
	metadata.PromptTokensDetails = append([]GeminiPromptTokensDetails{}, metadata.PromptTokensDetails...)
	metadata.ToolUsePromptTokensDetails = append([]GeminiPromptTokensDetails{}, metadata.ToolUsePromptTokensDetails...)
	metadata.CandidatesTokensDetails = append([]GeminiPromptTokensDetails{}, metadata.CandidatesTokensDetails...)
	return metadata
}

func HasGeminiUsageMetadataTokens(metadata *GeminiUsageMetadata) bool {
	if metadata == nil {
		return false
	}
	if metadata.PromptTokenCount != 0 ||
		metadata.ToolUsePromptTokenCount != 0 ||
		metadata.CandidatesTokenCount != 0 ||
		metadata.TotalTokenCount != 0 ||
		metadata.ThoughtsTokenCount != 0 ||
		metadata.CachedContentTokenCount != 0 {
		return true
	}
	for _, detail := range metadata.PromptTokensDetails {
		if detail.TokenCount != 0 {
			return true
		}
	}
	for _, detail := range metadata.ToolUsePromptTokensDetails {
		if detail.TokenCount != 0 {
			return true
		}
	}
	for _, detail := range metadata.CandidatesTokensDetails {
		if detail.TokenCount != 0 {
			return true
		}
	}
	return false
}
