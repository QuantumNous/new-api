package operation_setting

import "strings"

// EmptyResponseRetryEnabled controls whether a model response without usable
// output (no content and no tool calls; reasoning-only output counts as empty)
// is treated as a failed upstream response, so the relay retry logic can pick
// another channel.
var EmptyResponseRetryEnabled = false

// ResponseBlacklistKeywords holds case-insensitive keywords. Some providers
// return HTTP 200 with an error message as if it were model output; when the
// model output contains any of these keywords, the response is treated as a
// failed upstream response so the relay retry logic can pick another channel.
var ResponseBlacklistKeywords []string

func ResponseBlacklistKeywordsToString() string {
	return strings.Join(ResponseBlacklistKeywords, "\n")
}

func ResponseBlacklistKeywordsFromString(s string) {
	ResponseBlacklistKeywords = []string{}
	for _, k := range strings.Split(s, "\n") {
		k = strings.TrimSpace(k)
		k = strings.ToLower(k)
		if k != "" {
			ResponseBlacklistKeywords = append(ResponseBlacklistKeywords, k)
		}
	}
}

// ResponseValidationActive reports whether any model output validation rule
// (empty response retry or output blacklist) is enabled.
func ResponseValidationActive() bool {
	return EmptyResponseRetryEnabled || len(ResponseBlacklistKeywords) > 0
}
