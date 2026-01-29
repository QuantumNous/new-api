package router

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

// Hydra paths -> target paths (for redirect rewriting)
var oauthPathMapping = map[string]string{
	// Hydra fallback paths -> new-api OAuth paths
	"/oauth2/fallbacks/login":   "/oauth/login",
	"/oauth2/fallbacks/consent": "/oauth/consent",
	"/oauth2/fallbacks/logout":  "/oauth/logout",
	// Configured OAuth paths (keep same path, just rewrite host)
	"/oauth/login":   "/oauth/login",
	"/oauth/consent": "/oauth/consent",
	"/oauth/logout":  "/oauth/logout",
	// Hydra internal paths (keep same path, just rewrite host)
	"/oauth2/auth":     "/oauth2/auth",
	"/oauth2/token":    "/oauth2/token",
	"/oauth2/revoke":   "/oauth2/revoke",
	"/oauth2/sessions": "/oauth2/sessions",
}

// SetHydraPublicProxyRouter proxies Hydra public endpoints through new-api.
func SetHydraPublicProxyRouter(router *gin.Engine) {
	if !common.HydraEnabled {
		return
	}

	publicURL := strings.TrimSpace(common.HydraPublicURL)
	if publicURL == "" {
		return
	}

	target, err := url.Parse(publicURL)
	if err != nil || target.Scheme == "" || target.Host == "" {
		common.SysLog("invalid HYDRA_PUBLIC_URL: " + publicURL)
		return
	}

	router.Any("/oauth2/*any", func(c *gin.Context) {
		proxy := createHydraProxy(target, c.Request)
		proxy.ServeHTTP(c.Writer, c.Request)
	})
	router.Any("/.well-known/*any", func(c *gin.Context) {
		proxy := createHydraProxy(target, c.Request)
		proxy.ServeHTTP(c.Writer, c.Request)
	})
}

// createHydraProxy creates a reverse proxy with automatic URL rewriting for OAuth redirects.
func createHydraProxy(target *url.URL, originalReq *http.Request) *httputil.ReverseProxy {
	requestHost := originalReq.Host
	requestScheme := getRequestScheme(originalReq)

	proxy := httputil.NewSingleHostReverseProxy(target)
	defaultDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		defaultDirector(req)
		if requestHost != "" {
			req.Header.Set("X-Forwarded-Host", requestHost)
		}
		if requestScheme != "" {
			req.Header.Set("X-Forwarded-Proto", requestScheme)
		}
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, proxyErr error) {
		common.SysLog(fmt.Sprintf("hydra proxy error: %s %s -> %v", r.Method, r.URL.String(), proxyErr))
		http.Error(w, "bad gateway", http.StatusBadGateway)
	}

	proxy.ModifyResponse = func(resp *http.Response) error {
		return rewriteOAuthRedirect(resp, requestHost, requestScheme)
	}

	return proxy
}

func getRequestScheme(req *http.Request) string {
	if proto := req.Header.Get("X-Forwarded-Proto"); proto != "" {
		return strings.ToLower(strings.TrimSpace(proto))
	}
	if req.TLS != nil {
		return "https"
	}
	return "http"
}

// rewriteOAuthRedirect rewrites OAuth redirect URLs to use the request's host/scheme.
// Also maps Hydra fallback paths to new-api OAuth paths.
func rewriteOAuthRedirect(resp *http.Response, requestHost, requestScheme string) error {
	if resp.StatusCode < 300 || resp.StatusCode >= 400 {
		return nil
	}

	location := resp.Header.Get("Location")
	if location == "" {
		return nil
	}

	locURL, err := url.Parse(location)
	if err != nil {
		return nil
	}

	// Check if this is an OAuth path that needs rewriting
	newPath := mapOAuthPath(locURL.Path)
	if newPath == "" {
		return nil
	}

	oldLocation := location

	// Rewrite path (e.g., /oauth2/fallbacks/login -> /oauth/login)
	locURL.Path = newPath + strings.TrimPrefix(locURL.Path, extractBasePath(locURL.Path))

	// Rewrite host and scheme to match the original request
	locURL.Host = requestHost
	locURL.Scheme = requestScheme

	resp.Header.Set("Location", locURL.String())
	common.SysLog(fmt.Sprintf("hydra rewrite: %s -> %s", oldLocation, locURL.String()))

	return nil
}

// mapOAuthPath returns the new-api OAuth path for a given path, or empty string if not an OAuth path.
func mapOAuthPath(path string) string {
	for prefix, newPath := range oauthPathMapping {
		if strings.HasPrefix(path, prefix) {
			return newPath
		}
	}
	return ""
}

// extractBasePath extracts the base OAuth path from a full path.
func extractBasePath(path string) string {
	for prefix := range oauthPathMapping {
		if strings.HasPrefix(path, prefix) {
			return prefix
		}
	}
	return ""
}
