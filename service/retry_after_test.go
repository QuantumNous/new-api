package service

import (
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestParseRetryAfterSeconds(t *testing.T) {
	t.Run("nil header", func(t *testing.T) {
		require.Equal(t, 0, ParseRetryAfterSeconds(nil))
	})

	t.Run("empty header", func(t *testing.T) {
		require.Equal(t, 0, ParseRetryAfterSeconds(http.Header{}))
	})

	t.Run("retry-after delta seconds", func(t *testing.T) {
		h := http.Header{"Retry-After": {"42"}}
		require.Equal(t, 42, ParseRetryAfterSeconds(h))
	})

	t.Run("retry-after negative clamped to 0", func(t *testing.T) {
		h := http.Header{"Retry-After": {"-5"}}
		require.Equal(t, 0, ParseRetryAfterSeconds(h))
	})

	t.Run("retry-after http date", func(t *testing.T) {
		future := time.Now().Add(90 * time.Second).UTC().Format(http.TimeFormat)
		h := http.Header{"Retry-After": {future}}
		n := ParseRetryAfterSeconds(h)
		// Allow a little slack for clock/rounding.
		require.GreaterOrEqual(t, n, 80)
		require.LessOrEqual(t, n, 90)
	})

	t.Run("retry-after past http date -> 0", func(t *testing.T) {
		past := time.Now().Add(-90 * time.Second).UTC().Format(http.TimeFormat)
		h := http.Header{"Retry-After": {past}}
		require.Equal(t, 0, ParseRetryAfterSeconds(h))
	})

	t.Run("x-ratelimit-reset delta seconds", func(t *testing.T) {
		h := http.Header{"X-Ratelimit-Reset": {"12"}}
		require.Equal(t, 12, ParseRetryAfterSeconds(h))
	})

	t.Run("x-ratelimit-reset unix seconds", func(t *testing.T) {
		reset := time.Now().Add(60 * time.Second).Unix()
		h := http.Header{"X-Ratelimit-Reset": {formatInt(reset)}}
		n := ParseRetryAfterSeconds(h)
		require.GreaterOrEqual(t, n, 50)
		require.LessOrEqual(t, n, 60)
	})

	t.Run("x-ratelimit-reset unix millis", func(t *testing.T) {
		reset := time.Now().Add(60*time.Second).UnixNano() / int64(time.Millisecond)
		h := http.Header{"X-Ratelimit-Reset": {formatInt(reset)}}
		n := ParseRetryAfterSeconds(h)
		require.GreaterOrEqual(t, n, 50)
		require.LessOrEqual(t, n, 60)
	})

	t.Run("retry-after takes precedence over reset", func(t *testing.T) {
		h := http.Header{
			"Retry-After":       {"7"},
			"X-Ratelimit-Reset": {"999"},
		}
		require.Equal(t, 7, ParseRetryAfterSeconds(h))
	})

	// OpenAI emits reset headers as Go-duration strings, e.g. "6m0s", "1s",
	// "88ms". These must be honoured rather than falling through to 0.
	t.Run("reset go-duration minutes", func(t *testing.T) {
		h := http.Header{"X-Ratelimit-Reset-Requests": {"6m0s"}}
		require.Equal(t, 360, ParseRetryAfterSeconds(h))
	})

	t.Run("reset go-duration seconds", func(t *testing.T) {
		h := http.Header{"X-Ratelimit-Reset-Tokens": {"1s"}}
		require.Equal(t, 1, ParseRetryAfterSeconds(h))
	})

	t.Run("reset go-duration sub-second rounds up to 1", func(t *testing.T) {
		h := http.Header{"X-Ratelimit-Reset-Requests": {"88ms"}}
		require.Equal(t, 1, ParseRetryAfterSeconds(h))
	})
}

func formatInt(v int64) string {
	return strconv.FormatInt(v, 10)
}
