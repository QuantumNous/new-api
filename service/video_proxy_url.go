package service

import (
	"strings"
)

// IsDirectVideoMediaURL reports whether url points at fetchable video bytes (CDN/file),
// as opposed to a provider content API that needs auth headers.
func IsDirectVideoMediaURL(raw string) bool {
	raw = strings.TrimSpace(raw)
	if raw == "" || strings.HasPrefix(raw, "data:") {
		return false
	}
	lower := strings.ToLower(raw)
	if !strings.HasPrefix(lower, "http://") && !strings.HasPrefix(lower, "https://") {
		return false
	}
	if strings.Contains(lower, ".mp4") || strings.Contains(lower, ".webm") || strings.Contains(lower, ".mov") {
		return true
	}
	for _, host := range []string{"getapib.org", "cdn.apimart", "apimart.ai/videos/"} {
		if strings.Contains(lower, host) {
			return true
		}
	}
	return false
}
