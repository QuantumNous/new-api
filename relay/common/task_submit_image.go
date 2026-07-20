package common

import (
	"encoding/json"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/tidwall/gjson"
)

// parseFlexibleImageURLs parses the singular image field when it is an object or string.
func parseFlexibleImageURLs(raw json.RawMessage) []string {
	if len(raw) == 0 {
		return nil
	}
	return appendURLsFromGJSON(nil, gjson.ParseBytes(raw))
}

func appendURLsFromGJSON(urls []string, v gjson.Result) []string {
	if !v.Exists() {
		return urls
	}
	if v.Type == gjson.String {
		return appendURLString(urls, v.String())
	}
	if v.IsArray() {
		for _, item := range v.Array() {
			if item.Type == gjson.String {
				urls = appendURLString(urls, item.String())
			}
		}
		return urls
	}
	if v.IsObject() {
		for _, key := range []string{"url", "http_url", "uri", "src", "href", "image_url"} {
			if u := strings.TrimSpace(v.Get(key).String()); u != "" {
				return appendURLString(urls, u)
			}
		}
	}
	return urls
}

func appendURLString(urls []string, s string) []string {
	if u := strings.TrimSpace(s); u != "" {
		return append(urls, u)
	}
	return urls
}

func dedupeNonEmptyURLs(urls []string) []string {
	if len(urls) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(urls))
	out := make([]string, 0, len(urls))
	for _, u := range urls {
		u = strings.TrimSpace(u)
		if u == "" {
			continue
		}
		if _, ok := seen[u]; ok {
			continue
		}
		seen[u] = struct{}{}
		out = append(out, u)
	}
	return out
}

func applyParsedImageURLs(t *TaskSubmitReq, urls []string) {
	if len(urls) == 0 {
		return
	}
	t.Images = dedupeNonEmptyURLs(append(t.Images, urls...))
	if strings.TrimSpace(t.Image) == "" && len(t.Images) > 0 {
		t.Image = t.Images[0]
	}
}

func unmarshalTaskSubmitDuration(raw json.RawMessage, t *TaskSubmitReq) {
	if len(raw) == 0 {
		return
	}
	var durationInt int
	if err := common.Unmarshal(raw, &durationInt); err == nil {
		t.Duration = durationInt
		return
	}
	var durationStr string
	if err := common.Unmarshal(raw, &durationStr); err == nil && durationStr != "" {
		if v, err := strconv.Atoi(durationStr); err == nil {
			t.Duration = v
		}
	}
}

func unmarshalTaskSubmitSeconds(raw json.RawMessage, t *TaskSubmitReq) {
	if len(raw) == 0 {
		return
	}
	var asInt int
	if err := common.Unmarshal(raw, &asInt); err == nil && asInt > 0 {
		t.Seconds = strconv.Itoa(asInt)
		return
	}
	var asFloat float64
	if err := common.Unmarshal(raw, &asFloat); err == nil && asFloat > 0 {
		t.Seconds = strconv.Itoa(int(asFloat))
		return
	}
	var asStr string
	if err := common.Unmarshal(raw, &asStr); err == nil {
		t.Seconds = strings.TrimSpace(asStr)
	}
}

func unmarshalTaskSubmitMetadata(raw json.RawMessage, t *TaskSubmitReq) {
	if len(raw) == 0 {
		return
	}
	var metadataStr string
	if err := common.Unmarshal(raw, &metadataStr); err == nil && metadataStr != "" {
		var metadataObj map[string]interface{}
		if err := common.Unmarshal([]byte(metadataStr), &metadataObj); err == nil {
			t.Metadata = metadataObj
			return
		}
	}
	var metadataObj map[string]interface{}
	if err := common.Unmarshal(raw, &metadataObj); err == nil {
		t.Metadata = metadataObj
	}
}

// unmarshalTaskSubmitBool handles bool fields that may arrive from multipart form
// as strings ("1", "0", "true", "false") or numbers, common when clients use -F.
func unmarshalTaskSubmitBool(raw json.RawMessage, target **bool) {
	if len(raw) == 0 || target == nil {
		return
	}

	var bv dto.BoolValue
	if err := common.Unmarshal(raw, &bv); err == nil {
		b := bool(bv)
		*target = &b
		return
	}

	// Fallback: try direct bool
	var b bool
	if err := common.Unmarshal(raw, &b); err == nil {
		*target = &b
	}
}
