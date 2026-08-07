package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type relayBillingFailureRecorder struct {
	refunds       int
	manualReviews int
}

func (r *relayBillingFailureRecorder) Settle(int) error         { return nil }
func (r *relayBillingFailureRecorder) NeedsRefund() bool        { return true }
func (r *relayBillingFailureRecorder) GetPreConsumedQuota() int { return 1 }
func (r *relayBillingFailureRecorder) Reserve(int) error        { return nil }
func (r *relayBillingFailureRecorder) Refund(*gin.Context)      { r.refunds++ }
func (r *relayBillingFailureRecorder) MarkSettlementUnknown(error) error {
	r.manualReviews++
	return nil
}

func TestCanWriteRelayErrorRefusesAfterResponseStarted(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	require.True(t, canWriteRelayError(c))
	c.String(200, "already sent")
	require.False(t, canWriteRelayError(c))
}

func TestImageAutoRefundRequiresProofRequestWasNotDispatched(t *testing.T) {
	require.True(t, isImageAutoRefundSafe(types.NewError(
		errors.New("no route"),
		types.ErrorCodeGetChannelFailed,
	)))
	require.True(t, isImageAutoRefundSafe(types.NewOpenAIError(
		errors.New("dial failed before write"),
		types.ErrorCodeDoRequestFailed,
		http.StatusBadGateway,
		types.ErrOptionWithRequestNotSent(),
	)))

	require.False(t, isImageAutoRefundSafe(types.NewOpenAIError(
		errors.New("transport failed after request write"),
		types.ErrorCodeDoRequestFailed,
		http.StatusBadGateway,
	)))
	require.False(t, isImageAutoRefundSafe(types.NewOpenAIError(
		errors.New("upstream returned 500"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusBadGateway,
	)))
	require.False(t, isImageAutoRefundSafe(types.NewOpenAIError(
		errors.New("truncated upstream body"),
		types.ErrorCodeReadResponseBodyFailed,
		http.StatusBadGateway,
	)))
}

func TestImageAutoBillingFailureRefundsWhenNoResultWasWritten(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	billing := &relayBillingFailureRecorder{}
	info := &relaycommon.RelayInfo{
		Billing:      billing,
		ImageRouting: &relaycommon.ImageRoutingState{},
	}

	ambiguous := types.NewOpenAIError(
		errors.New("upstream returned 500 after dispatch"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusBadGateway,
	)
	require.NoError(t, handleRelayBillingFailure(c, info, ambiguous))
	require.Equal(t, 1, billing.refunds)
	require.Zero(t, billing.manualReviews)

	c.String(http.StatusOK, "partial response")
	require.NoError(t, handleRelayBillingFailure(c, info, ambiguous))
	require.Equal(t, 2, billing.refunds)
	require.Zero(t, billing.manualReviews)

	notSent := types.NewOpenAIError(
		errors.New("dial failed before request write"),
		types.ErrorCodeDoRequestFailed,
		http.StatusBadGateway,
		types.ErrOptionWithRequestNotSent(),
	)
	require.NoError(t, handleRelayBillingFailure(c, info, notSent))
	require.Equal(t, 3, billing.refunds)
	require.Zero(t, billing.manualReviews)
}
