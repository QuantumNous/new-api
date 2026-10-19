package yb

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/service"
)

const (
	facePollInterval = 3 * time.Second
	facePollTimeout  = 60 * time.Second
)

// ensureImageAssetRef rewrites http(s)/data/base64 images through yabao face
// moderation into asset:// refs. Existing asset:// / asset-xxx pass through.
func ensureImageAssetRef(baseURL, apiKey, image, name string) (string, error) {
	image = strings.TrimSpace(image)
	if image == "" {
		return "", nil
	}
	if looksLikeAssetRef(image) {
		return normalizeAssetRef(image), nil
	}
	if !needsFaceModeration(image) {
		return image, nil
	}

	body := map[string]any{"image": image}
	if n := strings.TrimSpace(name); n != "" {
		body["name"] = truncateName(n, 50)
	} else {
		body["name"] = "auto"
	}

	submitted, err := service.YbFaceModerationSubmitWithCreds(baseURL, apiKey, body)
	if err != nil {
		return "", fmt.Errorf("face moderation submit failed: %w", err)
	}
	taskID := firstString(submitted, "task_id", "data.task_id", "id")
	if taskID == "" {
		return "", fmt.Errorf("face moderation submit: empty task_id; body=%v", submitted)
	}
	if ref := extractAssetRef(submitted); ref != "" && isActiveStatus(firstString(submitted, "status", "data.status")) {
		return ref, nil
	}

	deadline := time.Now().Add(facePollTimeout)
	var last map[string]any
	for {
		polled, err := service.YbFaceModerationPollWithCreds(baseURL, apiKey, taskID)
		if err != nil {
			return "", fmt.Errorf("face moderation poll failed: %w", err)
		}
		last = polled
		status := strings.ToLower(strings.TrimSpace(firstString(polled, "status", "data.status")))
		if isActiveStatus(status) {
			ref := extractAssetRef(polled)
			if ref == "" {
				return "", fmt.Errorf("face moderation active but empty asset_ref; body=%v", polled)
			}
			return ref, nil
		}
		if isFailedStatus(status) {
			msg := firstString(polled, "message", "msg", "error", "fail_reason", "data.message")
			if msg == "" {
				msg = "face moderation " + status
			}
			return "", fmt.Errorf("face moderation failed: %s", msg)
		}
		if time.Now().After(deadline) {
			st := firstString(last, "status", "data.status")
			return "", fmt.Errorf("face moderation timeout (last status=%s)", st)
		}
		time.Sleep(facePollInterval)
	}
}

func needsFaceModeration(image string) bool {
	lower := strings.ToLower(image)
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") {
		return true
	}
	if strings.HasPrefix(lower, "data:") {
		return true
	}
	// bare base64 (no scheme): long opaque string without "://"
	if !strings.Contains(image, "://") && len(image) > 64 {
		return true
	}
	return false
}

func looksLikeAssetRef(s string) bool {
	lower := strings.ToLower(strings.TrimSpace(s))
	return strings.HasPrefix(lower, "asset://") ||
		strings.HasPrefix(lower, "assetid://") ||
		strings.HasPrefix(lower, "asset-")
}

func normalizeAssetRef(s string) string {
	s = strings.TrimSpace(s)
	lower := strings.ToLower(s)
	switch {
	case strings.HasPrefix(lower, "asset://"):
		return "asset://" + strings.TrimPrefix(s[len("asset://"):], "/")
	case strings.HasPrefix(lower, "assetid://"):
		id := strings.TrimPrefix(s[len("assetid://"):], "/")
		if !strings.HasPrefix(strings.ToLower(id), "asset-") && id != "" {
			id = "asset-" + id
		}
		return "asset://" + id
	case strings.HasPrefix(lower, "asset-"):
		return "asset://" + s
	default:
		return s
	}
}

func extractAssetRef(m map[string]any) string {
	if m == nil {
		return ""
	}
	for _, key := range []string{"asset_ref", "assetRef"} {
		if v := strings.TrimSpace(asString(m[key])); v != "" {
			return normalizeAssetRef(v)
		}
	}
	if data, ok := m["data"].(map[string]any); ok {
		for _, key := range []string{"asset_ref", "assetRef"} {
			if v := strings.TrimSpace(asString(data[key])); v != "" {
				return normalizeAssetRef(v)
			}
		}
		if id := strings.TrimSpace(asString(data["asset_id"])); id != "" {
			return normalizeAssetRef(id)
		}
	}
	if id := strings.TrimSpace(asString(m["asset_id"])); id != "" {
		return normalizeAssetRef(id)
	}
	return ""
}

func isActiveStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "active", "success", "succeeded", "completed", "passed":
		return true
	default:
		return false
	}
}

func isFailedStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "failed", "failure", "error", "rejected", "denied":
		return true
	default:
		return false
	}
}

func firstString(m map[string]any, keys ...string) string {
	if m == nil {
		return ""
	}
	for _, key := range keys {
		parts := strings.Split(key, ".")
		cur := any(m)
		ok := true
		for _, p := range parts {
			obj, isMap := cur.(map[string]any)
			if !isMap {
				ok = false
				break
			}
			cur, ok = obj[p]
			if !ok {
				break
			}
		}
		if !ok {
			continue
		}
		if v := strings.TrimSpace(asString(cur)); v != "" {
			return v
		}
	}
	return ""
}

func truncateName(s string, max int) string {
	s = strings.TrimSpace(s)
	if max <= 0 || len(s) <= max {
		return s
	}
	return s[:max]
}
