package taskcommon

import (
	"fmt"
	"math"

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
