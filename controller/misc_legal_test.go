package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetRefundPolicyReturnsConfiguredDocument(t *testing.T) {
	legalSettings := system_setting.GetLegalSettings()
	originalRefundPolicy := legalSettings.RefundPolicy
	legalSettings.RefundPolicy = "# Refund Policy\n\nRefunds are available within 14 days."
	t.Cleanup(func() {
		legalSettings.RefundPolicy = originalRefundPolicy
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	GetRefundPolicy(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
		Data    string `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	assert.True(t, payload.Success)
	assert.Empty(t, payload.Message)
	assert.Equal(t, legalSettings.RefundPolicy, payload.Data)
}

func TestGetStatusAdvertisesConfiguredRefundPolicy(t *testing.T) {
	legalSettings := system_setting.GetLegalSettings()
	originalRefundPolicy := legalSettings.RefundPolicy
	t.Cleanup(func() {
		legalSettings.RefundPolicy = originalRefundPolicy
	})

	testCases := []struct {
		name    string
		policy  string
		enabled bool
	}{
		{name: "configured", policy: "https://example.com/refunds", enabled: true},
		{name: "whitespace only", policy: " \n\t", enabled: false},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			legalSettings.RefundPolicy = testCase.policy

			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)

			GetStatus(ctx)

			require.Equal(t, http.StatusOK, recorder.Code)
			var payload struct {
				Success bool `json:"success"`
				Data    struct {
					RefundPolicyEnabled bool `json:"refund_policy_enabled"`
				} `json:"data"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
			assert.True(t, payload.Success)
			assert.Equal(t, testCase.enabled, payload.Data.RefundPolicyEnabled)
		})
	}
}
