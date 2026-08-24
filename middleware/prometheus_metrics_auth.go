package middleware

import (
	"crypto/sha256"
	"crypto/subtle"
	"net"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

const PrometheusMetricsTokenEnv = "PROMETHEUS_METRICS_TOKEN"

func PrometheusMetricsAuth() gin.HandlerFunc {
	authFailureRateLimit := PrometheusMetricsRateLimit()
	return func(c *gin.Context) {
		if prometheusMetricsLocalScrape(c.Request.RemoteAddr) {
			c.Next()
			return
		}
		want := strings.TrimSpace(common.GetEnvOrDefaultString(PrometheusMetricsTokenEnv, ""))
		if want == "" {
			c.String(http.StatusServiceUnavailable, "prometheus metrics token not configured")
			c.Abort()
			return
		}
		got := prometheusMetricsBearer(c.GetHeader("Authorization"))
		if got == "" || !prometheusMetricsTokenEqual(want, got) {
			authFailureRateLimit(c)
			if c.IsAborted() {
				return
			}
			c.String(http.StatusUnauthorized, "unauthorized")
			c.Abort()
			return
		}
		c.Next()
	}
}

func prometheusMetricsLocalScrape(remoteAddr string) bool {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	ip := net.ParseIP(strings.Trim(host, "[]"))
	return ip != nil && ip.IsLoopback()
}

func prometheusMetricsBearer(header string) string {
	parts := strings.Fields(header)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return parts[1]
}

func prometheusMetricsTokenEqual(want string, got string) bool {
	wantHash := sha256.Sum256([]byte(want))
	gotHash := sha256.Sum256([]byte(got))
	return subtle.ConstantTimeCompare(wantHash[:], gotHash[:]) == 1
}
