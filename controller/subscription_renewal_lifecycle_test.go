package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCancelSubscriptionRenewalReturnsProviderNeutralEnvelope(t *testing.T) {
	originalCancel := cancelCurrentSubscriptionRenewal
	t.Cleanup(func() { cancelCurrentSubscriptionRenewal = originalCancel })
	cancelCurrentSubscriptionRenewal = func(userID int) (*service.SubscriptionRenewalLifecycleResult, error) {
		require.Equal(t, 901, userID)
		return &service.SubscriptionRenewalLifecycleResult{
			RenewalSource:     model.SubscriptionRenewalSourceWallet,
			RenewalStatus:     model.SubscriptionRenewalStatusCancelledByUser,
			CurrentPeriodEnd:  12345,
			CanCancel:         false,
			CanResume:         true,
			CancelAtPeriodEnd: true,
		}, nil
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 901)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/subscription/self/renewal/cancel", nil)

	CancelSubscriptionRenewal(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var envelope map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	require.Equal(t, true, envelope["success"])
	data := envelope["data"].(map[string]any)
	require.Equal(t, model.SubscriptionRenewalSourceWallet, data["renewal_source"])
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, data["renewal_status"])
	require.Equal(t, float64(12345), data["current_period_end"])
	require.Equal(t, false, data["can_cancel"])
	require.Equal(t, true, data["can_resume"])
	require.Equal(t, true, data["is_cancel_at_period_end"])
}

func TestResumeSubscriptionRenewalReturnsApiErrorEnvelope(t *testing.T) {
	originalResume := resumeCurrentSubscriptionRenewal
	t.Cleanup(func() { resumeCurrentSubscriptionRenewal = originalResume })
	resumeCurrentSubscriptionRenewal = func(userID int) (*service.SubscriptionRenewalLifecycleResult, error) {
		require.Equal(t, 902, userID)
		return nil, errors.New("subscription renewal status cannot be changed")
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 902)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/subscription/self/renewal/resume", nil)

	ResumeSubscriptionRenewal(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
	require.Contains(t, recorder.Body.String(), "subscription renewal status cannot be changed")
}
