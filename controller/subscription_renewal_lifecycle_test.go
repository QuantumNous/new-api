package controller

import (
	"bytes"
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
	cancelCurrentSubscriptionRenewal = func(userID int, precondition service.SubscriptionRenewalLifecyclePrecondition) (*service.SubscriptionRenewalLifecycleResult, error) {
		require.Equal(t, 901, userID)
		require.Equal(t, int64(7001), precondition.ExpectedContractID)
		require.Equal(t, int64(3), precondition.ExpectedChangeVersion)
		require.Equal(t, int64(12345), precondition.ExpectedCurrentPeriodEnd)
		require.Equal(t, model.SubscriptionRenewalSourceWallet, precondition.ExpectedRenewalSource)
		require.Equal(t, model.SubscriptionRenewalStatusEnabled, precondition.ExpectedRenewalStatus)
		result := &service.SubscriptionRenewalLifecycleResult{
			RenewalSource:     model.SubscriptionRenewalSourceWallet,
			RenewalStatus:     model.SubscriptionRenewalStatusCancelledByUser,
			CurrentPeriodEnd:  12345,
			ChangeVersion:     4,
			CanCancel:         false,
			CanResume:         true,
			CancelAtPeriodEnd: true,
		}
		return result, nil
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 901)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/subscription/self/renewal/cancel", bytes.NewBufferString(`{
		"expected_contract_id":7001,
		"expected_change_version":3,
		"expected_current_period_end":12345,
		"expected_renewal_source":"wallet_auto",
		"expected_renewal_status":"enabled"
	}`))

	CancelSubscriptionRenewal(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var envelope map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	require.Equal(t, true, envelope["success"])
	data := envelope["data"].(map[string]any)
	require.Equal(t, model.SubscriptionRenewalSourceWallet, data["renewal_source"])
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, data["renewal_status"])
	require.Equal(t, float64(12345), data["current_period_end"])
	require.Equal(t, float64(4), data["change_version"])
	require.Equal(t, false, data["can_cancel"])
	require.Equal(t, true, data["can_resume"])
	require.Equal(t, true, data["is_cancel_at_period_end"])
	require.NotContains(t, data, "sync_pending")
}

func TestResumeSubscriptionRenewalReturnsApiErrorEnvelope(t *testing.T) {
	originalResume := resumeCurrentSubscriptionRenewal
	t.Cleanup(func() { resumeCurrentSubscriptionRenewal = originalResume })
	resumeCurrentSubscriptionRenewal = func(userID int, precondition service.SubscriptionRenewalLifecyclePrecondition) (*service.SubscriptionRenewalLifecycleResult, error) {
		require.Equal(t, 902, userID)
		require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, precondition.ExpectedRenewalStatus)
		return nil, errors.New("subscription renewal status cannot be changed")
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 902)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/subscription/self/renewal/resume", bytes.NewBufferString(`{
		"expected_contract_id":7002,
		"expected_change_version":4,
		"expected_current_period_end":12346,
		"expected_renewal_source":"provider_recurring",
		"expected_renewal_status":"cancelled_by_user"
	}`))

	ResumeSubscriptionRenewal(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
	require.Contains(t, recorder.Body.String(), "subscription renewal status cannot be changed")
}

func TestSubscriptionRenewalLifecycleRejectsNilServiceResult(t *testing.T) {
	originalCancel := cancelCurrentSubscriptionRenewal
	originalResume := resumeCurrentSubscriptionRenewal
	t.Cleanup(func() {
		cancelCurrentSubscriptionRenewal = originalCancel
		resumeCurrentSubscriptionRenewal = originalResume
	})
	cancelCurrentSubscriptionRenewal = func(userID int, precondition service.SubscriptionRenewalLifecyclePrecondition) (*service.SubscriptionRenewalLifecycleResult, error) {
		return nil, nil
	}
	resumeCurrentSubscriptionRenewal = func(userID int, precondition service.SubscriptionRenewalLifecyclePrecondition) (*service.SubscriptionRenewalLifecycleResult, error) {
		return nil, nil
	}

	tests := []struct {
		name    string
		path    string
		handler func(*gin.Context)
	}{
		{name: "cancel", path: "/api/subscription/self/renewal/cancel", handler: CancelSubscriptionRenewal},
		{name: "resume", path: "/api/subscription/self/renewal/resume", handler: ResumeSubscriptionRenewal},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Set("id", 903)
			ctx.Request = httptest.NewRequest(http.MethodPost, test.path, bytes.NewBufferString(`{
				"expected_contract_id":7003,
				"expected_change_version":5,
				"expected_current_period_end":12347,
				"expected_renewal_source":"wallet_auto",
				"expected_renewal_status":"enabled"
			}`))

			test.handler(ctx)

			require.Equal(t, http.StatusOK, recorder.Code)
			require.Contains(t, recorder.Body.String(), `"success":false`)
			require.Contains(t, recorder.Body.String(), "subscription renewal lifecycle result is missing")
		})
	}
}

func TestSubscriptionRenewalLifecycleRejectsMissingOrInvalidPreconditionBody(t *testing.T) {
	originalCancel := cancelCurrentSubscriptionRenewal
	t.Cleanup(func() { cancelCurrentSubscriptionRenewal = originalCancel })
	called := false
	cancelCurrentSubscriptionRenewal = func(userID int, precondition service.SubscriptionRenewalLifecyclePrecondition) (*service.SubscriptionRenewalLifecycleResult, error) {
		called = true
		return nil, nil
	}
	tests := []struct {
		name string
		body string
	}{
		{name: "missing", body: ``},
		{name: "missing change version", body: `{"expected_contract_id":1,"expected_current_period_end":2,"expected_renewal_source":"wallet_auto","expected_renewal_status":"enabled"}`},
		{name: "missing status", body: `{"expected_contract_id":1,"expected_change_version":1,"expected_current_period_end":2,"expected_renewal_source":"wallet_auto"}`},
		{name: "unsupported source", body: `{"expected_contract_id":1,"expected_change_version":1,"expected_current_period_end":2,"expected_renewal_source":"pix","expected_renewal_status":"enabled"}`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			called = false
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Set("id", 904)
			ctx.Request = httptest.NewRequest(http.MethodPost, "/api/subscription/self/renewal/cancel", bytes.NewBufferString(test.body))

			CancelSubscriptionRenewal(ctx)

			require.Equal(t, http.StatusOK, recorder.Code)
			require.Contains(t, recorder.Body.String(), `"success":false`)
			require.False(t, called)
		})
	}
}

func TestSubscriptionRenewalLifecycleAllowsExplicitZeroChangeVersion(t *testing.T) {
	originalCancel := cancelCurrentSubscriptionRenewal
	t.Cleanup(func() { cancelCurrentSubscriptionRenewal = originalCancel })
	called := false
	cancelCurrentSubscriptionRenewal = func(userID int, precondition service.SubscriptionRenewalLifecyclePrecondition) (*service.SubscriptionRenewalLifecycleResult, error) {
		called = true
		require.Equal(t, int64(0), precondition.ExpectedChangeVersion)
		return &service.SubscriptionRenewalLifecycleResult{
			RenewalSource:    model.SubscriptionRenewalSourceWallet,
			RenewalStatus:    model.SubscriptionRenewalStatusCancelledByUser,
			CurrentPeriodEnd: 2,
		}, nil
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 905)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/subscription/self/renewal/cancel", bytes.NewBufferString(`{
		"expected_contract_id":1,
		"expected_change_version":0,
		"expected_current_period_end":2,
		"expected_renewal_source":"wallet_auto",
		"expected_renewal_status":"enabled"
	}`))

	CancelSubscriptionRenewal(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.True(t, called)
	require.Contains(t, recorder.Body.String(), `"success":true`)
}

func TestSubscriptionRenewalLifecycleRejectsUnknownProviderBindingID(t *testing.T) {
	originalCancel := cancelCurrentSubscriptionRenewal
	originalResume := resumeCurrentSubscriptionRenewal
	t.Cleanup(func() {
		cancelCurrentSubscriptionRenewal = originalCancel
		resumeCurrentSubscriptionRenewal = originalResume
	})
	cancelCalls := 0
	resumeCalls := 0
	cancelCurrentSubscriptionRenewal = func(userID int, precondition service.SubscriptionRenewalLifecyclePrecondition) (*service.SubscriptionRenewalLifecycleResult, error) {
		cancelCalls++
		return &service.SubscriptionRenewalLifecycleResult{}, nil
	}
	resumeCurrentSubscriptionRenewal = func(userID int, precondition service.SubscriptionRenewalLifecyclePrecondition) (*service.SubscriptionRenewalLifecycleResult, error) {
		resumeCalls++
		return &service.SubscriptionRenewalLifecycleResult{}, nil
	}

	tests := []struct {
		name      string
		path      string
		handler   func(*gin.Context)
		callCount *int
	}{
		{name: "cancel", path: "/api/subscription/self/renewal/cancel", handler: CancelSubscriptionRenewal, callCount: &cancelCalls},
		{name: "resume", path: "/api/subscription/self/renewal/resume", handler: ResumeSubscriptionRenewal, callCount: &resumeCalls},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Set("id", 905)
			ctx.Request = httptest.NewRequest(http.MethodPost, test.path, bytes.NewBufferString(`{
				"expected_contract_id":7005,
				"expected_change_version":7,
				"expected_current_period_end":12349,
				"expected_renewal_source":"provider_recurring",
				"expected_renewal_status":"enabled",
				"provider_binding_id":8801
			}`))

			test.handler(ctx)

			require.Equal(t, 0, *test.callCount)
			if recorder.Code >= http.StatusBadRequest {
				require.Less(t, recorder.Code, http.StatusInternalServerError)
				return
			}
			require.Contains(t, recorder.Body.String(), `"success":false`)
		})
	}
}
