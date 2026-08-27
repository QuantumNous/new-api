package taskcommon

import (
	"net/url"
	"strings"
)

const agnesAPIHostname = "apihub.agnes-ai.com"

// IsAgnesAPIBaseURL reports whether baseURL points to Agnes' official API host.
func IsAgnesAPIBaseURL(baseURL string) bool {
	parsed, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil {
		return false
	}
	return strings.EqualFold(parsed.Hostname(), agnesAPIHostname)
}
