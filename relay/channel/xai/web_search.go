package xai

import (
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/tidwall/gjson"
)

// xaiResponsesToolUsage reads xAI's billed server-side tool counts from
// usage.server_side_tool_usage_details (terminal stream frames carry the
// cumulative usage under response.usage; num_sources_used is not a billed
// count). web_search_calls replaces the web_search_call items and is priced by
// the web_search:grok* override; x_search is billed per fetched post and per
// fetched profile. gjson truncates fractional values and reads non-numbers as
// zero; SetBillableToolCount ignores negatives and settlement applies
// MaxBillableToolCallCount.
func xaiResponsesToolUsage(raw []byte) map[string]int {
	details := gjson.GetBytes(raw, "usage.server_side_tool_usage_details")
	if !details.Exists() {
		details = gjson.GetBytes(raw, "response.usage.server_side_tool_usage_details")
	}
	if !details.IsObject() {
		return nil
	}
	counts := make(map[string]int, 4)
	if calls := details.Get("web_search_calls"); calls.Exists() {
		counts[dto.BuildInToolWebSearch] = int(calls.Int())
		counts[dto.BuildInToolWebSearchPreview] = 0
	}
	if posts := details.Get("x_posts_fetched"); posts.Exists() {
		counts["x_search_posts"] = int(posts.Int())
	}
	if users := details.Get("x_users_fetched"); users.Exists() {
		counts["x_search_profiles"] = int(users.Int())
	}
	return counts
}
