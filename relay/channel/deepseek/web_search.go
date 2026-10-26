package deepseek

import (
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/tidwall/gjson"
)

// responsesToolUsage bills the Search and Fetch API calls DeepSeek runs for
// the Responses web_search tool from the web_search_call items of the whole
// response (output on non-stream bodies, response.output on terminal stream
// frames); its usage reports tokens only. An open_page action is a Fetch call,
// any other action a Search call, and a failed call is free. The counts
// replace the web_search_call items counted under the Search key while the
// stream was running. An empty output proves nothing, so those counts stay.
func responsesToolUsage(raw []byte) map[string]int {
	output := gjson.GetBytes(raw, "output")
	if !output.Exists() {
		output = gjson.GetBytes(raw, "response.output")
	}
	items := output.Array()
	if !output.IsArray() || len(items) == 0 {
		return nil
	}
	counts := map[string]int{SearchToolPriceKey: 0, FetchToolPriceKey: 0}
	for _, item := range items {
		if item.Get("type").String() != dto.BuildInCallWebSearchCall || item.Get("status").String() != "completed" {
			continue
		}
		if item.Get("action.type").String() == "open_page" {
			counts[FetchToolPriceKey]++
		} else {
			counts[SearchToolPriceKey]++
		}
	}
	return counts
}
