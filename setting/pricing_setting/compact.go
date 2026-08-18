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

	normalizedModel := ratio_setting.FormatMatchingModelName(modelName)
	isVirtualCompact := ratio_setting.IsVirtualCompactModelName(normalizedModel)
	baseModel := ratio_setting.CompactBaseModelName(normalizedModel)
	manualPrice := ratio_setting.GetModelPriceCopy()
	manualRatio := ratio_setting.GetModelRatioCopy()
	hasManual := func(name string) bool {
		if billing_setting.GetBillingMode(name) == billing_setting.BillingModeTieredExpr {
			return true
		}
		if _, ok := manualPrice[name]; ok {
			return true
		}
		_, ok := manualRatio[name]
		return ok
	}

	if !isVirtualCompact {
		if hasManual(baseModel) {
			return baseModel, "compact_base_manual"
		}
		if ratio_setting.HasAutoPricingEntry(baseModel) {
			return baseModel, "compact_base_auto"
		}
		return baseModel, "compact_base_unconfigured"
	}

	if hasManual(normalizedModel) {
		return normalizedModel, "compact_exact_manual"
	}
	if hasManual(ratio_setting.CompactWildcardModelKey) {
		return ratio_setting.CompactWildcardModelKey, "compact_wildcard_manual"
	}
	if hasManual(baseModel) {
		return baseModel, "compact_base_manual"
	}
	if ratio_setting.HasExactAutoPricingEntry(normalizedModel) {
		return normalizedModel, "compact_exact_auto"
	}
	if ratio_setting.HasAutoPricingEntry(baseModel) {
		return baseModel, "compact_base_auto"
	}
	return normalizedModel, "compact_unconfigured"
}
