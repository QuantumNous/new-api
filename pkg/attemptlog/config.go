// Package attemptlog records one telemetry row per relay attempt against one
// upstream channel, intended as a training data source for routing and
// success-rate models.
//
// It is deliberately decoupled from relay/common and service: the caller
// extracts values and passes primitives in. That keeps the package free of
// import cycles and unit-testable without constructing a RelayInfo.
package attemptlog

import (
	"math/rand"
	"strconv"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

const (
	envEnabled     = "RELAY_ATTEMPT_LOG_ENABLED"
	envSampleRate  = "RELAY_ATTEMPT_LOG_SAMPLE_RATE"
	envBufferSize  = "RELAY_ATTEMPT_LOG_BUFFER_SIZE"
	envBatchSize   = "RELAY_ATTEMPT_LOG_BATCH_SIZE"
	envFlushMillis = "RELAY_ATTEMPT_LOG_FLUSH_MS"
)

type config struct {
	enabled     bool
	sampleRate  float64
	bufferSize  int
	batchSize   int
	flushMillis int
}

var (
	cfgOnce sync.Once
	cfg     config
)

func loadConfig() config {
	cfgOnce.Do(func() {
		cfg = config{
			enabled:     common.GetEnvOrDefaultBool(envEnabled, false),
			bufferSize:  common.GetEnvOrDefault(envBufferSize, 4096),
			batchSize:   common.GetEnvOrDefault(envBatchSize, 200),
			flushMillis: common.GetEnvOrDefault(envFlushMillis, 2000),
		}

		rate := common.GetEnvOrDefaultString(envSampleRate, "1")
		cfg.sampleRate = parseSampleRate(rate)

		if cfg.bufferSize < 1 {
			cfg.bufferSize = 1
		}
		if cfg.batchSize < 1 {
			cfg.batchSize = 1
		}
		if cfg.batchSize > cfg.bufferSize {
			cfg.batchSize = cfg.bufferSize
		}
		if cfg.flushMillis < 100 {
			cfg.flushMillis = 100
		}
	})
	return cfg
}

func parseSampleRate(raw string) float64 {
	rate, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		common.SysError("attemptlog: invalid " + envSampleRate + "=" + raw + ", falling back to 1")
		return 1
	}
	if rate < 0 {
		return 0
	}
	if rate > 1 {
		return 1
	}
	return rate
}

// Enabled reports whether attempt telemetry is being recorded at all. It is off
// by default; set RELAY_ATTEMPT_LOG_ENABLED=true to turn it on.
func Enabled() bool {
	return loadConfig().enabled
}

func sampled() bool {
	rate := loadConfig().sampleRate
	if rate >= 1 {
		return true
	}
	if rate <= 0 {
		return false
	}
	return rand.Float64() < rate
}
