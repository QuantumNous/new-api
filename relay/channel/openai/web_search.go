package openai

import (
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/tidwall/gjson"
)

// azureResponsesToolUsage bills Azure Responses web search by the Bing request
// count the service reports (tool_usage.web_search.num_requests, $14 per 1,000
// transactions) under its own key, and silences the web_search_call items:
// Azure documents "Use tool_usage.web_search.num_requests" rather than
// counting web_search_call. gjson truncates fractional values and reads
// non-numbers as zero; SetBillableToolCount ignores negatives and settlement
// applies MaxBillableToolCallCount.
func azureResponsesToolUsage(raw []byte) map[string]int {
	count := gjson.GetBytes(raw, "tool_usage.web_search.num_requests")
	if !count.Exists() {
		count = gjson.GetBytes(raw, "response.tool_usage.web_search.num_requests")
	}
	if !count.Exists() {
		return nil
	}
	return map[string]int{
		"bing_web_search":               int(count.Int()),
		dto.BuildInToolWebSearch:        0,
		dto.BuildInToolWebSearchPreview: 0,
	}
}
