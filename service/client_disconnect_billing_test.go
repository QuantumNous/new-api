package service

import (
	"context"
	"io"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	disconnectUserId     = 701
	disconnectTokenId    = 702
	disconnectTokenKey   = "client-disconnect"
	disconnectStartQuota = 10_000
	disconnectPreConsume = 5_000
)

// newDisconnectBillingCase pre-consumes like a real relay request and returns
// a cancel func that simulates the client closing the connection.
func newDisconnectBillingCase(t *testing.T, priceData types.PriceData) (*gin.Context, *relaycommon.RelayInfo, context.CancelFunc) {
	t.Helper()
	truncate(t)
	// Below the trust quota, so the request really pre-consumes.
	seedUser(t, disconnectUserId, disconnectStartQuota)
	seedToken(t, disconnectTokenId, disconnectUserId, disconnectTokenKey, disconnectStartQuota)

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	req := httptest.NewRequest("POST", "/v1/chat/completions", nil)
	reqCtx, cancel := context.WithCancel(req.Context())
	t.Cleanup(cancel)
	ctx.Request = req.WithContext(reqCtx)

	info := &relaycommon.RelayInfo{
		UserId:          disconnectUserId,
		TokenId:         disconnectTokenId,
		TokenKey:        disconnectTokenKey,
		RequestId:       t.Name(),
		OriginModelName: "gpt-disconnect-test",
		StartTime:       time.Now(),
		UserSetting:     dto.UserSetting{BillingPreference: "wallet_only"},
		PriceData:       priceData,
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 703},
	}
	info.SetEstimatePromptTokens(1_000)

	require.Nil(t, PreConsumeBilling(ctx, disconnectPreConsume, info))
	require.Equal(t, disconnectStartQuota-disconnectPreConsume, getUserQuota(t, disconnectUserId))
	return ctx, info, cancel
}

func tokenPriced() types.PriceData {
	return types.PriceData{
		ModelRatio:      1,
		CompletionRatio: 1,
		GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 1},
	}
}

func TestClientDisconnectAfterUpstreamSendChargesPromptTokens(t *testing.T) {
	ctx, info, cancel := newDisconnectBillingCase(t, tokenPriced())
	info.MarkUpstreamStart()
	cancel()

	settled := SettleClientDisconnectBilling(ctx, info)

	require.True(t, settled)
	session := info.Billing.(*BillingSession)
	assert.False(t, session.NeedsRefund(), "settled session must not be refunded")
	charged := disconnectStartQuota - getUserQuota(t, disconnectUserId)
	assert.Positive(t, charged, "prompt tokens must be charged")
	assert.Less(t, charged, disconnectPreConsume, "only the input side is charged, not the full reservation")
}

func TestClientDisconnectBeforeUpstreamSendKeepsRefund(t *testing.T) {
	ctx, info, cancel := newDisconnectBillingCase(t, tokenPriced())
	cancel()

	assert.False(t, SettleClientDisconnectBilling(ctx, info))
	assert.True(t, info.Billing.(*BillingSession).NeedsRefund())
}

func TestUpstreamFailureWithoutClientDisconnectKeepsRefund(t *testing.T) {
	ctx, info, _ := newDisconnectBillingCase(t, tokenPriced())
	info.MarkUpstreamStart()

	assert.False(t, SettleClientDisconnectBilling(ctx, info))
	assert.True(t, info.Billing.(*BillingSession).NeedsRefund())
}

func newProxiedRequestContext(t *testing.T, cfRay string, minIdleSeconds int) (*gin.Context, *httptest.ResponseRecorder, context.CancelFunc) {
	t.Helper()
	prevEnabled, prevMax, prevIdle := common.CloudflareDisconnectBillingEnabled, common.CloudflareDisconnectBillingMaxSeconds, common.CloudflareDisconnectBillingMinIdleSeconds
	common.CloudflareDisconnectBillingEnabled, common.CloudflareDisconnectBillingMaxSeconds, common.CloudflareDisconnectBillingMinIdleSeconds = true, 1800, minIdleSeconds
	t.Cleanup(func() {
		common.CloudflareDisconnectBillingEnabled, common.CloudflareDisconnectBillingMaxSeconds, common.CloudflareDisconnectBillingMinIdleSeconds = prevEnabled, prevMax, prevIdle
	})
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest("POST", "/v1beta/models/gemini:generateContent", nil)
	if cfRay != "" {
		req.Header.Set("Cf-Ray", cfRay)
	}
	reqCtx, cancel := context.WithCancel(req.Context())
	t.Cleanup(cancel)
	ctx.Request = req.WithContext(reqCtx)
	return ctx, recorder, cancel
}

