package controller

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const fakeOAuthProviderName = "fake-regcode-provider"

// fakeOAuthProvider is a minimal built-in style provider backed by github_id.
type fakeOAuthProvider struct{}

func (p *fakeOAuthProvider) GetName() string  { return "Fake" }
func (p *fakeOAuthProvider) IsEnabled() bool  { return true }
func (p *fakeOAuthProvider) ExchangeToken(ctx context.Context, code string, c *gin.Context) (*oauth.OAuthToken, error) {
	return &oauth.OAuthToken{AccessToken: "token"}, nil
}
func (p *fakeOAuthProvider) GetUserInfo(ctx context.Context, token *oauth.OAuthToken) (*oauth.OAuthUser, error) {
	return &oauth.OAuthUser{ProviderUserID: "fake-123"}, nil
}
func (p *fakeOAuthProvider) IsUserIDTaken(providerUserID string) bool {
	var count int64
	model.DB.Model(&model.User{}).Where("github_id = ?", providerUserID).Count(&count)
	return count > 0
}
func (p *fakeOAuthProvider) FillUserByProviderID(user *model.User, providerUserID string) error {
	return model.DB.Where("github_id = ?", providerUserID).First(user).Error
}
func (p *fakeOAuthProvider) SetProviderUserID(user *model.User, providerUserID string) {
	user.GitHubId = providerUserID
}
func (p *fakeOAuthProvider) GetProviderPrefix() string { return "fake_" }

func setupOAuthRegistrationTest(t *testing.T) *gorm.DB {
	t.Helper()
	require.NoError(t, i18n.Init())
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	previousMainDatabaseType, previousLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()
	previousRegister := common.RegisterEnabled
	previousRegistrationCode := common.RegistrationCodeEnabled
	previousSecret := common.SessionSecret
	common.RedisEnabled = false
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RegisterEnabled = true
	common.RegistrationCodeEnabled = true
	common.SessionSecret = "oauth-registration-test-secret"

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB, model.LOG_DB = db, db
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.UserSession{}, &model.Log{}, &model.AuthFlow{}, &model.RegistrationCode{},
	))

	oauth.Register(fakeOAuthProviderName, &fakeOAuthProvider{})

	t.Cleanup(func() {
		oauth.Unregister(fakeOAuthProviderName)
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedisEnabled
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		common.RegisterEnabled = previousRegister
		common.RegistrationCodeEnabled = previousRegistrationCode
		common.SessionSecret = previousSecret
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func createPendingOAuthRegisterFlow(t *testing.T, providerUserID string) string {
	t.Helper()
	payload, err := common.Marshal(oauthRegisterFlowPayload{
		ProviderUserID: providerUserID,
		Username:       "fakeuser",
		DisplayName:    "Fake User",
	})
	require.NoError(t, err)
	token, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposeOAuthRegister,
		Provider:  fakeOAuthProviderName,
		Payload:   string(payload),
		ExpiresAt: time.Now().Add(10 * time.Minute),
	})
	require.NoError(t, err)
	return token
}

func performCompleteOAuthRegistration(t *testing.T, body string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/oauth/complete_registration", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	CompleteOAuthRegistration(c)
	return recorder
}

