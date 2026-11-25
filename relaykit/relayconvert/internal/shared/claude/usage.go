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
	if existingBillingUsage != nil && existingBillingUsage.ClaudeUsage != nil &&
		(existingBillingUsage.Source == dto.BillingUsageSourceClaudeMessages || existingBillingUsage.Semantic == dto.BillingUsageSemanticAnthropic) {
		result := existingBillingUsage.ClaudeUsage
		result.BillingUsage = dto.CloneBillingUsage(usage.BillingUsage)
		if !result.OutputTokensDetails.HasThinkingTokens() {
			// A stream-synthesized snapshot has no breakdown; the reasoning
			// count mapped from that same usage still does. The restored
			// snapshot owns output_tokens, so bound against that total.
			result.OutputTokensDetails = outputTokensDetailsWithin(usage, result.OutputTokens)
		}
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
	result.OutputTokensDetails = OutputTokensDetailsFromOpenAI(usage)
	if cacheCreation5m > 0 || cacheCreation1h > 0 {
		result.CacheCreation = &dto.ClaudeCacheCreationUsage{
			Ephemeral5mInputTokens: cacheCreation5m,
			Ephemeral1hInputTokens: cacheCreation1h,
		}
	}
	return result
}

// OutputTokensDetailsFromOpenAI maps reported reasoning only. It does not
// alter totals, canonicalize accounting, or mutate the provider snapshot.
func OutputTokensDetailsFromOpenAI(usage *dto.Usage) *dto.ClaudeOutputTokensDetails {
	if usage == nil {
		return nil
	}
	return outputTokensDetailsWithin(usage, usage.CompletionTokens)
}

// outputTokensDetailsWithin maps the reported reasoning count and bounds it
// by outputTokens, the total returned beside it.
func outputTokensDetailsWithin(usage *dto.Usage, outputTokens int) *dto.ClaudeOutputTokensDetails {
	if usage == nil {
		return nil
	}
	// Native Chat fields win, including explicit zero. Only a recognized,
	// non-estimated OpenAI sidecar may fill a missing reasoning count. Never
	// canonicalize the full usage here: that would change totals and billing.
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
		// Match Claude's existing bounds convention, but report the anomaly
		// and retain the unmodified upstream count in the billing sidecar.
		thinkingTokens, bounded := dto.BoundedReasoningTokens(details.ReasoningTokens, outputTokens)
		if bounded {
			kitutil.LogError(fmt.Sprintf("OpenAI reasoning usage out of range: reasoning_tokens=%d output_tokens=%d; thinking_tokens bounded to %d (billing snapshot preserved)", details.ReasoningTokens, outputTokens, thinkingTokens))
		}
		return &dto.ClaudeOutputTokensDetails{ThinkingTokens: thinkingTokens, ThinkingTokensPresent: thinkingTokens == 0}
	}
	return nil
}
