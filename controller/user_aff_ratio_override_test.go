package controller

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupUserAffRatioOverrideControllerTestDB(t *testing.T) {
	t.Helper()
	oldDB := model.DB
	oldLOGDB := model.LOG_DB
	oldRedisEnabled := common.RedisEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Log{}))
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB = oldDB
		model.LOG_DB = oldLOGDB
		common.RedisEnabled = oldRedisEnabled
	})
}

func TestUpdateUserCanClearAffRatioOverride(t *testing.T) {
	setupUserAffRatioOverrideControllerTestDB(t)
	gin.SetMode(gin.TestMode)

	override := 25
	require.NoError(t, model.DB.Create(&model.User{
		Id:               1,
		Username:         "invite-owner",
		DisplayName:      "Invite Owner",
		Group:            "default",
		Role:             common.RoleCommonUser,
		Status:           common.UserStatusEnabled,
		AffCode:          "a001",
		AffRatioOverride: &override,
	}).Error)

	body := `{"id":1,"username":"invite-owner","display_name":"Invite Owner","group":"default","aff_ratio_override":null}`
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPut, "/api/user/", strings.NewReader(body))
	c.Set("role", common.RoleRootUser)
	c.Set("id", 99)
	c.Set("username", "root")

	UpdateUser(c)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"success":true`)
	var raw sql.NullInt64
	require.NoError(t, model.DB.Raw("SELECT aff_ratio_override FROM users WHERE id = ?", 1).Scan(&raw).Error)
	require.False(t, raw.Valid)
	var user model.User
	require.NoError(t, model.DB.First(&user, 1).Error)
	require.Nil(t, user.AffRatioOverride)
}

func TestUpdateUserCanSetAffRatioOverrideZero(t *testing.T) {
	setupUserAffRatioOverrideControllerTestDB(t)
	gin.SetMode(gin.TestMode)

	require.NoError(t, model.DB.Create(&model.User{
		Id:          1,
		Username:    "invite-owner",
		DisplayName: "Invite Owner",
		Group:       "default",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		AffCode:     "a001",
	}).Error)

	body := `{"id":1,"username":"invite-owner","display_name":"Invite Owner","group":"default","aff_ratio_override":0}`
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPut, "/api/user/", strings.NewReader(body))
	c.Set("role", common.RoleRootUser)
	c.Set("id", 99)
	c.Set("username", "root")

	UpdateUser(c)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"success":true`)
	var raw sql.NullInt64
	require.NoError(t, model.DB.Raw("SELECT aff_ratio_override FROM users WHERE id = ?", 1).Scan(&raw).Error)
	require.True(t, raw.Valid)
	require.Equal(t, int64(0), raw.Int64)
	var user model.User
	require.NoError(t, model.DB.First(&user, 1).Error)
	require.NotNil(t, user.AffRatioOverride)
	require.Equal(t, 0, *user.AffRatioOverride)
}
