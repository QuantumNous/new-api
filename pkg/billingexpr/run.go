package billingexpr

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/expr-lang/expr"
	"github.com/expr-lang/expr/vm"
	"github.com/tidwall/gjson"
)

// RunExpr compiles (with cache) and executes an expression string.
// The environment exposes:
//   - p, c             — prompt / completion tokens (auto-excluding separately-priced sub-categories)
//   - len              — total input context length for tier conditions (never reduced by sub-category exclusion)
//   - cr, cc, cc1h     — cache read / creation / creation-1h tokens
//   - tier(name, value) — trace callback that records which tier matched
//   - max, min, abs, ceil, floor — standard math helpers
//
// Returns the resulting float64 quota (before group ratio) and a TraceResult
// with side-channel info captured by tier() during execution.
func RunExpr(exprStr string, params TokenParams) (float64, TraceResult, error) {
	return RunExprWithRequest(exprStr, params, RequestInput{})
}

func RunExprWithRequest(exprStr string, params TokenParams, request RequestInput) (float64, TraceResult, error) {
	entry, err := compileEntryFromCacheByHash(exprStr, ExprHashString(exprStr))
	if err != nil {
		return 0, TraceResult{}, err
	}
	return runProgram(entry.prog, entry.requestRules, entry.usedVars, params, request)
}

// RunExprByHash is like RunExpr but accepts a pre-computed hash for the cache
// lookup, avoiding a redundant SHA-256 computation when the caller already
// holds BillingSnapshot.ExprHash.
func RunExprByHash(exprStr, hash string, params TokenParams) (float64, TraceResult, error) {
	return RunExprByHashWithRequest(exprStr, hash, params, RequestInput{})
}

func RunExprByHashWithRequest(exprStr, hash string, params TokenParams, request RequestInput) (float64, TraceResult, error) {
	entry, err := compileEntryFromCacheByHash(exprStr, hash)
	if err != nil {
		return 0, TraceResult{}, err
	}
	return runProgram(entry.prog, entry.requestRules, entry.usedVars, params, request)
}

func validatedRequestScalar(name string, value *float64, maximum float64) (float64, error) {
	if value == nil {
		return 0, fmt.Errorf("%s is required for fixed request pricing", name)
	}
	if math.IsNaN(*value) || math.IsInf(*value, 0) || *value < 0 || *value > maximum || math.Trunc(*value) != *value {
		return 0, fmt.Errorf("%s must be a finite integer between 0 and %.0f", name, maximum)
	}
	return *value, nil
}

