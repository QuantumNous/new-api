package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestTokenAuthAllowsHistoricalAutoTokenWithVisibleCandidate(t *testing.T) {
	setupRuntimeVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	oldAutoGroups := setting.AutoGroups2JsonString()
	t.Cleanup(func() { _ = setting.UpdateAutoGroupsByJsonString(oldAutoGroups) })
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["default"]`))
	require.NoError(t, model.DB.Create(&model.User{
		Id: 1, Username: "auto-token-user", Password: "password", Group: "default",
		AffCode: "auto-token-aff", Status: common.UserStatusEnabled,
	}).Error)
	require.NoError(t, model.DB.Create(&model.Token{
		Id: 1, UserId: 1, Key: "autotoken", Status: common.TokenStatusEnabled,
		UnlimitedQuota: true, ExpiredTime: -1, Group: "auto",
	}).Error)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	continued := false
	router.Use(TokenAuth())
	router.POST("/v1/chat/completions", func(c *gin.Context) {
		continued = true
		c.Status(http.StatusOK)
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	req.Header.Set("Authorization", "Bearer sk-autotoken")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.True(t, continued, "a visible auto candidate must let the token reach relay")
}

func TestTokenAuthRejectsAutoTokenWithoutVisibleCandidate(t *testing.T) {
	setupRuntimeVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	oldAutoGroups := setting.AutoGroups2JsonString()
	t.Cleanup(func() { _ = setting.UpdateAutoGroupsByJsonString(oldAutoGroups) })
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`[]`))
	require.NoError(t, model.DB.Create(&model.User{
		Id: 1, Username: "auto-token-no-candidate-user", Password: "password", Group: "default",
		AffCode: "auto-token-no-candidate-aff", Status: common.UserStatusEnabled,
	}).Error)
	require.NoError(t, model.DB.Create(&model.Token{
		Id: 1, UserId: 1, Key: "autotokenNoCandidate", Status: common.TokenStatusEnabled,
		UnlimitedQuota: true, ExpiredTime: -1, Group: "auto",
	}).Error)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	continued := false
	router.Use(TokenAuth())
	router.POST("/v1/chat/completions", func(c *gin.Context) {
		continued = true
		c.Status(http.StatusOK)
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	req.Header.Set("Authorization", "Bearer sk-autotokenNoCandidate")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusForbidden, recorder.Code)
	require.False(t, continued, "an auto token without a visible candidate must not reach relay")
}
