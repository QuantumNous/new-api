package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	HTTPRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "newapi_http_requests_total",
			Help: "Total number of HTTP requests handled by the gateway.",
		},
		[]string{"route_tag", "method", "route", "status"},
	)

	HTTPRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "newapi_http_request_duration_seconds",
			Help:    "HTTP request duration in seconds.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"route_tag", "method", "route"},
	)

	HTTPActiveRequests = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "newapi_http_active_requests",
			Help: "Current number of in-flight HTTP requests handled by the gateway.",
		},
		[]string{"route_tag"},
	)
)
