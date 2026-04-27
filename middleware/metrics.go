package middleware

import (
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/metrics"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var httpLabelNames = []string{"method", "path", "status", "region"}

var (
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "newapi",
			Name:      "http_requests_total",
			Help:      "Total number of HTTP requests",
		},
		httpLabelNames,
	)

	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "newapi",
			Name:      "http_request_duration_seconds",
			Help:      "HTTP request duration in seconds",
			Buckets:   []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60},
		},
		httpLabelNames,
	)

	httpRequestsInFlight = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Namespace: "newapi",
			Name:      "http_requests_in_flight",
			Help:      "Number of HTTP requests currently being processed",
		},
	)

	httpResponseSizeBytes = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "newapi",
			Name:      "http_response_size_bytes",
			Help:      "HTTP response size in bytes",
			Buckets:   prometheus.ExponentialBuckets(100, 10, 8),
		},
		httpLabelNames,
	)
)

func init() {
	prometheus.MustRegister(
		httpRequestsTotal,
		httpRequestDuration,
		httpRequestsInFlight,
		httpResponseSizeBytes,
	)
}

// PrometheusMiddleware collects HTTP golden metrics for each request.
// It records request count, latency, in-flight requests, and response size.
func PrometheusMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.URL.Path == "/metrics" {
			c.Next()
			return
		}

		startTime := time.Now()
		httpRequestsInFlight.Inc()

		c.Next()

		httpRequestsInFlight.Dec()

		statusCode := strconv.Itoa(c.Writer.Status())
		routePath := normalizeRoutePath(c)
		method := c.Request.Method
		duration := time.Since(startTime).Seconds()
		responseSize := float64(c.Writer.Size())
		regionLabel := metrics.GetRegion()

		httpRequestsTotal.WithLabelValues(method, routePath, statusCode, regionLabel).Inc()
		httpRequestDuration.WithLabelValues(method, routePath, statusCode, regionLabel).Observe(duration)
		httpResponseSizeBytes.WithLabelValues(method, routePath, statusCode, regionLabel).Observe(responseSize)
	}
}

// MetricsHandler returns the Prometheus metrics HTTP handler for the /metrics endpoint.
func MetricsHandler() gin.HandlerFunc {
	handler := promhttp.Handler()
	return func(c *gin.Context) {
		handler.ServeHTTP(c.Writer, c.Request)
	}
}

// normalizeRoutePath extracts the matched route template to avoid high-cardinality labels.
// Falls back to a generic label if no route template is available.
func normalizeRoutePath(c *gin.Context) string {
	routePath := c.FullPath()
	if routePath != "" {
		return routePath
	}

	routeTag, exists := c.Get(RouteTagKey)
	if exists {
		return routeTag.(string)
	}

	return "unmatched"
}
