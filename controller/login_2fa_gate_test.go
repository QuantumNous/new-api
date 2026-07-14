package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	appI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCompleteLoginWithTwoFAKeepsSessionPending(t *testing.T) {
	require.NoError(t, appI18n.Init())
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.TwoFA{}))

	user := &model.User{
		Username: "external-login-twofa-user",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}
	require.NoError(t, db.Create(user).Error)
	require.NoError(t, db.Create(&model.TwoFA{
		UserId:    user.Id,
		Secret:    "test-secret",
		IsEnabled: true,
	}).Error)

	router := gin.New()
	store := cookie.NewStore([]byte("test-session-secret"))
	router.Use(sessions.Sessions("session", store))
	router.GET("/login", func(c *gin.Context) {
		completeLoginWithTwoFA(user, c)
	})
	router.GET("/state", func(c *gin.Context) {
		session := sessions.Default(c)
		c.JSON(http.StatusOK, gin.H{
			"authenticated_user_id": session.Get("id"),
			"pending_user_id":       session.Get("pending_user_id"),
		})
	})

	loginRecorder := httptest.NewRecorder()
	router.ServeHTTP(loginRecorder, httptest.NewRequest(http.MethodGet, "/login", nil))
	require.Equal(t, http.StatusOK, loginRecorder.Code)

	var loginResponse struct {
		Success bool `json:"success"`
		Data    struct {
			RequireTwoFA bool `json:"require_2fa"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(loginRecorder.Body.Bytes(), &loginResponse))
	assert.True(t, loginResponse.Success)
	assert.True(t, loginResponse.Data.RequireTwoFA)

	stateRequest := httptest.NewRequest(http.MethodGet, "/state", nil)
	for _, responseCookie := range loginRecorder.Result().Cookies() {
		stateRequest.AddCookie(responseCookie)
	}
	stateRecorder := httptest.NewRecorder()
	router.ServeHTTP(stateRecorder, stateRequest)

	var state struct {
		AuthenticatedUserId *int `json:"authenticated_user_id"`
		PendingUserId       int  `json:"pending_user_id"`
	}
	require.NoError(t, common.Unmarshal(stateRecorder.Body.Bytes(), &state))
	assert.Nil(t, state.AuthenticatedUserId)
	assert.Equal(t, user.Id, state.PendingUserId)
}

func TestCompleteLoginWithTwoFARejectsDisabledUser(t *testing.T) {
	require.NoError(t, appI18n.Init())

	for _, twoFAEnabled := range []bool{false, true} {
		t.Run(fmt.Sprintf("twofa_enabled_%t", twoFAEnabled), func(t *testing.T) {
			db := setupModelListControllerTestDB(t)
			require.NoError(t, db.AutoMigrate(&model.TwoFA{}))

			user := &model.User{
				Username: "disabled-external-login-user",
				Role:     common.RoleCommonUser,
				Status:   common.UserStatusDisabled,
				Group:    "default",
			}
			require.NoError(t, db.Create(user).Error)
			if twoFAEnabled {
				require.NoError(t, db.Create(&model.TwoFA{
					UserId:    user.Id,
					Secret:    "test-secret",
					IsEnabled: true,
				}).Error)
			}

			router := gin.New()
			store := cookie.NewStore([]byte("test-session-secret"))
			router.Use(sessions.Sessions("session", store))
			router.GET("/login", func(c *gin.Context) {
				completeLoginWithTwoFA(user, c)
			})
			router.GET("/state", func(c *gin.Context) {
				session := sessions.Default(c)
				c.JSON(http.StatusOK, gin.H{
					"authenticated_user_id": session.Get("id"),
					"pending_user_id":       session.Get("pending_user_id"),
				})
			})

			loginRequest := httptest.NewRequest(http.MethodGet, "/login", nil)
			loginRequest.Header.Set("Accept-Language", appI18n.LangEn)
			loginRecorder := httptest.NewRecorder()
			router.ServeHTTP(loginRecorder, loginRequest)

			var loginResponse struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			}
			require.NoError(t, common.Unmarshal(loginRecorder.Body.Bytes(), &loginResponse))
			assert.False(t, loginResponse.Success)
			assert.Equal(t, appI18n.Translate(appI18n.LangEn, appI18n.MsgOAuthUserBanned), loginResponse.Message)

			stateRequest := httptest.NewRequest(http.MethodGet, "/state", nil)
			for _, responseCookie := range loginRecorder.Result().Cookies() {
				stateRequest.AddCookie(responseCookie)
			}
			stateRecorder := httptest.NewRecorder()
			router.ServeHTTP(stateRecorder, stateRequest)

			var state struct {
				AuthenticatedUserId *int `json:"authenticated_user_id"`
				PendingUserId       *int `json:"pending_user_id"`
			}
			require.NoError(t, common.Unmarshal(stateRecorder.Body.Bytes(), &state))
			assert.Nil(t, state.AuthenticatedUserId)
			assert.Nil(t, state.PendingUserId)
		})
	}
}

func TestSetupLoginRejectsUserDisabledWhileTwoFAIsPending(t *testing.T) {
	require.NoError(t, appI18n.Init())
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.TwoFA{}))

	user := &model.User{
		Username: "disabled-during-twofa-user",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}
	require.NoError(t, db.Create(user).Error)
	require.NoError(t, db.Create(&model.TwoFA{
		UserId:    user.Id,
		Secret:    "test-secret",
		IsEnabled: true,
	}).Error)

	router := gin.New()
	store := cookie.NewStore([]byte("test-session-secret"))
	router.Use(sessions.Sessions("session", store))
	router.GET("/login", func(c *gin.Context) {
		completeLoginWithTwoFA(user, c)
	})
	router.GET("/finish", func(c *gin.Context) {
		setupLogin(user, c)
	})
	router.GET("/state", func(c *gin.Context) {
		session := sessions.Default(c)
		c.JSON(http.StatusOK, gin.H{"authenticated_user_id": session.Get("id")})
	})

	loginRecorder := httptest.NewRecorder()
	router.ServeHTTP(loginRecorder, httptest.NewRequest(http.MethodGet, "/login", nil))
	require.Equal(t, http.StatusOK, loginRecorder.Code)

	user.Status = common.UserStatusDisabled
	require.NoError(t, db.Model(user).Update("status", user.Status).Error)
	finishRequest := httptest.NewRequest(http.MethodGet, "/finish", nil)
	finishRequest.Header.Set("Accept-Language", appI18n.LangEn)
	for _, responseCookie := range loginRecorder.Result().Cookies() {
		finishRequest.AddCookie(responseCookie)
	}
	finishRecorder := httptest.NewRecorder()
	router.ServeHTTP(finishRecorder, finishRequest)

	var finishResponse struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(finishRecorder.Body.Bytes(), &finishResponse))
	assert.False(t, finishResponse.Success)
	assert.Equal(t, appI18n.Translate(appI18n.LangEn, appI18n.MsgOAuthUserBanned), finishResponse.Message)

	stateRequest := httptest.NewRequest(http.MethodGet, "/state", nil)
	for _, responseCookie := range loginRecorder.Result().Cookies() {
		stateRequest.AddCookie(responseCookie)
	}
	for _, responseCookie := range finishRecorder.Result().Cookies() {
		stateRequest.AddCookie(responseCookie)
	}
	stateRecorder := httptest.NewRecorder()
	router.ServeHTTP(stateRecorder, stateRequest)

	var state struct {
		AuthenticatedUserId *int `json:"authenticated_user_id"`
	}
	require.NoError(t, common.Unmarshal(stateRecorder.Body.Bytes(), &state))
	assert.Nil(t, state.AuthenticatedUserId)
}
