package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
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
		require.True(t, types.IsSkipRetryError(got))
	})

	t.Run("signed transport failure is settlement unknown", func(t *testing.T) {
		ctx, _ := newBlockRunPaymentTestContext()
		relaycommon.MarkBlockRunPaymentAttempt(ctx, dto.BlockRunPaymentChainBase, 203, "request=req-3")

		got := normalizeBlockRunPaymentError(ctx, types.NewError(errors.New("connection reset"), types.ErrorCodeDoRequestFailed))
		require.Equal(t, types.ErrorCodeBlockRunSettlementUnknown, got.GetErrorCode())
		require.True(t, types.IsSkipRetryError(got))
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
