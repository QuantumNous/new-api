package metrics

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	routeTagKey      = "route_tag"
	defaultRouteTag  = "web"
	apiRouteTag      = "api"
	relayRouteTag    = "relay"
	oldAPIRouteTag   = "old_api"
	metricsRouteTag  = "api"
	unknownRoute     = "unknown"
	webFallbackRoute = "web_fallback"
)

func HTTPMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		activeRouteTag := resolveActiveRouteTag(c)
		HTTPActiveRequests.WithLabelValues(activeRouteTag).Inc()
		defer HTTPActiveRequests.WithLabelValues(activeRouteTag).Dec()

		c.Next()

		routeTag := resolveFinalRouteTag(c, activeRouteTag)

		route := resolveRoute(c, routeTag)
		method := c.Request.Method
		status := strconv.Itoa(c.Writer.Status())

		HTTPRequestsTotal.WithLabelValues(routeTag, method, route, status).Inc()
		HTTPRequestDuration.WithLabelValues(routeTag, method, route).Observe(time.Since(start).Seconds())
	}
}

func resolveActiveRouteTag(c *gin.Context) string {
	if routeTag := c.GetString(routeTagKey); routeTag != "" {
		return routeTag
	}

	path := c.Request.URL.Path
	switch {
	case path == "/metrics":
		return metricsRouteTag
	case strings.HasPrefix(path, "/api"):
		return apiRouteTag
	case path == "/dashboard/billing/subscription",
		path == "/v1/dashboard/billing/subscription",
		path == "/dashboard/billing/usage",
		path == "/v1/dashboard/billing/usage":
		return oldAPIRouteTag
	case isRelayPath(path):
		return relayRouteTag
	default:
		return defaultRouteTag
	}
}

func resolveFinalRouteTag(c *gin.Context, fallback string) string {
	if routeTag := c.GetString(routeTagKey); routeTag != "" {
		return routeTag
	}
	if fallback != "" {
		return fallback
	}
	return defaultRouteTag
}

func resolveRoute(c *gin.Context, routeTag string) string {
	if route := c.FullPath(); route != "" {
		return route
	}

	switch {
	case c.Request.URL.Path == "/metrics":
		return "/metrics"
	case routeTag == defaultRouteTag && c.Writer.Status() != http.StatusNotFound:
		return webFallbackRoute
	default:
		return unknownRoute
	}
}

func isRelayPath(path string) bool {
	switch {
	case strings.HasPrefix(path, "/v1/"),
		path == "/v1",
		strings.HasPrefix(path, "/v1beta/"),
		path == "/v1beta",
		strings.HasPrefix(path, "/pg/"),
		path == "/pg",
		strings.HasPrefix(path, "/mj/"),
		path == "/mj",
		strings.HasSuffix(path, "/mj"),
		strings.HasPrefix(path, "/suno/"),
		path == "/suno":
		return true
	default:
		return false
	}
}
