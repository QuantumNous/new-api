package model

import (
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestFormatUserLogsStripsQuotaSaturation verifies the admin-only quota
// saturation marker (nested under other.admin_info) is removed for non-admin
// log views, since formatUserLogs strips the whole admin_info object.
func TestFormatUserLogsStripsQuotaSaturation(t *testing.T) {
	other := common.MapToJsonStr(map[string]any{
		"model_price": 0.004,
		"admin_info": map[string]any{
			"quota_saturation": map[string]any{
				"op":      "QuotaFromDecimal",
				"kind":    "overflow",
				"clamped": common.MaxQuota,
			},
		},
	})
	logs := []*Log{{Other: other}}

	formatUserLogs(logs, 0)

	parsed, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	_, hasAdminInfo := parsed["admin_info"]
	require.False(t, hasAdminInfo, "admin_info (and nested quota_saturation) must be stripped for non-admin views")
	// Non-admin billing fields remain visible.
	require.Contains(t, parsed, "model_price")
}

func TestTaskPluginLogVisibilityIsRoleSeparated(t *testing.T) {
	other := common.MapToJsonStr(map[string]any{
		"model_price": 1.25,
		"admin_info": map[string]any{
			"task_plugin": map[string]any{
				"key":     "document-parser",
				"name":    "Document Parser",
				"version": "1.2.3",
			},
		},
		"root_info": map[string]any{
			"upstream_task_id": "upstream-private",
			"task_plugin": map[string]any{
				"generation": 42,
			},
		},
	})

	t.Run("user", func(t *testing.T) {
		logs := []*Log{{Other: other}}
		formatUserLogs(logs, 0)

		parsed, err := common.StrToMap(logs[0].Other)
		require.NoError(t, err)
		assert.NotContains(t, parsed, "admin_info")
		assert.NotContains(t, parsed, "root_info")
		assert.Equal(t, 1.25, parsed["model_price"])
	})

	t.Run("admin", func(t *testing.T) {
		logs := []*Log{{Other: other}}
		FormatAdminLogs(logs)

		parsed, err := common.StrToMap(logs[0].Other)
		require.NoError(t, err)
		assert.Contains(t, parsed, "admin_info")
		assert.NotContains(t, parsed, "root_info")
	})

	t.Run("root", func(t *testing.T) {
		logs := []*Log{{Other: other}}
		FormatRootLogs(logs)

		parsed, err := common.StrToMap(logs[0].Other)
		require.NoError(t, err)
		assert.Contains(t, parsed, "admin_info")
		assert.Contains(t, parsed, "root_info")
	})
}

func TestLegacyLogOtherVisibilityIsRoleSeparated(t *testing.T) {
	other := common.MapToJsonStr(map[string]any{
		"request_path":  "/v1/chat/completions",
		"channel_id":    202,
		"channel_name":  "legacy-secret-channel",
		"channel_type":  1,
		"reject_reason": "legacy-policy-rejection",
		"admin_info": map[string]any{
			"existing_admin_field": "preserved",
		},
		"root_info": map[string]any{
			"upstream_request_id": "upstream-private",
		},
		"audit_info": map[string]any{
			"method": "POST",
		},
	})

	t.Run("user", func(t *testing.T) {
		logs := []*Log{{
			Id:          99,
			ChannelId:   77,
			ChannelName: "resolved-secret-channel",
			Other:       other,
		}}

		formatUserLogs(logs, 10)

		assert.Equal(t, 11, logs[0].Id)
		assert.Equal(t, 77, logs[0].ChannelId)
		assert.Empty(t, logs[0].ChannelName)
		parsed, err := common.StrToMap(logs[0].Other)
		require.NoError(t, err)
		assert.Equal(t, "/v1/chat/completions", parsed["request_path"])
		for _, key := range []string{
			"channel_id",
			"channel_name",
			"channel_type",
			"reject_reason",
			"admin_info",
			"root_info",
			"audit_info",
		} {
			assert.NotContains(t, parsed, key)
		}
	})

	t.Run("admin", func(t *testing.T) {
		logs := []*Log{{Other: other}}

		FormatAdminLogs(logs)

		parsed, err := common.StrToMap(logs[0].Other)
		require.NoError(t, err)
		assert.Equal(t, "legacy-secret-channel", parsed["channel_name"])
		assert.NotContains(t, parsed, "reject_reason")
		assert.NotContains(t, parsed, "root_info")
		assert.Contains(t, parsed, "audit_info")
		adminInfo, ok := parsed["admin_info"].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "preserved", adminInfo["existing_admin_field"])
		assert.Equal(t, "legacy-policy-rejection", adminInfo["reject_reason"])
	})

	t.Run("root", func(t *testing.T) {
		logs := []*Log{{Other: other}}

		FormatRootLogs(logs)

		parsed, err := common.StrToMap(logs[0].Other)
		require.NoError(t, err)
		assert.Equal(t, "legacy-secret-channel", parsed["channel_name"])
		assert.NotContains(t, parsed, "reject_reason")
		assert.Contains(t, parsed, "root_info")
		assert.Contains(t, parsed, "audit_info")
		adminInfo, ok := parsed["admin_info"].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "preserved", adminInfo["existing_admin_field"])
		assert.Equal(t, "legacy-policy-rejection", adminInfo["reject_reason"])
	})
}