func TestCloudflareTruncationKeepsRelayRunning(t *testing.T) {
	ctx, recorder, cancel := newProxiedRequestContext(t, "8f0c1d2e3a4b5c6d-SJC", 0)
	release := DetachProxiedClientCancellation(ctx)
	defer release()

	_, err := ctx.Writer.WriteString("before")
	require.NoError(t, err)
	assert.False(t, ClientRequestCanceled(ctx))

	cancel()

	require.Eventually(t, func() bool { return ProxiedClientGone(ctx) }, time.Second, time.Millisecond)
	assert.NoError(t, ctx.Request.Context().Err(), "upstream context must survive the Cloudflare truncation")
	assert.True(t, ClientRequestCanceled(ctx), "retry and refund paths must still see the client as gone")
	n, err := ctx.Writer.WriteString("after")
	require.NoError(t, err)
	assert.Equal(t, len("after"), n)
	assert.Equal(t, "before", recorder.Body.String(), "writes after the disconnect are discarded")

	streamSteps := 0
	clientGone := ctx.Stream(func(w io.Writer) bool {
		streamSteps++
		return streamSteps < 3
	})
	assert.False(t, clientGone, "c.Stream handlers must keep reading upstream after a truncation")
	assert.Equal(t, 3, streamSteps)
	closeNotify := ctx.Writer.CloseNotify()

	release()
	assert.Error(t, ctx.Request.Context().Err(), "release must cancel the detached relay")
	select {
	case <-closeNotify:
	case <-time.After(time.Second):
		t.Fatal("CloseNotify must fire once the relay ends")
	}
}

func TestDisconnectWithoutCloudflareTruncationCancelsRelay(t *testing.T) {
	tests := []struct {
		name        string
		cfRay       string
		minIdle     int
		continueOff bool
	}{
		{name: "direct connection", cfRay: "", minIdle: 90},
		{name: "user abort through Cloudflare before idle timeout", cfRay: "8f0c1d2e3a4b5c6d-SJC", minIdle: 90},
		{name: "Cloudflare truncation with the continue switch off", cfRay: "8f0c1d2e3a4b5c6d-SJC", minIdle: 0, continueOff: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.continueOff {
				setAbnormalOption(t, "continue_after_cloudflare_truncation", false, true)
			}
			ctx, _, cancel := newProxiedRequestContext(t, tt.cfRay, tt.minIdle)
			release := DetachProxiedClientCancellation(ctx)
			defer release()

			cancel()

			select {
			case <-ctx.Request.Context().Done():
			case <-time.After(time.Second):
				t.Fatal("relay context was not cancelled")
			}
			assert.True(t, ClientRequestCanceled(ctx))
			assert.False(t, ProxiedClientGone(ctx))
		})
	}
}

func TestClientDisconnectOnPerCallModelKeepsRefund(t *testing.T) {
	priceData := tokenPriced()
	priceData.UsePrice = true
	priceData.ModelPrice = 0.01
	ctx, info, cancel := newDisconnectBillingCase(t, priceData)
	info.MarkUpstreamStart()
	cancel()

	assert.False(t, SettleClientDisconnectBilling(ctx, info))
	assert.True(t, info.Billing.(*BillingSession).NeedsRefund())
}

func lastConsumeLog(t *testing.T) model.Log {
	t.Helper()
	var log model.Log
	require.NoError(t, model.LOG_DB.Where("type = ?", model.LogTypeConsume).Order("id desc").First(&log).Error)
	return log
}

const waivedMarker = `"abnormal_charge_waived":true`

// setPolicyBlock marks the request as refused by an upstream safety policy.
func setPolicyBlock(info *relaycommon.RelayInfo) {
	if info.StreamStatus == nil {
		info.StreamStatus = relaycommon.NewStreamStatus()
	}
	info.StreamStatus.MarkPolicyBlocked("cyber_policy")
}

const policyBlockWaiver = "Not charged: upstream blocked the request by a safety policy"

