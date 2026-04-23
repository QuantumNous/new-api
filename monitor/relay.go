package monitor

import (
	"strconv"
	"time"
)

// RelayMetricsData holds the data needed to record relay metrics.
type RelayMetricsData struct {
	ChannelId      int
	ChannelType    int
	Model          string
	RelayMode      int
	StatusCode     int
	StartTime      time.Time
	FirstTokenTime time.Time
	IsStream       bool
	ErrorType      string
}

// RecordRelayRequest records relay request count, duration, first-token time, and errors.
func RecordRelayRequest(d *RelayMetricsData) {
	if !Enabled() || d == nil {
		return
	}

	chID := strconv.Itoa(d.ChannelId)
	chType := strconv.Itoa(d.ChannelType)
	model := d.Model
	mode := strconv.Itoa(d.RelayMode)
	status := strconv.Itoa(d.StatusCode)

	RelayRequestsTotal.WithLabelValues(chID, chType, model, status, mode).Inc()

	duration := time.Since(d.StartTime).Seconds()
	RelayRequestDuration.WithLabelValues(chID, chType, model, mode).Observe(duration)

	if d.IsStream && !d.FirstTokenTime.IsZero() {
		ttft := d.FirstTokenTime.Sub(d.StartTime).Seconds()
		RelayFirstTokenDuration.WithLabelValues(chID, chType, model).Observe(ttft)
	}

	if d.ErrorType != "" {
		RelayErrorsTotal.WithLabelValues(chID, chType, d.ErrorType).Inc()
	}
}

// RecordRelayRetry records a relay retry event.
func RecordRelayRetry(channelId, channelType int) {
	if !Enabled() {
		return
	}
	RelayRetriesTotal.WithLabelValues(strconv.Itoa(channelId), strconv.Itoa(channelType)).Inc()
}

// RecordRelayTokens records token usage for a relay request.
func RecordRelayTokens(channelId, channelType int, model string, inputTokens, outputTokens int) {
	if !Enabled() {
		return
	}
	chID := strconv.Itoa(channelId)
	chType := strconv.Itoa(channelType)

	if inputTokens > 0 {
		RelayTokensUsedTotal.WithLabelValues(chID, chType, model, "input").Add(float64(inputTokens))
	}
	if outputTokens > 0 {
		RelayTokensUsedTotal.WithLabelValues(chID, chType, model, "output").Add(float64(outputTokens))
	}
}
