package common

import (
	"net/url"
	"os"
	"strings"
)

type AsyncImageProvider string

const (
	AsyncImageProviderYunwu AsyncImageProvider = "yunwu"
	AsyncImageProviderGRSAI AsyncImageProvider = "grsai"
)

// IsAllowedYunwuBaseURL restricts the async wrapper to an explicitly allowed
// Yunwu origin and the only two base paths that can produce the whitelisted
// /v1/images/generations endpoint.
func IsAllowedYunwuBaseURL(raw string) bool {
	parsed, ok := normalizeAsyncImageBaseURL(raw)
	if !ok {
		return false
	}
	allowed := strings.TrimSpace(os.Getenv("ASYNC_YUNWU_ALLOWED_BASE_URLS"))
	if allowed == "" {
		return parsed == "https://yunwu.ai"
	}
	for _, item := range strings.Split(allowed, ",") {
		candidate, valid := normalizeAsyncImageBaseURL(item)
		if valid && parsed == candidate {
			return true
		}
	}
	return false
}

// IsAllowedGRSAIBaseURL limits GRS AI workers to the two documented API
// origins, unless an explicit allowlist is configured for integration tests or
// private relay nodes. The dashboard origin is intentionally not accepted.
func IsAllowedGRSAIBaseURL(raw string) bool {
	parsed, ok := normalizeAsyncImageBaseURL(raw)
	if !ok {
		return false
	}
	allowed := strings.TrimSpace(os.Getenv("ASYNC_GRSAI_ALLOWED_BASE_URLS"))
	if allowed == "" {
		return parsed == "https://grsaiapi.com" || parsed == "https://grsai.dakka.com.cn"
	}
	for _, item := range strings.Split(allowed, ",") {
		candidate, valid := normalizeAsyncImageBaseURL(item)
		if valid && parsed == candidate {
			return true
		}
	}
	return false
}

func AsyncImageProviderForBaseURL(raw string) (AsyncImageProvider, bool) {
	if IsAllowedYunwuBaseURL(raw) {
		return AsyncImageProviderYunwu, true
	}
	if IsAllowedGRSAIBaseURL(raw) {
		return AsyncImageProviderGRSAI, true
	}
	return "", false
}

func IsAllowedAsyncImageBaseURL(raw string) bool {
	_, ok := AsyncImageProviderForBaseURL(raw)
	return ok
}

func normalizeAsyncImageBaseURL(raw string) (string, bool) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.User != nil || parsed.Hostname() == "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", false
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", false
	}
	path := strings.TrimRight(parsed.Path, "/")
	if path != "" && path != "/v1" {
		return "", false
	}
	return strings.ToLower(parsed.Scheme + "://" + parsed.Host), true
}
