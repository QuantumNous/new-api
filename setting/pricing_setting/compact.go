package pricing_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func ResolveModel(modelName string) (string, string) {
	if !strings.HasSuffix(modelName, ratio_setting.CompactModelSuffix) {
		return modelName, "direct"
	}

	baseModel := strings.TrimSuffix(modelName, ratio_setting.CompactModelSuffix)
	manualPrice := ratio_setting.GetModelPriceCopy()
	manualRatio := ratio_setting.GetModelRatioCopy()
	hasManual := func(name string) bool {
		if billing_setting.GetBillingMode(name) == billing_setting.BillingModeTieredExpr {
			return true
		}
		name = ratio_setting.FormatMatchingModelName(name)
		if _, ok := manualPrice[name]; ok {
			return true
		}
		_, ok := manualRatio[name]
		return ok
	}

	if hasManual(modelName) {
		return modelName, "compact_exact_manual"
	}
	if hasManual(ratio_setting.CompactWildcardModelKey) {
		return ratio_setting.CompactWildcardModelKey, "compact_wildcard_manual"
	}
	if hasManual(baseModel) {
		return baseModel, "compact_base_manual"
	}
	if ratio_setting.HasExactAutoPricingEntry(modelName) {
		return modelName, "compact_exact_auto"
	}
	if ratio_setting.HasAutoPricingEntry(baseModel) {
		return baseModel, "compact_base_auto"
	}
	return modelName, "compact_unconfigured"
}
