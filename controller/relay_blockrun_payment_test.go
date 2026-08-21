package controller

import (
	"encoding/base64"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	blockrunSDK "github.com/BlockRunAI/blockrun-llm-go"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	blockrunchannel "github.com/QuantumNous/new-api/relay/channel/blockrun"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func newBlockRunPaymentTestContext() (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	return ctx, recorder
}

func TestShouldRetryStopsBaseFailoverAfterSignedPaymentAttempt(t *testing.T) {
	ctx, _ := newBlockRunPaymentTestContext()
	relaycommon.MarkBlockRunPaymentAttempt(ctx, dto.BlockRunPaymentChainBase, 101, "request=req-1")

	channelErr := types.NewError(errors.New("first Base channel failed"), types.ErrorCodeChannelResponseTimeExceeded)
	require.False(t, shouldRetry(ctx, channelErr, 2))
}

func TestShouldRetryPreservesUnsignedChannelRetry(t *testing.T) {
	ctx, _ := newBlockRunPaymentTestContext()
	channelErr := types.NewError(errors.New("unsigned channel failed"), types.ErrorCodeChannelResponseTimeExceeded)

	require.True(t, shouldRetry(ctx, channelErr, 2))
}

func TestNormalizeBlockRunPaymentErrors(t *testing.T) {
	t.Run("signed 402 is rejected", func(t *testing.T) {
		ctx, _ := newBlockRunPaymentTestContext()
		relaycommon.MarkBlockRunPaymentAttempt(ctx, dto.BlockRunPaymentChainSolana, 202, "request=req-2")
		relaycommon.UpdateBlockRunPaymentOutcome(ctx, relaycommon.BlockRunPaymentOutcomeRejected, false)

		got := normalizeBlockRunPaymentError(ctx, types.NewError(errors.New("wrapped rejection"), types.ErrorCodeDoRequestFailed))
		require.Equal(t, types.ErrorCodeBlockRunPaymentRejected, got.GetErrorCode())
		require.Equal(t, http.StatusPaymentRequired, got.StatusCode)
		require.Equal(t, "BlockRun payment was rejected after signing; this request was not retried", got.Error())
		require.True(t, types.IsSkipRetryError(got))
		require.False(t, shouldApplyChannelPenalty(got))
	})

	t.Run("signed transport failure is settlement unknown", func(t *testing.T) {
		ctx, _ := newBlockRunPaymentTestContext()
		relaycommon.MarkBlockRunPaymentAttempt(ctx, dto.BlockRunPaymentChainBase, 203, "request=req-3")

		got := normalizeBlockRunPaymentError(ctx, types.NewErrorWithStatusCode(errors.New("connection reset"), types.ErrorCodeDoRequestFailed, http.StatusServiceUnavailable))
		require.Equal(t, types.ErrorCodeBlockRunSettlementUnknown, got.GetErrorCode())
		require.Equal(t, http.StatusServiceUnavailable, got.StatusCode)
		require.Equal(t, "BlockRun signed payment settlement is unknown and may have been charged; automatic retry is disabled, reconcile using the request ID", got.Error())
		require.True(t, types.IsSkipRetryError(got))
		require.False(t, shouldApplyChannelPenalty(got))
		state, ok := relaycommon.GetBlockRunPaymentState(ctx)
		require.True(t, ok)
		require.Equal(t, relaycommon.BlockRunPaymentOutcomeSettlementUnknown, state.Outcome)
	})

	t.Run("written stream records truncation", func(t *testing.T) {
		ctx, recorder := newBlockRunPaymentTestContext()
		relaycommon.MarkBlockRunPaymentAttempt(ctx, dto.BlockRunPaymentChainSolana, 204, "request=req-4")
		ctx.String(http.StatusOK, "partial")

		got := normalizeBlockRunPaymentError(ctx, types.NewError(errors.New("unexpected EOF"), types.ErrorCodeReadResponseBodyFailed))
		require.Equal(t, types.ErrorCodeBlockRunSettlementUnknown, got.GetErrorCode())
		require.Equal(t, "partial", recorder.Body.String())
		state, ok := relaycommon.GetBlockRunPaymentState(ctx)
		require.True(t, ok)
		require.True(t, state.StreamTruncated)
	})
}

func TestProcessChannelErrorPersistsOriginalBlockRunError(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/blockrun-error-log.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Log{}, &model.Option{}))

	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	previousErrorLogEnabled := constant.ErrorLogEnabled
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	constant.ErrorLogEnabled = true
	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.RedisEnabled = previousRedisEnabled
		constant.ErrorLogEnabled = previousErrorLogEnabled
	})

	tests := []struct {
		name             string
		outcome          relaycommon.BlockRunPaymentOutcome
		originalStatus   int
		originalMessage  string
		wantClientCode   types.ErrorCode
		wantClientStatus int
	}{
		{
			name:             "payment rejected",
			outcome:          relaycommon.BlockRunPaymentOutcomeRejected,
			originalStatus:   http.StatusPaymentRequired,
			originalMessage:  "upstream x402 rejected signed payment: nonce already used",
			wantClientCode:   types.ErrorCodeBlockRunPaymentRejected,
			wantClientStatus: http.StatusPaymentRequired,
		},
		{
			name:             "settlement unknown",
			outcome:          relaycommon.BlockRunPaymentOutcomeSigned,
			originalStatus:   http.StatusBadGateway,
			originalMessage:  "upstream connection closed before settlement receipt",
			wantClientCode:   types.ErrorCodeBlockRunSettlementUnknown,
			wantClientStatus: http.StatusBadGateway,
		},
	}

	for index, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, _ := newBlockRunPaymentTestContext()
			ctx.Set("id", 1)
			ctx.Set("token_id", index+1)
			ctx.Set("token_name", "blockrun-token")
			ctx.Set("original_model", "test-model")
			ctx.Set("group", "default")
			relaycommon.MarkBlockRunPaymentAttempt(ctx, dto.BlockRunPaymentChainBase, 700+index, "request=req-log")
			relaycommon.UpdateBlockRunPaymentOutcome(ctx, tt.outcome, false)

			originalErr := types.NewOpenAIError(errors.New(tt.originalMessage), types.ErrorCodeBadResponseStatusCode, tt.originalStatus)
			clientErr := normalizeBlockRunPaymentError(ctx, originalErr)
			require.Equal(t, tt.wantClientCode, clientErr.GetErrorCode())
			require.Equal(t, tt.wantClientStatus, clientErr.StatusCode)
			require.True(t, types.IsSkipRetryError(clientErr))
			require.False(t, shouldApplyChannelPenalty(clientErr))

			channel := types.NewChannelError(700+index, constant.ChannelTypeBlockRun, "blockrun", false, "", true)
			processChannelError(ctx, *channel, clientErr)

			var log model.Log
			require.NoError(t, db.Where("token_id = ?", index+1).First(&log).Error)
			require.Equal(t, originalErr.MaskSensitiveErrorWithStatusCode(), log.Content)
			require.Contains(t, log.Content, tt.originalMessage)
			require.False(t, strings.Contains(log.Content, clientErr.Error()))

			other, err := common.StrToMap(log.Other)
			require.NoError(t, err)
			require.Equal(t, string(originalErr.GetErrorType()), other["error_type"])
			require.Equal(t, string(originalErr.GetErrorCode()), other["error_code"])
			require.EqualValues(t, originalErr.StatusCode, other["status_code"])
		})
	}
}

