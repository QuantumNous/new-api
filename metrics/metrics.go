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
	// error log metrics
	registry.MustRegister(errorLogCounter)
}

var (
	relayRequestTotalCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_total",
			Help:      "Total number of relay request total",
		}, []string{"channel", "channel_name", "tag", "base_url", "model", "group"})
	relayRequestSuccessCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_success",
			Help:      "Total number of relay request success",
		}, []string{"channel", "channel_name", "tag", "base_url", "model", "group"})
	relayRequestFailedCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_failed",
			Help:      "Total number of relay request failed",
		}, []string{"channel", "channel_name", "tag", "base_url", "model", "group", "code"})
	relayRequestRetryCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_retry",
			Help:      "Total number of relay request retry",
		}, []string{"channel", "channel_name", "tag", "base_url", "model", "group"})
	relayRequestDurationObsever = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Subsystem: Namespace,
			Name:      "relay_request_duration",
			Help:      "Duration of relay request",
			Buckets:   prometheus.ExponentialBuckets(1, 2, 12),
		},
		[]string{"channel", "channel_name", "tag", "base_url", "model", "group"},
	)
	relayRequestE2ETotalCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_e2e_total",
			Help:      "Total number of relay request e2e total",
		}, []string{"channel", "channel_name", "model", "group", "token_key", "token_name"})
	relayRequestE2ESuccessCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_e2e_success",
			Help:      "Total number of relay request e2e success",
		}, []string{"channel", "channel_name", "model", "group", "token_key", "token_name"})
	relayRequestE2EFailedCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_e2e_failed",
			Help:      "Total number of relay request e2e failed",
		}, []string{"channel", "channel_name", "model", "group", "code", "token_key", "token_name"})
	relayRequestE2EDurationObsever = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Subsystem: Namespace,
			Name:      "relay_request_e2e_duration",
			Help:      "Duration of relay request e2e",
			Buckets:   prometheus.ExponentialBuckets(1, 2, 12),
		},
		[]string{"channel", "channel_name", "model", "group", "token_key", "token_name"},
	)
	// Token metrics
	inputTokensCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "input_tokens_total",
			Help:      "Total number of input tokens processed",
		}, []string{"channel", "channel_name", "model", "group", "user_id", "user_name", "token_name"})

	outputTokensCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "output_tokens_total",
			Help:      "Total number of output tokens generated",
		}, []string{"channel", "channel_name", "model", "group", "user_id", "user_name", "token_name"})

	cacheHitTokensCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "cache_hit_tokens_total",
			Help:      "Total number of tokens served from cache",
		}, []string{"channel", "channel_name", "model", "group", "user_id", "user_name", "token_name"})

	inferenceTokensCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "inference_tokens_total",
			Help:      "Total number of tokens processed during inference",
		}, []string{"channel", "channel_name", "model", "group", "user_id", "user_name", "token_name"})

	errorLogCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "error_log_total",
			Help:      "Total number of error logs",
		}, []string{"channel", "channel_name", "error_code", "error_type", "model", "group", "token_name"})
)

func IncrementRelayRequestTotalCounter(channel, channelName, tag, baseURL, model, group string, add float64) {
	relayRequestTotalCounter.WithLabelValues(channel, channelName, tag, baseURL, model, group).Add(add)
}

func IncrementRelayRequestSuccessCounter(channel, channelName, tag, baseURL, model, group string, add float64) {
	relayRequestSuccessCounter.WithLabelValues(channel, channelName, tag, baseURL, model, group).Add(add)
}

func IncrementRelayRequestFailedCounter(channel, channelName, tag, baseURL, model, group, code string, add float64) {
	relayRequestFailedCounter.WithLabelValues(channel, channelName, tag, baseURL, model, group, code).Add(add)
}

func IncrementRelayRetryCounter(channel, channelName, tag, baseURL, model, group string, add float64) {
	relayRequestRetryCounter.WithLabelValues(channel, channelName, tag, baseURL, model, group).Add(add)
}

func ObserveRelayRequestDuration(channel, channelName, tag, baseURL, model, group string, duration float64) {
	relayRequestDurationObsever.WithLabelValues(channel, channelName, tag, baseURL, model, group).Observe(duration)
}

func IncrementRelayRequestE2ETotalCounter(channel, channelName, model, group, tokenKey, tokenName string, add float64) {
	relayRequestE2ETotalCounter.WithLabelValues(channel, channelName, model, group, tokenKey, tokenName).Add(add)
}

func IncrementRelayRequestE2ESuccessCounter(channel, channelName, model, group, tokenKey, tokenName string, add float64) {
	relayRequestE2ESuccessCounter.WithLabelValues(channel, channelName, model, group, tokenKey, tokenName).Add(add)
}

func IncrementRelayRequestE2EFailedCounter(channel, channelName, model, group, code, tokenKey, tokenName string, add float64) {
	relayRequestE2EFailedCounter.WithLabelValues(channel, channelName, model, group, code, tokenKey, tokenName).Add(add)
}

func ObserveRelayRequestE2EDuration(channel, channelName, model, group, tokenKey, tokenName string, duration float64) {
	relayRequestE2EDurationObsever.WithLabelValues(channel, channelName, model, group, tokenKey, tokenName).Observe(duration)
}

// Token metrics functions
func IncrementInputTokens(channel, channelName, model, group, userId, userName, tokenName string, add float64) {
	inputTokensCounter.WithLabelValues(channel, channelName, model, group, userId, userName, tokenName).Add(add)
}

func IncrementOutputTokens(channel, channelName, model, group, userId, userName, tokenName string, add float64) {
	outputTokensCounter.WithLabelValues(channel, channelName, model, group, userId, userName, tokenName).Add(add)
}

func IncrementCacheHitTokens(channel, channelName, model, group, userId, userName, tokenName string, add float64) {
	cacheHitTokensCounter.WithLabelValues(channel, channelName, model, group, userId, userName, tokenName).Add(add)
}

func IncrementInferenceTokens(channel, channelName, model, group, userId, userName, tokenName string, add float64) {
	inferenceTokensCounter.WithLabelValues(channel, channelName, model, group, userId, userName, tokenName).Add(add)
}

// Error log metrics function
func IncrementErrorLog(channel, channelName, errorCode, errorType, model, group, tokenName string, add float64) {
	errorLogCounter.WithLabelValues(channel, channelName, errorCode, errorType, model, group, tokenName).Add(add)
}
