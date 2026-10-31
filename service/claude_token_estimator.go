package service

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

// EstimateClaudeInputTokens returns a free, fast local estimate of
// input_tokens for an Anthropic /v1/messages/count_tokens request.
//
// Reuses ClaudeRequest.GetTokenCountMeta to do the canonical flattening
// of system / messages (text, tool_use, tool_result) / tools, and then
// the project's existing Claude-tuned tokenizer EstimateTokenByModel to
// turn that into a token count. This means the value matches whatever
// /v1/messages itself would report on the same body, so callers can
// reason about the two numbers consistently.
//
// Image tokens are intentionally NOT added: getImageToken requires a
// RelayInfo + http.Request context, which this route deliberately
// avoids by bypassing the channel pipeline. The Claude CLI context-bar
// probe (the failure mode this endpoint exists to mitigate) never
// carries images, so the gap doesn't matter for that case. Requests
// that do contain images will under-estimate, which is documented and
// acceptable for an estimate endpoint.
func EstimateClaudeInputTokens(req *dto.ClaudeRequest) int {
	if req == nil {
		return 0
	}
	normalizeRequestTools(req)
	meta := req.GetTokenCountMeta()
	if meta == nil {
		return 0
	}
	return EstimateTokenByModel(req.Model, meta.CombineText)
}

// normalizeRequestTools converts raw map[string]any entries (which is what
// json.Unmarshal of `tools` produces when the field is declared as `any`)
// into the typed *dto.Tool / *dto.ClaudeWebSearchTool values that
// dto.ProcessTools (called from GetTokenCountMeta) accepts. Without this,
// every tool entry on a count_tokens request is silently dropped on the
// `default: continue` arm of ProcessTools — see dto/claude.go:439-442.
//
// Mutates req.Tools in place. Safe because the request is parsed in this
// handler and not shared with anything else (count_tokens does not enter
// the channel pipeline).
//
// Web-search tools are distinguished from regular user-defined tools by a
// top-level "type" field whose value begins with "web_search" (e.g.
// "web_search_20250305", "web_search_20250604"). Other Anthropic server tools
// — computer_*, bash_*, text_editor_*, code_execution_*, mcp_* — also carry
// a top-level "type" but have a completely different shape from
// ClaudeWebSearchTool; if we unmarshalled them into that struct we would lose
// the rest of their schema from the estimate (ProcessTools would then only
// see Name + UserLocation). Prefix-matching the web-search family is a
// deliberate narrow allowlist: unknown "type" values fall through to the
// dto.Tool path so ProcessTools still sees Name / Description / InputSchema.
// (dto.Tool doesn't model every server-tool field, so undercount can still
// happen for exotic server tools — that's an upstream schema gap outside
// this PR's scope; the fallthrough at least stops the regression from
// misrouting.)
func normalizeRequestTools(req *dto.ClaudeRequest) {
	if req == nil || req.Tools == nil {
		return
	}
	rawTools, ok := req.Tools.([]any)
	if !ok {
		return
	}
	normalized := make([]any, 0, len(rawTools))
	for _, t := range rawTools {
		switch t.(type) {
		case *dto.Tool, dto.Tool, *dto.ClaudeWebSearchTool, dto.ClaudeWebSearchTool:
			normalized = append(normalized, t)
			continue
		}
		m, ok := t.(map[string]any)
		if !ok {
			continue
		}
		b, err := common.Marshal(m)
		if err != nil {
			continue
		}
		if typeVal, hasType := m["type"]; hasType {
			if typeStr, ok := typeVal.(string); ok && strings.HasPrefix(typeStr, "web_search") {
				var ws dto.ClaudeWebSearchTool
				if err := common.Unmarshal(b, &ws); err == nil && ws.Type != "" {
					normalized = append(normalized, &ws)
				}
				continue
			}
			// Non-web-search server tools (computer_*, bash_*, ...): fall
			// through to the dto.Tool path below so ProcessTools still sees
			// Name / Description / InputSchema instead of truncating the
			// tool to just Name + UserLocation.
		}
		var tool dto.Tool
		if err := common.Unmarshal(b, &tool); err == nil && tool.Name != "" {
			normalized = append(normalized, &tool)
		}
	}
	req.Tools = normalized
}
