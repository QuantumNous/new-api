package controller

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestTelegramLoginWithValidUnboundIdentityDoesNotCreateUser(t *testing.T) {
	oldDB, oldLogDB := model.DB, model.LOG_DB
	oldMainDatabaseType, oldLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()
	oldTelegramOAuthEnabled, oldTelegramBotToken := common.TelegramOAuthEnabled, common.TelegramBotToken

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.AuthIdentity{}))
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.TelegramOAuthEnabled = true
	common.TelegramBotToken = "telegram-registration-boundary-token"

	t.Cleanup(func() {
		common.TelegramOAuthEnabled = oldTelegramOAuthEnabled
		common.TelegramBotToken = oldTelegramBotToken
		model.DB, model.LOG_DB = oldDB, oldLogDB
		common.SetDatabaseTypes(oldMainDatabaseType, oldLogDatabaseType)
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})

	existingUser := &model.User{
		Username: "existing-telegram-user",
		Password: "password-hash",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(existingUser).Error)

	var countBefore int64
	require.NoError(t, db.Model(&model.User{}).Count(&countBefore).Error)

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("telegram-registration-boundary-session"))))
	engine.GET("/api/oauth/telegram/login", TelegramLogin)

	query := signedTelegramLoginBoundaryQuery(
		common.TelegramBotToken,
		"987654321",
		time.Now(),
	)
	request := httptest.NewRequest(http.MethodGet, "/api/oauth/telegram/login?"+query.Encode(), nil)
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, request)

	var payload struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
	assert.Equal(t, http.StatusOK, response.Code)
	assert.False(t, payload.Success)
	assert.Contains(t, payload.Message, "未绑定")

	var countAfter int64
	require.NoError(t, db.Model(&model.User{}).Count(&countAfter).Error)
	assert.Equal(t, countBefore, countAfter)

	var matchingUsers int64
	require.NoError(t, db.Model(&model.User{}).Where("telegram_id = ?", "987654321").Count(&matchingUsers).Error)
	assert.Zero(t, matchingUsers)
}

func signedTelegramLoginBoundaryQuery(token string, telegramID string, authDate time.Time) url.Values {
	params := url.Values{
		"auth_date":  {strconv.FormatInt(authDate.Unix(), 10)},
		"first_name": {"Boundary"},
		"id":         {telegramID},
	}
	keys := make([]string, 0, len(params))
	for key := range params {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	dataCheck := make([]string, 0, len(keys))
	for _, key := range keys {
		dataCheck = append(dataCheck, key+"="+params.Get(key))
	}
	secret := sha256.Sum256([]byte(token))
	mac := hmac.New(sha256.New, secret[:])
	_, _ = mac.Write([]byte(strings.Join(dataCheck, "\n")))
	params.Set("hash", hex.EncodeToString(mac.Sum(nil)))
	return params
}
