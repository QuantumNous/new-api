package jsonx

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/ir"
)

func Marshal(v any) (json.RawMessage, error) {
	if v == nil {
		return nil, nil
	}
	if raw, ok := v.(json.RawMessage); ok {
		if !Present(raw) {
			return nil, nil
		}
		return raw, nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	if !Present(b) {
		return nil, nil
	}
	return b, nil
}

func Present(raw json.RawMessage) bool {
	trimmed := bytes.TrimSpace(raw)
	return len(trimmed) > 0 && !bytes.Equal(trimmed, []byte("null"))
}

func Clone(raw json.RawMessage) json.RawMessage {
	if !Present(raw) {
		return nil
	}
	out := make(json.RawMessage, len(raw))
	copy(out, raw)
	return out
}

func AsMap(v any) (map[string]any, bool) {
	if v == nil {
		return nil, false
	}
	if m, ok := v.(map[string]any); ok {
		return m, true
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return nil, false
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, false
	}
	return out, true
}

func AsSlice(v any) ([]any, bool) {
	if v == nil {
		return nil, false
	}
	if s, ok := v.([]any); ok {
		return s, true
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return nil, false
	}
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || trimmed[0] != '[' {
		return nil, false
	}
	var out []any
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, false
	}
	return out, true
}

func AsString(v any) string {
	if v == nil {
		return ""
	}
	switch val := v.(type) {
	case string:
		return val
	case json.RawMessage:
		var s string
		if err := json.Unmarshal(val, &s); err == nil {
			return s
		}
		return string(bytes.TrimSpace(val))
	default:
		return fmt.Sprintf("%v", val)
	}
}

func MapString(m map[string]any, key string) string {
	if m == nil {
		return ""
	}
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		return AsString(v)
	}
	return s
}

func MapBool(m map[string]any, key string) (bool, bool) {
	if m == nil {
		return false, false
	}
	v, ok := m[key]
	if !ok || v == nil {
		return false, false
	}
	b, ok := v.(bool)
	return b, ok
}

func PutIfNotEmpty(m map[string]any, key, value string) {
	if value != "" {
		m[key] = value
	}
}

func PutRaw(m map[string]any, key string, raw json.RawMessage) {
	if !Present(raw) {
		return
	}
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		return
	}
	m[key] = v
}

func CacheControlFrom(v any) *ir.CacheControl {
	if v == nil {
		return nil
	}
	raw, err := Marshal(v)
	if err != nil || !Present(raw) {
		return nil
	}
	var parsed struct {
		Type string `json:"type"`
		TTL  string `json:"ttl"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil
	}
	if parsed.Type == "" && parsed.TTL == "" {
		return nil
	}
	return &ir.CacheControl{Type: parsed.Type, TTL: parsed.TTL}
}

func CacheControlToMap(cc *ir.CacheControl) any {
	if cc == nil {
		return nil
	}
	out := map[string]any{}
	if cc.Type != "" {
		out["type"] = cc.Type
	}
	if cc.TTL != "" {
		out["ttl"] = cc.TTL
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func WithoutKeys(v any, keys ...string) (json.RawMessage, error) {
	raw, err := Marshal(v)
	if err != nil || !Present(raw) {
		return nil, err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return nil, nil
	}
	for _, key := range keys {
		delete(fields, key)
	}
	if len(fields) == 0 {
		return nil, nil
	}
	return json.Marshal(fields)
}

func MergeInto(dst any, extra json.RawMessage) error {
	if dst == nil || !Present(extra) {
		return nil
	}
	base, err := json.Marshal(dst)
	if err != nil {
		return err
	}
	var baseMap map[string]json.RawMessage
	if err := json.Unmarshal(base, &baseMap); err != nil {
		return err
	}
	if baseMap == nil {
		baseMap = map[string]json.RawMessage{}
	}
	var extraMap map[string]json.RawMessage
	if err := json.Unmarshal(extra, &extraMap); err != nil {
		return err
	}
	for key, value := range extraMap {
		if _, exists := baseMap[key]; exists {
			continue
		}
		baseMap[key] = value
	}
	merged, err := json.Marshal(baseMap)
	if err != nil {
		return err
	}
	return json.Unmarshal(merged, dst)
}

func ParseDataURL(url string) (mime, data string, ok bool) {
	if len(url) < len("data:") || !strings.EqualFold(url[:len("data:")], "data:") {
		return "", "", false
	}
	header, payload, found := strings.Cut(url[len("data:"):], ",")
	if !found {
		return "", "", false
	}
	parts := strings.Split(header, ";")
	mime = strings.TrimSpace(parts[0])
	base64Encoded := false
	for _, part := range parts[1:] {
		if strings.EqualFold(strings.TrimSpace(part), "base64") {
			base64Encoded = true
			break
		}
	}
	if !base64Encoded {
		return "", "", false
	}
	return mime, strings.TrimSpace(payload), true
}

func DataURL(mime, data string) string {
	mime = strings.TrimSpace(strings.SplitN(mime, ";", 2)[0])
	if mime == "" {
		mime = "application/octet-stream"
	}
	return "data:" + mime + ";base64," + data
}

func RawJSONType(raw json.RawMessage) string {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return "unknown"
	}
	switch trimmed[0] {
	case '{':
		return "object"
	case '[':
		return "array"
	case '"':
		return "string"
	case 't', 'f':
		return "boolean"
	case 'n':
		return "null"
	default:
		return "number"
	}
}
