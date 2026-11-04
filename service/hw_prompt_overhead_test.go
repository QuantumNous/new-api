package service

import (
	"fmt"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	hosttypes "github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// The supplier counts a constant hidden overhead into every prompt (measured
// 20 Oct 2026: about 790-800 tokens on a 9-token request). The customer pays for
// what it sent, never for that overhead, and a channel that is not the primary
// supplier keeps the supplier's count.
func TestHwCorrectUpstreamPrompt(t *testing.T) {
	for _, tc := range []struct {
		name          string
		option, tag   string
		model         string
		reported      int
		estimate      int
		wantCorrected int
		wantOverhead  int
	}{
		{name: "empty option leaves the count alone", option: ``, tag: "lumia", model: "m", reported: 807, wantCorrected: 807},
		{name: "wildcard subtracts the overhead", option: `{"*":800}`, tag: "lumia", model: "m", reported: 807, wantCorrected: 7, wantOverhead: 800},
		{name: "model entry wins over the wildcard", option: `{"*":800,"m":793}`, tag: "lumia", model: "m", reported: 807, wantCorrected: 14, wantOverhead: 793},
		{name: "report below the overhead gives zero", option: `{"*":800}`, tag: "lumia", model: "m", reported: 500, wantCorrected: 0, wantOverhead: 800},
		{name: "local estimate is the floor", option: `{"*":800}`, tag: "lumia", model: "m", reported: 500, estimate: 120, wantCorrected: 120, wantOverhead: 800},
		{name: "short request bills the real input size", option: `{"*":800}`, tag: "lumia", model: "m", reported: 807, estimate: 9, wantCorrected: 9, wantOverhead: 800},
		{name: "channel without the primary tag is untouched", option: `{"*":800}`, tag: "", model: "m", reported: 807, wantCorrected: 807},
		{name: "another supplier tag is untouched", option: `{"*":800}`, tag: "openrouter", model: "m", reported: 807, wantCorrected: 807},
		{name: "missing usage is never corrected", option: `{"*":800}`, tag: "lumia", model: "m", reported: 0, estimate: 9, wantCorrected: 0},
		{name: "malformed option leaves the count alone", option: `{"*":"many"}`, tag: "lumia", model: "m", reported: 807, wantCorrected: 807},
	} {
		t.Run(tc.name, func(t *testing.T) {
			hwSetPromptOverheadOption(t, tc.option)
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			HwNoteChannelTag(ctx, tc.tag)
			corrected, overhead := HwCorrectUpstreamPrompt(ctx, tc.model, tc.reported, tc.estimate)
			assert.Equal(t, tc.wantCorrected, corrected)
			assert.Equal(t, tc.wantOverhead, overhead)
		})
	}
}

// The correction reaches the wallet, the consume log and the admin-only log
// fields together: the customer is billed the corrected prompt count, and the
// supplier's own count stays visible to the administrator only.
func TestPostTextConsumeQuotaAppliesPromptOverhead(t *testing.T) {
	db := hwPromptOverheadDB(t)
	for index, tc := range []struct {
		name             string
		option, tag      string
		estimate, stream int
		wantPrompt       int
		wantQuota        int
	}{
		{name: "overhead subtracted", option: `{"*":800}`, tag: "lumia", wantPrompt: 7, wantQuota: 12},
		{name: "short request bills its real input size", option: `{"*":800}`, tag: "lumia", estimate: 9, wantPrompt: 9, wantQuota: 14},
		{name: "stream settles the same", option: `{"*":800}`, tag: "lumia", stream: 1, wantPrompt: 7, wantQuota: 12},
		{name: "channel without the primary tag untouched", option: `{"*":800}`, tag: "", wantPrompt: 807, wantQuota: 812},
		{name: "empty option untouched", option: ``, tag: "lumia", wantPrompt: 807, wantQuota: 812},
	} {
		t.Run(tc.name, func(t *testing.T) {
			hwSetPromptOverheadOption(t, tc.option)
			user := model.User{Username: fmt.Sprintf("prompt_overhead_%d", index), AffCode: fmt.Sprintf("aff%d", index), Quota: 1_000_000, Status: common.UserStatusEnabled}
			require.NoError(t, db.Create(&user).Error)
			token := model.Token{UserId: user.Id, Key: fmt.Sprintf("prompt-overhead-%d", index), Name: "overhead", RemainQuota: 1_000_000, Status: common.TokenStatusEnabled}
			require.NoError(t, db.Create(&token).Error)
			channelTag := tc.tag
			channel := model.Channel{Name: fmt.Sprintf("prompt-overhead-%d", index), Key: "unused", Status: common.ChannelStatusEnabled}
			if channelTag != "" {
				channel.Tag = &channelTag
			}
			require.NoError(t, db.Create(&channel).Error)

			info := &relaycommon.RelayInfo{
				UserId: user.Id, TokenId: token.Id, TokenKey: token.Key,
				ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: channel.Id},
				OriginModelName: "claude-sonnet-5-5", UsingGroup: "default", UserGroup: "default",
				RelayFormat: types.RelayFormatOpenAI, IsStream: tc.stream == 1, StartTime: time.Now(),
				UserSetting: dto.UserSetting{BillingPreference: "wallet_only"},
				PriceData:   hwPromptOverheadPrice(),
			}
			info.SetEstimatePromptTokens(tc.estimate)
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
			HwNoteChannelTag(ctx, tc.tag)
			HwNoteLocalPromptEstimate(ctx, tc.estimate)

			PostTextConsumeQuota(ctx, info, &dto.Usage{PromptTokens: 807, CompletionTokens: 5, TotalTokens: 812}, nil)

			require.NoError(t, db.First(&user, user.Id).Error)
			assert.Equal(t, 1_000_000-tc.wantQuota, user.Quota, "the wallet is charged the corrected count")
			var logEntry model.Log
			require.NoError(t, db.Where("user_id = ?", user.Id).Take(&logEntry).Error)
			assert.Equal(t, tc.wantQuota, logEntry.Quota)
			assert.Equal(t, tc.wantPrompt, logEntry.PromptTokens, "the consume log shows the billed prompt count")
			var other map[string]any
			require.NoError(t, common.UnmarshalJsonStr(logEntry.Other, &other))
			admin, _ := other["admin_info"].(map[string]any)
			if tc.wantPrompt == 807 {
				assert.NotContains(t, admin, "prompt_tokens_upstream")
			} else {
				assert.Equal(t, float64(807), admin["prompt_tokens_upstream"], "the admin log keeps the supplier count")
				assert.Equal(t, float64(800), admin["prompt_overhead_tokens"])
				assert.Equal(t, float64(tc.wantPrompt), admin["prompt_tokens_billed"])
			}
		})
	}
}

