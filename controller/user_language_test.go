package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupUserLanguageControllerTestDB(t *testing.T) {
	t.Helper()

	originalDB := model.DB
	originalRedisEnabled := common.RedisEnabled
	t.Cleanup(func() {
		model.DB = originalDB
		common.RedisEnabled = originalRedisEnabled
	})

	common.RedisEnabled = false
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	model.DB = db
	gin.SetMode(gin.TestMode)
}

func newUserLanguageRequestContext(t *testing.T, body string, userID int) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", userID)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/user/self", bytes.NewBufferString(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	return ctx, recorder
}

func TestUpdateSelfNormalizesSupportedLanguage(t *testing.T) {
	setupUserLanguageControllerTestDB(t)
	user := model.User{Id: 101, Username: "language-user", Password: "hashed", Status: common.UserStatusEnabled}
	require.NoError(t, model.DB.Create(&user).Error)

	ctx, recorder := newUserLanguageRequestContext(t, `{"language":"zh-CN"}`, user.Id)
	UpdateSelf(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var fresh model.User
	require.NoError(t, model.DB.First(&fresh, user.Id).Error)
	require.Equal(t, "zh", fresh.GetSetting().Language)
}

func TestUpdateSelfRejectsUnsupportedLanguage(t *testing.T) {
	setupUserLanguageControllerTestDB(t)
	user := model.User{Id: 102, Username: "invalid-language-user", Password: "hashed", Status: common.UserStatusEnabled}
	user.SetSetting(dto.UserSetting{Language: "en"})
	require.NoError(t, model.DB.Create(&user).Error)

	ctx, recorder := newUserLanguageRequestContext(t, `{"language":"de"}`, user.Id)
	UpdateSelf(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.False(t, response.Success)
	var fresh model.User
	require.NoError(t, model.DB.First(&fresh, user.Id).Error)
	require.Equal(t, "en", fresh.GetSetting().Language)
}

func TestUpdateUserSettingPreservesLanguagePreference(t *testing.T) {
	setupUserLanguageControllerTestDB(t)
	user := model.User{Id: 103, Username: "settings-user", Password: "hashed", Status: common.UserStatusEnabled}
	user.SetSetting(dto.UserSetting{Language: "pt"})
	require.NoError(t, model.DB.Create(&user).Error)

	ctx, recorder := newUserLanguageRequestContext(t, `{"notify_type":"email","quota_warning_threshold":1,"notification_email":"ops@example.com"}`, user.Id)
	UpdateUserSetting(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var fresh model.User
	require.NoError(t, model.DB.First(&fresh, user.Id).Error)
	require.Equal(t, "pt", fresh.GetSetting().Language)
	require.Equal(t, dto.NotifyTypeEmail, fresh.GetSetting().NotifyType)
}

func TestSearchUsersFiltersByLanguagePreference(t *testing.T) {
	setupUserLanguageControllerTestDB(t)

	jaUser := model.User{Id: 201, Username: "ja-language-user", Password: "hashed", Status: common.UserStatusEnabled, AffCode: "ja01"}
	jaUser.SetSetting(dto.UserSetting{Language: "ja"})
	enUser := model.User{Id: 202, Username: "en-language-user", Password: "hashed", Status: common.UserStatusEnabled, AffCode: "en01"}
	enUser.SetSetting(dto.UserSetting{Language: "en"})
	noLanguageUser := model.User{Id: 203, Username: "no-language-user", Password: "hashed", Status: common.UserStatusEnabled, AffCode: "no01"}
	require.NoError(t, model.DB.Create(&[]model.User{jaUser, enUser, noLanguageUser}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/search?language=ja&p=1&page_size=20", nil)

	SearchUsers(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			Items []model.User `json:"items"`
			Total int          `json:"total"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Equal(t, 1, response.Data.Total)
	require.Len(t, response.Data.Items, 1)
	require.Equal(t, "ja-language-user", response.Data.Items[0].Username)
	require.Equal(t, "ja", response.Data.Items[0].GetSetting().Language)
}
