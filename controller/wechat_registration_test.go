package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWeChatRegistrationRequiresInvitationInSinglePrimaryMode(t *testing.T) {
	db := setupAPIKeyLoginTestDB(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"success":true,"data":"wechat-new-user"}`))
	}))
	t.Cleanup(server.Close)
	previousEnabled := common.WeChatAuthEnabled
	previousAddress := common.WeChatServerAddress
	previousSingle := common.SinglePrimaryAPIKeyEnabled
	common.WeChatAuthEnabled = true
	common.WeChatServerAddress = server.URL
	common.SinglePrimaryAPIKeyEnabled = true
	t.Cleanup(func() {
		common.WeChatAuthEnabled = previousEnabled
		common.WeChatServerAddress = previousAddress
		common.SinglePrimaryAPIKeyEnabled = previousSingle
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/oauth/wechat?code=test-code", nil)
	c.Request.URL.RawQuery = "code=test-code"

	WeChatAuth(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"success":false`)
	assert.Contains(t, recorder.Body.String(), "invite_required")
	var count int64
	require.NoError(t, db.Model(&model.User{}).Count(&count).Error)
	assert.Zero(t, count)
}