// A customer who gives up on a stream before its first token received nothing,
// so the attempt settles at zero: the pre-consumed quota goes back and the
// single consume log shows quota 0. Measured 4 Nov 2026: row 7023 hung 145 s on
// Lumia, ended client_gone with no chunk and was billed the prompt estimate.
// Once output reached the customer the normal settlement applies.
func TestPostTextConsumeQuotaClientGoneBeforeOutput(t *testing.T) {
	db := hwPromptOverheadDB(t)
	hwSetPromptOverheadOption(t, ``)
	for index, tc := range []struct {
		name          string
		received      int
		writes        int
		wantQuota     int
		wantNoOutputs bool
	}{
		{name: "no chunk and no write settles at zero", wantQuota: 0, wantNoOutputs: true},
		{name: "a chunk already received is billed", received: 2, wantQuota: 812},
		{name: "a chunk already written is billed", writes: 1, wantQuota: 812},
	} {
		t.Run(tc.name, func(t *testing.T) {
			user := model.User{Username: fmt.Sprintf("client_gone_%d", index), AffCode: fmt.Sprintf("gone%d", index), Quota: 1_000_000, Status: common.UserStatusEnabled}
			require.NoError(t, db.Create(&user).Error)
			token := model.Token{UserId: user.Id, Key: fmt.Sprintf("client-gone-%d", index), Name: "gone", RemainQuota: 1_000_000, Status: common.TokenStatusEnabled}
			require.NoError(t, db.Create(&token).Error)

			status := relaycommon.NewStreamStatus()
			status.RequireTerminal()
			status.SetEndReason(relaycommon.StreamEndReasonClientGone, nil)
			info := &relaycommon.RelayInfo{
				UserId: user.Id, TokenId: token.Id, TokenKey: token.Key,
				ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 1},
				OriginModelName: "gpt-6-astra", UsingGroup: "free", UserGroup: "free",
				RelayFormat: types.RelayFormatOpenAI, IsStream: true, StartTime: time.Now(),
				StreamStatus: status, ReceivedResponseCount: tc.received,
				UserSetting: dto.UserSetting{BillingPreference: "wallet_only"},
				PriceData:   hwPromptOverheadPrice(),
			}
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
			ctx.Set(hwRouteContextKey, hwPolicyRoute(nil, nil))
			for range tc.writes {
				HwNoteStreamWrite(ctx)
			}

			PostTextConsumeQuota(ctx, info, &dto.Usage{PromptTokens: 807, CompletionTokens: 5, TotalTokens: 812}, nil)

			require.NoError(t, db.First(&user, user.Id).Error)
			assert.Equal(t, 1_000_000-tc.wantQuota, user.Quota)
			var logs []model.Log
			require.NoError(t, db.Where("user_id = ?", user.Id).Find(&logs).Error)
			require.Len(t, logs, 1, "one request, one consume log")
			assert.Equal(t, tc.wantQuota, logs[0].Quota)
			var other map[string]any
			require.NoError(t, common.UnmarshalJsonStr(logs[0].Other, &other))
			admin, _ := other["admin_info"].(map[string]any)
			if tc.wantNoOutputs {
				assert.Equal(t, true, admin["client_gone_before_output"])
				assert.Zero(t, logs[0].PromptTokens)
				return
			}
			assert.NotContains(t, admin, "client_gone_before_output")
		})
	}
}

