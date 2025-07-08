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
		}, []string{"channel", "channel_name", "tag", "base_url", "model", "group", "user_id", "user_name"})
	relayRequestSuccessCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_success",
			Help:      "Total number of relay request success",
<<<<<<< Updated upstream
		}, []string{"channel", "channel_name", "tag", "base_url", "model", "group"})
=======
		}, []string{"channel", "channel_name", "tag", "base_url", "model", "group", "code", "user_id", "user_name"})
>>>>>>> Stashed changes
	relayRequestFailedCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_failed",
			Help:      "Total number of relay request failed",
		}, []string{"channel", "channel_name", "tag", "base_url", "model", "group", "code", "user_id", "user_name"})
	relayRequestRetryCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_retry",
			Help:      "Total number of relay request retry",
		}, []string{"channel", "channel_name", "tag", "base_url", "model", "group", "user_id", "user_name"})
	relayRequestDurationObsever = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Subsystem: Namespace,
			Name:      "relay_request_duration",
			Help:      "Duration of relay request",
			Buckets:   prometheus.ExponentialBuckets(1, 2, 12),
		},
		[]string{"channel", "channel_name", "tag", "base_url", "model", "group", "user_id", "user_name"},
	)
	relayRequestE2ETotalCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_e2e_total",
			Help:      "Total number of relay request e2e total",
		}, []string{"channel", "channel_name", "model", "group", "token_key", "token_name", "user_id", "user_name"})
	relayRequestE2ESuccessCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_e2e_success",
			Help:      "Total number of relay request e2e success",
		}, []string{"channel", "channel_name", "model", "group", "token_key", "token_name", "user_id", "user_name"})
	relayRequestE2EFailedCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "relay_request_e2e_failed",
			Help:      "Total number of relay request e2e failed",
		}, []string{"channel", "channel_name", "model", "group", "code", "token_key", "token_name", "user_id", "user_name"})
	relayRequestE2EDurationObsever = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Subsystem: Namespace,
			Name:      "relay_request_e2e_duration",
			Help:      "Duration of relay request e2e",
			Buckets:   prometheus.ExponentialBuckets(1, 2, 12),
		},
		[]string{"channel", "channel_name", "model", "group", "token_key", "token_name", "user_id", "user_name"},
	)
<<<<<<< Updated upstream
=======
	// Batch request metrics
	batchRequestCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Subsystem: Namespace,
			Name:      "batch_request_total",
			Help:      "Total number of batch requests by status code",
		}, []string{"channel", "channel_name", "tag", "base_url", "model", "group", "code", "retry_header", "user_id", "user_name"})
	batchRequestDurationObsever = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Subsystem: Namespace,
			Name:      "batch_request_duration",
			Help:      "Duration of batch request",
			Buckets:   prometheus.ExponentialBuckets(1, 2, 12),
		},
		[]string{"channel", "channel_name", "tag", "base_url", "model", "group", "code", "retry_header", "user_id", "user_name"},
	)
>>>>>>> Stashed changes
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
		}, []string{"channel", "channel_name", "error_code", "error_type", "model", "group", "token_name", "user_id", "user_name"})
)

func IncrementRelayRequestTotalCounter(channel, channelName, tag, baseURL, model, group, userId, userName string, add float64) {
	relayRequestTotalCounter.WithLabelValues(channel, channelName, tag, baseURL, model, group, userId, userName).Add(add)
}

<<<<<<< Updated upstream
func IncrementRelayRequestSuccessCounter(channel, channelName, tag, baseURL, model, group string, add float64) {
	relayRequestSuccessCounter.WithLabelValues(channel, channelName, tag, baseURL, model, group).Add(add)
=======
func IncrementRelayRequestSuccessCounter(channel, channelName, tag, baseURL, model, group, statusCode, userId, userName string, add float64) {
	relayRequestSuccessCounter.WithLabelValues(channel, channelName, tag, baseURL, model, group, statusCode, userId, userName).Add(add)
>>>>>>> Stashed changes
}

func IncrementRelayRequestFailedCounter(channel, channelName, tag, baseURL, model, group, code, userId, userName string, add float64) {
	relayRequestFailedCounter.WithLabelValues(channel, channelName, tag, baseURL, model, group, code, userId, userName).Add(add)
}

func IncrementRelayRetryCounter(channel, channelName, tag, baseURL, model, group, userId, userName string, add float64) {
	relayRequestRetryCounter.WithLabelValues(channel, channelName, tag, baseURL, model, group, userId, userName).Add(add)
}

func ObserveRelayRequestDuration(channel, channelName, tag, baseURL, model, group, userId, userName string, duration float64) {
	relayRequestDurationObsever.WithLabelValues(channel, channelName, tag, baseURL, model, group, userId, userName).Observe(duration)
}

func IncrementRelayRequestE2ETotalCounter(channel, channelName, model, group, tokenKey, tokenName, userId, userName string, add float64) {
	relayRequestE2ETotalCounter.WithLabelValues(channel, channelName, model, group, tokenKey, tokenName, userId, userName).Add(add)
}

func IncrementRelayRequestE2ESuccessCounter(channel, channelName, model, group, tokenKey, tokenName, userId, userName string, add float64) {
	relayRequestE2ESuccessCounter.WithLabelValues(channel, channelName, model, group, tokenKey, tokenName, userId, userName).Add(add)
}

func IncrementRelayRequestE2EFailedCounter(channel, channelName, model, group, code, tokenKey, tokenName, userId, userName string, add float64) {
	relayRequestE2EFailedCounter.WithLabelValues(channel, channelName, model, group, code, tokenKey, tokenName, userId, userName).Add(add)
}

func ObserveRelayRequestE2EDuration(channel, channelName, model, group, tokenKey, tokenName, userId, userName string, duration float64) {
	relayRequestE2EDurationObsever.WithLabelValues(channel, channelName, model, group, tokenKey, tokenName, userId, userName).Observe(duration)
}

<<<<<<< Updated upstream
=======
// Batch request metrics functions
func IncrementBatchRequestCounter(channel, channelName, tag, baseURL, model, group, code, retryHeader, userId, userName string, add float64) {
	batchRequestCounter.WithLabelValues(channel, channelName, tag, baseURL, model, group, code, retryHeader, userId, userName).Add(add)
}

func ObserveBatchRequestDuration(channel, channelName, tag, baseURL, model, group, code, retryHeader, userId, userName string, duration float64) {
	batchRequestDurationObsever.WithLabelValues(channel, channelName, tag, baseURL, model, group, code, retryHeader, userId, userName).Observe(duration)
}

>>>>>>> Stashed changes
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
func IncrementErrorLog(channel, channelName, errorCode, errorType, model, group, tokenName, userId, userName string, add float64) {
	errorLogCounter.WithLabelValues(channel, channelName, errorCode, errorType, model, group, tokenName, userId, userName).Add(add)
}
