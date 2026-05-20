package openaicompat

import (
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

// anthropicToolIDPattern matches Anthropic's allowed tool_use.id regex.
var anthropicToolIDPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

const maxAnthropicToolIDLen = 64

// sanitizeOneToolID applies the three-tier policy:
//  1. pass-through if valid AND <= 64 chars,
//  2. strip non-[a-zA-Z0-9_-] characters and keep if non-empty AND <= 64,
//  3. otherwise generate a fresh UUID (dashes removed).
func sanitizeOneToolID(id string) string {
	if id != "" && len(id) <= maxAnthropicToolIDLen && anthropicToolIDPattern.MatchString(id) {
		return id
	}
	// Strip-and-keep.
	var b strings.Builder
	b.Grow(len(id))
	for _, r := range id {
		switch {
		case r >= 'a' && r <= 'z',
			r >= 'A' && r <= 'Z',
			r >= '0' && r <= '9',
			r == '_', r == '-':
			b.WriteRune(r)
		}
	}
	residue := b.String()
	if residue != "" && len(residue) <= maxAnthropicToolIDLen {
		return residue
	}
	// UUID fallback (dashes stripped per common.GetUUID()).
	return common.GetUUID()
}

// SanitizeToolCallIDs walks the request messages and rewrites every tool-call
// ID (assistant.tool_calls[].id) and any matching tool_call_id on the next
// tool messages so the upstream Anthropic API receives a consistent mapping
// that satisfies its regex and length constraints.
//
// It also defaults a missing tool_call.type to "function" and stringifies
// any object-valued tool_call.function.arguments.
func SanitizeToolCallIDs(req *dto.GeneralOpenAIRequest) {
	if req == nil || len(req.Messages) == 0 {
		return
	}

	// idMap tracks original-ID -> sanitized-ID rewrites so we can also patch
	// downstream tool_result references.
	idMap := map[string]string{}

	for mi := range req.Messages {
		msg := &req.Messages[mi]
		if msg.Role == "assistant" && msg.ToolCalls != nil {
			calls := msg.ParseToolCalls()
			if len(calls) == 0 {
				continue
			}
			for ci := range calls {
				tc := &calls[ci]
				// Default missing type to "function".
				if strings.TrimSpace(tc.Type) == "" {
					tc.Type = "function"
				}
				// Sanitize ID.
				origID := tc.ID
				newID := sanitizeOneToolID(origID)
				if newID != origID {
					idMap[origID] = newID
					tc.ID = newID
				}
			}
			msg.SetToolCalls(calls)
		}
	}

	// Remap tool messages' tool_call_id references.
	if len(idMap) == 0 {
		return
	}
	for mi := range req.Messages {
		msg := &req.Messages[mi]
		if msg.Role != "tool" && msg.Role != "function" {
			continue
		}
		if msg.ToolCallId == "" {
			continue
		}
		if remap, ok := idMap[msg.ToolCallId]; ok {
			msg.ToolCallId = remap
		}
	}
}
