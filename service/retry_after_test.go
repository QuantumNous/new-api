package service

import (
	"net/http"
	"strconv"
	"testing"
	"time"
)

func TestParseRetryAfterSeconds(t *testing.T) {
	t.Run("nil header", func(t *testing.T) {
		if n := ParseRetryAfterSeconds(nil); n != 0 {
			t.Fatalf("expected 0 for nil header, got %d", n)
		}
	})

	t.Run("empty header", func(t *testing.T) {
		if n := ParseRetryAfterSeconds(http.Header{}); n != 0 {
			t.Fatalf("expected 0 for empty header, got %d", n)
		}
	})

	t.Run("retry-after delta seconds", func(t *testing.T) {
		h := http.Header{"Retry-After": {"42"}}
		if n := ParseRetryAfterSeconds(h); n != 42 {
			t.Fatalf("expected 42, got %d", n)
		}
	})

	t.Run("retry-after negative clamped to 0", func(t *testing.T) {
		h := http.Header{"Retry-After": {"-5"}}
		if n := ParseRetryAfterSeconds(h); n != 0 {
			t.Fatalf("expected 0 for negative, got %d", n)
		}
	})

	t.Run("retry-after http date", func(t *testing.T) {
		future := time.Now().Add(90 * time.Second).UTC().Format(http.TimeFormat)
		h := http.Header{"Retry-After": {future}}
		n := ParseRetryAfterSeconds(h)
		// Allow a little slack for clock/rounding.
		if n < 80 || n > 90 {
			t.Fatalf("expected ~90s from http-date, got %d", n)
		}
	})

	t.Run("retry-after past http date -> 0", func(t *testing.T) {
		past := time.Now().Add(-90 * time.Second).UTC().Format(http.TimeFormat)
		h := http.Header{"Retry-After": {past}}
		if n := ParseRetryAfterSeconds(h); n != 0 {
			t.Fatalf("expected 0 for past date, got %d", n)
		}
	})

	t.Run("x-ratelimit-reset delta seconds", func(t *testing.T) {
		h := http.Header{"X-Ratelimit-Reset": {"12"}}
		if n := ParseRetryAfterSeconds(h); n != 12 {
			t.Fatalf("expected 12, got %d", n)
		}
	})

	t.Run("x-ratelimit-reset unix seconds", func(t *testing.T) {
		reset := time.Now().Add(60 * time.Second).Unix()
		h := http.Header{"X-Ratelimit-Reset": {formatInt(reset)}}
		n := ParseRetryAfterSeconds(h)
		if n < 50 || n > 60 {
			t.Fatalf("expected ~60s from unix-seconds reset, got %d", n)
		}
	})

	t.Run("x-ratelimit-reset unix millis", func(t *testing.T) {
		reset := time.Now().Add(60*time.Second).UnixNano() / int64(time.Millisecond)
		h := http.Header{"X-Ratelimit-Reset": {formatInt(reset)}}
		n := ParseRetryAfterSeconds(h)
		if n < 50 || n > 60 {
			t.Fatalf("expected ~60s from unix-millis reset, got %d", n)
		}
	})

	t.Run("retry-after takes precedence over reset", func(t *testing.T) {
		h := http.Header{
			"Retry-After":       {"7"},
			"X-Ratelimit-Reset": {"999"},
		}
		if n := ParseRetryAfterSeconds(h); n != 7 {
			t.Fatalf("expected Retry-After (7) to win, got %d", n)
		}
	})

	// OpenAI emits reset headers as Go-duration strings, e.g. "6m0s", "1s",
	// "88ms". These must be honoured rather than falling through to 0.
	t.Run("reset go-duration minutes", func(t *testing.T) {
		h := http.Header{"X-Ratelimit-Reset-Requests": {"6m0s"}}
		if n := ParseRetryAfterSeconds(h); n != 360 {
			t.Fatalf("expected 360 from 6m0s, got %d", n)
		}
	})

	t.Run("reset go-duration seconds", func(t *testing.T) {
		h := http.Header{"X-Ratelimit-Reset-Tokens": {"1s"}}
		if n := ParseRetryAfterSeconds(h); n != 1 {
			t.Fatalf("expected 1 from 1s, got %d", n)
		}
	})

	t.Run("reset go-duration sub-second rounds up to 1", func(t *testing.T) {
		h := http.Header{"X-Ratelimit-Reset-Requests": {"88ms"}}
		if n := ParseRetryAfterSeconds(h); n != 1 {
			t.Fatalf("expected sub-second to round up to 1, got %d", n)
		}
	})
}

func formatInt(v int64) string {
	return strconv.FormatInt(v, 10)
}
