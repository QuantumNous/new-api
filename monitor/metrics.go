package monitor

import (
	"os"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

const namespace = "newapi"

var (
	initOnce     sync.Once
	enabled      bool
	tier3Enabled bool
)

// ---- Tier 1: System-Level (Low Cardinality) ----

var (
	HTTPRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "http_requests_total",
			Help:      "Total number of HTTP requests.",
		},
		[]string{"method", "path", "status_code"},
	)
	HTTPRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: namespace,
			Name:      "http_request_duration_seconds",
			Help:      "HTTP request latency in seconds.",
			Buckets:   prometheus.DefBuckets,
		},
		[]string{"method", "path", "status_code"},
	)
	HTTPActiveConnections = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Namespace: namespace,
			Name:      "http_active_connections",
			Help:      "Number of currently active HTTP connections.",
		},
	)

	RedisCommandsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "redis_commands_total",
			Help:      "Total number of Redis commands executed.",
		},
		[]string{"command", "status"},
	)
	RedisCommandDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: namespace,
			Name:      "redis_command_duration_seconds",
			Help:      "Redis command latency in seconds.",
			Buckets:   []float64{.0005, .001, .005, .01, .025, .05, .1, .25, .5, 1},
		},
		[]string{"command"},
	)

	DBQueriesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "db_queries_total",
			Help:      "Total number of database queries.",
		},
		[]string{"operation", "status"},
	)
	DBQueryDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: namespace,
			Name:      "db_query_duration_seconds",
			Help:      "Database query latency in seconds.",
			Buckets:   []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5},
		},
		[]string{"operation"},
	)
	DBOpenConnections = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: namespace,
			Name:      "db_open_connections",
			Help:      "Number of database connections by state.",
		},
		[]string{"state"},
	)
	DBWaitTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "db_wait_total",
			Help:      "Total number of waits for a database connection.",
		},
	)
	DBWaitDuration = prometheus.NewCounter(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "db_wait_duration_seconds_total",
			Help:      "Total time spent waiting for a database connection in seconds.",
		},
	)
)

// ---- Tier 2: Relay/Channel-Level (Moderate Cardinality) ----

var (
	RelayRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "relay_requests_total",
			Help:      "Total relay requests per channel.",
		},
		[]string{"channel_id", "channel_type", "model", "status_code", "relay_mode"},
	)
	RelayRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: namespace,
			Name:      "relay_request_duration_seconds",
			Help:      "End-to-end relay request latency in seconds.",
			Buckets:   []float64{.1, .25, .5, 1, 2.5, 5, 10, 30, 60, 120},
		},
		[]string{"channel_id", "channel_type", "model", "relay_mode"},
	)
	RelayFirstTokenDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: namespace,
			Name:      "relay_first_token_seconds",
			Help:      "Time to first token for streaming requests in seconds.",
			Buckets:   []float64{.05, .1, .25, .5, 1, 2.5, 5, 10, 30},
		},
		[]string{"channel_id", "channel_type", "model"},
	)
	RelayTokensUsedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "relay_tokens_used_total",
			Help:      "Total tokens consumed via relay.",
		},
		[]string{"channel_id", "channel_type", "model", "direction"},
	)
	RelayErrorsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "relay_errors_total",
			Help:      "Total relay errors by type.",
		},
		[]string{"channel_id", "channel_type", "error_type"},
	)
	RelayRetriesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "relay_retries_total",
			Help:      "Total relay retries.",
		},
		[]string{"channel_id", "channel_type"},
	)
)

// ---- Tier 3: User/Token-Level (High Cardinality, Counters Only) ----

var (
	TokenRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "token_requests_total",
			Help:      "Total requests per user per token.",
		},
		[]string{"user_id", "token_id"},
	)
	TokenTokensUsedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "token_tokens_used_total",
			Help:      "Total tokens consumed per user per token.",
		},
		[]string{"user_id", "token_id", "model", "direction"},
	)
	TokenQuotaConsumedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "token_quota_consumed_total",
			Help:      "Total quota units consumed per user per token.",
		},
		[]string{"user_id", "token_id"},
	)
)

// InitMetrics registers all Prometheus metrics. Safe to call multiple times.
func InitMetrics() {
	initOnce.Do(func() {
		// Tier 1
		prometheus.MustRegister(
			HTTPRequestsTotal,
			HTTPRequestDuration,
			HTTPActiveConnections,
			RedisCommandsTotal,
			RedisCommandDuration,
			DBQueriesTotal,
			DBQueryDuration,
			DBOpenConnections,
			DBWaitTotal,
			DBWaitDuration,
		)
		// Tier 2
		prometheus.MustRegister(
			RelayRequestsTotal,
			RelayRequestDuration,
			RelayFirstTokenDuration,
			RelayTokensUsedTotal,
			RelayErrorsTotal,
			RelayRetriesTotal,
		)
		// Tier 3 (high cardinality — opt-in via PROMETHEUS_TIER3_ENABLED)
		if os.Getenv("PROMETHEUS_TIER3_ENABLED") == "true" {
			prometheus.MustRegister(
				TokenRequestsTotal,
				TokenTokensUsedTotal,
				TokenQuotaConsumedTotal,
			)
			tier3Enabled = true
		}
		enabled = true
	})
}

// Enabled returns whether Prometheus metrics are initialized.
func Enabled() bool {
	return enabled
}

// Tier3Enabled returns whether high-cardinality user/token metrics are enabled.
func Tier3Enabled() bool {
	return tier3Enabled
}
