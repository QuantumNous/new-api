package attemptlog

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// NoteUpstream records the outcome of one upstream HTTP call against the attempt
// currently on the context. It is a no-op when telemetry is off.
//
// Some adaptors issue more than one upstream call per attempt. The earliest
// start time wins so upstream_ms spans the whole upstream interaction, while the
// status and Retry-After of the most recent call win, since that is the response
// the attempt's result is derived from.
func NoteUpstream(c *gin.Context, upstreamStart time.Time, resp *http.Response) {
	attempt := fromContext(c)
	if attempt == nil {
		return
	}

	attempt.mu.Lock()
	defer attempt.mu.Unlock()

	if !attempt.upstreamKnown || upstreamStart.Before(attempt.upstreamStart) {
		attempt.upstreamStart = upstreamStart
	}
	attempt.upstreamKnown = true

	if resp == nil {
		return
	}
	attempt.httpStatus = resp.StatusCode
	if hint := parseRetryAfter(resp.Header.Get("Retry-After")); hint != nil {
		attempt.retryAfterHint = hint
	}
}

// parseRetryAfter reads the Retry-After header, which RFC 9110 allows to be
// either delay-seconds or an HTTP-date.
func parseRetryAfter(raw string) *int {
	if raw == "" {
		return nil
	}
	if secs, err := strconv.Atoi(raw); err == nil {
		if secs < 0 {
			return nil
		}
		return &secs
	}
	if when, err := http.ParseTime(raw); err == nil {
		secs := int(time.Until(when).Seconds())
		if secs < 0 {
			secs = 0
		}
		return &secs
	}
	return nil
}

// UsageNote carries the settled usage and cost for an attempt.
type UsageNote struct {
	InputTokens     int
	OutputTokens    int
	CachedTokens    int
	ReasoningTokens int
	CostActual      int
}

// NoteUsage records settled usage and cost against the attempt on the context.
// It is called from the billing layer, which is the only place where the final
// charged quota and the normalized token counts are both known.
func NoteUsage(c *gin.Context, note UsageNote) {
	attempt := fromContext(c)
	if attempt == nil {
		return
	}

	attempt.mu.Lock()
	defer attempt.mu.Unlock()

	attempt.usageKnown = true
	attempt.inputTokens = note.InputTokens
	attempt.outputTokens = note.OutputTokens
	attempt.cachedTokens = note.CachedTokens
	attempt.reasoningTokens = note.ReasoningTokens
	attempt.costActual = note.CostActual
}
