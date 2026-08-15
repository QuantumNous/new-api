package controller

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
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

func setupAccountCenterControllerTest(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousMainType := common.MainDatabaseType()
	previousLogType := common.LogDatabaseType()
	previousRedisEnabled := common.RedisEnabled

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.ExternalIdentityClaim{}))
	model.DB = db
	model.LOG_DB = db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	t.Cleanup(func() {
		sqlDB, closeErr := db.DB()
		if closeErr == nil {
			_ = sqlDB.Close()
		}
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.SetDatabaseTypes(previousMainType, previousLogType)
		common.RedisEnabled = previousRedisEnabled
	})
	return db
}

func TestAccountCenterOverviewReturnsOnlyTheMatchingOidcUsersApiWallet(t *testing.T) {
	db := setupAccountCenterControllerTest(t)
	user := &model.User{
		Username: "account-center-user", Password: "password", OidcId: "oidc-account-center-subject",
		Quota: 750_000, UsedQuota: 12_345, RequestCount: 8,
	}
	require.NoError(t, db.Create(user).Error)
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return model.ClaimExternalIdentityWithTx(tx, model.ExternalIdentityProviderOIDC, user.OidcId, user.Id)
	}))
	setAccountCenterEnv(t, accountCenterSecretEnv, "account-center-test-secret-with-at-least-thirty-two-bytes")

	body, err := common.Marshal(accountCenterOverviewRequest{Subject: "oidc-account-center-subject"})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = signedAccountCenterRequest(t, body, "account-center-test-secret-with-at-least-thirty-two-bytes")

	GetAccountCenterOverview(context)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			Registered   bool `json:"registered"`
			Quota        int  `json:"quota"`
			UsedQuota    int  `json:"used_quota"`
			RequestCount int  `json:"request_count"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.True(t, response.Data.Registered)
	assert.Equal(t, 750_000, response.Data.Quota)
	assert.Equal(t, 12_345, response.Data.UsedQuota)
	assert.Equal(t, 8, response.Data.RequestCount)
}

func TestAccountCenterOverviewRejectsAnUnsignedRequest(t *testing.T) {
	setupAccountCenterControllerTest(t)
	setAccountCenterEnv(t, accountCenterSecretEnv, "account-center-test-secret-with-at-least-thirty-two-bytes")
	body, err := common.Marshal(accountCenterOverviewRequest{Subject: "oidc-account-center-subject"})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPost, "/api/internal/account/overview", bytes.NewReader(body))
	context.Request.Header.Set("Content-Type", "application/json")

	GetAccountCenterOverview(context)

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
}

func TestAccountCenterOverviewReportsAnUnregisteredOidcSubjectWithoutLeakingAnotherUser(t *testing.T) {
	db := setupAccountCenterControllerTest(t)
	user := &model.User{
		Username: "another-account-center-user", Password: "password", OidcId: "different-oidc-subject",
		Quota: 99_999, UsedQuota: 12, RequestCount: 2,
	}
	require.NoError(t, db.Create(user).Error)
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return model.ClaimExternalIdentityWithTx(tx, model.ExternalIdentityProviderOIDC, user.OidcId, user.Id)
	}))
	setAccountCenterEnv(t, accountCenterSecretEnv, "account-center-test-secret-with-at-least-thirty-two-bytes")
	body, err := common.Marshal(accountCenterOverviewRequest{Subject: "not-yet-registered-subject"})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = signedAccountCenterRequest(t, body, "account-center-test-secret-with-at-least-thirty-two-bytes")

	GetAccountCenterOverview(context)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			Registered   bool `json:"registered"`
			Quota        int  `json:"quota"`
			UsedQuota    int  `json:"used_quota"`
			RequestCount int  `json:"request_count"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.False(t, response.Data.Registered)
	assert.Zero(t, response.Data.Quota)
	assert.Zero(t, response.Data.UsedQuota)
	assert.Zero(t, response.Data.RequestCount)
}

func TestAccountCenterOverviewIsDisabledWithoutASecret(t *testing.T) {
	setupAccountCenterControllerTest(t)
	t.Setenv(accountCenterSecretEnv, "too-short")
	body, err := common.Marshal(accountCenterOverviewRequest{Subject: "oidc-account-center-subject"})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = signedAccountCenterRequest(t, body, "account-center-test-secret-with-at-least-thirty-two-bytes")

	GetAccountCenterOverview(context)

	assert.Equal(t, http.StatusNotFound, recorder.Code)
}

func TestAccountCenterRedirectUsesOnlyTheConfiguredHttpsTarget(t *testing.T) {
	setAccountCenterEnv(t, accountCenterPublicURLEnv, "https://store.example.test/account")
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/account-center", nil)

	RedirectToAccountCenter(context)

	assert.Equal(t, http.StatusFound, recorder.Code)
	assert.Equal(t, "https://store.example.test/account", recorder.Header().Get("Location"))
	assert.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
}

func TestAccountCenterRedirectIsDisabledWithoutHttpsTarget(t *testing.T) {
	t.Setenv(accountCenterPublicURLEnv, "http://insecure.example.test/account")
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/account-center", nil)

	RedirectToAccountCenter(context)

	assert.Equal(t, http.StatusNotFound, recorder.Code)
}

func signedAccountCenterRequest(t *testing.T, body []byte, secret string) *http.Request {
	t.Helper()
	request := httptest.NewRequest(http.MethodPost, "/api/internal/account/overview", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	timestamp := time.Now().UTC().Format(time.RFC3339Nano)
	request.Header.Set(accountCenterTimestamp, timestamp)
	digest := sha256.Sum256(body)
	payload := timestamp + "\n" + request.Method + "\n" + request.URL.EscapedPath() + "\n" + hex.EncodeToString(digest[:])
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(payload))
	request.Header.Set(accountCenterSignature, hex.EncodeToString(mac.Sum(nil)))
	return request
}

func setAccountCenterEnv(t *testing.T, key string, value string) {
	t.Helper()
	t.Setenv(key, value)
}
