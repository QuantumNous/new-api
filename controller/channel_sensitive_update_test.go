package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type channelSensitiveUpdateResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Code    string `json:"code"`
}

func setupChannelSensitiveUpdateTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false
	common.MemoryCacheEnabled = false
	common.BatchUpdateEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db

	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func seedSensitiveUpdateChannel(t *testing.T, db *gorm.DB, baseURL string) *model.Channel {
	t.Helper()

	autoBan := 1
	weight := uint(1)
	priority := int64(0)
	channel := &model.Channel{
		Type:     constant.ChannelTypeOpenAI,
		Key:      "sk-upstream-secret-poc",
		Status:   common.ChannelStatusEnabled,
		Name:     "origin",
		Models:   "gpt-4o",
		Group:    "default",
		BaseURL:  common.GetPointer(baseURL),
		AutoBan:  &autoBan,
		Weight:   &weight,
		Priority: &priority,
	}
	require.NoError(t, db.Create(channel).Error)
	return channel
}

func serveUpdateChannelForRole(t *testing.T, role int, secureVerified bool, body any) (*httptest.ResponseRecorder, channelSensitiveUpdateResponse) {
	t.Helper()

	payload, err := common.Marshal(body)
	require.NoError(t, err)

	router := gin.New()
	router.Use(sessions.Sessions("new-api-test", cookie.NewStore([]byte("channel-sensitive-update-test"))))
	router.PUT("/api/channel/", func(c *gin.Context) {
		c.Set("id", 1)
		c.Set("role", role)
		if secureVerified {
			session := sessions.Default(c)
			session.Set(middleware.SecureVerificationSessionKey, time.Now().Unix())
			require.NoError(t, session.Save())
		}
		UpdateChannel(c)
	})

	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/api/channel/", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, req)

	var response channelSensitiveUpdateResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return recorder, response
}

func TestAdminCanUpdateNonSensitiveChannelFields(t *testing.T) {
	db := setupChannelSensitiveUpdateTestDB(t)
	channel := seedSensitiveUpdateChannel(t, db, "https://origin.example.com")

	_, response := serveUpdateChannelForRole(t, common.RoleAdminUser, false, map[string]any{
		"id":     channel.Id,
		"type":   channel.Type,
		"name":   "renamed",
		"models": "gpt-4o,gpt-4.1",
		"group":  "default",
	})

	require.True(t, response.Success, response.Message)

	reloaded, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	require.Equal(t, "renamed", reloaded.Name)
	require.Equal(t, "gpt-4o,gpt-4.1", reloaded.Models)
	require.Equal(t, "sk-upstream-secret-poc", reloaded.Key)
	require.Equal(t, "https://origin.example.com", reloaded.GetBaseURL())
}

func TestAdminCannotRetargetChannelBaseURLWithExistingKey(t *testing.T) {
	db := setupChannelSensitiveUpdateTestDB(t)
	channel := seedSensitiveUpdateChannel(t, db, "https://origin.example.com")

	recorder, response := serveUpdateChannelForRole(t, common.RoleAdminUser, false, map[string]any{
		"id":       channel.Id,
		"type":     channel.Type,
		"name":     channel.Name,
		"models":   channel.Models,
		"group":    channel.Group,
		"base_url": "https://attacker.example.com",
	})

	require.Equal(t, http.StatusForbidden, recorder.Code)
	require.False(t, response.Success)
	require.Equal(t, channelSensitiveUpdateRequiresRootCode, response.Code)

	reloaded, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	require.Equal(t, "sk-upstream-secret-poc", reloaded.Key)
	require.Equal(t, "https://origin.example.com", reloaded.GetBaseURL())
}

func TestAdminCannotChangeChannelTypeWithExistingKey(t *testing.T) {
	db := setupChannelSensitiveUpdateTestDB(t)
	channel := seedSensitiveUpdateChannel(t, db, "https://origin.example.com")

	recorder, response := serveUpdateChannelForRole(t, common.RoleAdminUser, false, map[string]any{
		"id":     channel.Id,
		"type":   constant.ChannelTypeGemini,
		"name":   channel.Name,
		"models": channel.Models,
		"group":  channel.Group,
	})

	require.Equal(t, http.StatusForbidden, recorder.Code)
	require.False(t, response.Success)
	require.Equal(t, channelSensitiveUpdateRequiresRootCode, response.Code)

	reloaded, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	require.Equal(t, constant.ChannelTypeOpenAI, reloaded.Type)
	require.Equal(t, "sk-upstream-secret-poc", reloaded.Key)
}

func TestAdminCannotSetHeaderOverrideWithAPIKeyPlaceholder(t *testing.T) {
	db := setupChannelSensitiveUpdateTestDB(t)
	channel := seedSensitiveUpdateChannel(t, db, "https://origin.example.com")
	headerOverride := `{"X-Leaked-Key":"{api_key}"}`

	recorder, response := serveUpdateChannelForRole(t, common.RoleAdminUser, false, map[string]any{
		"id":              channel.Id,
		"type":            channel.Type,
		"name":            channel.Name,
		"models":          channel.Models,
		"group":           channel.Group,
		"header_override": headerOverride,
	})

	require.Equal(t, http.StatusForbidden, recorder.Code)
	require.False(t, response.Success)
	require.Equal(t, channelSensitiveUpdateRequiresRootCode, response.Code)

	reloaded, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	require.Nil(t, reloaded.HeaderOverride)
}

func TestRootMustPassSecureVerificationForSensitiveChannelUpdate(t *testing.T) {
	db := setupChannelSensitiveUpdateTestDB(t)
	channel := seedSensitiveUpdateChannel(t, db, "https://origin.example.com")

	recorder, response := serveUpdateChannelForRole(t, common.RoleRootUser, false, map[string]any{
		"id":       channel.Id,
		"type":     channel.Type,
		"name":     channel.Name,
		"models":   channel.Models,
		"group":    channel.Group,
		"base_url": "https://verified.example.com",
	})

	require.Equal(t, http.StatusForbidden, recorder.Code)
	require.False(t, response.Success)
	require.Equal(t, channelSensitiveUpdateRequiresVerificationCode, response.Code)

	_, response = serveUpdateChannelForRole(t, common.RoleRootUser, true, map[string]any{
		"id":       channel.Id,
		"type":     channel.Type,
		"name":     channel.Name,
		"models":   channel.Models,
		"group":    channel.Group,
		"base_url": "https://verified.example.com",
	})

	require.True(t, response.Success, response.Message)

	reloaded, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	require.Equal(t, "sk-upstream-secret-poc", reloaded.Key)
	require.Equal(t, "https://verified.example.com", reloaded.GetBaseURL())
}

func TestKeyFingerprintDoesNotExposeKeyPrefix(t *testing.T) {
	fingerprint := keyFingerprint("sk-upstream-secret-poc")

	require.NotContains(t, fingerprint, "sk-upstream")
	require.NotContains(t, fingerprint, "secret")
	require.Regexp(t, `^sha256:[0-9a-f]{12}$`, fingerprint)
}
