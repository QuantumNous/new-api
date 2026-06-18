package types

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func strPtr(s string) *string { return &s }
func fPtr(f float64) *float64  { return &f }

func TestModelGroupPricingModeOnlyNotBareNumberedOrEmpty(t *testing.T) {
	// A group that pins only a billing mode (no price) must survive round-trip:
	// not serialized to a bare number, not judged empty.
	item := ModelGroupPricing{
		Ratio:       fPtr(1.5),
		BillingMode: strPtr(GroupBillingModePerRequest),
	}
	require.False(t, item.IsEmpty())
	require.True(t, item.HasBillingMode())

	raw, err := json.Marshal(item)
	require.NoError(t, err)
	// Must be an object (carries mode), NOT the bare number "1.5".
	require.Equal(t, byte('{'), raw[0])

	var back ModelGroupPricing
	require.NoError(t, json.Unmarshal(raw, &back))
	require.NotNil(t, back.BillingMode)
	require.Equal(t, GroupBillingModePerRequest, *back.BillingMode)
	require.NotNil(t, back.Ratio)
	require.Equal(t, 1.5, *back.Ratio)
}

func TestModelGroupPricingTieredExprRoundTrip(t *testing.T) {
	item := ModelGroupPricing{
		BillingMode: strPtr(GroupBillingModeTieredExpr),
		BillingExpr: strPtr(`tier("base", p * 2)`),
	}
	raw, err := json.Marshal(item)
	require.NoError(t, err)

	var back ModelGroupPricing
	require.NoError(t, json.Unmarshal(raw, &back))
	require.NotNil(t, back.BillingMode)
	require.Equal(t, GroupBillingModeTieredExpr, *back.BillingMode)
	require.NotNil(t, back.BillingExpr)
	require.Equal(t, `tier("base", p * 2)`, *back.BillingExpr)
}

func TestModelGroupPricingBareRatioStillCompact(t *testing.T) {
	// Legacy behavior preserved: ratio-only (no mode, no price) marshals to a bare number.
	item := ModelGroupPricing{Ratio: fPtr(1.25)}
	raw, err := json.Marshal(item)
	require.NoError(t, err)
	require.Equal(t, "1.25", string(raw))
}

func TestModelGroupPricingEmptyIsEmpty(t *testing.T) {
	require.True(t, ModelGroupPricing{}.IsEmpty())
}

// 锁定遗留反序列化：DB 中早期存的「裸数字」必须解回 Ratio（price_data.go 的
// UnmarshalJSON 先试标量）。本测试是 JSON 包装层迁移（encoding/json → common.*）
// 的安全网，确保迁移不改变既有存量值的解析。
func TestModelGroupPricingUnmarshalBareNumberToRatio(t *testing.T) {
	var item ModelGroupPricing
	require.NoError(t, json.Unmarshal([]byte("1.25"), &item))
	require.NotNil(t, item.Ratio)
	require.Equal(t, 1.25, *item.Ratio)
	require.False(t, item.HasPriceOverride())
	require.False(t, item.HasBillingMode())
}

// 锁定遗留反序列化：JSON null 必须解为空结构体且判定为空（price_data.go 的
// UnmarshalJSON 对 "null" 的早返回分支）。同为迁移安全网。
func TestModelGroupPricingUnmarshalNullIsEmpty(t *testing.T) {
	item := ModelGroupPricing{Ratio: fPtr(9)}
	require.NoError(t, json.Unmarshal([]byte("null"), &item))
	require.True(t, item.IsEmpty())
}
