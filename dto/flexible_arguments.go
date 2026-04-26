package dto

import (
	"bytes"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// ObjectArgumentItemTypes lists Responses-API item types whose `arguments`
// field must be carried as a JSON object/array (not a JSON string) when sent
// to or received from the upstream. Items not listed here (notably
// `function_call`) keep `arguments` as a JSON string per OpenAI Responses spec.
//
// The list is intentionally non-exhaustive: it enumerates the built-in tool
// call item types that are known today to use object-shaped `arguments`.
// Unknown / future item types fall through the default branch in
// normalizeArgumentField and are coerced to string. This is fail-closed for
// types whose shape is unknown (better to over-stringify and let downstream
// parse than to drop data).
//
// Add a new entry here whenever the upstream introduces another structured
// built-in tool whose `arguments` is delivered as an object.
var ObjectArgumentItemTypes = map[string]bool{
	"tool_search_call":      true,
	"web_search_call":       true,
	"file_search_call":      true,
	"local_shell_call":      true,
	"computer_call":         true,
	"image_generation_call": true,
	"code_interpreter_call": true,
	"mcp_call":              true,
}

// FlexibleArguments holds the raw JSON bytes of the `arguments` field of a
// Responses API output item. The Responses API uses different JSON shapes for
// different item types: function_call carries a JSON-encoded string, while
// tool_search_call / web_search_call / etc. carry a JSON object.
//
// The string representation stores the verbatim JSON token received from the
// wire (e.g. `"{\"k\":\"v\"}"` for a string-shaped value, or `{"k":"v"}` for
// an object-shaped value), so that re-marshaling reproduces the original
// shape and the upstream / downstream observe the protocol they expect.
//
// Empty FlexibleArguments ("") is treated as absent: it survives `omitempty`
// elision and `MarshalJSON` falls back to an empty JSON string for callers
// that do force-serialize the field.
//
// The underlying string holds raw JSON bytes, not a plain Go string. Do not
// cast a plain Go string into FlexibleArguments directly (e.g.
// `FlexibleArguments("hello")` would marshal as invalid JSON). All callers
// in this codebase populate FlexibleArguments only via JSON unmarshal.
type FlexibleArguments string

// UnmarshalJSON stores the raw JSON bytes verbatim (with their surrounding
// quotes for string payloads) so the original shape can be re-emitted later.
func (a *FlexibleArguments) UnmarshalJSON(data []byte) error {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		*a = ""
		return nil
	}
	*a = FlexibleArguments(trimmed)
	return nil
}

// MarshalJSON re-emits the arguments using the original shape received from
// the wire. An empty FlexibleArguments serializes as an empty JSON string so
// that surrounding `omitempty` tags continue to elide the field.
func (a FlexibleArguments) MarshalJSON() ([]byte, error) {
	if a == "" {
		return []byte(`""`), nil
	}
	return []byte(a), nil
}

// String returns a string representation of the arguments suitable for places
// that expect the OpenAI Chat Completions `tool_calls[].function.arguments`
// shape (always a JSON-encoded string).
//
//   - JSON-string raw payload  -> the unquoted contents.
//   - empty / null raw payload -> "".
//   - object/array/etc.        -> compact JSON encoding.
func (a FlexibleArguments) String() string {
	raw := strings.TrimSpace(string(a))
	if raw == "" || raw == "null" {
		return ""
	}
	if raw[0] == '"' {
		var s string
		if err := common.UnmarshalJsonStr(raw, &s); err == nil {
			return s
		}
	}
	return raw
}

// NormalizeResponsesStreamArgumentsJSON walks a single SSE event payload and
// makes the `arguments` field of any function_call / tool_*_call items match
// the shape required by the OpenAI Responses spec:
//
//   - function_call (and any item type not listed in ObjectArgumentItemTypes):
//     arguments must be a JSON string.
//   - tool_search_call / web_search_call / file_search_call / local_shell_call /
//     computer_call / image_generation_call: arguments must be a JSON object
//     or array.
//
// It returns the (possibly rewritten) JSON, a flag indicating whether the
// payload was modified, and any error encountered while parsing.
func NormalizeResponsesStreamArgumentsJSON(data string) (string, bool, error) {
	if data == "" || !strings.Contains(data, `"arguments"`) {
		return data, false, nil
	}

	var event map[string]any
	if err := common.UnmarshalJsonStr(data, &event); err != nil {
		return data, false, err
	}

	changed, err := normalizeResponsesArgumentsInEvent(event)
	if err != nil || !changed {
		return data, changed, err
	}

	normalized, err := common.Marshal(event)
	if err != nil {
		return data, false, err
	}
	return string(normalized), true, nil
}

func normalizeResponsesArgumentsInEvent(event map[string]any) (bool, error) {
	changed := false

	if item, ok := event["item"].(map[string]any); ok {
		itemChanged, err := normalizeArgumentField(item)
		if err != nil {
			return false, err
		}
		changed = changed || itemChanged
	}

	if response, ok := event["response"].(map[string]any); ok {
		if output, ok := response["output"].([]any); ok {
			for _, outputItem := range output {
				item, ok := outputItem.(map[string]any)
				if !ok {
					continue
				}
				itemChanged, err := normalizeArgumentField(item)
				if err != nil {
					return false, err
				}
				changed = changed || itemChanged
			}
		}
	}

	return changed, nil
}

// normalizeArgumentField makes the arguments field of one item match its
// expected shape based on the item's `type`.
func normalizeArgumentField(item map[string]any) (bool, error) {
	typ, _ := item["type"].(string)
	value, ok := item["arguments"]
	if !ok {
		return false, nil
	}

	if ObjectArgumentItemTypes[typ] {
		// Wants object/array. Convert string -> object only.
		str, isString := value.(string)
		if !isString {
			return false, nil
		}
		trimmed := strings.TrimSpace(str)
		if trimmed == "" {
			item["arguments"] = map[string]any{}
			return true, nil
		}
		var parsed any
		if err := common.UnmarshalJsonStr(trimmed, &parsed); err != nil {
			// Leave the original string in place rather than failing the
			// whole event; downstream may still recover.
			return false, nil
		}
		item["arguments"] = parsed
		return true, nil
	}

	// Default (function_call etc.): wants string.
	if _, isString := value.(string); isString {
		return false, nil
	}
	if value == nil {
		item["arguments"] = ""
		return true, nil
	}
	compact, err := common.Marshal(value)
	if err != nil {
		return false, err
	}
	item["arguments"] = string(compact)
	return true, nil
}