func TestLegacyRejectReasonDoesNotOverrideScopedValue(t *testing.T) {
	other := common.MapToJsonStr(map[string]any{
		"reject_reason": "legacy-value",
		"admin_info": map[string]any{
			"reject_reason": "scoped-value",
		},
	})
	logs := []*Log{{Other: other}}

	FormatRootLogs(logs)

	parsed, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	assert.NotContains(t, parsed, "reject_reason")
	adminInfo, ok := parsed["admin_info"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "scoped-value", adminInfo["reject_reason"])
}

func TestLegacyRejectReasonHandlesNullAdminInfo(t *testing.T) {
	logs := []*Log{{Other: `{"reject_reason":"legacy-value","admin_info":null}`}}

	FormatAdminLogs(logs)

	parsed, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	assert.NotContains(t, parsed, "reject_reason")
	adminInfo, ok := parsed["admin_info"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "legacy-value", adminInfo["reject_reason"])
}

// TestCacheLogOtherVisibilityFollowsSwitches verifies that cache-usage fields
// stay visible to log owners while both cache-rate switches are on, and are
// stripped from user projections when either switch is off. Cache-derived
// entries nested inside the public billing_tokens map follow the same
// stripping; unrelated billing metadata in that map survives. Admin and root
// projections keep everything regardless of the switches.
func TestCacheLogOtherVisibilityFollowsSwitches(t *testing.T) {
	other := common.MapToJsonStr(map[string]any{
		"cache_tokens":             63616,
		"cache_creation_tokens":    500,
		"cache_creation_tokens_5m": 300,
		"cache_creation_tokens_1h": 200,
		"cache_write_tokens":       500,
		"image_cache_tokens":       100,
		"cache_ratio":              0.5,
		"cache_creation_ratio":     1.25,
		"input_tokens_total":       64324,
		"billing_tokens": map[string]any{
			"p": 1000, "c": 200, "len": 1200,
			"cr": 63616, "cc": 300, "cc1h": 200,
			"img": 4, "img_cr": 2, "img_o": 1,
		},
	})

	restoreSwitches := func(t *testing.T) func() {
		oldStats, oldUserVisible := common.CacheRateStatsEnabled, common.CacheRateUserVisibleEnabled
		return func() {
			common.CacheRateStatsEnabled = oldStats
			common.CacheRateUserVisibleEnabled = oldUserVisible
		}
	}

	assertCacheKeys := func(t *testing.T, logs []*Log, expectVisible bool) {
		t.Helper()
		parsed, err := common.StrToMap(logs[0].Other)
		require.NoError(t, err)
		for _, key := range userHiddenCacheLogOtherKeys {
			if expectVisible {
				assert.Contains(t, parsed, key)
			} else {
				assert.NotContains(t, parsed, key)
			}
		}
		// Pricing ratios and the explicit input total are pricing metadata,
		// not cache-usage facts; they stay visible to log owners.
		assert.Contains(t, parsed, "cache_ratio")
		assert.Contains(t, parsed, "cache_creation_ratio")
		assert.Contains(t, parsed, "input_tokens_total")

		billingTokens, ok := parsed["billing_tokens"].(map[string]any)
		require.True(t, ok, "billing_tokens must stay a JSON object")
		for _, key := range userHiddenBillingTokenKeys {
			if expectVisible {
				assert.Contains(t, billingTokens, key)
			} else {
				assert.NotContains(t, billingTokens, key)
			}
		}
		// Unrelated billing metadata survives in both modes.
		for _, key := range []string{"p", "c", "len", "img", "img_o"} {
			assert.Contains(t, billingTokens, key)
		}
	}

	t.Run("both switches on keeps cache fields for users", func(t *testing.T) {
		defer restoreSwitches(t)()
		common.CacheRateStatsEnabled = true
		common.CacheRateUserVisibleEnabled = true

		logs := []*Log{{Other: other}}
		formatUserLogs(logs, 0)
		assertCacheKeys(t, logs, true)
	})

	t.Run("master switch off strips cache fields for users", func(t *testing.T) {
		defer restoreSwitches(t)()
		common.CacheRateStatsEnabled = false
		common.CacheRateUserVisibleEnabled = true

		logs := []*Log{{Other: other}}
		formatUserLogs(logs, 0)
		assertCacheKeys(t, logs, false)
	})

	t.Run("user visibility off strips cache fields for users", func(t *testing.T) {
		defer restoreSwitches(t)()
		common.CacheRateStatsEnabled = true
		common.CacheRateUserVisibleEnabled = false

		logs := []*Log{{Other: other}}
		formatUserLogs(logs, 0)
		assertCacheKeys(t, logs, false)
	})

	t.Run("admin projection keeps cache fields even when hidden from users", func(t *testing.T) {
		defer restoreSwitches(t)()
		common.CacheRateStatsEnabled = false
		common.CacheRateUserVisibleEnabled = false

		adminLogs := []*Log{{Other: other}}
		FormatAdminLogs(adminLogs)
		parsed, err := common.StrToMap(adminLogs[0].Other)
		require.NoError(t, err)
		assert.Contains(t, parsed, "cache_tokens")
		assert.Contains(t, parsed, "cache_creation_tokens_5m")
		adminBillingTokens, ok := parsed["billing_tokens"].(map[string]any)
		require.True(t, ok)
		assert.Contains(t, adminBillingTokens, "cr")
		assert.Contains(t, adminBillingTokens, "cc1h")

		rootLogs := []*Log{{Other: other}}
		FormatRootLogs(rootLogs)
		parsed, err = common.StrToMap(rootLogs[0].Other)
		require.NoError(t, err)
		assert.Contains(t, parsed, "cache_tokens")
	})
}

