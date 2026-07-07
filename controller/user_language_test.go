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
