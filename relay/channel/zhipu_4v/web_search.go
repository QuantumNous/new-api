package zhipu_4v

import (
	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/tidwall/gjson"
)

// zhipuSearchEngine is the documented default search_engine. It is also the
// tool-price key of the searches billed on this path.
const zhipuSearchEngine = "search_std"

// encodeWebSearch maps hosted web search onto the GLM Chat web_search tool
// (https://docs.bigmodel.cn/api-reference/模型-api/对话补全). Claude and
// Responses clients reach Zhipu natively, so only the Chat target is handled.
// search_result makes non-stream responses carry the top-level web_search
// array; search_intent:false skips intent detection when the client forced
// the search.
func encodeWebSearch(info *relaycommon.RelayInfo) convmeta.WebSearchEncoder {
	return func(call convmeta.WebSearchCall) (*convmeta.WebSearchEncoding, error) {
		if call.Chat == nil {
			return nil, nil
		}
		var diagnostics []types.ConversionDiagnostic
		webSearch := map[string]any{"enable": true, "search_engine": zhipuSearchEngine, "search_result": true}
		if call.Forced {
			webSearch["search_intent"] = false
			// Stream responses carry no search evidence; a forced search is
			// the only proof that one ran. A non-stream web_search array
			// confirms the same single call through zhipuChatToolUsage.
			info.RecordRequestInferredToolCall(zhipuSearchEngine)
		}
		// Only searches this encoder requested are known to use search_std.
		info.VendorToolUsage = zhipuChatToolUsage
		spec := call.Spec
		switch {
		case len(spec.AllowedDomains) == 1:
			webSearch["search_domain_filter"] = spec.AllowedDomains[0]
		case len(spec.AllowedDomains) > 1:
			diagnostics = append(diagnostics, call.SemanticLoss("unsupported_domain_filter", "GLM web_search accepts one search_domain_filter; the domain filter was dropped"))
		}
		if len(spec.BlockedDomains) > 0 {
			diagnostics = append(diagnostics, call.SemanticLoss("unsupported_domain_filter", "GLM web_search cannot exclude domains; blocked_domains was dropped"))
		}
		if spec.MaxUses != nil {
			diagnostics = append(diagnostics, call.SemanticLoss("unsupported_search_limit", "GLM web_search cannot preserve max_uses"))
		}
		if len(spec.AllowedCallers) > 0 || spec.ExternalWebAccess != nil {
			diagnostics = append(diagnostics, call.SemanticLoss("unsupported_search_controls", "GLM web_search cannot preserve caller or external-access constraints"))
		}
		switch spec.SearchContextSize {
		case "high":
			webSearch["content_size"] = "high"
		case "", "medium":
		default:
			diagnostics = append(diagnostics, call.PresentationLoss("unsupported_search_tuning", "GLM web_search content_size has no low setting"))
		}
		if spec.Location != nil || spec.ResponseInclusion != "" || len(spec.ReturnTokenBudget) > 0 {
			diagnostics = append(diagnostics, call.PresentationLoss("unsupported_search_tuning", "GLM web_search cannot preserve location or result tuning"))
		}
		native, err := common.Marshal(map[string]any{"type": "web_search", "web_search": webSearch})
		if err != nil {
			return nil, err
		}
		return &convmeta.WebSearchEncoding{
			Tool:        dto.ToolCallRequest{Type: "web_search", Native: native},
			Diagnostics: diagnostics,
		}, nil
	}
}

// zhipuChatToolUsage bills one search_std call when a non-stream GLM Chat
// response carries the top-level web_search result array. The array lists
// results, not searches, so its length is not a count.
func zhipuChatToolUsage(raw []byte) map[string]int {
	results := gjson.GetBytes(raw, "web_search")
	if !results.IsArray() || len(results.Array()) == 0 {
		return nil
	}
	return map[string]int{zhipuSearchEngine: 1}
}
