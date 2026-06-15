package service

import "strings"

// providerForModel maps a model name to the estimator Provider, matching the
// exact dispatch logic of EstimateTokenByModel so that streaming estimation
// produces identical results to the legacy ResponseText2Usage path.
func providerForModel(model string) Provider {
	m := strings.ToLower(model)
	switch {
	case strings.Contains(m, "gemini"):
		return Gemini
	case strings.Contains(m, "claude"):
		return Claude
	default:
		return OpenAI
	}
}

// UsageAccumulator replaces the legacy "accumulate the whole response into a
// strings.Builder, then EstimateToken(builder.String())" pattern used across
// every streaming relay handler.
//
// Instead of buffering the full response text (which makes heap residency grow
// with response size — hundreds of MB for large-context streams, never released
// under default Go GC), it feeds each delta through a streaming estimator that
// keeps only O(1) state. The token result is bit-for-bit identical to running
// EstimateTokenByModel over the concatenated text, because the streaming
// estimator shares the exact same per-rune state machine as EstimateToken.
//
// Billing semantics are controlled by TrustUpstreamUsage at the call site via
// Resolve():
//   - trust=true:  prefer the upstream-reported completion tokens; fall back to
//     the local streamed estimate only when the upstream omits usage.
//   - trust=false: use the local streamed estimate (the legacy behavior, but
//     without buffering the full text).
//
// For models/channels that emit separate reasoning ("thinking") content (e.g.
// Claude extended thinking), feed it via FeedReasoning so it is counted with a
// dedicated estimator and summed into the completion tokens — matching the
// legacy behavior of writing both text and thinking into the same builder, but
// without holding either in memory.
type UsageAccumulator struct {
	text      *streamingEstimator
	reasoning *streamingEstimator // lazily created on first FeedReasoning
	provider  Provider
}

// NewUsageAccumulator builds an accumulator for the given model.
func NewUsageAccumulator(model string) *UsageAccumulator {
	p := providerForModel(model)
	return &UsageAccumulator{
		text:     newStreamingEstimator(p),
		provider: p,
	}
}

// Feed accumulates a chunk of output text. The chunk may be any byte stream,
// including a multibyte rune split across two calls.
func (a *UsageAccumulator) Feed(delta string) {
	if delta == "" {
		return
	}
	a.text.feed(delta)
}

// FeedReasoning accumulates a chunk of reasoning/thinking text, counted with a
// separate estimator so reasoning and visible text are tallied independently
// and then summed.
func (a *UsageAccumulator) FeedReasoning(delta string) {
	if delta == "" {
		return
	}
	if a.reasoning == nil {
		a.reasoning = newStreamingEstimator(a.provider)
	}
	a.reasoning.feed(delta)
}

// WriteString implements io.StringWriter so a *UsageAccumulator can be passed
// where the legacy code expected a *strings.Builder (e.g. openai
// ProcessStreamResponse / processTokenData). It accumulates into the text
// estimator and always reports the full input as consumed.
func (a *UsageAccumulator) WriteString(s string) (int, error) {
	a.Feed(s)
	return len(s), nil
}

// LocalCompletionTokens returns the locally estimated completion tokens
// (text + reasoning), equal to EstimateTokenByModel over the concatenated
// streamed text.
func (a *UsageAccumulator) LocalCompletionTokens() int {
	n := a.text.result()
	if a.reasoning != nil {
		n += a.reasoning.result()
	}
	return n
}

// Resolve returns the final completion token count given the upstream-reported
// value and the channel's trust setting.
//   - trustUpstream && upstreamCompletion > 0 -> use the upstream value
//   - otherwise -> use the local streamed estimate
func (a *UsageAccumulator) Resolve(upstreamCompletion int, trustUpstream bool) int {
	if trustUpstream && upstreamCompletion > 0 {
		return upstreamCompletion
	}
	return a.LocalCompletionTokens()
}