func runProgram(prog *vm.Program, requestRules []RequestRuleTrace, usedVars map[string]bool, params TokenParams, request RequestInput) (float64, TraceResult, error) {
	trace := TraceResult{
		BillingUnit:  BillingUnitToken,
		RequestRules: append([]RequestRuleTrace(nil), requestRules...),
	}
	headers := normalizeHeaders(request.Headers)
	evaluatedAt := time.Now().UTC()
	if request.EvaluatedAtUnix > 0 {
		evaluatedAt = time.Unix(request.EvaluatedAtUnix, 0).UTC()
	}
	imageCount := 1
	if usedVars["image_count"] {
		if request.ImageCount != nil {
			imageCount = *request.ImageCount
		}
		if imageCount < 1 || imageCount > dto.MaxImageN {
			return 0, trace, fmt.Errorf("image_count must be between 1 and %d", dto.MaxImageN)
		}
		trace.ImageCount = &imageCount
	}
	imagesUpTo1_5K := float64(0)
	if usedVars["images_up_to_1_5k"] {
		var scalarErr error
		imagesUpTo1_5K, scalarErr = validatedRequestScalar("images_up_to_1_5k", request.ImagesUpTo1_5K, MaxRequestImageOutputs)
		if scalarErr != nil {
			return 0, trace, scalarErr
		}
	}
	imagesAbove1_5K := float64(0)
	if usedVars["images_above_1_5k"] {
		var scalarErr error
		imagesAbove1_5K, scalarErr = validatedRequestScalar("images_above_1_5k", request.ImagesAbove1_5K, MaxRequestImageOutputs)
		if scalarErr != nil {
			return 0, trace, scalarErr
		}
	}
	if usedVars["images_up_to_1_5k"] && usedVars["images_above_1_5k"] && imagesUpTo1_5K+imagesAbove1_5K > MaxRequestImageOutputs {
		return 0, trace, fmt.Errorf("request image outputs must total between 0 and %d", MaxRequestImageOutputs)
	}
	inputImages := float64(0)
	if usedVars["input_images"] {
		var scalarErr error
		inputImages, scalarErr = validatedRequestScalar("input_images", request.InputImages, MaxRequestInputImages)
		if scalarErr != nil {
			return 0, trace, scalarErr
		}
	}

	var fixedErr error
	env := map[string]any{
		"image_count":       float64(imageCount),
		"images_up_to_1_5k": imagesUpTo1_5K,
		"images_above_1_5k": imagesAbove1_5K,
		"input_images":      inputImages,
		"p":                 params.P,
		"c":                 params.C,
		"len":               params.Len,
		"cr":                params.CR,
		"cc":                params.CC,
		"cc1h":              params.CC1h,
		"img":               params.Img,
		"img_cr":            params.ImgCR,
		"img_o":             params.ImgO,
		"ai":                params.AI,
		"ao":                params.AO,
		"tier": func(name string, value float64) float64 {
			trace.MatchedTier = name
			trace.Cost = value
			return value
		},
		"fixed": func(amount float64) float64 {
			if amount < 0 || math.IsNaN(amount) || math.IsInf(amount, 0) || math.IsInf(amount*1_000_000, 0) {
				fixedErr = fmt.Errorf("fixed price must evaluate to a finite, non-negative amount with a finite v1 value")
				return 0
			}
			trace.BillingUnit = BillingUnitRequest
			trace.FixedPrice = &amount
			return amount * 1_000_000
		},
		requestRuleTraceFunction: func(ruleIndex int, matched bool, multiplier float64) float64 {
			if matched && ruleIndex >= 0 && ruleIndex < len(trace.RequestRules) {
				trace.RequestRules[ruleIndex].Matched = true
			}
			if matched {
				return multiplier
			}
			return 1
		},
		requestRuleTraceIntFunction: func(ruleIndex int, matched bool, multiplier int) int {
			if matched && ruleIndex >= 0 && ruleIndex < len(trace.RequestRules) {
				trace.RequestRules[ruleIndex].Matched = true
			}
			if matched {
				return multiplier
			}
			return 1
		},
		"header": func(key string) string {
			return headers[strings.ToLower(strings.TrimSpace(key))]
		},
		"param": func(path string) any {
			path = strings.TrimSpace(path)
			if path == "" || len(request.Body) == 0 {
				return nil
			}
			result := gjson.GetBytes(request.Body, path)
			if !result.Exists() {
				return nil
			}
			return result.Value()
		},
		"u": func(name string) any {
			if request.Usage == nil {
				return nil
			}
			return request.Usage[strings.TrimSpace(name)]
		},
		"has": func(source any, substr string) bool {
			if source == nil || substr == "" {
				return false
			}
			return strings.Contains(fmt.Sprint(source), substr)
		},
		"hour":    func(tz string) int { return timeInZone(evaluatedAt, tz).Hour() },
		"minute":  func(tz string) int { return timeInZone(evaluatedAt, tz).Minute() },
		"weekday": func(tz string) int { return int(timeInZone(evaluatedAt, tz).Weekday()) },
		"month":   func(tz string) int { return int(timeInZone(evaluatedAt, tz).Month()) },
		"day":     func(tz string) int { return timeInZone(evaluatedAt, tz).Day() },
		"unix":    func() int64 { return evaluatedAt.Unix() },
		"max":     math.Max,
		"min":     math.Min,
		"abs":     math.Abs,
		"ceil":    math.Ceil,
		"floor":   math.Floor,
	}

	out, err := expr.Run(prog, env)
	if err != nil {
		return 0, trace, fmt.Errorf("expr run error: %w", err)
	}
	if fixedErr != nil {
		return 0, trace, fixedErr
	}
	f, ok := out.(float64)
	if !ok {
		return 0, trace, fmt.Errorf("expr result is %T, want float64", out)
	}
	return f, trace, nil
}

func timeInZone(now time.Time, tz string) time.Time {
	tz = strings.TrimSpace(tz)
	if tz == "" {
		return now.UTC()
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return now.UTC()
	}
	return now.In(loc)
}

func normalizeHeaders(headers map[string]string) map[string]string {
	if len(headers) == 0 {
		return map[string]string{}
	}
	normalized := make(map[string]string, len(headers))
	for key, value := range headers {
		k := strings.ToLower(strings.TrimSpace(key))
		v := strings.TrimSpace(value)
		if k == "" || v == "" {
			continue
		}
		normalized[k] = v
	}
	return normalized
}