// New OAuth identities must be gated behind the registration code; existing
// users must log in directly without touching the code flow.
func TestFindOrCreateOAuthUserRegistrationCodeGate(t *testing.T) {
	db := setupOAuthRegistrationTest(t)
	provider := oauth.GetProvider(fakeOAuthProviderName)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	// New user with the switch on: sentinel error, no user created.
	_, err := findOrCreateOAuthUser(c, provider, &oauth.OAuthUser{ProviderUserID: "new-1"}, "")
	var required *OAuthRegistrationCodeRequiredError
	require.ErrorAs(t, err, &required)
	var count int64
	require.NoError(t, db.Model(&model.User{}).Count(&count).Error)
	assert.Zero(t, count)

	// The gate must not bypass RegisterEnabled.
	common.RegisterEnabled = false
	_, err = findOrCreateOAuthUser(c, provider, &oauth.OAuthUser{ProviderUserID: "new-1"}, "")
	var disabled *OAuthRegistrationDisabledError
	require.ErrorAs(t, err, &disabled)
	common.RegisterEnabled = true

	// Existing user logs in directly even with the switch on.
	existing := model.User{Username: "existing-fake", Password: "password", GitHubId: "old-1", Status: common.UserStatusEnabled, Role: common.RoleCommonUser}
	require.NoError(t, db.Create(&existing).Error)
	user, err := findOrCreateOAuthUser(c, provider, &oauth.OAuthUser{ProviderUserID: "old-1"}, "")
	require.NoError(t, err)
	assert.Equal(t, existing.Id, user.Id)
}

func TestCompleteOAuthRegistrationConsumesCodeAndFlow(t *testing.T) {
	db := setupOAuthRegistrationTest(t)
	require.NoError(t, db.Create(&model.RegistrationCode{
		Name: "oauth-code", Key: "50000000000000000000000000000001",
		Status: common.RegistrationCodeStatusUnused, CreatedTime: common.GetTimestamp(),
	}).Error)
	flowToken := createPendingOAuthRegisterFlow(t, "fake-777")

	// Wrong code: rejected, flow stays retryable, no user created.
	recorder := performCompleteOAuthRegistration(t, fmt.Sprintf(`{"flow_token":"%s","registration_code":"wrong"}`, flowToken))
	assert.Contains(t, recorder.Body.String(), `"success":false`)
	var count int64
	require.NoError(t, db.Model(&model.User{}).Count(&count).Error)
	assert.Zero(t, count, "failed completion must roll back user creation")

	// Retry with the right code on the same flow: user created, code consumed.
	recorder = performCompleteOAuthRegistration(t, fmt.Sprintf(`{"flow_token":"%s","registration_code":"50000000000000000000000000000001"}`, flowToken))
	assert.Contains(t, recorder.Body.String(), `"success":true`)

	var user model.User
	require.NoError(t, db.First(&user, "github_id = ?", "fake-777").Error)
	var code model.RegistrationCode
	require.NoError(t, db.First(&code, "name = ?", "oauth-code").Error)
	assert.Equal(t, common.RegistrationCodeStatusUsed, code.Status)
	assert.Equal(t, user.Id, code.UsedUserId)

	// The flow is consumed; replay must fail.
	recorder = performCompleteOAuthRegistration(t, fmt.Sprintf(`{"flow_token":"%s","registration_code":"50000000000000000000000000000001"}`, flowToken))
	assert.Contains(t, recorder.Body.String(), `"success":false`)
}

// Turning RegisterEnabled off must also stop pending completions.
func TestCompleteOAuthRegistrationRespectsRegisterEnabled(t *testing.T) {
	db := setupOAuthRegistrationTest(t)
	require.NoError(t, db.Create(&model.RegistrationCode{
		Name: "oauth-code", Key: "50000000000000000000000000000002",
		Status: common.RegistrationCodeStatusUnused, CreatedTime: common.GetTimestamp(),
	}).Error)
	flowToken := createPendingOAuthRegisterFlow(t, "fake-888")

	common.RegisterEnabled = false
	recorder := performCompleteOAuthRegistration(t, fmt.Sprintf(`{"flow_token":"%s","registration_code":"50000000000000000000000000000002"}`, flowToken))
	assert.Contains(t, recorder.Body.String(), `"success":false`)

	var count int64
	require.NoError(t, db.Model(&model.User{}).Count(&count).Error)
	assert.Zero(t, count)
	var code model.RegistrationCode
	require.NoError(t, db.First(&code, "name = ?", "oauth-code").Error)
	assert.Equal(t, common.RegistrationCodeStatusUnused, code.Status)
}
