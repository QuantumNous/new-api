/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type passkeyStatusResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Enabled       bool `json:"enabled"`
		SystemEnabled bool `json:"system_enabled"`
	} `json:"data"`
}

func TestPasskeyStatusSeparatesCredentialAndSystemState(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.PasskeyCredential{}))

	user := &model.User{
		Username: "passkey-status-user",
		Password: "password",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}
	require.NoError(t, db.Create(user).Error)

	passkeySettings := system_setting.GetPasskeySettings()
	originalEnabled := passkeySettings.Enabled
	t.Cleanup(func() {
		passkeySettings.Enabled = originalEnabled
	})

	requestStatus := func() passkeyStatusResponse {
		recorder := httptest.NewRecorder()
		router := gin.New()
		router.Use(sessions.Sessions("session", cookie.NewStore([]byte("passkey-status-secret"))))
		router.GET("/", func(c *gin.Context) {
			session := sessions.Default(c)
			session.Set("id", user.Id)
			PasskeyStatus(c)
		})

		request := httptest.NewRequest(http.MethodGet, "/", nil)
		router.ServeHTTP(recorder, request)

		require.Equal(t, http.StatusOK, recorder.Code)
		var response passkeyStatusResponse
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
		require.True(t, response.Success)
		return response
	}

	passkeySettings.Enabled = false
	response := requestStatus()
	assert.False(t, response.Data.Enabled)
	assert.False(t, response.Data.SystemEnabled)

	passkeySettings.Enabled = true
	response = requestStatus()
	assert.False(t, response.Data.Enabled)
	assert.True(t, response.Data.SystemEnabled)

	require.NoError(t, db.Create(&model.PasskeyCredential{
		UserID:       user.Id,
		CredentialID: "credential-id",
		PublicKey:    "public-key",
	}).Error)
	passkeySettings.Enabled = false
	response = requestStatus()
	assert.True(t, response.Data.Enabled)
	assert.False(t, response.Data.SystemEnabled)
}
