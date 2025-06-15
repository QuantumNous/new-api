package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const (
	Namespace = "new_api"
)

func RegisterMetrics(registry prometheus.Registerer) {
	// channel
	registry.MustRegister(relayRequestTotalCounter)
	registry.MustRegister(relayRequestSuccessCounter)
	registry.MustRegister(relayRequestFailedCounter)
	registry.MustRegister(relayRequestRetryCounter)
	registry.MustRegister(relayRequestDurationObsever)
	// e2e
	registry.MustRegister(relayRequestE2ETotalCounter)
	registry.MustRegister(relayRequestE2ESuccessCounter)
	registry.MustRegister(relayRequestE2EFailedCounter)
	registry.MustRegister(relayRequestE2EDurationObsever)
	// token metrics
	registry.MustRegister(inputTokensCounter)
	registry.MustRegister(outputTokensCounter)
	registry.MustRegister(cacheHitTokensCounter)
	registry.MustRegister(inferenceTokensCounter)
}

var (
	relayRequestTotalCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_total",
			Help:      "Total number of relay request total",
		}, []string{"channel", "tag", "base_url", "model", "group"})
	relayRequestSuccessCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_success",
			Help:      "Total number of relay request success",
		}, []string{"channel", "tag", "base_url", "model", "group"})
	relayRequestFailedCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_failed",
			Help:      "Total number of relay request failed",
		}, []string{"channel", "tag", "base_url", "model", "group", "code"})
	relayRequestRetryCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_retry",
			Help:      "Total number of relay request retry",
		}, []string{"channel", "tag", "base_url", "model", "group"})
	relayRequestDurationObsever = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Subsystem: Namespace,
			Name:      "relay_request_duration",
			Help:      "Duration of relay request",
			Buckets:   prometheus.ExponentialBuckets(1, 2, 12),
		},
		[]string{"channel", "tag", "base_url", "model", "group"},
	)
	relayRequestE2ETotalCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_e2e_total",
			Help:      "Total number of relay request e2e total",
		}, []string{"channel", "model", "group", "token_key", "token_name"})
	relayRequestE2ESuccessCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_e2e_success",
			Help:      "Total number of relay request e2e success",
		}, []string{"channel", "model", "group", "token_key", "token_name"})
	relayRequestE2EFailedCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_e2e_failed",
			Help:      "Total number of relay request e2e failed",
		}, []string{"channel", "model", "group", "code", "token_key", "token_name"})
	relayRequestE2EDurationObsever = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Subsystem: Namespace,
			Name:      "relay_request_e2e_duration",
			Help:      "Duration of relay request e2e",
			Buckets:   prometheus.ExponentialBuckets(1, 2, 12),
		},
		[]string{"channel", "model", "group", "token_key", "token_name"},
	)
	// Token metrics
	inputTokensCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "input_tokens_total",
			Help:      "Total number of input tokens processed",
		}, []string{"channel", "model", "group", "user_id"})

	outputTokensCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "output_tokens_total",
			Help:      "Total number of output tokens generated",
		}, []string{"channel", "model", "group", "user_id"})

	cacheHitTokensCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "cache_hit_tokens_total",
			Help:      "Total number of tokens served from cache",
		}, []string{"channel", "model", "group", "user_id"})

	inferenceTokensCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "inference_tokens_total",
			Help:      "Total number of tokens processed during inference",
		}, []string{"channel", "model", "group", "user_id"})
)

func IncrementRelayRequestTotalCounter(channel, tag, baseURL, model, group string, add float64) {
	relayRequestTotalCounter.WithLabelValues(channel, tag, baseURL, model, group).Add(add)
}

func IncrementRelayRequestSuccessCounter(channel, tag, baseURL, model, group string, add float64) {
	relayRequestSuccessCounter.WithLabelValues(channel, tag, baseURL, model, group).Add(add)
}

func IncrementRelayRequestFailedCounter(channel, tag, baseURL, model, group, code string, add float64) {
	relayRequestFailedCounter.WithLabelValues(channel, tag, baseURL, model, group, code).Add(add)
}

func IncrementRelayRetryCounter(channel, tag, baseURL, model, group string, add float64) {
	relayRequestRetryCounter.WithLabelValues(channel, tag, baseURL, model, group).Add(add)
}

func ObserveRelayRequestDuration(channel, tag, baseURL, model, group string, duration float64) {
	relayRequestDurationObsever.WithLabelValues(channel, tag, baseURL, model, group).Observe(duration)
}

func IncrementRelayRequestE2ETotalCounter(channel, model, group, tokenKey, tokenName string, add float64) {
	relayRequestE2ETotalCounter.WithLabelValues(channel, model, group, tokenKey, tokenName).Add(add)
}

func IncrementRelayRequestE2ESuccessCounter(channel, model, group, tokenKey, tokenName string, add float64) {
	relayRequestE2ESuccessCounter.WithLabelValues(channel, model, group, tokenKey, tokenName).Add(add)
}

func IncrementRelayRequestE2EFailedCounter(channel, model, group, code, tokenKey, tokenName string, add float64) {
	relayRequestE2EFailedCounter.WithLabelValues(channel, model, group, code, tokenKey, tokenName).Add(add)
}

func ObserveRelayRequestE2EDuration(channel, model, group, tokenKey, tokenName string, duration float64) {
	relayRequestE2EDurationObsever.WithLabelValues(channel, model, group, tokenKey, tokenName).Observe(duration)
}

// Token metrics functions
func IncrementInputTokens(channel, model, group, userId string, add float64) {
	inputTokensCounter.WithLabelValues(channel, model, group, userId).Add(add)
}

func IncrementOutputTokens(channel, model, group, userId string, add float64) {
	outputTokensCounter.WithLabelValues(channel, model, group, userId).Add(add)
}

func IncrementCacheHitTokens(channel, model, group, userId string, add float64) {
	cacheHitTokensCounter.WithLabelValues(channel, model, group, userId).Add(add)
}

func IncrementInferenceTokens(channel, model, group, userId string, add float64) {
	inferenceTokensCounter.WithLabelValues(channel, model, group, userId).Add(add)
}