// TestCacheStatsVisibleToUserReadsUnderOptionLock is a regression test for the
// data race between updateOptionMap (which writes both cache-rate switches
// under OptionMapRWMutex) and visibility reads: CacheStatsVisibleToUser must
// hold the read lock. Run with -race to make a missing lock fail.
func TestCacheStatsVisibleToUserReadsUnderOptionLock(t *testing.T) {
	oldStats, oldUserVisible := common.CacheRateStatsEnabled, common.CacheRateUserVisibleEnabled
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.CacheRateStatsEnabled = oldStats
		common.CacheRateUserVisibleEnabled = oldUserVisible
		common.OptionMapRWMutex.Unlock()
	})

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		for range 64 {
			common.OptionMapRWMutex.Lock()
			common.CacheRateStatsEnabled = !common.CacheRateStatsEnabled
			common.CacheRateUserVisibleEnabled = !common.CacheRateUserVisibleEnabled
			common.OptionMapRWMutex.Unlock()
		}
	}()
	go func() {
		defer wg.Done()
		for range 64 {
			CacheStatsVisibleToUser()
		}
	}()
	wg.Wait()
}

func TestLogFormattingPreservesLargeIntegerLexemes(t *testing.T) {
	const other = `{"public_id":9007199254740993,"admin_info":{"admin_id":9007199254740995},"root_info":{"generation":18446744073709551615}}`

	t.Run("user", func(t *testing.T) {
		logs := []*Log{{Other: other}}

		formatUserLogs(logs, 0)

		assert.Contains(t, logs[0].Other, `"public_id":9007199254740993`)
		assert.NotContains(t, logs[0].Other, "admin_id")
		assert.NotContains(t, logs[0].Other, "generation")
	})

	t.Run("admin", func(t *testing.T) {
		logs := []*Log{{Other: other}}

		FormatAdminLogs(logs)

		assert.Contains(t, logs[0].Other, `"public_id":9007199254740993`)
		assert.Contains(t, logs[0].Other, `"admin_id":9007199254740995`)
		assert.NotContains(t, logs[0].Other, "generation")
	})

	t.Run("root", func(t *testing.T) {
		logs := []*Log{{Other: other}}

		FormatRootLogs(logs)

		assert.Equal(t, other, logs[0].Other)
	})

	t.Run("unprivileged", func(t *testing.T) {
		const unprivileged = `{"public_id":9007199254740993,"model_price":0.004}`

		userLogs := []*Log{{Other: unprivileged}}
		formatUserLogs(userLogs, 0)
		assert.Equal(t, unprivileged, userLogs[0].Other)

		adminLogs := []*Log{{Other: unprivileged}}
		FormatAdminLogs(adminLogs)
		assert.Equal(t, unprivileged, adminLogs[0].Other)
	})
}
