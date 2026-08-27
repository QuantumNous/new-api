package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/QuantumNous/new-api/constant"
)

// Upstream payloads below are captured from the provider docs (measured
// 2026-08-25) so the parsers are locked to the real wire format, including the
// documented traps: zhipu reports used percent and business errors with HTTP
// 200, minimax reports remaining percent and skips weekly windows on status 3.

const zhipuCreditPlanSample = `{
  "code": 200,
  "msg": "操作成功",
  "data": {
    "limits": [
      {"type": "CREDIT_LIMIT", "unit": 3, "number": 5, "usage": 2000, "currentValue": 0, "remaining": 2000, "percentage": 0},
      {"type": "CREDIT_LIMIT", "unit": 6, "number": 1, "usage": 10000, "currentValue": 4788, "remaining": 5211, "percentage": 47, "nextResetTime": 1787919529998}
    ],
    "level": "lite"
  },
  "success": true
}`

const minimaxCodingPlanSample = `{
  "model_remains": [
    {
      "start_time": 1787623200000,
      "end_time": 1787641200000,
      "remains_time": 15436231,
      "current_interval_total_count": 0,
      "current_interval_usage_count": 0,
      "model_name": "general",
      "current_weekly_total_count": 0,
      "current_weekly_usage_count": 0,
      "weekly_start_time": 1787500800000,
      "weekly_end_time": 1788105600000,
      "weekly_remains_time": 479836231,
      "current_interval_status": 1,
      "current_interval_remaining_percent": 100,
      "current_weekly_status": 3,
      "current_weekly_remaining_percent": 100
    },
    {
      "start_time": 1787587200000,
      "end_time": 1787673600000,
      "remains_time": 47836231,
      "model_name": "video",
      "current_interval_status": 3,
      "current_interval_remaining_percent": 100,
      "current_weekly_status": 3,
      "current_weekly_remaining_percent": 100
    }
  ],
  "base_resp": {"status_code": 0, "status_msg": "success"}
}`

func TestParseZhipuQuotaLimit(t *testing.T) {
	t.Run("credit plan sample maps both windows", func(t *testing.T) {
		usage, err := parseZhipuQuotaLimit([]byte(zhipuCreditPlanSample))
		require.NoError(t, err)
		require.Equal(t, planProviderZhipu, usage.Provider)
		require.Equal(t, "lite", usage.Level)
		require.Len(t, usage.Windows, 2)

		fiveHour := usage.Windows[0]
		assert.Equal(t, planWindowInterval5h, fiveHour.Kind)
		assert.Equal(t, 0.0, fiveHour.UsedPercent)
		assert.Equal(t, int64(0), fiveHour.ResetTime) // idle 5h window has no reset time
		assert.Equal(t, "CREDIT_LIMIT", fiveHour.LimitType)
		require.NotNil(t, fiveHour.TotalQuota)
		assert.Equal(t, 2000.0, *fiveHour.TotalQuota)
		require.NotNil(t, fiveHour.UsedQuota)
		assert.Equal(t, 0.0, *fiveHour.UsedQuota)
		require.NotNil(t, fiveHour.RemainingQuota)
		assert.Equal(t, 2000.0, *fiveHour.RemainingQuota)

		weekly := usage.Windows[1]
		assert.Equal(t, planWindowWeekly, weekly.Kind)
		assert.Equal(t, 47.0, weekly.UsedPercent)
		assert.Equal(t, int64(1787919529), weekly.ResetTime)
		require.NotNil(t, weekly.UsedQuota)
		assert.Equal(t, 4788.0, *weekly.UsedQuota)
		require.NotNil(t, weekly.RemainingQuota)
		assert.Equal(t, 5211.0, *weekly.RemainingQuota)
	})

	t.Run("business error with http 200 fails on success flag", func(t *testing.T) {
		body := []byte(`{"code":401,"msg":"令牌已过期或验证不正确","success":false}`)
		_, err := parseZhipuQuotaLimit(body)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "401")
		assert.Contains(t, err.Error(), "令牌已过期或验证不正确")
	})

	t.Run("old plan with a single limit degrades to the 5h window only", func(t *testing.T) {
		body := []byte(`{"code":200,"msg":"ok","success":true,"data":{"level":"pro","limits":[
			{"type":"TOKENS_LIMIT","unit":3,"percentage":12}
		]}}`)
		usage, err := parseZhipuQuotaLimit(body)
		require.NoError(t, err)
		require.Len(t, usage.Windows, 1)
		assert.Equal(t, planWindowInterval5h, usage.Windows[0].Kind)
		assert.Equal(t, 12.0, usage.Windows[0].UsedPercent)
		assert.Equal(t, "TOKENS_LIMIT", usage.Windows[0].LimitType)
		assert.Nil(t, usage.Windows[0].TotalQuota)
		assert.Nil(t, usage.Windows[0].UsedQuota)
		assert.Nil(t, usage.Windows[0].RemainingQuota)
	})

	t.Run("missing unit falls back to reset-time heuristic", func(t *testing.T) {
		// Near period boundaries the weekly window resets earlier than the
		// 5h one; the entry without a reset time must still land in the 5h
		// bucket instead of being classified by reset order.
		body := []byte(`{"code":200,"msg":"ok","success":true,"data":{"level":"lite","limits":[
			{"type":"TOKENS_LIMIT","percentage":30,"nextResetTime":1787800000000},
			{"type":"TOKENS_LIMIT","percentage":80}
		]}}`)
		usage, err := parseZhipuQuotaLimit(body)
		require.NoError(t, err)
		require.Len(t, usage.Windows, 2)
		assert.Equal(t, planWindowInterval5h, usage.Windows[0].Kind)
		assert.Equal(t, 80.0, usage.Windows[0].UsedPercent)
		assert.Equal(t, planWindowWeekly, usage.Windows[1].Kind)
		assert.Equal(t, 30.0, usage.Windows[1].UsedPercent)
		assert.Equal(t, int64(1787800000), usage.Windows[1].ResetTime)
	})

	t.Run("no limits is an error", func(t *testing.T) {
		body := []byte(`{"code":200,"msg":"ok","success":true,"data":{"level":"lite","limits":[]}}`)
		_, err := parseZhipuQuotaLimit(body)
		require.Error(t, err)
	})
}

