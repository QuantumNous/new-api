package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestResolvePlaygroundUsingGroupForcesPlgUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("group", plgGroup)

	group, err := resolvePlaygroundUsingGroup(c, "", "default")

	require.NoError(t, err)
	require.Equal(t, plgGroup, group)
}

func TestResolvePlaygroundUsingGroupUsesContextUserGroupFallback(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set(string(constant.ContextKeyUserGroup), "Enterprise")

	group, err := resolvePlaygroundUsingGroup(c, "", "")

	require.NoError(t, err)
	require.Equal(t, "Enterprise", group)
}

func TestResolvePlaygroundUsingGroupDoesNotTreatPlgTokenAsPlgUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("group", plgGroup)
	c.Set(string(constant.ContextKeyUserGroup), "Enterprise")

	group, err := resolvePlaygroundUsingGroup(c, plgGroup, "default")

	require.NoError(t, err)
	require.Equal(t, "default", group)
}

func TestGetModelRequestGenerationTasksSubmit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/generation/tasks", strings.NewReader(`{"model":"doubao/doubao-seedance-2-0-260128"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	modelRequest, shouldSelectChannel, err := getModelRequest(c)

	require.NoError(t, err)
	require.True(t, shouldSelectChannel)
	require.Equal(t, "doubao/doubao-seedance-2-0-260128", modelRequest.Model)
	relayMode, ok := c.Get("relay_mode")
	require.True(t, ok)
	require.Equal(t, relayconstant.RelayModeVideoSubmit, relayMode)
}

func TestGetModelRequestGenerationTasksFetch(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/generation/tasks/task_abc", nil)

	_, shouldSelectChannel, err := getModelRequest(c)

	require.NoError(t, err)
	require.False(t, shouldSelectChannel)
	relayMode, ok := c.Get("relay_mode")
	require.True(t, ok)
	require.Equal(t, relayconstant.RelayModeVideoFetchByID, relayMode)
}

func TestResolvePlaygroundUsingGroupDoesNotExpandAccessFromTokenGroup(t *testing.T) {
	gin.SetMode(gin.TestMode)
	special := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup
	originalSpecial := special.ReadAll()
	special.Clear()
	special.AddAll(map[string]map[string]string{
		"vip": {
			"token-only": "token-only",
		},
	})
	t.Cleanup(func() {
		special.Clear()
		special.AddAll(originalSpecial)
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("group", "vip")
	c.Set(string(constant.ContextKeyUserGroup), "Enterprise")

	group, err := resolvePlaygroundUsingGroup(c, "vip", "token-only")

	require.Error(t, err)
	require.Empty(t, group)
}

func TestResolvePlaygroundUsingGroupLoadsAuthoritativeUserGroup(t *testing.T) {
	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	originalDB := model.DB
	model.DB = db
	t.Cleanup(func() {
		model.DB = originalDB
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})
	require.NoError(t, db.AutoMigrate(&model.User{}))
	require.NoError(t, db.Create(&model.User{
		Id:          31,
		Username:    "plg-user",
		Password:    "password123",
		DisplayName: "PLG User",
		Group:       plgGroup,
		Status:      common.UserStatusEnabled,
	}).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("id", 31)

	group, err := resolvePlaygroundUsingGroup(c, "", "default")

	require.NoError(t, err)
	require.Equal(t, plgGroup, group)
}

func TestResolvePlaygroundUsingGroupPrefersAuthoritativeUserGroup(t *testing.T) {
	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	originalDB := model.DB
	model.DB = db
	t.Cleanup(func() {
		model.DB = originalDB
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})
	require.NoError(t, db.AutoMigrate(&model.User{}))
	require.NoError(t, db.Create(&model.User{
		Id:          32,
		Username:    "enterprise-user",
		Password:    "password123",
		DisplayName: "Enterprise User",
		Group:       "Enterprise",
		Status:      common.UserStatusEnabled,
	}).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("id", 32)
	c.Set("group", plgGroup)
	c.Set(string(constant.ContextKeyUserGroup), plgGroup)

	group, err := resolvePlaygroundUsingGroup(c, plgGroup, "default")

	require.NoError(t, err)
	require.Equal(t, "default", group)
}
