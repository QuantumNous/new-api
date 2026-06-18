package common

import (
	"math/rand"
	"sync/atomic"
)

// upstreamTraceSamplePercent stores the upstream-trace sampling rate as an
// integer percent in [0,100] (default 100 = trace every request once tracing is
// enabled). It is stored atomically because it is read on the request hot path
// (in AttachUpstreamTrace) whenever UpstreamTraceEnabled is on.
var upstreamTraceSamplePercent atomic.Int64

func init() {
	// Default to 100% so that enabling the trace without configuring a sample
	// rate (and any code path that skips InitEnv, e.g. unit tests) still samples.
	upstreamTraceSamplePercent.Store(100)
}

// SetUpstreamTraceSampleRate sets the sampling rate from a [0,1] fraction,
// clamping out-of-range values. 1 => always, 0 => never.
func SetUpstreamTraceSampleRate(rate float64) {
	switch {
	case rate <= 0:
		upstreamTraceSamplePercent.Store(0)
	case rate >= 1:
		upstreamTraceSamplePercent.Store(100)
	default:
		upstreamTraceSamplePercent.Store(int64(rate*100 + 0.5))
	}
}

// GetUpstreamTraceSampleRate returns the configured sampling rate as a [0,1]
// fraction (used for OptionMap registration and the admin UI round-trip).
func GetUpstreamTraceSampleRate() float64 {
	return float64(upstreamTraceSamplePercent.Load()) / 100
}

// UpstreamTraceSampleHit reports whether the current request should be traced
// under the configured sampling rate. Rate 1 (default) always hits; rate 0 never.
func UpstreamTraceSampleHit() bool {
	p := upstreamTraceSamplePercent.Load()
	if p >= 100 {
		return true
	}
	if p <= 0 {
		return false
	}
	return rand.Int63n(100) < p
}
