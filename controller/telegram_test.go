package controller

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
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
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestVerifyTelegramAuthorization(t *testing.T) {
	const token = "telegram-test-token"
	now := time.Unix(1_700_000_000, 0)

	tests := []struct {
		name     string
		authDate time.Time
		mutate   func(url.Values)
		wantID   string
		wantErr  string
	}{
		{name: "valid", authDate: now, wantID: "123456"},
		{name: "small future clock skew", authDate: now.Add(90 * time.Second), wantID: "123456"},
		{name: "expired", authDate: now.Add(-telegramAuthorizationMaxAge - time.Second), wantErr: "expired"},
		{name: "too far in future", authDate: now.Add(telegramAuthorizationFutureSkew + time.Second), wantErr: "expired"},
		{name: "invalid signature", authDate: now, mutate: func(values url.Values) { values.Set("hash", "00") }, wantErr: "signature"},
		{name: "unsigned flow token query is rejected", authDate: now, mutate: func(values url.Values) { values.Set("flow_token", "must-be-in-path") }, wantErr: "signature"},
		{name: "duplicate parameter", authDate: now, mutate: func(values url.Values) { values["id"] = append(values["id"], "654321") }, wantErr: "duplicate"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			params := signedTelegramAuthorization(token, tt.authDate)
			if tt.mutate != nil {
				tt.mutate(params)
			}

			telegramID, err := verifyTelegramAuthorization(params, token, now)
			if tt.wantErr != "" {
				require.Error(t, err)
				assert.ErrorContains(t, err, tt.wantErr)
				assert.Empty(t, telegramID)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.wantID, telegramID)
		})
	}
}

func signedTelegramAuthorization(token string, authDate time.Time) url.Values {
	params := url.Values{
		"auth_date":  {strconv.FormatInt(authDate.Unix(), 10)},
		"first_name": {"Test"},
		"id":         {"123456"},
	}
	signTelegramAuthorization(token, params)
	return params
}

func signTelegramAuthorization(token string, params url.Values) {
	keys := make([]string, 0, len(params))
	for key := range params {
		if key == "hash" {
			continue
		}
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
}

func TestTelegramBindCommitsFlowAssertionAndBindingAtomically(t *testing.T) {
	previousDB := model.DB
	previousType := common.MainDatabaseType()
	previousRedis := common.RedisEnabled
	previousEnabled := common.TelegramOAuthEnabled
	previousToken := common.TelegramBotToken
	previousSecret := common.SessionSecret
	previousTheme := common.GetTheme()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.UserSession{},
		&model.AuthFlow{},
		&model.ExternalIdentityClaim{},
	))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.TelegramOAuthEnabled = true
	common.TelegramBotToken = "telegram-bind-test-token"
	common.SessionSecret = "telegram-bind-session-secret"
	common.SetTheme("default")
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousType)
		common.RedisEnabled = previousRedis
		common.TelegramOAuthEnabled = previousEnabled
		common.TelegramBotToken = previousToken
		common.SessionSecret = previousSecret
		common.SetTheme(previousTheme)
	})

	user := &model.User{
		Username: "telegram-bind-user", Password: "password-placeholder", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "telegram-bind-user",
	}
	require.NoError(t, db.Create(user).Error)
	now := time.Now()
	session := &model.UserSession{
		SID: "telegram-bind-session", UserID: user.Id, Version: 1, UserAuthVersion: user.AuthVersion,
		Status: model.UserSessionStatusActive, RefreshHash: "refresh-hash", LoginMethod: "password",
		CreatedAt: now.Unix(), LastActiveAt: now.Unix(), ExpiresAt: now.Add(time.Hour).Unix(),
	}
	require.NoError(t, model.CreateUserSession(session))
	flowToken, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose: model.AuthFlowPurposeTelegramBind, UserId: user.Id, SessionId: session.SID,
		ExpiresAt: now.Add(time.Minute),
	})
	require.NoError(t, err)
	params := signedTelegramAuthorization(common.TelegramBotToken, now)
	router := gin.New()
	router.GET("/api/oauth/telegram/bind/:flow_token", TelegramBind)
	request := httptest.NewRequest(http.MethodGet, "/api/oauth/telegram/bind/"+flowToken+"?"+params.Encode(), nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusFound, response.Code)
	var storedUser model.User
	require.NoError(t, db.First(&storedUser, user.Id).Error)
	assert.Equal(t, "123456", storedUser.TelegramId)
	var identityClaim model.ExternalIdentityClaim
	require.NoError(t, db.Where("provider = ? AND subject = ?", model.ExternalIdentityProviderTelegram, "123456").
		First(&identityClaim).Error)
	assert.Equal(t, user.Id, identityClaim.UserId)
	_, err = model.GetAuthFlow(flowToken, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeTelegramBind})
	assert.ErrorIs(t, err, model.ErrAuthFlowConsumed)

	replayFlowToken, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose: model.AuthFlowPurposeTelegramBind, UserId: user.Id, SessionId: session.SID,
		ExpiresAt: now.Add(time.Minute),
	})
	require.NoError(t, err)
	request = httptest.NewRequest(http.MethodGet, "/api/oauth/telegram/bind/"+replayFlowToken+"?"+params.Encode(), nil)
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	assert.Equal(t, http.StatusForbidden, response.Code)
	replayFlow, err := model.GetAuthFlow(replayFlowToken, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeTelegramBind})
	require.NoError(t, err)
	assert.Nil(t, replayFlow.ConsumedAt)

	competingUser := &model.User{
		Username: "telegram-bind-competing-user", Password: "password-placeholder", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "telegram-bind-competing-user",
	}
	require.NoError(t, db.Create(competingUser).Error)
	competingSession := &model.UserSession{
		SID: "telegram-bind-competing-session", UserID: competingUser.Id, Version: 1,
		UserAuthVersion: competingUser.AuthVersion, Status: model.UserSessionStatusActive,
		RefreshHash: "competing-refresh-hash", LoginMethod: "password",
		CreatedAt: now.Unix(), LastActiveAt: now.Unix(), ExpiresAt: now.Add(time.Hour).Unix(),
	}
	require.NoError(t, model.CreateUserSession(competingSession))
	competingFlowToken, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose: model.AuthFlowPurposeTelegramBind, UserId: competingUser.Id, SessionId: competingSession.SID,
		ExpiresAt: now.Add(time.Minute),
	})
	require.NoError(t, err)
	competingParams := signedTelegramAuthorization(common.TelegramBotToken, now)
	competingParams.Set("first_name", "Competing")
	signTelegramAuthorization(common.TelegramBotToken, competingParams)
	request = httptest.NewRequest(
		http.MethodGet,
		"/api/oauth/telegram/bind/"+competingFlowToken+"?"+competingParams.Encode(),
		nil,
	)
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	assert.Equal(t, http.StatusOK, response.Code)

	require.NoError(t, db.First(competingUser, competingUser.Id).Error)
	assert.Empty(t, competingUser.TelegramId)
	competingFlow, err := model.GetAuthFlow(competingFlowToken, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeTelegramBind})
	require.NoError(t, err)
	assert.Nil(t, competingFlow.ConsumedAt)
	competingAssertion, competingAssertionExpiry, err := telegramAuthorizationClaim(competingParams, time.Now())
	require.NoError(t, err)
	require.NoError(t, model.ClaimExternalAuthAssertion(
		model.AuthFlowPurposeTelegramAssertion,
		competingAssertion,
		competingAssertionExpiry,
	))
}