func TestSignedBlockRun402PersistsSanitizedUpstreamError(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/blockrun-do-request-error-log.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Log{}, &model.Option{}))

	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	previousErrorLogEnabled := constant.ErrorLogEnabled
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	constant.ErrorLogEnabled = true
	t.Cleanup(func() {
		service.ResetProxyClientCache()
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.RedisEnabled = previousRedisEnabled
		constant.ErrorLogEnabled = previousErrorLogEnabled
	})

	const (
		baseURL       = "http://blockrun.test"
		fakeWalletKey = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	)
	requirement := blockrunSDK.PaymentRequirement{
		X402Version: 2,
		Accepts: []blockrunSDK.PaymentOption{{
			Scheme:            "exact",
			Network:           "eip155:8453",
			Amount:            "3000",
			Asset:             "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
			PayTo:             "0x000000000000000000000000000000000000dEaD",
			MaxTimeoutSeconds: 300,
			Extra:             map[string]any{"name": "USD Coin", "version": "2"},
		}},
		Resource: blockrunSDK.ResourceInfo{URL: baseURL + "/v1/responses", MimeType: "application/json"},
	}
	requirementJSON, err := common.Marshal(requirement)
	require.NoError(t, err)
	paymentRequired := base64.StdEncoding.EncodeToString(requirementJSON)

	var signedPayload string
	attempt := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempt++
		if attempt == 1 {
			w.Header().Set("Payment-Required", paymentRequired)
			w.WriteHeader(http.StatusPaymentRequired)
			return
		}
		signedPayload = r.Header.Get("Payment-Signature")
		body, marshalErr := common.Marshal(map[string]any{
			"error": map[string]any{
				"message": "BlockRun balance insufficient; Payment-Signature " + signedPayload,
				"code":    "PAYMENT_REJECTED",
				"reason":  "insufficient_funds",
			},
		})
		if marshalErr != nil {
			t.Errorf("marshal signed rejection: %v", marshalErr)
			return
		}
		w.WriteHeader(http.StatusPaymentRequired)
		_, _ = w.Write(body)
	}))
	defer server.Close()

	ctx, _ := newBlockRunPaymentTestContext()
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", 1)
	ctx.Set("token_id", 99)
	ctx.Set("token_name", "blockrun-token")
	ctx.Set("original_model", "openai/gpt-5.4")
	ctx.Set("group", "default")
	info := &relaycommon.RelayInfo{
		RelayMode:      relayconstant.RelayModeResponses,
		RelayFormat:    types.RelayFormatOpenAI,
		RequestURLPath: "/v1/responses",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId:      799,
			ChannelType:    constant.ChannelTypeBlockRun,
			ChannelBaseUrl: baseURL,
			ApiKey:         fakeWalletKey,
			ChannelSetting: dto.ChannelSettings{Proxy: server.URL},
		},
	}

	resp, doErr := (&blockrunchannel.Adaptor{}).DoRequest(ctx, info, strings.NewReader(`{"model":"openai/gpt-5.4","input":"ping"}`))
	require.Nil(t, resp)
	require.Error(t, doErr)
	require.Equal(t, 2, attempt)
	require.NotEmpty(t, signedPayload)
	require.Contains(t, doErr.Error(), "BlockRun balance insufficient")
	require.Contains(t, doErr.Error(), "PAYMENT_REJECTED")
	require.NotContains(t, doErr.Error(), signedPayload)

	originalErr := types.NewOpenAIError(doErr, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	require.Equal(t, types.ErrorCodeBadResponseStatusCode, originalErr.GetErrorCode())
	require.Equal(t, http.StatusPaymentRequired, originalErr.StatusCode)
	clientErr := normalizeBlockRunPaymentError(ctx, originalErr)
	require.Equal(t, types.ErrorCodeBlockRunPaymentRejected, clientErr.GetErrorCode())
	require.Equal(t, http.StatusPaymentRequired, clientErr.StatusCode)
	require.Equal(t, "BlockRun payment was rejected after signing; this request was not retried", clientErr.Error())
	require.True(t, types.IsSkipRetryError(clientErr))
	require.False(t, shouldApplyChannelPenalty(clientErr))

	channel := types.NewChannelError(799, constant.ChannelTypeBlockRun, "blockrun", false, "", true)
	processChannelError(ctx, *channel, clientErr)

	var log model.Log
	require.NoError(t, db.Where("token_id = ?", 99).First(&log).Error)
	require.Contains(t, log.Content, "BlockRun balance insufficient")
	require.Contains(t, log.Content, "PAYMENT_REJECTED")
	require.Contains(t, log.Content, "insufficient_funds")
	require.Contains(t, log.Content, "status_code=402")
	require.NotContains(t, log.Content, clientErr.Error())
	require.NotContains(t, log.Content, "payment signature rejected by upstream")
	require.NotContains(t, log.Content, signedPayload)
	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	require.Equal(t, string(types.ErrorCodeBadResponseStatusCode), other["error_code"])
	require.EqualValues(t, http.StatusPaymentRequired, other["status_code"])
}

func TestPaidBlockRunErrorsNeverApplyChannelPenalty(t *testing.T) {
	for _, code := range []types.ErrorCode{
		types.ErrorCodeBlockRunPaymentRejected,
		types.ErrorCodeBlockRunSettlementUnknown,
	} {
		err := types.NewErrorWithStatusCode(errors.New("paid failure"), code, http.StatusTooManyRequests)
		require.False(t, shouldApplyChannelPenalty(err), code)
	}

	unsigned := types.NewErrorWithStatusCode(errors.New("rate limited"), types.ErrorCodeDoRequestFailed, http.StatusTooManyRequests)
	require.True(t, shouldApplyChannelPenalty(unsigned))
	require.True(t, shouldMarkChannelConcurrencyCooldown(unsigned))
}
