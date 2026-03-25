package metrics

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/prometheus/client_golang/prometheus"
)

// region is read once from MAAS_REGION env var at startup.
var region string

func init() {
	region = os.Getenv("MAAS_REGION")
	if region == "" {
		region = "unknown"
	}

	prometheus.MustRegister(
		llmInputTokenTotal,
		llmOutputTokenTotal,
		llmRequestTotal,
		llmServiceDuration,
		llmFirstTokenDuration,
		llmTimePerOutputToken,
		rateLimitTotal,
		circuitBreakerState,
		llmGatewayDuration,
	)
}

// GetRegion returns the configured MAAS_REGION value.
func GetRegion() string {
	return region
}

// ---- LLM Metrics (6) ----

var llmRequestLabelNames = []string{
	"model", "channel", "upstream_model", "status", "error_type",
	"region", "is_stream", "token_name",
}

var llmTokenLabelNames = []string{
	"model", "channel", "upstream_model", "region", "token_name",
}

var llmLatencyLabelNames = []string{
	"model", "channel", "region",
}

var (
	llmRequestTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "newapi",
			Name:      "llm_request_total",
			Help:      "Total number of LLM requests",
		},
		llmRequestLabelNames,
	)

	llmInputTokenTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "newapi",
			Name:      "llm_input_token_total",
			Help:      "Total number of LLM input (prompt) tokens",
		},
		llmTokenLabelNames,
	)

	llmOutputTokenTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "newapi",
			Name:      "llm_output_token_total",
			Help:      "Total number of LLM output (completion) tokens",
		},
		llmTokenLabelNames,
	)

	llmFirstTokenDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "newapi",
			Name:      "llm_first_token_duration_seconds",
			Help:      "LLM time-to-first-token (TTFT) in seconds",
			Buckets:   []float64{0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30},
		},
		llmLatencyLabelNames,
	)

	llmTimePerOutputToken = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "newapi",
			Name:      "llm_time_per_output_token_seconds",
			Help:      "LLM time per output token (TPOT) in seconds",
			Buckets:   []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1},
		},
		llmLatencyLabelNames,
	)

	llmServiceDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "newapi",
			Name:      "llm_service_duration_seconds",
			Help:      "LLM upstream service duration in seconds (from request start to response complete)",
			Buckets:   []float64{0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300},
		},
		llmLatencyLabelNames,
	)
)

// ---- Rate Limit / Circuit Breaker / Gateway Metrics (3) ----

var (
	rateLimitTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "newapi",
			Name:      "rate_limit_total",
			Help:      "Total number of rate limit triggers",
		},
		[]string{"model", "channel", "type", "token_name"},
	)

	circuitBreakerState = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: "newapi",
			Name:      "circuit_breaker_state",
			Help:      "Circuit breaker state (0=Closed, 1=HalfOpen, 2=Open)",
		},
		[]string{"channel", "model"},
	)

	llmGatewayDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "newapi",
			Name:      "llm_gateway_duration_seconds",
			Help:      "Gateway processing duration in seconds (excluding upstream)",
			Buckets:   []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5},
		},
		[]string{"model", "channel"},
	)
)

// RecordAIMetrics should be called after a relay request completes.
// It records token counts, request count, service duration, TTFT, and TPOT.
func RecordAIMetrics(relayInfo *relaycommon.RelayInfo, usage *dto.Usage) {
	RecordAIMetricsWithStatus(relayInfo, usage, "success", "")
}

// RecordAIMetricsWithStatus records LLM metrics with explicit status and error type.
func RecordAIMetricsWithStatus(relayInfo *relaycommon.RelayInfo, usage *dto.Usage, status string, errorType string) {
	if relayInfo == nil || relayInfo.ChannelMeta == nil {
		return
	}

	model := relayInfo.OriginModelName
	channel := fmt.Sprintf("%d", relayInfo.ChannelMeta.ChannelId)
	upstreamModel := relayInfo.ChannelMeta.UpstreamModelName
	tokenName := ""
	if relayInfo.TokenKey != "" {
		tokenName = relayInfo.TokenKey
	}
	isStream := strconv.FormatBool(relayInfo.IsStream)

	// Request count (with status labels)
	llmRequestTotal.WithLabelValues(
		model, channel, upstreamModel, status, errorType,
		region, isStream, tokenName,
	).Inc()

	// Token counts
	if usage != nil {
		tokenLabels := []string{model, channel, upstreamModel, region, tokenName}
		llmInputTokenTotal.WithLabelValues(tokenLabels...).Add(float64(usage.PromptTokens))
		llmOutputTokenTotal.WithLabelValues(tokenLabels...).Add(float64(usage.CompletionTokens))
	}

	latencyLabels := []string{model, channel, region}

	// Service duration (total time from request start to now)
	serviceDuration := time.Since(relayInfo.StartTime).Seconds()
	llmServiceDuration.WithLabelValues(latencyLabels...).Observe(serviceDuration)

	// Time-to-first-token (only meaningful when FirstResponseTime was recorded)
	if !relayInfo.FirstResponseTime.IsZero() {
		ttft := relayInfo.FirstResponseTime.Sub(relayInfo.StartTime).Seconds()
		if ttft > 0 {
			llmFirstTokenDuration.WithLabelValues(latencyLabels...).Observe(ttft)
		}

		// Time per output token (TPOT): (total_duration - ttft) / output_tokens
		if usage != nil && usage.CompletionTokens > 0 {
			generationDuration := serviceDuration - ttft
			if generationDuration > 0 {
				tpot := generationDuration / float64(usage.CompletionTokens)
				llmTimePerOutputToken.WithLabelValues(latencyLabels...).Observe(tpot)
			}
		}
	}
}

// RecordRateLimit records a rate limit trigger event.
func RecordRateLimit(model string, channel string, limitType string, tokenName string) {
	rateLimitTotal.WithLabelValues(model, channel, limitType, tokenName).Inc()
}

// RecordCircuitBreakerState updates the circuit breaker state gauge.
func RecordCircuitBreakerState(channel string, model string, state float64) {
	circuitBreakerState.WithLabelValues(channel, model).Set(state)
}

// RecordGatewayDuration records the gateway processing duration (excluding upstream).
func RecordGatewayDuration(model string, channel string, durationSeconds float64) {
	llmGatewayDuration.WithLabelValues(model, channel).Observe(durationSeconds)
}
