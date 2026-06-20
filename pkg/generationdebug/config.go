package generationdebug

import (
	"hash/fnv"
	"math"
	"os"
	"strconv"
	"strings"
)

const (
	defaultMaxBytes = 262144
)

func LoadConfigFromEnv() CaptureConfig {
	return CaptureConfig{
		Enabled:       envBool("GENERATION_DEBUG_ENABLED", false),
		CaptureRaw:    envBool("GENERATION_DEBUG_CAPTURE_RAW", false),
		CaptureOutput: envBool("GENERATION_DEBUG_CAPTURE_OUTPUT", true),
		MaxBytes:      envInt("GENERATION_DEBUG_MAX_BYTES", defaultMaxBytes),
		SampleRate:    envFloat("GENERATION_DEBUG_SAMPLE_RATE", 1),
		UserVisible:   envBool("GENERATION_DEBUG_USER_VISIBLE", true),
	}
}

func envBool(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func envInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func envFloat(key string, fallback float64) float64 {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil || math.IsNaN(parsed) || math.IsInf(parsed, 0) {
		return fallback
	}
	if parsed < 0 {
		return 0
	}
	if parsed > 1 {
		return 1
	}
	return parsed
}

func sampled(requestID string, rate float64) bool {
	if rate <= 0 {
		return false
	}
	if rate >= 1 {
		return true
	}
	hash := fnv.New64a()
	_, _ = hash.Write([]byte(requestID))
	const buckets = uint64(1_000_000)
	return float64(hash.Sum64()%buckets)/float64(buckets) < rate
}
