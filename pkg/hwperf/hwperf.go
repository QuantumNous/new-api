// Package hwperf holds the HisarWeb rule that decides which served request may
// feed a tokens-per-second figure. It lives outside pkg/perf_metrics so that the
// upstream files there keep nothing but a single call into this rule.
package hwperf

// MinOutputTokens is the output a served request needs before it counts as a
// speed sample. The relay stores the duration of the whole request, start-up
// included, so a ping that answers with one token in nine seconds says nothing
// about how fast the model writes: dividing its handful of tokens by its
// duration is what showed Opus at 0.2 tokens per second. Short answers and
// answers without output are left out of every tokens-per-second figure.
const MinOutputTokens = 32

// CountsForSpeed reports whether one finished request may feed the
// tokens-per-second figure: it needs a measured generation time and a real
// answer. A request with a handful of output tokens (a ping, a health probe) is
// dominated by start-up time, so dividing its few tokens by its duration only
// drags the average to about one token per second; requests without output carry
// no speed at all.
func CountsForSpeed(outputTokens, generationMs int64) bool {
	return outputTokens >= MinOutputTokens && generationMs > 0
}
