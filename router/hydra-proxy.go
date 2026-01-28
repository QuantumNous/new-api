package router

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

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

	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, proxyErr error) {
		common.SysLog("hydra public proxy error: " + proxyErr.Error())
		http.Error(w, "bad gateway", http.StatusBadGateway)
	}

	router.Any("/oauth2/*any", func(c *gin.Context) {
		proxy.ServeHTTP(c.Writer, c.Request)
	})
	router.Any("/.well-known/*any", func(c *gin.Context) {
		proxy.ServeHTTP(c.Writer, c.Request)
	})
}