func TestAbnormalBillingDecidesDisconnectSettlement(t *testing.T) {
	tests := []struct {
		name         string
		arrange      func(info *relaycommon.RelayInfo)
		wantSettled  bool
		wantCharged  bool
		wantContains string
	}{
		{
			name: "client leaves before upstream answers and is charged the estimated input",
			arrange: func(info *relaycommon.RelayInfo) {
				info.UpstreamAttempt().MarkRequestSent()
				info.UpstreamAttempt().Fail(context.Canceled, true)
			},
			wantSettled: true, wantCharged: true,
			wantContains: "Client disconnected after the request reached the upstream, billed by usage",
		},
		{
			name: "client leaves before the request was fully sent and is charged",
			arrange: func(info *relaycommon.RelayInfo) {
				info.UpstreamAttempt().Fail(context.Canceled, true)
			},
			wantSettled: true, wantCharged: true,
		},
		{
			name: "client leaves while reading a non-stream body and is charged",
			arrange: func(info *relaycommon.RelayInfo) {
				info.UpstreamAttempt().MarkRequestSent()
				info.UpstreamAttempt().MarkResponse()
				info.UpstreamAttempt().Fail(context.Canceled, true)
			},
			wantSettled: true, wantCharged: true,
		},
		{
			name: "a client leaving a request upstream blocked by a safety policy is not charged",
			arrange: func(info *relaycommon.RelayInfo) {
				info.UpstreamAttempt().MarkRequestSent()
				info.UpstreamAttempt().MarkResponse()
				info.UpstreamAttempt().Fail(context.Canceled, true)
				setPolicyBlock(info)
			},
			wantSettled: true, wantCharged: false,
			wantContains: policyBlockWaiver,
		},
		{
			name: "upstream failure before answering stays refunded",
			arrange: func(info *relaycommon.RelayInfo) {
				info.UpstreamAttempt().MarkRequestSent()
				info.UpstreamAttempt().Fail(io.ErrUnexpectedEOF, false)
			},
			wantSettled: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, info, cancel := newDisconnectBillingCase(t, tokenPriced())
			info.MarkUpstreamStart()
			tt.arrange(info)
			cancel()

			settled := SettleClientDisconnectBilling(ctx, info)

			require.Equal(t, tt.wantSettled, settled)
			session := info.Billing.(*BillingSession)
			if !tt.wantSettled {
				assert.True(t, session.NeedsRefund(), "an unsettled session must fall back to the refund")
				return
			}
			assert.False(t, session.NeedsRefund())
			charged := disconnectStartQuota - getUserQuota(t, disconnectUserId)
			log := lastConsumeLog(t)
			if tt.wantCharged {
				assert.Positive(t, charged)
				assert.Equal(t, charged, log.Quota)
				assert.NotContains(t, log.Other, waivedMarker)
			} else {
				assert.Zero(t, charged, "a waived charge must return the whole reservation")
				assert.Zero(t, getTokenUsedQuota(t, disconnectTokenId))
				assert.Zero(t, log.Quota)
				assert.Contains(t, log.Other, waivedMarker)
			}
			if tt.wantContains != "" {
				assert.Contains(t, log.Content, tt.wantContains)
			}
		})
	}
}

