package service

import (
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	imageCacheDir        = "/opt/imgs"
	imageCachePublicBase = "https://apimaster.ai/imgs/"
)

var cacheImageLocallyImpl = defaultCacheImageLocally

// CacheImageLocally downloads an image URL and stores it under /opt/imgs/, returning an apimaster.ai URL.
// Falls back to the original URL on any error so callers always get a usable URL.
func CacheImageLocally(imageURL string) string {
	return cacheImageLocallyImpl(imageURL)
}

func defaultCacheImageLocally(imageURL string) string {
	imageURL = strings.TrimSpace(imageURL)
	if imageURL == "" || !shouldCacheImageURL(imageURL) {
		return imageURL
	}

	resp, err := DoDownloadRequest(imageURL, "image_cache")
	if err != nil {
		return imageURL
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return imageURL
	}

	ext := ".png"
	ct := resp.Header.Get("Content-Type")
	switch {
	case strings.Contains(ct, "jpeg"), strings.Contains(ct, "jpg"):
		ext = ".jpg"
	case strings.Contains(ct, "webp"):
		ext = ".webp"
	}

	if err := os.MkdirAll(imageCacheDir, 0o755); err != nil {
		return imageURL
	}

	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	fpath := imageCacheDir + "/" + filename

	f, err := os.Create(fpath)
	if err != nil {
		return imageURL
	}
	defer f.Close()

	if _, err = io.Copy(f, resp.Body); err != nil {
		os.Remove(fpath)
		return imageURL
	}
	return imageCachePublicBase + filename
}

// RewriteImageResponseBody replaces upstream image URLs in OpenAI-style image responses
// (sync data[].url or async task poll data.result.images[].url) with apimaster.ai cached URLs.
func RewriteImageResponseBody(body []byte) []byte {
	if len(body) == 0 {
		return body
	}

	var root map[string]interface{}
	if err := common.Unmarshal(body, &root); err != nil {
		return body
	}

	data, ok := root["data"]
	if !ok {
		return body
	}

	switch typed := data.(type) {
	case map[string]interface{}:
		if !shouldRewriteTaskPollData(typed) {
			return body
		}
		rewriteImageURLsInMap(typed)
	case []interface{}:
		for _, item := range typed {
			if m, ok := item.(map[string]interface{}); ok {
				rewriteImageURLsInMap(m)
			}
		}
	default:
		return body
	}

	out, err := common.Marshal(root)
	if err != nil {
		return body
	}
	return out
}

// ExtractFirstImageURLFromResponse reads the first image URL from an OpenAI-style image response body.
func ExtractFirstImageURLFromResponse(body []byte) string {
	if len(body) == 0 {
		return ""
	}
	var root map[string]interface{}
	if err := common.Unmarshal(body, &root); err != nil {
		return ""
	}
	data, ok := root["data"]
	if !ok {
		return ""
	}
	switch typed := data.(type) {
	case []interface{}:
		for _, item := range typed {
			if m, ok := item.(map[string]interface{}); ok {
				if u := firstURLFromImageMap(m); u != "" {
					return u
				}
			}
		}
	case map[string]interface{}:
		return firstURLFromImageMap(typed)
	}
	return ""
}

func firstURLFromImageMap(m map[string]interface{}) string {
	if u, ok := m["url"].(string); ok && strings.TrimSpace(u) != "" {
		return strings.TrimSpace(u)
	}
	result, ok := m["result"].(map[string]interface{})
	if !ok {
		return ""
	}
	images, ok := result["images"].([]interface{})
	if !ok {
		return ""
	}
	for _, img := range images {
		im, ok := img.(map[string]interface{})
		if !ok {
			continue
		}
		if u, ok := im["url"].(string); ok && strings.TrimSpace(u) != "" {
			return strings.TrimSpace(u)
		}
	}
	return ""
}

func shouldRewriteTaskPollData(data map[string]interface{}) bool {
	status := strings.ToLower(strings.TrimSpace(fmt.Sprint(data["status"])))
	if status == "" {
		return true
	}
	switch status {
	case "completed", "succeeded", "success":
		return true
	default:
		return false
	}
}

func rewriteImageURLsInMap(m map[string]interface{}) {
	if urlVal, ok := m["url"]; ok {
		m["url"] = rewriteURLValue(urlVal)
	}
	result, ok := m["result"].(map[string]interface{})
	if !ok {
		return
	}
	images, ok := result["images"].([]interface{})
	if !ok {
		return
	}
	for _, img := range images {
		im, ok := img.(map[string]interface{})
		if !ok {
			continue
		}
		if urlVal, ok := im["url"]; ok {
			im["url"] = rewriteURLValue(urlVal)
		}
	}
}

func rewriteURLValue(v interface{}) interface{} {
	switch u := v.(type) {
	case string:
		return CacheImageLocally(u)
	case []interface{}:
		out := make([]interface{}, len(u))
		for i, item := range u {
			if s, ok := item.(string); ok {
				out[i] = CacheImageLocally(s)
			} else {
				out[i] = item
			}
		}
		return out
	default:
		return v
	}
}

func shouldCacheImageURL(u string) bool {
	u = strings.TrimSpace(u)
	if u == "" || strings.HasPrefix(u, "data:") || strings.HasPrefix(u, imageCachePublicBase) {
		return false
	}
	return strings.HasPrefix(u, "http://") || strings.HasPrefix(u, "https://")
}

// IsValidMediaResultURL reports whether a stored result_url is a real media location
// (not a legacy FailReason string accidentally written via GetResultURL fallback).
func IsValidMediaResultURL(u string) bool {
	u = strings.TrimSpace(u)
	if u == "" {
		return false
	}
	if strings.HasPrefix(u, "data:image") {
		return true
	}
	if strings.HasPrefix(u, "http://") || strings.HasPrefix(u, "https://") {
		return true
	}
	return strings.HasPrefix(u, "/")
}
