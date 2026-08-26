package claude

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/QuantumNous/new-api/relaykit/ir/internal/jsonx"
)

func marshalRaw(v any) (json.RawMessage, error) { return jsonx.Marshal(v) }
func rawPresent(raw json.RawMessage) bool       { return jsonx.Present(raw) }
func asMap(v any) (map[string]any, bool)        { return jsonx.AsMap(v) }
func asSlice(v any) ([]any, bool)               { return jsonx.AsSlice(v) }
func asString(v any) string                     { return jsonx.AsString(v) }
func mapString(m map[string]any, key string) string {
	return jsonx.MapString(m, key)
}
func mapBool(m map[string]any, key string) (bool, bool) { return jsonx.MapBool(m, key) }
func cacheControlFromAny(v any) *ir.CacheControl        { return jsonx.CacheControlFrom(v) }
func cacheControlToMap(cc *ir.CacheControl) any         { return jsonx.CacheControlToMap(cc) }
func putIfNotEmpty(m map[string]any, key, value string) { jsonx.PutIfNotEmpty(m, key, value) }
func putRaw(m map[string]any, key string, raw json.RawMessage) {
	jsonx.PutRaw(m, key, raw)
}
func cloneRaw(raw json.RawMessage) json.RawMessage { return jsonx.Clone(raw) }

func looksLikeWebSearchTool(m map[string]any) bool {
	typ := strings.ToLower(mapString(m, "type"))
	if strings.HasPrefix(typ, "web_search") {
		return true
	}
	if _, hasSchema := m["input_schema"]; hasSchema {
		return false
	}
	return strings.EqualFold(mapString(m, "name"), "web_search") && typ != ""
}
