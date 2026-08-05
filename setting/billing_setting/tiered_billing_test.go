package billing_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func restoreBillingSetting(t *testing.T) {
	t.Helper()
	origMode := billingSetting.BillingMode.ReadAll()
	origExpr := billingSetting.BillingExpr.ReadAll()
	t.Cleanup(func() {
		billingSetting.BillingMode.Clear()
		billingSetting.BillingMode.AddAll(origMode)
		billingSetting.BillingExpr.Clear()
		billingSetting.BillingExpr.AddAll(origExpr)
	})
}

// 字段类型从裸 map 改为 *types.RWMap 后，写入数据库的序列化形式必须保持不变，
// 否则升级后旧数据行会读不出来。
func TestBillingSettingSerializationIsUnchanged(t *testing.T) {
	restoreBillingSetting(t)

	require.NoError(t, config.UpdateConfigFromMap(&billingSetting, map[string]string{
		"billing_mode": `{"gpt-4o":"tiered_expr"}`,
		"billing_expr": `{"gpt-4o":"p*2"}`,
	}))

	serialized, err := config.ConfigToMap(&billingSetting)
	require.NoError(t, err)
	assert.JSONEq(t, `{"gpt-4o":"tiered_expr"}`, serialized["billing_mode"])
	assert.JSONEq(t, `{"gpt-4o":"p*2"}`, serialized["billing_expr"])
}

// 热更新必须完整替换映射，被移除的模型不能残留。
func TestBillingSettingUpdateReplacesRemovedKeys(t *testing.T) {
	restoreBillingSetting(t)

	require.NoError(t, config.UpdateConfigFromMap(&billingSetting, map[string]string{
		"billing_mode": `{"a":"tiered_expr","b":"tiered_expr"}`,
	}))
	require.Equal(t, BillingModeTieredExpr, GetBillingMode("b"))

	require.NoError(t, config.UpdateConfigFromMap(&billingSetting, map[string]string{
		"billing_mode": `{"a":"tiered_expr"}`,
	}))

	assert.Equal(t, BillingModeTieredExpr, GetBillingMode("a"))
	assert.Equal(t, BillingModeRatio, GetBillingMode("b"), "被移除的模型应回退到 ratio")
}

func TestBillingAccessorsReflectUpdates(t *testing.T) {
	restoreBillingSetting(t)

	require.NoError(t, config.UpdateConfigFromMap(&billingSetting, map[string]string{
		"billing_mode": `{"gpt-4o":"tiered_expr"}`,
		"billing_expr": `{"gpt-4o":"p*2"}`,
	}))

	assert.Equal(t, BillingModeTieredExpr, GetBillingMode("gpt-4o"))
	assert.Equal(t, BillingModeRatio, GetBillingMode("unknown-model"))

	expr, ok := GetBillingExpr("gpt-4o")
	assert.True(t, ok)
	assert.Equal(t, "p*2", expr)

	_, ok = GetBillingExpr("unknown-model")
	assert.False(t, ok)
}

// Copy 系列必须返回独立副本，调用方修改它不能影响全局配置。
func TestBillingCopyAccessorsAreDetached(t *testing.T) {
	restoreBillingSetting(t)

	require.NoError(t, config.UpdateConfigFromMap(&billingSetting, map[string]string{
		"billing_mode": `{"gpt-4o":"tiered_expr"}`,
	}))

	modes := GetBillingModeCopy()
	modes["gpt-4o"] = "mutated"
	modes["injected"] = "tiered_expr"

	assert.Equal(t, BillingModeTieredExpr, GetBillingMode("gpt-4o"))
	assert.Equal(t, BillingModeRatio, GetBillingMode("injected"))
}
