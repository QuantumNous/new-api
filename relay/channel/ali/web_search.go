package ali

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/tidwall/gjson"
)

// DashScope web-search tool-price keys (search_strategy_* prices in
// setting/operation_setting/tools.go). The compatible-mode Chat encoder never
// writes search_strategy, so DashScope runs turbo; the Responses API "bills
// web search like the agent strategy"; the Anthropic-compatible endpoint
// publishes no search price and is billed like agent too (owner decision N9).
const (
	aliSearchTurboKey = "search_strategy_turbo"
	aliSearchAgentKey = "search_strategy_agent"
)

// aliMaxAssignedSites is the documented search_options.assigned_site_list
// limit; the list only applies to the default turbo strategy.
const aliMaxAssignedSites = 25

// encodeWebSearch maps hosted web search onto the DashScope OpenAI-compatible
// Chat fields enable_search and search_options
// (https://help.aliyun.com/zh/model-studio/web-search). search_strategy is
// never written, so DashScope runs its default turbo strategy, and
// search_context_size is not mapped to a strategy: a strategy changes the
// price, not the amount of retrieved context.
//
// enable_search only works on the models DashScope lists. Other models answer
// HTTP 400 "This model does not support enable_search.", and models that only
// accept search_strategy=agent (qwen3.8-omni-flash) answer 400 as well. The
// encoder sees no model support matrix and does not gate on model names, so
// the request is sent as is and the upstream 400 reaches the client.
func encodeWebSearch(info *relaycommon.RelayInfo) convmeta.WebSearchEncoder {
	return func(call convmeta.WebSearchCall) (*convmeta.WebSearchEncoding, error) {
		if call.Chat == nil {
			return nil, nil
		}
		var diagnostics []types.ConversionDiagnostic
		options := map[string]any{}
		if call.Forced {
			options["forced_search"] = true
			// Compatible-mode Chat responses report no search usage; a forced
			// search is the only proof that one ran.
			info.RecordRequestInferredToolCall(aliSearchTurboKey)
		}
		spec := call.Spec
		switch {
		case len(spec.AllowedDomains) > aliMaxAssignedSites:
			diagnostics = append(diagnostics, call.SemanticLoss("unsupported_domain_filter", "DashScope assigned_site_list accepts at most 25 sites; the domain filter was dropped"))
		case len(spec.AllowedDomains) > 0:
			options["assigned_site_list"] = spec.AllowedDomains
		}
		if len(spec.BlockedDomains) > 0 {
			diagnostics = append(diagnostics, call.SemanticLoss("unsupported_domain_filter", "DashScope web search cannot exclude domains; blocked_domains was dropped"))
		}
		if spec.MaxUses != nil {
			diagnostics = append(diagnostics, call.SemanticLoss("unsupported_search_limit", "DashScope web search cannot preserve max_uses"))
		}
		if len(spec.AllowedCallers) > 0 || spec.ExternalWebAccess != nil {
			diagnostics = append(diagnostics, call.SemanticLoss("unsupported_search_controls", "DashScope web search cannot preserve caller or external-access constraints"))
		}
		if spec.SearchContextSize != "" || spec.Location != nil || spec.ResponseInclusion != "" || len(spec.ReturnTokenBudget) > 0 {
			diagnostics = append(diagnostics, call.PresentationLoss("unsupported_search_tuning", "DashScope web search cannot preserve search context size, location, or result tuning"))
		}
		call.Chat.EnableSearch = json.RawMessage(`true`)
		if len(options) > 0 {
			encoded, err := common.Marshal(options)
			if err != nil {
				return nil, err
			}
			call.Chat.SearchOptions = encoded
		}
		return &convmeta.WebSearchEncoding{Diagnostics: diagnostics}, nil
	}
}

// aliResponsesToolUsage bills Responses web search by the count DashScope
// reports in usage.x_tools.web_search.count (terminal frames carry it under
// response.usage) and silences the web_search_call items under the protocol
// keys. gjson truncates fractional values and reads non-numbers as zero;
// SetBillableToolCount ignores negatives and settlement applies
// MaxBillableToolCallCount.
func aliResponsesToolUsage(raw []byte) map[string]int {
	count := gjson.GetBytes(raw, "usage.x_tools.web_search.count")
	if !count.Exists() {
		count = gjson.GetBytes(raw, "response.usage.x_tools.web_search.count")
	}
	if !count.Exists() {
		return nil
	}
	return map[string]int{
		aliSearchAgentKey:               int(count.Int()),
		dto.BuildInToolWebSearch:        0,
		dto.BuildInToolWebSearchPreview: 0,
	}
}

// aliAnthropicWebSearchEntrypoint is the client marker DashScope's
// Anthropic-compatible endpoint requires in system before it runs web search:
// "使用 Anthropic SDK 或 HTTP 直接调用时，需在 system 中传入客户端标识
// x-anthropic-billing-header: cc_entrypoint=cli;，否则联网搜索不生效。"
// (https://help.aliyun.com/zh/model-studio/web-search). The marker must be a
// system text block: sent as a plain string system, qwen3.8-flash answered
// without searching (2026-10-05).
const aliAnthropicWebSearchEntrypoint = "x-anthropic-billing-header: cc_entrypoint=cli;"

// ensureAnthropicWebSearchEntrypoint prepends the marker block to system when
// the request carries a web_search_* tool; a string system becomes the block
// after the marker. It is idempotent: a system that already names
// cc_entrypoint=cli, from the client or an earlier call, is left as is.
func ensureAnthropicWebSearchEntrypoint(request *dto.ClaudeRequest) {
	hasWebSearch := false
	for _, tool := range request.GetTools() {
		var toolType string
		switch typed := tool.(type) {
		case map[string]any:
			toolType, _ = typed["type"].(string)
		case *dto.ClaudeWebSearchTool:
			toolType = typed.Type
		case dto.ClaudeWebSearchTool:
			toolType = typed.Type
		}
		if strings.HasPrefix(toolType, "web_search_") {
			hasWebSearch = true
			break
		}
	}
	if !hasWebSearch {
		return
	}
	const present = "cc_entrypoint=cli"
	var blocks []dto.ClaudeMediaMessage
	if request.System == nil || request.IsStringSystem() {
		system := request.GetStringSystem()
		if strings.Contains(system, present) {
			return
		}
		if strings.TrimSpace(system) != "" {
			block := dto.ClaudeMediaMessage{Type: dto.ContentTypeText}
			block.SetText(system)
			blocks = []dto.ClaudeMediaMessage{block}
		}
	} else {
		blocks = request.ParseSystem()
		for _, block := range blocks {
			if block.Type == dto.ContentTypeText && strings.Contains(block.GetText(), present) {
				return
			}
		}
	}
	marker := dto.ClaudeMediaMessage{Type: dto.ContentTypeText}
	marker.SetText(aliAnthropicWebSearchEntrypoint)
	request.System = append([]dto.ClaudeMediaMessage{marker}, blocks...)
}