func TestParseMiniMaxCodingPlanRemains(t *testing.T) {
	t.Run("doc sample maps general entry and skips uncapped weekly", func(t *testing.T) {
		usage, err := parseMiniMaxCodingPlanRemains([]byte(minimaxCodingPlanSample))
		require.NoError(t, err)
		require.Equal(t, planProviderMiniMax, usage.Provider)
		require.Len(t, usage.Windows, 1) // weekly status 3 means no weekly cap

		interval := usage.Windows[0]
		assert.Equal(t, planWindowInterval5h, interval.Kind)
		assert.Equal(t, 0.0, interval.UsedPercent) // remaining 100 → used 0
		assert.Equal(t, int64(1787641200), interval.ResetTime)
	})

	t.Run("weekly window is reported when status is 1", func(t *testing.T) {
		body := []byte(`{
			"model_remains": [
				{"model_name": "general", "end_time": 1787641200000, "weekly_end_time": 1788105600000,
				 "current_interval_remaining_percent": 70.5, "current_weekly_status": 1, "current_weekly_remaining_percent": 94}
			],
			"base_resp": {"status_code": 0, "status_msg": "success"}
		}`)
		usage, err := parseMiniMaxCodingPlanRemains(body)
		require.NoError(t, err)
		require.Len(t, usage.Windows, 2)
		assert.Equal(t, 29.5, usage.Windows[0].UsedPercent)
		assert.Equal(t, planWindowWeekly, usage.Windows[1].Kind)
		assert.Equal(t, 6.0, usage.Windows[1].UsedPercent)
		assert.Equal(t, int64(1788105600), usage.Windows[1].ResetTime)
	})

	t.Run("expired session key reports business code 1004", func(t *testing.T) {
		body := []byte(`{"model_remains": [], "base_resp": {"status_code": 1004, "status_msg": "cookie is missing, log in again"}}`)
		_, err := parseMiniMaxCodingPlanRemains(body)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "1004")
		assert.Contains(t, err.Error(), "cookie is missing")
	})

	t.Run("missing general entry is an error", func(t *testing.T) {
		body := []byte(`{
			"model_remains": [{"model_name": "video", "current_interval_remaining_percent": 100}],
			"base_resp": {"status_code": 0, "status_msg": "success"}
		}`)
		_, err := parseMiniMaxCodingPlanRemains(body)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "general")
	})
}

func TestResolvePlanUsageURLs(t *testing.T) {
	zhipuCases := []struct {
		name     string
		baseURL  string
		expected string
	}{
		{"empty base defaults to domestic", "", "https://open.bigmodel.cn/api/monitor/usage/quota/limit"},
		{"domestic base", "https://open.bigmodel.cn/api/paas/v4", "https://open.bigmodel.cn/api/monitor/usage/quota/limit"},
		{"domestic coding plan alias", "glm-coding-plan", "https://open.bigmodel.cn/api/monitor/usage/quota/limit"},
		{"international base", "https://api.z.ai/api/coding/paas/v4", "https://api.z.ai/api/monitor/usage/quota/limit"},
		{"international coding plan alias", "glm-coding-plan-international", "https://api.z.ai/api/monitor/usage/quota/limit"},
		{"unknown proxy base falls back to domestic", "https://my-relay.example.com", "https://open.bigmodel.cn/api/monitor/usage/quota/limit"},
	}
	for _, tc := range zhipuCases {
		t.Run("zhipu "+tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, resolveZhipuMonitorURL(tc.baseURL))
		})
	}

	minimaxCases := []struct {
		name     string
		baseURL  string
		expected string
	}{
		{"empty base defaults to domestic", "", "https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains"},
		{"chat api base still uses domestic remains host", "https://api.minimax.chat", "https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains"},
		{"international base", "https://api.minimax.io/v1", "https://api.minimax.io/v1/api/openplatform/coding_plan/remains"},
	}
	for _, tc := range minimaxCases {
		t.Run("minimax "+tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, resolveMiniMaxRemainsURL(tc.baseURL))
		})
	}
}

func TestIsPlanUsageChannelType(t *testing.T) {
	for _, channelType := range []int{
		constant.ChannelTypeZhipu,
		constant.ChannelTypeZhipu_v4,
		constant.ChannelTypeMiniMax,
	} {
		assert.True(t, isPlanUsageChannelType(channelType), "type %d", channelType)
	}
	assert.False(t, isPlanUsageChannelType(constant.ChannelTypeOpenAI))
}
