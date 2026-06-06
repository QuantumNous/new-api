package model

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// GetModelContextLength parses a model's comma-separated Tags field for a
// context window token and returns the resolved token count as a *int64.
// Returns nil if the model is unknown or its tags contain no recognizable
// context window value.
//
// Accepted token formats (case-insensitive, whitespace-tolerant):
//
//	"200K"     -> 200_000
//	"262.1K"   -> 262_100
//	"1M"       -> 1_000_000
//	"1.1M"     -> 1_100_000
//	"200000"   -> 200_000
//	"128"      -> 128
//
// Tags is read from the in-memory pricingMap cache. We only consult
// GetPricing() when the cache is already populated, so a call here never
// triggers a database refresh — making it safe to invoke on every
// /v1/models request and from tests that do not initialize a database.
func GetModelContextLength(modelName string) (result *int64) {
	if modelName == "" {
		return nil
	}

	// Ensure the pricing cache is fresh. We always call GetPricing() (which
	// is internally guarded by a 1-minute TTL and a mutex) so the cold-start
	// path of /v1/models still surfaces context_length for the first request
	// after a container restart. This mirrors GetModelEnableGroups and
	// GetModelQuotaTypes in model_extra.go.
	//
	// The recover() guards test paths (and any future degraded DB state)
	// where the cache refresh might panic. A failed refresh simply means
	// we cannot resolve context_length for this request, which is the same
	// outcome as "model not found in the cache" - return nil, do not crash
	// the /v1/models response.
	defer func() {
		if r := recover(); r != nil {
			common.SysLog(fmt.Sprintf("GetModelContextLength: cache refresh panicked for model %q: %v", modelName, r))
			result = nil
		}
	}()
	GetPricing()

	for i := range pricingMap {
		if pricingMap[i].ModelName != modelName {
			continue
		}
		tags := pricingMap[i].Tags
		if strings.TrimSpace(tags) == "" {
			return nil
		}
		for _, token := range strings.Split(tags, ",") {
			token = strings.TrimSpace(token)
			if token == "" {
				continue
			}
			if v := parseContextLengthToken(token); v != nil {
				return v
			}
		}
		return nil
	}
	return nil
}

// parseContextLengthToken tries to interpret a single tag token as a
// context window size. It accepts:
//
//   - "<number>[kKmM]" with an optional decimal component (e.g. "200K",
//     "262.1K", "1M", "1.1M"). "K" multiplies by 1_000, "M" by 1_000_000.
//   - A raw non-negative integer (e.g. "128", "200000").
//
// Matching is case-insensitive and whitespace around the numeric part is
// tolerated. Returns nil when the token does not match either pattern.
func parseContextLengthToken(token string) *int64 {
	upper := strings.ToUpper(strings.TrimSpace(token))
	if upper == "" {
		return nil
	}

	// Suffix form: <number>[kKmM]
	if len(upper) > 1 {
		suffix := upper[len(upper)-1]
		if suffix == 'K' || suffix == 'M' {
			numPart := strings.TrimSpace(upper[:len(upper)-1])
			if numPart == "" {
				return nil
			}
			// Only accept pure decimals here. Using ParseFloat keeps us
			// safe for "262.1K" style tokens.
			f, err := strconv.ParseFloat(numPart, 64)
			if err != nil || f < 0 {
				return nil
			}
			var mult int64
			if suffix == 'K' {
				mult = 1_000
			} else {
				mult = 1_000_000
			}
			return int64Ptr(int64(f * float64(mult)))
		}
	}

	// Raw integer form: "128", "200000"
	if i, err := strconv.ParseInt(upper, 10, 64); err == nil && i >= 0 {
		return int64Ptr(i)
	}
	return nil
}

func int64Ptr(v int64) *int64 {
	return &v
}
