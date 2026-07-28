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

func TestWeChatGetRejectsInvitationCodeInQuery(t *testing.T) {
	oldEnabled := common.WeChatAuthEnabled
	common.WeChatAuthEnabled = true
	t.Cleanup(func() {
		common.WeChatAuthEnabled = oldEnabled
	})

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(
		http.MethodGet,
		"/api/oauth/wechat?code=wechat-code&invitation_code=INV-PLAINTEXT",
		nil,
	)

	WeChatAuth(context)

	var response struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
}

func TestWeChatPostRejectsAuthenticationValuesInQuery(t *testing.T) {
	oldEnabled := common.WeChatAuthEnabled
	common.WeChatAuthEnabled = true
	t.Cleanup(func() {
		common.WeChatAuthEnabled = oldEnabled
	})

	for _, target := range []string{
		"/api/oauth/wechat?invitation_code=INV-PLAINTEXT",
		"/api/oauth/wechat?code=query-code",
	} {
		t.Run(target, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			recorder := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(recorder)
			context.Request = httptest.NewRequest(
				http.MethodPost,
				target,
				strings.NewReader(`{"code":"body-code"}`),
			)
			context.Request.Header.Set("Content-Type", "application/json")

			WeChatAuth(context)

			var response struct {
				Success bool `json:"success"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			assert.False(t, response.Success)
		})
	}
}