func hwPromptOverheadPrice() hosttypes.PriceData {
	return hosttypes.PriceData{ModelRatio: 1, CompletionRatio: 1, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1}}
}

func hwSetPromptOverheadOption(t *testing.T, value string) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	old, had := common.OptionMap[model.HwUpstreamPromptOverheadOption]
	common.OptionMap[model.HwUpstreamPromptOverheadOption] = value
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		defer common.OptionMapRWMutex.Unlock()
		if had {
			common.OptionMap[model.HwUpstreamPromptOverheadOption] = old
			return
		}
		delete(common.OptionMap, model.HwUpstreamPromptOverheadOption)
	})
}

func hwPromptOverheadDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	oldDB, oldLogDB := model.DB, model.LOG_DB
	oldMainType, oldLogType := common.MainDatabaseType(), common.LogDatabaseType()
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		model.DB, model.LOG_DB = oldDB, oldLogDB
		common.SetDatabaseTypes(oldMainType, oldLogType)
	})
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.Channel{}, &model.Log{}))
	return db
}

// The corrected usage is a copy: the settlement bills on it while the caller's
// raw usage keeps the supplier numbers for the admin log. Total tokens follow
// the corrected prompt, and the canonical InputTokens (Anthropic shape, cache
// included) lose the same tokens without going below zero.
func TestHwCorrectUsagePromptOverheadCopiesAndKeepsCountsConsistent(t *testing.T) {
	hwSetPromptOverheadOption(t, `{"*":800}`)
	newInfo := func() *relaycommon.RelayInfo { return &relaycommon.RelayInfo{OriginModelName: "claude-sonnet-5-5"} }
	newContext := func(tag string, estimate int) *gin.Context {
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		HwNoteChannelTag(ctx, tag)
		HwNoteLocalPromptEstimate(ctx, estimate)
		return ctx
	}

	t.Run("applied", func(t *testing.T) {
		raw := &dto.Usage{PromptTokens: 807, CompletionTokens: 5, TotalTokens: 812, InputTokens: 1000}
		adjusted, correction := hwCorrectUsagePromptOverhead(newContext(HwProviderLumia, 0), newInfo(), raw)

		assert.NotSame(t, raw, adjusted)
		assert.Equal(t, 807, raw.PromptTokens, "the raw usage is not mutated")
		assert.Equal(t, 812, raw.TotalTokens)
		assert.Equal(t, 1000, raw.InputTokens)
		assert.Equal(t, 7, adjusted.PromptTokens)
		assert.Equal(t, 12, adjusted.TotalTokens)
		assert.Equal(t, 200, adjusted.InputTokens, "the same 800 tokens leave the canonical count")
		assert.Equal(t, hwPromptOverheadCorrection{Applied: true, Reported: 807, Overhead: 800, Billed: 7}, correction)
	})

	t.Run("input tokens never go negative and stay zero when absent", func(t *testing.T) {
		small, _ := hwCorrectUsagePromptOverhead(newContext(HwProviderLumia, 0), newInfo(), &dto.Usage{PromptTokens: 807, InputTokens: 100})
		assert.Equal(t, 0, small.InputTokens)
		absent, _ := hwCorrectUsagePromptOverhead(newContext(HwProviderLumia, 0), newInfo(), &dto.Usage{PromptTokens: 807})
		assert.Equal(t, 0, absent.InputTokens)
	})

	t.Run("nothing to correct", func(t *testing.T) {
		raw := &dto.Usage{PromptTokens: 807, TotalTokens: 807}
		for name, ctx := range map[string]*gin.Context{
			"other supplier": newContext(HwProviderOpenRouter, 0),
			"no tag":         newContext("", 0),
		} {
			same, correction := hwCorrectUsagePromptOverhead(ctx, newInfo(), raw)
			assert.Same(t, raw, same, name)
			assert.Equal(t, hwPromptOverheadCorrection{Reported: 807}, correction, name)
		}
		// The local estimate equals the reported count: the floor makes it a no-op.
		same, correction := hwCorrectUsagePromptOverhead(newContext(HwProviderLumia, 807), newInfo(), raw)
		assert.Same(t, raw, same)
		assert.False(t, correction.Applied)

		nilUsage, _ := hwCorrectUsagePromptOverhead(newContext(HwProviderLumia, 0), newInfo(), nil)
		assert.Nil(t, nilUsage)
		sameUsage, _ := hwCorrectUsagePromptOverhead(newContext(HwProviderLumia, 0), nil, raw)
		assert.Same(t, raw, sameUsage)
	})
}

func TestHwAppendPromptOverheadAdminInfoOnlyWhenApplied(t *testing.T) {
	hwAppendPromptOverheadAdminInfo(nil, hwPromptOverheadCorrection{Applied: true})

	other := model.LogOther{}
	hwAppendPromptOverheadAdminInfo(&other, hwPromptOverheadCorrection{Reported: 807})
	assert.NotContains(t, other.Snapshot(), "admin_info", "an unapplied correction leaves the log alone")

	hwAppendPromptOverheadAdminInfo(&other, hwPromptOverheadCorrection{Applied: true, Reported: 807, Overhead: 800, Billed: 7})
	admin, ok := other.Snapshot()["admin_info"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, 807, admin["prompt_tokens_upstream"])
	assert.Equal(t, 800, admin["prompt_overhead_tokens"])
	assert.Equal(t, 7, admin["prompt_tokens_billed"])
}
