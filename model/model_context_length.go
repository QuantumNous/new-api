package model

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// contextLengthPattern matches a single context window token with a
// K/M/T unit suffix. The number may include a decimal component
// (e.g. "200K", "262.1K", "2T", "0.5t"). Whitespace around the token
// is trimmed before matching.
//
// The pattern is anchored to digits at the start and a single K/M/T
// letter at the end, with nothing allowed in between. This explicitly
// rejects tokens that contain letters anywhere other than the trailing
// unit, so values like "e4bK", "4bK", "200KB", "1.0X", or "v2K" are
// all rejected by the pattern without reaching the multiplier math.
// Bare decimals like "1.5" are also rejected — they fall through to
// the ParseInt path below, which also rejects them.
//
// Bare non-negative integers without a unit (e.g. "128", "200000") are
// handled by strconv.ParseInt, not by this regex.
//
// Examples that match this pattern: "200K", "262.1K", "1M", "2T", "0.5t".
// Examples that do NOT match: "1.5", "Tools", "K", "-1", "200KB", "1.0X",
//   "e4bK", "4bK", "v2K", "200k " (trailing space inside the regex).
var contextLengthPattern = regexp.MustCompile(`^(\d+(?:\.\d+)?)([kKmMtT])$`)

// unitMultipliers maps a suffix character to its power-of-ten multiplier
// relative to a single token. Keeping the table as a map (rather than
// scattered branches) makes the supported set obvious at a glance and
// trivial to extend.
var unitMultipliers = map[byte]int64{
	'K': 1_000,
	'M': 1_000_000,
	'T': 1_000_000_000,
}

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
//	"2T"       -> 2_000_000_000
//	"0.5T"     -> 500_000_000
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
// context window size. It accepts "<number>[KkMmTt]" (optional suffix)
// where the number may have a decimal component. A raw non-negative
// integer is also accepted (e.g. "128", "200000").
//
// Matching is case-insensitive and whitespace around the token is
// tolerated. Returns nil when the token does not match the pattern.
func parseContextLengthToken(token string) *int64 {
	trimmed := strings.TrimSpace(token)
	if trimmed == "" {
		return nil
	}

	// Suffix form: <number>[KkMmTt]. The number may be a decimal,
	// and the suffix is required (so "1.5" is rejected outright by
	// the pattern, never reaching the multiplier math). Lowercase and
	// uppercase suffix letters are accepted; we normalize to uppercase
	// before the multiplier lookup so the table stays the single
	// source of truth.
	if m := contextLengthPattern.FindStringSubmatch(trimmed); m != nil {
		f, err := strconv.ParseFloat(m[1], 64)
		if err != nil || f < 0 {
			return nil
		}
		suffix := m[2][0]
		if suffix >= 'a' && suffix <= 'z' {
			suffix -= 'a' - 'A'
		}
		return int64Ptr(int64(f * float64(unitMultipliers[suffix])))
	}

	// Raw integer form: "128", "200000". Strictly integers, no decimal
	// point and no suffix — anything more exotic falls through.
	if i, err := strconv.ParseInt(trimmed, 10, 64); err == nil && i >= 0 {
		return int64Ptr(i)
	}

	return nil
}

// int64Ptr returns a pointer to the given int64 value. It exists so the
// parser can return typed pointers directly from branches (regex match,
// ParseInt) without each call site re-allocating a temp variable.
func int64Ptr(v int64) *int64 {
	return &v
}
