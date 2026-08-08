package billing_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// restoreBillingSetting 同时还原写入目标与已发布的快照。
func restoreBillingSetting(t *testing.T) {
	t.Helper()
	orig := billingSetting
	origSnapshot := billingSnapshot.Load()
	t.Cleanup(func() {
		billingSetting = orig
		billingSnapshot.Store(origSnapshot)
	})
}

// 写入数据库的序列化形式必须保持不变，否则升级后旧数据行会读不出来。
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

// 字面量 "null" 会把映射置为 nil。计费访问器在每个中继请求上都会被调用，绝不能因此 panic，
// 必须退回 ratio。
func TestBillingSettingSurvivesNullValue(t *testing.T) {
	restoreBillingSetting(t)

	require.NoError(t, config.UpdateConfigFromMap(&billingSetting, map[string]string{
		"billing_mode": `{"gpt-4o":"tiered_expr"}`,
		"billing_expr": `{"gpt-4o":"p*2"}`,
	}))
	require.Equal(t, BillingModeTieredExpr, GetBillingMode("gpt-4o"))

	require.NoError(t, config.UpdateConfigFromMap(&billingSetting, map[string]string{
		"billing_mode": "null",
		"billing_expr": "null",
	}))

	assert.NotPanics(t, func() {
		assert.Equal(t, BillingModeRatio, GetBillingMode("gpt-4o"))
		_, ok := GetBillingExpr("gpt-4o")
		assert.False(t, ok)
		assert.Empty(t, GetBillingModeCopy())
		assert.Empty(t, GetBillingExprCopy())
	})

	// 字段必须被复原，否则 configToMap 会把 nil 再次写成 "null" 并长期固化。
	assert.NotNil(t, billingSetting.BillingMode)
	assert.NotNil(t, billingSetting.BillingExpr)

	// 复原后必须能重新接受正常配置。
	require.NoError(t, config.UpdateConfigFromMap(&billingSetting, map[string]string{
		"billing_mode": `{"gpt-4o":"tiered_expr"}`,
	}))
	assert.Equal(t, BillingModeTieredExpr, GetBillingMode("gpt-4o"))
}

// 读者拿到的必须是与写入目标解耦的快照。RWMap 之类只保护映射内容的方案在这里不够：
// 热更新遇到 "null" 时会替换字段本身，读者与该替换之间同样需要同步。
func TestBillingSnapshotIsDecoupledFromWriteTarget(t *testing.T) {
	restoreBillingSetting(t)

	require.NoError(t, config.UpdateConfigFromMap(&billingSetting, map[string]string{
		"billing_mode": `{"gpt-4o":"tiered_expr"}`,
	}))
	held := GetBillingModeCopy()
	require.Equal(t, BillingModeTieredExpr, held["gpt-4o"])

	require.NoError(t, config.UpdateConfigFromMap(&billingSetting, map[string]string{
		"billing_mode": `{"gpt-4o":"ratio"}`,
	}))

	assert.Equal(t, BillingModeTieredExpr, held["gpt-4o"], "已取得的副本不应被后续热更新改写")
	assert.Equal(t, BillingModeRatio, GetBillingMode("gpt-4o"), "新快照应反映最新配置")
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
