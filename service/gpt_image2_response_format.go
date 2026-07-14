package service

import (
	"encoding/base64"
	"io"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// ConvertImageResponseFormat rewrites an OpenAI-style image response body so each
// data[] item is expressed in the client's requested response_format:
//
//   - "url":      ensure each item carries a "url" (b64_json is cached to a URL)
//   - "b64_json": ensure each item carries "b64_json" (a url is downloaded + encoded)
//
// format must be "url" or "b64_json"; any other value returns the body unchanged.
// headers are forwarded when downloading an upstream url for b64 conversion.
// Conversions are best-effort: an item that cannot be converted is left as-is so
// the client still receives a usable payload.
func ConvertImageResponseFormat(body []byte, format string, headers map[string]string) []byte {
	format = strings.ToLower(strings.TrimSpace(format))
	if len(body) == 0 || (format != "url" && format != "b64_json") {
		return body
	}

	var root map[string]interface{}
	if err := common.Unmarshal(body, &root); err != nil {
		return body
	}
	data, ok := root["data"].([]interface{})
	if !ok || len(data) == 0 {
		return body
	}

	changed := false
	for _, item := range data {
		m, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if convertImageItemFormat(m, format, headers) {
			changed = true
		}
	}
	if !changed {
		return body
	}
	out, err := common.Marshal(root)
	if err != nil {
		return body
	}
	return out
}

// convertImageItemFormat converts a single data[] item in place, reporting whether
// it was modified.
func convertImageItemFormat(m map[string]interface{}, format string, headers map[string]string) bool {
	switch format {
	case "url":
		if hasNonEmptyString(m, "url") {
			delete(m, "b64_json")
			return false
		}
		b64, _ := m["b64_json"].(string)
		if strings.TrimSpace(b64) == "" {
			return false
		}
		cachedURL := CacheImageBase64Locally(b64)
		if cachedURL == "" {
			return false
		}
		m["url"] = cachedURL
		delete(m, "b64_json")
		return true
	case "b64_json":
		if hasNonEmptyString(m, "b64_json") {
			delete(m, "url")
			return false
		}
		u, _ := m["url"].(string)
		u = strings.TrimSpace(u)
		if u == "" {
			return false
		}
		b64 := downloadImageAsBase64(u, headers)
		if b64 == "" {
			return false
		}
		m["b64_json"] = b64
		delete(m, "url")
		return true
	}
	return false
}

func hasNonEmptyString(m map[string]interface{}, key string) bool {
	s, ok := m[key].(string)
	return ok && strings.TrimSpace(s) != ""
}

// downloadImageAsBase64 fetches an image URL and returns its standard base64
// encoding (no data: prefix, matching OpenAI's b64_json). Returns "" on any error.
func downloadImageAsBase64(imageURL string, headers map[string]string) string {
	resp, err := DoDownloadRequestWithHeaders(imageURL, headers, "response_format_b64")
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return ""
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil || len(data) == 0 {
		return ""
	}
	return base64.StdEncoding.EncodeToString(data)
}
