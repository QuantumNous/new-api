package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func vStrPtr(s string) *string { return &s }

func TestValidateGroupBillingModesRejectsBadMode(t *testing.T) {
	err := validateGroupBillingModes(map[string]types.ModelGroupPricing{
		"c": {BillingMode: vStrPtr("nonsense")},
	})
	require.Error(t, err)
}

func TestValidateGroupBillingModesRejectsTieredWithoutExpr(t *testing.T) {
	err := validateGroupBillingModes(map[string]types.ModelGroupPricing{
		"c": {BillingMode: vStrPtr(types.GroupBillingModeTieredExpr)},
	})
	require.Error(t, err)
}

func TestValidateGroupBillingModesRejectsBadExpr(t *testing.T) {
	err := validateGroupBillingModes(map[string]types.ModelGroupPricing{
		"c": {
			BillingMode: vStrPtr(types.GroupBillingModeTieredExpr),
			BillingExpr: vStrPtr("this is not a valid expr ((("),
		},
	})
	require.Error(t, err)
}

func vFloatPtr(f float64) *float64 { return &f }

// 按次计费未填 model_price 必须被拒绝（留空会触发 -1 哨兵负扣费资损）。
func TestValidateGroupBillingModesRejectsPerRequestWithoutPrice(t *testing.T) {
	err := validateGroupBillingModes(map[string]types.ModelGroupPricing{
		"b": {BillingMode: vStrPtr(types.GroupBillingModePerRequest)},
	})
	require.Error(t, err)
}

// 按次计费填了价格（含 0=免费）应通过。
func TestValidateGroupBillingModesAcceptsPerRequestWithPrice(t *testing.T) {
	require.NoError(t, validateGroupBillingModes(map[string]types.ModelGroupPricing{
		"c": {BillingMode: vStrPtr(types.GroupBillingModePerRequest), ModelPrice: vFloatPtr(0.01)},
		"d": {BillingMode: vStrPtr(types.GroupBillingModePerRequest), ModelPrice: vFloatPtr(0)},
	}))
}

func TestValidateGroupBillingModesAcceptsValid(t *testing.T) {
	require.NoError(t, validateGroupBillingModes(map[string]types.ModelGroupPricing{
		"c": {BillingMode: vStrPtr(types.GroupBillingModePerRequest), ModelPrice: vFloatPtr(0.01)},
		"b": {
			BillingMode: vStrPtr(types.GroupBillingModeTieredExpr),
			BillingExpr: vStrPtr(`tier("base", p * 2)`),
		},
		"default": {Ratio: func() *float64 { f := 1.0; return &f }()},
	}))
}
