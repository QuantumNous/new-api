package service

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// initWssTestDB initializes the dialect-specific column mappings through the
// real InitLogDB entry (LOG_SQL_DSN unset ⇒ LOG_DB = DB), which the shared
// TestMain does not run. PreWssConsumeQuota resolves tokens via the mapped
// key column, so the mapping must exist before the billing paths run.
func initWssTestDB(t *testing.T) {
	t.Helper()
	if err := model.InitLogDB(); err != nil {
		t.Fatalf("init log db: %s", err)
	}
}

// TestPostWssConsumeQuotaSettlesOnlyTheUnbilledRemainder pins the realtime
// billing contract: every response.done segment is charged in real time by
// PreWssConsumeQuota, so the end-of-session settlement may only collect the
// remainder (and refund via the negative-delta path when the increments have
// already covered the total). The net wallet/token movement over the whole
// session must equal the total quota of the summed usage — nothing more.
func TestPostWssConsumeQuotaSettlesOnlyTheUnbilledRemainder(t *testing.T) {
	truncate(t)
	initWssTestDB(t)
	gin.SetMode(gin.TestMode)

	previousRatios := ratio_setting.ModelRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"realtime-test-model":1}`))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(previousRatios))
	})

	const (
		userID    = 60
		tokenID   = 60
		channelID = 60
	)
	const initialQuota, tokenRemain, preConsumed = 100_000, 50_000, 2_000

	seedUser(t, userID, initialQuota)
	seedToken(t, tokenID, userID, "realtime-wss-key", tokenRemain)
	seedChannel(t, channelID)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/realtime", nil)
	ctx.Set("token_name", "test_token")

	relayInfo := &relaycommon.RelayInfo{
		UserId:          userID,
		TokenId:         tokenID,
		TokenKey:        "sk-realtime-wss-key",
		OriginModelName: "realtime-test-model",
		UsingGroup:      "default",
		StartTime:       time.Now(),
		IsStream:        true,
		// 绕过信任额度旁路，预扣一个可预期的 P（与生产 wss 计费路径一致）
		ForcePreConsume: true,
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: channelID},
		PriceData: types.PriceData{
			ModelRatio:     1,
			GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1},
		},
	}

	if apiErr := PreConsumeBilling(ctx, preConsumed, relayInfo); apiErr != nil {
		t.Fatalf("pre-consume billing failed: %s", apiErr.Error())
	}
	require.NotNil(t, relayInfo.Billing)

	// 一个 response.done 段落：10 输入 + 10 输出文本 token（纯文本，便于对账）
	segmentUsage := func() *dto.RealtimeUsage {
		return &dto.RealtimeUsage{
			TotalTokens:        20,
			InputTokens:        10,
			OutputTokens:       10,
			InputTokenDetails:  dto.InputTokenDetails{TextTokens: 10},
			OutputTokenDetails: dto.OutputTokenDetails{TextTokens: 10},
		}
	}

	segQuota, clamp := calculateAudioQuota(QuotaInfo{
		InputDetails:  TokenDetails{TextTokens: 10},
		OutputDetails: TokenDetails{TextTokens: 10},
		ModelName:     "realtime-test-model",
		ModelRatio:    1,
		GroupRatio:    1,
	})
	require.Nil(t, clamp)
	require.Positive(t, segQuota)

	// 两个段落逐段实扣（模拟 relay_realtime.go 的 preConsumeUsage 循环）
	require.NoError(t, PreWssConsumeQuota(ctx, relayInfo, segmentUsage()))
	require.NoError(t, PreWssConsumeQuota(ctx, relayInfo, segmentUsage()))
	require.EqualValues(t, 2*segQuota, relayInfo.RealtimeIncrementalQuota)
	require.Equal(t, initialQuota-preConsumed-2*segQuota, getUserQuota(t, userID))

	// 会话结束：按累计总量结算
	totalUsage := &dto.RealtimeUsage{
		TotalTokens:        40,
		InputTokens:        20,
		OutputTokens:       20,
		InputTokenDetails:  dto.InputTokenDetails{TextTokens: 20},
		OutputTokenDetails: dto.OutputTokenDetails{TextTokens: 20},
	}
	totalQuota, clamp := calculateAudioQuota(QuotaInfo{
		InputDetails:  TokenDetails{TextTokens: 20},
		OutputDetails: TokenDetails{TextTokens: 20},
		ModelName:     "realtime-test-model",
		ModelRatio:    1,
		GroupRatio:    1,
	})
	require.Nil(t, clamp)
	require.Positive(t, totalQuota)

	PostWssConsumeQuota(ctx, relayInfo, "realtime-test-model", totalUsage, "")

	// 净扣费必须恰好等于总量：增量已扣过的部分不得重复扣
	assert.Equal(t, initialQuota-totalQuota, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain-totalQuota, getTokenRemainQuota(t, tokenID))

	// 统计口径记录总量，与净扣费一致（日志与余额可对账）
	usedQuota, requestCount := getUserUsageAccounting(t, userID)
	assert.Equal(t, totalQuota, usedQuota)
	assert.Equal(t, 1, requestCount)
	assert.EqualValues(t, totalQuota, getChannelUsedQuota(t, channelID))
}

// TestPreWssConsumeQuotaRejectsWhenBalanceRunsDry keeps the live-balance
// enforcement of the incremental charge: once the wallet cannot cover a
// segment, PreWssConsumeQuota must fail so the relay disconnects the session.
func TestPreWssConsumeQuotaRejectsWhenBalanceRunsDry(t *testing.T) {
	truncate(t)
	initWssTestDB(t)
	gin.SetMode(gin.TestMode)

	previousRatios := ratio_setting.ModelRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"realtime-test-model":1}`))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(previousRatios))
	})

	const (
		userID    = 61
		tokenID   = 61
		channelID = 61
	)
	// 钱包/令牌额度只够扣第一段（20），第二段必须被拒
	const initialQuota, tokenRemain = 30, 30

	seedUser(t, userID, initialQuota)
	seedToken(t, tokenID, userID, "realtime-dry-key", tokenRemain)
	seedChannel(t, channelID)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/realtime", nil)
	ctx.Set("token_name", "test_token")

	relayInfo := &relaycommon.RelayInfo{
		UserId:          userID,
		TokenId:         tokenID,
		TokenKey:        "sk-realtime-dry-key",
		OriginModelName: "realtime-test-model",
		UsingGroup:      "default",
		StartTime:       time.Now(),
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: channelID},
		PriceData: types.PriceData{
			ModelRatio:     1,
			GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1},
		},
	}

	usage := &dto.RealtimeUsage{
		TotalTokens:        20,
		InputTokens:        10,
		OutputTokens:       10,
		InputTokenDetails:  dto.InputTokenDetails{TextTokens: 10},
		OutputTokenDetails: dto.OutputTokenDetails{TextTokens: 10},
	}

	// 无预扣会话（Billing == nil）时也允许逐段扣费；钱包见底必须报错断流
	require.NoError(t, PreWssConsumeQuota(ctx, relayInfo, usage))
	require.Error(t, PreWssConsumeQuota(ctx, relayInfo, usage))
}
