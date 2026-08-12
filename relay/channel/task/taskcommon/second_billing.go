package taskcommon

import (
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/billing_setting"
)

// BillingUnitsKey is the single OtherRatios key holding the complete
// per-second calculation. One combined multiplier is used rather than separate
// seconds and resolution ratios because applyTaskOtherRatios truncates to int
// after each multiplication, and repeated truncation compounds.
//
// This value is persisted into TaskBillingContext at reservation and read back
// at settlement, which is what freezes the price against mid-flight edits.
const BillingUnitsKey = "video_billing_units"

// ComputeSecondBilling turns resolved dimensions into OtherRatios.
//
// Three outcomes:
//   - model not in the table          -> (nil, nil), caller keeps its old path
//   - model in the table, rule found  -> (units, nil)
//   - model in the table, no rule     -> (nil, error), request must be rejected
//
// seconds is the requested output length. A total_duration rule ignores it in
// favour of the rule's bounded FallbackSeconds, since input media length cannot
// be determined without fetching customer-controlled URLs.
//
// rules is taken as a parameter rather than read from the config getter so this
// stays pure and testable. Callers must call billing_setting.GetVideoPriceRules
// exactly once per request and pass the same snapshot here: two fetches could
// straddle a config reload and judge a model "configured" against one table
// while pricing it against another. The snapshot is shallow, so each rule's
// Match map is shared with the live table and is only ever read here.
func ComputeSecondBilling(
	rules []billing_setting.VideoPriceRule,
	model string,
	dims map[string]string,
	seconds float64,
	modelPrice float64,
) (map[string]float64, error) {
	if !billing_setting.IsVideoModelConfigured(rules, model) {
		return nil, nil
	}

	rule, ok := billing_setting.FindVideoPriceRule(rules, model, dims)
	if !ok {
		return nil, fmt.Errorf(
			"模型 %s 已配置按秒计费，但当前请求维度 %v 没有匹配的价格规则，请补充配置；"+
				"Model %s uses per-second billing but no price rule matches request dimensions %v. "+
				"Please add a matching rule.",
			model, dims, model, dims)
	}

	billableSeconds := seconds
	if rule.Basis == billing_setting.BasisTotalDuration {
		billableSeconds = rule.FallbackSeconds
	}
	if !isPositiveFinite(billableSeconds) {
		return nil, fmt.Errorf(
			"model %s: billable seconds must be positive and finite, got %v",
			model, billableSeconds)
	}
	if !isPositiveFinite(modelPrice) {
		return nil, fmt.Errorf(
			"model %s: model price must be positive and finite, got %v",
			model, modelPrice)
	}

	units := rule.PricePerSecond * billableSeconds / modelPrice
	if !isPositiveFinite(units) {
		return nil, fmt.Errorf(
			"model %s: computed billable units must be positive and finite, got %v",
			model, units)
	}
	return map[string]float64{BillingUnitsKey: units}, nil
}

func isPositiveFinite(v float64) bool {
	return v > 0 && !math.IsNaN(v) && !math.IsInf(v, 0)
}

// SeedanceBillableSeconds reports the output length a seedance request will be
// charged for. It reads only dto.SeedanceVideoRequest — the shared inbound
// format every seedance channel exposes — so the rule lives here rather than in
// any one channel: doubao and byteplus both submit to Ark and must not drift.
//
// Ark renders 5 seconds when neither duration nor frames is given, which is the
// seedance family default the sibling adaptors already rely on. Two shapes are
// unknowable at submit time and must not be guessed:
//
//   - frames, which sets the length in frames at a per-model fps the gateway
//     does not know. It is checked first because the upstream documents frames
//     and duration as "取其一" — when both are present the model decides which
//     one wins, so duration is not authoritative either.
//   - duration -1 (and any other non-positive value), which explicitly hands
//     the length to the model.
//
// Both report false so the caller skips capture and the request keeps its
// previous billing rather than being priced off a fabricated length.
func SeedanceBillableSeconds(seedReq *dto.SeedanceVideoRequest) (float64, bool) {
	if seedReq == nil {
		return 0, false
	}
	if seedReq.Frames != nil {
		return 0, false
	}
	if seedReq.Duration != nil {
		if *seedReq.Duration <= 0 {
			return 0, false
		}
		return float64(*seedReq.Duration), true
	}
	return 5, true
}

// Canonical resolution vocabulary for price rule Match keys.
const (
	Resolution480p  = "480p"
	Resolution720p  = "720p"
	Resolution1080p = "1080p"
	Resolution4K    = "4k"
)

var resolutionAliases = map[string]string{
	"480p":  Resolution480p,
	"720p":  Resolution720p,
	"1080p": Resolution1080p,
	"4k":    Resolution4K,
	"2160p": Resolution4K,
}

// resolutionByShortSide classifies pixel dimensions by their smaller side, so
// portrait and landscape of one tier normalize to the same label (sora's
// 1792x1024 and 1024x1792 are both the 1080p tier).
//
// Short sides are matched exactly rather than by open-ended ranges. A range
// ("anything from 720 up is 720p") silently absorbs dimensions no channel
// sends — 999x999 would price as 720p — and a wrong-but-plausible tier bills
// the customer at the wrong rate with nothing to alert on. An exact table
// refuses instead, and refusal is loud: ComputeSecondBilling turns an
// unmatched dimension on a configured model into a rejected request. Adding a
// new channel's dimensions is then a deliberate line here, reviewed against
// that channel's documented set, instead of an accident of where a threshold
// happened to fall.
var resolutionByShortSide = map[int]string{
	480:  Resolution480p,  // 854x480, 640x480
	720:  Resolution720p,  // 1280x720, 720x1280 (sora)
	1024: Resolution1080p, // 1792x1024, 1024x1792 (sora-2-pro)
	1080: Resolution1080p, // 1920x1080, 1080x1920 (kling)
	2160: Resolution4K,    // 3840x2160
}

// NormalizeResolution folds labels, aliases, and pixel dimensions into the
// canonical vocabulary. Returns false when the input cannot be classified;
// callers must then refuse to price the request rather than guess a tier.
func NormalizeResolution(raw string) (string, bool) {
	s := strings.ToLower(strings.TrimSpace(raw))
	if s == "" {
		return "", false
	}
	if label, ok := resolutionAliases[s]; ok {
		return label, true
	}
	if w, h, ok := parseDimensions(s); ok {
		short := h
		if w < h {
			short = w
		}
		if label, ok := resolutionByShortSide[short]; ok {
			return label, true
		}
	}
	return "", false
}

// parseDimensions splits a "WxH" pixel size. Both sides must be whole positive
// numbers; anything else is not a size we are willing to price.
func parseDimensions(s string) (int, int, bool) {
	parts := strings.Split(s, "x")
	if len(parts) != 2 {
		return 0, 0, false
	}
	w, err := strconv.Atoi(strings.TrimSpace(parts[0]))
	if err != nil || w <= 0 {
		return 0, 0, false
	}
	h, err := strconv.Atoi(strings.TrimSpace(parts[1]))
	if err != nil || h <= 0 {
		return 0, 0, false
	}
	return w, h, true
}
