package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func withOptionMap(t *testing.T, values map[string]string) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	previous := common.OptionMap
	common.OptionMap = values
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previous
		common.OptionMapRWMutex.Unlock()
	})
}

func TestValidateOptionPatchUsesFinalOAuthState(t *testing.T) {
	withOptionMap(t, map[string]string{
		"GitHubClientId":     "",
		"GitHubClientSecret": "",
	})

	err := validateOptionPatch(map[string]string{
		"GitHubClientId":     "client-id",
		"GitHubClientSecret": "client-secret",
		"GitHubOAuthEnabled": "true",
	})
	require.NoError(t, err)
}

func TestUpdateOptionsBulkRejectsInvalidPatchBeforePersistence(t *testing.T) {
	withOptionMap(t, map[string]string{
		"GitHubClientId":     "",
		"GitHubClientSecret": "",
	})

	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = httptest.NewRequest(
		http.MethodPut,
		"/api/option/bulk",
		strings.NewReader(`{"options":{"GitHubOAuthEnabled":true}}`),
	)

	UpdateOptionsBulk(context)

	assert.Equal(t, http.StatusOK, response.Code)
	var payload struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
	assert.False(t, payload.Success)
	assert.Contains(t, payload.Message, "GitHub Client Id")
	assert.Equal(t, "", common.OptionMap["GitHubClientId"])
}

func TestUpdateOptionsBulkRejectsNonScalarValues(t *testing.T) {
	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = httptest.NewRequest(
		http.MethodPut,
		"/api/option/bulk",
		strings.NewReader(`{"options":{"SystemName":{"invalid":true}}}`),
	)

	UpdateOptionsBulk(context)

	assert.Equal(t, http.StatusBadRequest, response.Code)
	assert.Contains(t, response.Body.String(), "字符串、数值或布尔值")
}

func TestGetOptionSecretStatusNeverReturnsSecretValues(t *testing.T) {
	withOptionMap(t, map[string]string{
		"SystemName":         "Ren2Hub",
		"GitHubClientSecret": "private-value",
		"SMTPToken":          "mail-password",
		"WaffoPublicCert":    "certificate-value",
	})

	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/option/secret-status", nil)

	GetOptionSecretStatus(context)

	assert.Equal(t, http.StatusOK, response.Code)
	assert.NotContains(t, response.Body.String(), "private-value")
	assert.NotContains(t, response.Body.String(), "mail-password")
	assert.NotContains(t, response.Body.String(), "certificate-value")
	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			Configured []string `json:"configured"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
	assert.True(t, payload.Success)
	assert.Equal(t, []string{"GitHubClientSecret", "SMTPToken", "WaffoPublicCert"}, payload.Data.Configured)
}