func TestAbnormalBillingDecidesStreamSettlement(t *testing.T) {
	streamEndedBy := func(reason relaycommon.StreamEndReason, endErr error, completed bool) func(info *relaycommon.RelayInfo) {
		return func(info *relaycommon.RelayInfo) {
			info.StreamStatus = relaycommon.NewStreamStatus()
			info.StreamStatus.RequireTerminal()
			if completed {
				info.StreamStatus.MarkCompleted()
			}
			info.StreamStatus.SetEndReason(reason, endErr)
		}
	}
	clientGone := streamEndedBy(relaycommon.StreamEndReasonClientGone, context.Canceled, false)
	upstreamReset := streamEndedBy(relaycommon.StreamEndReasonScannerErr, io.ErrUnexpectedEOF, false)
	// Codex sends cyber_policy as response.failed; Sub2API's chat streams send
	// it as a bare error chunk that leaves the stream looking complete.
	responseFailedByPolicy := func(info *relaycommon.RelayInfo) {
		info.StreamStatus = relaycommon.NewStreamStatus()
		info.StreamStatus.RequireTerminal()
		info.StreamStatus.MarkFailed("cyber_policy", "", 0)
		info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonEOF, nil)
	}
	bareChunkPolicyBlock := func(info *relaycommon.RelayInfo) {
		streamEndedBy(relaycommon.StreamEndReasonDone, nil, false)(info)
		setPolicyBlock(info)
	}
	tests := []struct {
		name         string
		chargePolicy bool
		arrange      func(info *relaycommon.RelayInfo)
		wantCharged  bool
	}{
		{name: "client leaves mid-stream and is charged the usage so far", arrange: clientGone, wantCharged: true},
		{name: "client leaving after the completion event is charged", arrange: streamEndedBy(relaycommon.StreamEndReasonClientGone, context.Canceled, true), wantCharged: true},
		{name: "upstream resets mid-stream and is charged the usage so far", arrange: upstreamReset, wantCharged: true},
		{name: "stream ending without its completion event is charged", arrange: streamEndedBy(relaycommon.StreamEndReasonEOF, nil, false), wantCharged: true},
		{name: "a completed stream is charged", arrange: streamEndedBy(relaycommon.StreamEndReasonDone, nil, true), wantCharged: true},
		{name: "response failed by a safety policy is free by default", arrange: responseFailedByPolicy, wantCharged: false},
		{name: "a bare safety policy error chunk is free by default", arrange: bareChunkPolicyBlock, wantCharged: false},
		{name: "a safety policy block is charged once its switch is on", chargePolicy: true, arrange: responseFailedByPolicy, wantCharged: true},
		{name: "a bare safety policy chunk is charged once its switch is on", chargePolicy: true, arrange: bareChunkPolicyBlock, wantCharged: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setAbnormalOption(t, "charge_policy_block", tt.chargePolicy, false)
			ctx, info, _ := newDisconnectBillingCase(t, tokenPriced())
			info.IsStream = true
			info.MarkUpstreamStart()
			info.UpstreamAttempt().MarkRequestSent()
			info.UpstreamAttempt().MarkResponse()
			tt.arrange(info)

			PostTextConsumeQuota(ctx, info, &dto.Usage{PromptTokens: 1_000, CompletionTokens: 200, TotalTokens: 1_200}, nil)

			charged := disconnectStartQuota - getUserQuota(t, disconnectUserId)
			log := lastConsumeLog(t)
			assert.Equal(t, charged, log.Quota)
			if tt.wantCharged {
				assert.Equal(t, 1_200, charged)
				assert.NotContains(t, log.Other, waivedMarker)
				return
			}
			assert.Zero(t, charged)
			assert.Zero(t, getTokenUsedQuota(t, disconnectTokenId))
			assert.Contains(t, log.Other, waivedMarker)
			assert.Contains(t, log.Content, policyBlockWaiver)
		})
	}
}

// setAbnormalOption sets one abnormal billing option for a test and restores
// its default afterwards.
func setAbnormalOption(t *testing.T, field string, value, defaultValue bool) {
	t.Helper()
	settings := config.GlobalConfig.Get("abnormal_billing_setting")
	require.NoError(t, config.UpdateConfigFromMap(settings, map[string]string{field: strconv.FormatBool(value)}))
	t.Cleanup(func() {
		require.NoError(t, config.UpdateConfigFromMap(settings, map[string]string{field: strconv.FormatBool(defaultValue)}))
	})
}

func TestCloudflareTruncatedRelayIsChargedActualUsage(t *testing.T) {
	tests := []struct {
		name           string
		respondedFirst bool
		policyBlocked  bool
		wantCharged    bool
	}{
		{name: "truncated before upstream answered", wantCharged: true},
		{name: "truncated while upstream was answering", respondedFirst: true, wantCharged: true},
		{name: "truncated on a request upstream blocked by a safety policy", respondedFirst: true, policyBlocked: true, wantCharged: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, info, _ := newDisconnectBillingCase(t, tokenPriced())
			if tt.policyBlocked {
				setPolicyBlock(info)
			}
			info.MarkUpstreamStart()
			info.UpstreamAttempt().MarkRequestSent()
			info.UpstreamAttempt().MarkResponse()
			// The relay keeps running after a truncation and ends normally; only
			// the moment the client left relative to the first response counts.
			truncatedAt := time.Now().Add(-time.Hour)
			if tt.respondedFirst {
				truncatedAt = time.Now().Add(time.Hour)
			}
			writer := &detachedClientWriter{ResponseWriter: ctx.Writer, clientCtx: context.Background(), relayCtx: context.Background()}
			writer.truncatedAtUnixNs.Store(truncatedAt.UnixNano())
			writer.truncated.Store(true)
			ctx.Set(detachedClientWriterKey, writer)

			PostTextConsumeQuota(ctx, info, &dto.Usage{PromptTokens: 1_000, CompletionTokens: 200, TotalTokens: 1_200}, nil)

			charged := disconnectStartQuota - getUserQuota(t, disconnectUserId)
			log := lastConsumeLog(t)
			if tt.wantCharged {
				assert.Equal(t, 1_200, charged)
				assert.Contains(t, log.Content, "billed by actual usage")
				return
			}
			assert.Zero(t, charged)
			assert.NotContains(t, log.Content, "billed by actual usage", "a waived log must not claim a charge")
		})
	}
}
