package observability

import (
	"crypto/subtle"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const routeTagContextKey = "route_tag"

var (
	httpRequests = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "newapi",
		Name:      "http_requests_total",
		Help:      "Total HTTP requests by plane, route class, method, route and status.",
	}, []string{"plane", "route_class", "method", "route", "status"})
	httpDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "newapi",
		Name:      "http_request_duration_seconds",
		Help:      "HTTP request duration by plane, route class, method and route.",
		Buckets:   []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60},
	}, []string{"plane", "route_class", "method", "route"})
	httpInFlight = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "newapi",
		Name:      "http_requests_in_flight",
		Help:      "Current in-flight HTTP requests by plane.",
	}, []string{"plane"})
	webVitals = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "newapi",
		Name:      "web_vital_value",
		Help:      "Privacy-preserving browser Web Vital samples (CLS unitless; LCP and INP milliseconds).",
		Buckets:   []float64{0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 50, 100, 200, 500, 1000, 2500, 4000, 10000, 60000},
	}, []string{"name", "rating"})
)

func init() {
	prometheus.MustRegister(httpRequests, httpDuration, httpInFlight, webVitals)
}

func Enabled() bool {
	return common.GetEnvOrDefaultBool("METRICS_ENABLED", false)
}

func planeName() string {
	switch value := strings.ToLower(strings.TrimSpace(os.Getenv("APP_PLANE"))); value {
	case "relay", "management":
		return value
	default:
		return "all"
	}
}

func HTTPMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		plane := planeName()
		start := time.Now()
		httpInFlight.WithLabelValues(plane).Inc()
		defer httpInFlight.WithLabelValues(plane).Dec()

		c.Next()
		route := c.FullPath()
		if route == "" {
			route = "unmatched"
		}
		routeClass := c.GetString(routeTagContextKey)
		if routeClass == "" {
			routeClass = "unknown"
		}
		method := c.Request.Method
		httpRequests.WithLabelValues(plane, routeClass, method, route, strconv.Itoa(c.Writer.Status())).Inc()
		httpDuration.WithLabelValues(plane, routeClass, method, route).Observe(time.Since(start).Seconds())
	}
}

func MetricsAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		expected := strings.TrimSpace(os.Getenv("METRICS_TOKEN"))
		if expected == "" {
			c.Next()
			return
		}
		provided := strings.TrimSpace(strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer "))
		if len(provided) != len(expected) || subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) != 1 {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		c.Next()
	}
}

func Handler() http.Handler {
	return promhttp.Handler()
}

func ObserveWebVital(name, rating string, value float64) {
	webVitals.WithLabelValues(name, rating).Observe(value)
}
