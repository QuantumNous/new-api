package controller

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSinglePrimaryKeyNeverRevealsViaReadEndpoints(t *testing.T) {
	db := setupAPIKeyLoginTestDB(t)
	previous := common.SinglePrimaryAPIKeyEnabled
	common.SinglePrimaryAPIKeyEnabled = true
	t.Cleanup(func() { common.SinglePrimaryAPIKeyEnabled = previous })
	user := createAPIKeyLoginUser(t, db, "read-once-key")
	var token model.Token
	require.NoError(t, db.Where("user_id = ?", user.Id).First(&token).Error)

	for _, tc := range []struct {
		name string
		call func(*gin.Context)
	}{
		{name: "single", call: GetTokenKey},
		{name: "batch", call: GetTokenKeysBatch},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Set("id", user.Id)
			c.Set("role", common.RoleCommonUser)
			if tc.name == "single" {
				c.Params = gin.Params{{Key: "id", Value: strconv.Itoa(token.Id)}}
				c.Request = httptest.NewRequest(http.MethodPost, "/api/token/"+strconv.Itoa(token.Id)+"/key", nil)
			} else {
				c.Request = httptest.NewRequest(http.MethodPost, "/api/token/batch/keys", strings.NewReader(`{"ids":[`+strconv.Itoa(token.Id)+`]}`))
			}
			tc.call(c)
			assert.Equal(t, http.StatusForbidden, recorder.Code)
			assert.NotContains(t, recorder.Body.String(), "read-once-key")
		})
	}
}

func TestRotatePrimaryAPIKeyRequiresSecurityProof(t *testing.T) {
	previous := common.SinglePrimaryAPIKeyEnabled
	common.SinglePrimaryAPIKeyEnabled = true
	t.Cleanup(func() { common.SinglePrimaryAPIKeyEnabled = previous })
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("id", 1)
	c.Set("role", common.RoleCommonUser)
	RotatePrimaryAPIKey(c)
	assert.Equal(t, http.StatusForbidden, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "SECURITY_PROOF_REQUIRED")
}
