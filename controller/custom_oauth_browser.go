package controller

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// CustomOAuthTrustForwardedHeaders controls whether browser callback URL fallback may read
// X-Forwarded-* headers; operators should keep ServerAddress configured for public deployments
// and only enable header-derived fallback behind a trusted private or loopback reverse proxy.
const customOAuthTrustForwardedHeadersOption = "CustomOAuthTrustForwardedHeaders"

func buildCustomOAuthBrowserCallbackURL(r *http.Request, providerSlug string, state string) (string, error) {
	baseURL := resolveCustomOAuthBrowserBaseURL(r)
	if baseURL == "" {
		return "", fmt.Errorf("server address is empty")
	}
	callbackURL, err := url.Parse(baseURL)
	if err != nil {
		return "", fmt.Errorf("invalid server address: %w", err)
	}
	if callbackURL == nil || strings.TrimSpace(callbackURL.Host) == "" {
		return "", fmt.Errorf("server address host is empty")
	}
	if callbackURL.Scheme != "http" && callbackURL.Scheme != "https" {
		return "", fmt.Errorf("server address scheme must be http or https")
	}

	callbackURL.RawQuery = ""
	callbackURL.Fragment = ""
	callbackURL.Path = strings.TrimRight(callbackURL.Path, "/") + "/oauth/" + providerSlug
	if strings.TrimSpace(state) != "" {
		query := callbackURL.Query()
		query.Set("state", state)
		callbackURL.RawQuery = query.Encode()
	}
	return callbackURL.String(), nil
}

func resolveCustomOAuthBrowserBaseURL(r *http.Request) string {
	if configured := configuredCustomOAuthServerAddress(); configured != "" {
		return configured
	}
	if derived := deriveCustomOAuthBaseURLFromRequest(r); derived != "" {
		return derived
	}
	return strings.TrimSpace(system_setting.ServerAddress)
}

func configuredCustomOAuthServerAddress() string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return strings.TrimSpace(common.OptionMap["ServerAddress"])
}

func deriveCustomOAuthBaseURLFromRequest(r *http.Request) string {
	if r == nil {
		return ""
	}

	useForwardedHeaders := shouldUseCustomOAuthForwardedHeaders(r)

	host := strings.TrimSpace(r.Host)
	if useForwardedHeaders {
		if forwardedHost := firstForwardedValue(r.Header.Get("X-Forwarded-Host")); forwardedHost != "" {
			host = forwardedHost
		}
	}
	if host == "" {
		return ""
	}

	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	if useForwardedHeaders {
		if forwardedScheme := firstForwardedValue(r.Header.Get("X-Forwarded-Proto")); forwardedScheme != "" {
			scheme = forwardedScheme
		}
	}
	if scheme != "http" && scheme != "https" {
		return ""
	}

	baseURL := scheme + "://" + host
	if useForwardedHeaders {
		prefix := strings.TrimSpace(firstForwardedValue(r.Header.Get("X-Forwarded-Prefix")))
		if prefix != "" && prefix != "/" {
			if !strings.HasPrefix(prefix, "/") {
				prefix = "/" + prefix
			}
			baseURL += strings.TrimRight(prefix, "/")
		}
	}
	return baseURL
}

func shouldUseCustomOAuthForwardedHeaders(r *http.Request) bool {
	if r == nil || !isCustomOAuthForwardedHeadersEnabled() {
		return false
	}
	peerIP, err := extractRequestPeerIP(r.RemoteAddr)
	if err != nil || peerIP == nil {
		return false
	}
	return peerIP.IsLoopback() || peerIP.IsPrivate()
}

func isCustomOAuthForwardedHeadersEnabled() bool {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	raw := strings.TrimSpace(common.OptionMap[customOAuthTrustForwardedHeadersOption])
	if raw == "" {
		return true
	}
	enabled, err := strconv.ParseBool(raw)
	if err != nil {
		return false
	}
	return enabled
}

func firstForwardedValue(raw string) string {
	if raw == "" {
		return ""
	}
	parts := strings.Split(raw, ",")
	return strings.TrimSpace(parts[0])
}
