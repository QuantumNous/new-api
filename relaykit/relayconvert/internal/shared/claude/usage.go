package claude

import (
	"fmt"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
)

func UsageFromOpenAI(usage *dto.Usage) *dto.ClaudeUsage {
	if usage == nil {
		return nil
	}
	// An existing sidecar snapshots the original provider usage; carry it
	// across this bridge unchanged regardless of its dialect. Only synthesize
	// an OpenAI snapshot when no sidecar exists yet.
	existingBillingUsage := dto.CloneBillingUsage(usage.BillingUsage)
	if isClaudeSnapshot(existingBillingUsage) {
		result := existingBillingUsage.ClaudeUsage
		result.BillingUsage = dto.CloneBillingUsage(usage.BillingUsage)
		// The restored snapshot owns output_tokens, so bound against that
		// total. ThinkingDetails keeps the snapshot's own count first.
		result.OutputTokensDetails = ThinkingDetails(usage, result.OutputTokens)
		return result
	}
	billingUsage := existingBillingUsage
	if billingUsage == nil {
		billingUsage = dto.NewOpenAIChatBillingUsage(usage)
	}
	cacheCreation5m, cacheCreation1h := NormalizeCacheCreationSplit(
		usage.PromptTokensDetails.CachedCreationTokens,
		usage.ClaudeCacheCreation5mTokens,
		usage.ClaudeCacheCreation1hTokens,
	)
	cacheCreationTokens := usage.PromptTokensDetails.CacheCreationTokensTotal()
	inputTokens := usage.PromptTokens
	if usage.UsageSemantic != dto.BillingUsageSemanticAnthropic {
		// OpenAI-style prompt/input totals include cache reads and writes, while
		// Claude reports both separately from input_tokens.
		inputTokens = usage.PromptTokens - usage.PromptTokensDetails.CachedTokens - cacheCreationTokens
		if inputTokens < 0 {
			inputTokens = 0
		}
	}
	result := &dto.ClaudeUsage{
		InputTokens:              inputTokens,
		OutputTokens:             usage.CompletionTokens,
		CacheCreationInputTokens: cacheCreationTokens,
		CacheReadInputTokens:     usage.PromptTokensDetails.CachedTokens,
		BillingUsage:             billingUsage,
	}
	result.OutputTokensDetails = ThinkingDetails(usage, result.OutputTokens)
	if cacheCreation5m > 0 || cacheCreation1h > 0 {
		result.CacheCreation = &dto.ClaudeCacheCreationUsage{
			Ephemeral5mInputTokens: cacheCreation5m,
			Ephemeral1hInputTokens: cacheCreation1h,
		}
	}
	return result
}

func isClaudeSnapshot(snapshot *dto.BillingUsage) bool {
	return snapshot != nil && snapshot.ClaudeUsage != nil &&
		(snapshot.Source == dto.BillingUsageSourceClaudeMessages || snapshot.Semantic == dto.BillingUsageSemanticAnthropic)
}

// ThinkingDetails returns the client-visible thinking breakdown shown beside
// outputTokens, the Claude output total actually returned. Non-stream and
// stream conversion share it, so both apply one source order:
//  1. thinking_tokens of a restored Claude snapshot, including explicit 0;
//  2. Chat reasoning_tokens, including explicit 0;
//  3. a recognized, non-estimated OpenAI snapshot.
//
// It maps reported counts only. It never changes totals or snapshots.
func ThinkingDetails(usage *dto.Usage, outputTokens int) *dto.ClaudeOutputTokensDetails {
	if usage == nil {
		return nil
	}
	if isClaudeSnapshot(usage.BillingUsage) && usage.BillingUsage.ClaudeUsage.OutputTokensDetails.HasThinkingTokens() {
		return boundedThinkingDetails(usage.BillingUsage.ClaudeUsage.OutputTokensDetails.ThinkingTokens, outputTokens, "Claude")
	}
	// Never canonicalize the full usage here: that would change totals and billing.
	details := usage.CompletionTokenDetails
	if fallback, ok := usage.BillingUsage.ReportedOpenAIReasoning(); ok {
		if details.HasReasoningTokens() && details.ReasoningTokens != fallback {
			kitutil.LogError(fmt.Sprintf("OpenAI reasoning usage conflict: native=%d snapshot=%d; native wins (billing snapshot preserved)", details.ReasoningTokens, fallback))
		}
		if !details.HasReasoningTokens() {
			details = dto.OutputTokenDetails{ReasoningTokens: fallback, ReasoningTokensPresent: fallback == 0}
		}
	}
	if details.HasReasoningTokens() {
		return boundedThinkingDetails(details.ReasoningTokens, outputTokens, "OpenAI")
	}
	return nil
}

// boundedThinkingDetails applies Claude's display bound [0, output_tokens]
// and logs an anomaly; the snapshot keeps the unmodified upstream count.
func boundedThinkingDetails(reported int, outputTokens int, source string) *dto.ClaudeOutputTokensDetails {
	thinkingTokens, bounded := dto.BoundedReasoningTokens(reported, outputTokens)
	if bounded {
		kitutil.LogError(fmt.Sprintf("%s thinking usage out of range: reported=%d output_tokens=%d; thinking_tokens bounded to %d (billing snapshot preserved)", source, reported, outputTokens, thinkingTokens))
	}
	return &dto.ClaudeOutputTokensDetails{ThinkingTokens: thinkingTokens, ThinkingTokensPresent: thinkingTokens == 0}
}
