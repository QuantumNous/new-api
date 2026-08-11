package controller

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type invitationOAuthProvider struct {
	name   string
	prefix string
}

func (provider invitationOAuthProvider) GetName() string { return provider.name }
func (invitationOAuthProvider) IsEnabled() bool          { return true }
func (invitationOAuthProvider) ExchangeToken(context.Context, string, *gin.Context) (*oauth.OAuthToken, error) {
	return &oauth.OAuthToken{}, nil
}
func (invitationOAuthProvider) GetUserInfo(context.Context, *oauth.OAuthToken) (*oauth.OAuthUser, error) {
	return &oauth.OAuthUser{}, nil
}
func (invitationOAuthProvider) IsUserIDTaken(string) bool { return false }
func (invitationOAuthProvider) FillUserByProviderID(*model.User, string) error {
	return gorm.ErrRecordNotFound
}
func (invitationOAuthProvider) SetProviderUserID(*model.User, string) {}
func (provider invitationOAuthProvider) GetProviderPrefix() string    { return provider.prefix }

func setupOAuthInvitationTest(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousRedis := common.RedisEnabled
	previousMainType, previousLogType := common.MainDatabaseType(), common.LogDatabaseType()
	previousSettings := common.GetInvitationCodeSettings()
	previousOptionMap := common.OptionMap
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.AuthIdentity{},
		&model.AuthFlow{},
		&model.InvitationCode{},
		&model.Option{},
		&model.Log{},
	))
	model.DB, model.LOG_DB = db, db
	common.RedisEnabled = false
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.OptionMap = make(map[string]string)
	_, err = model.UpdateInvitationCodeSettings(false, []string{common.InvitationRegistrationMethodLinuxDO})
	require.NoError(t, err)
	t.Cleanup(func() {
		_, settingsErr := common.ApplyInvitationCodeSettings(previousSettings.Required, previousSettings.Methods)
		require.NoError(t, settingsErr)
		common.OptionMap = previousOptionMap
		common.RedisEnabled = previousRedis
		common.SetDatabaseTypes(previousMainType, previousLogType)
		model.DB, model.LOG_DB = previousDB, previousLogDB
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})
	return db
}

func createOAuthFlowForInvitation(t *testing.T, body string, query string, configureContext func(*gin.Context)) (*httptest.ResponseRecorder, *model.AuthFlow, oauthFlowPayload) {
	t.Helper()
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPost, "/api/oauth/state"+query, strings.NewReader(body))
	context.Request.Header.Set("Content-Type", "application/json")
	if configureContext != nil {
		configureContext(context)
	}
	GenerateOAuthCode(context)

	var response struct {
		Success bool `json:"success"`
		Data    struct {
			FlowToken string `json:"flow_token"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	if !response.Success {
		return recorder, nil, oauthFlowPayload{}
	}
	flow, err := model.GetAuthFlow(response.Data.FlowToken, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeOAuth})
	require.NoError(t, err)
	var payload oauthFlowPayload
	require.NoError(t, common.UnmarshalJsonStr(flow.Payload, &payload))
	return recorder, flow, payload
}

func TestOAuthLoginFlowStoresOnlyServerSideInvitationReference(t *testing.T) {
	db := setupOAuthInvitationTest(t)
	providerName := "invitation-flow-test"
	oauth.Register(providerName, invitationOAuthProvider{name: "Invitation Flow", prefix: "invitation_"})
	t.Cleanup(func() { oauth.Unregister(providerName) })
	codes, err := model.CreateInvitationCodes("oauth-flow", 1, 1, 0)
	require.NoError(t, err)
	rawCode := codes[0]

	recorder, flow, payload := createOAuthFlowForInvitation(t,
		fmt.Sprintf(`{"provider":%q,"intent":"login","aff":"AFF","invitation_code":%q}`, providerName, rawCode),
		"",
		nil,
	)
	require.NotNil(t, flow)
	assert.True(t, payload.InvitationSupplied)
	assert.Positive(t, payload.InvitationCodeID)
	assert.Equal(t, "AFF", payload.AffiliateCode)
	assert.NotContains(t, flow.Payload, rawCode)
	assert.NotContains(t, recorder.Body.String(), rawCode)
	var storedFlow model.AuthFlow
	require.NoError(t, db.First(&storedFlow, flow.Id).Error)
	assert.NotContains(t, storedFlow.Payload, rawCode)

	_, invalidFlow, invalidPayload := createOAuthFlowForInvitation(t,
		fmt.Sprintf(`{"provider":%q,"intent":"login","invitation_code":"INV-NOT-FOUND"}`, providerName),
		"",
		nil,
	)
	require.NotNil(t, invalidFlow)
	assert.True(t, invalidPayload.InvitationSupplied)
	assert.Zero(t, invalidPayload.InvitationCodeID)
	assert.NotContains(t, invalidFlow.Payload, "INV-NOT-FOUND")

	_, missingFlow, missingPayload := createOAuthFlowForInvitation(t,
		fmt.Sprintf(`{"provider":%q,"intent":"login"}`, providerName),
		"",
		nil,
	)
	require.NotNil(t, missingFlow)
	assert.False(t, missingPayload.InvitationSupplied)
	assert.Zero(t, missingPayload.InvitationCodeID)
}

func TestOAuthInvitationIsRejectedFromQueryAndIgnoredForBindIntent(t *testing.T) {
	setupOAuthInvitationTest(t)
	providerName := "invitation-bind-test"
	oauth.Register(providerName, invitationOAuthProvider{name: "Invitation Bind", prefix: "bind_"})
	t.Cleanup(func() { oauth.Unregister(providerName) })

	recorder, flow, _ := createOAuthFlowForInvitation(t,
		fmt.Sprintf(`{"provider":%q,"intent":"login"}`, providerName),
		"?invitation_code=INV-PLAINTEXT",
		nil,
	)
	assert.Nil(t, flow)
	var rejected struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &rejected))
	assert.False(t, rejected.Success)

	_, bindFlow, bindPayload := createOAuthFlowForInvitation(t,
		fmt.Sprintf(`{"provider":%q,"intent":"bind","invitation_code":"INV-PLAINTEXT"}`, providerName),
		"",
		func(context *gin.Context) {
			context.Set("id", 42)
			context.Set("session_id", "session-42")
			context.Set("auth_version", int64(1))
			context.Set("session_version", int64(1))
		},
	)
	require.NotNil(t, bindFlow)
	assert.False(t, bindPayload.InvitationSupplied)
	assert.Zero(t, bindPayload.InvitationCodeID)
	assert.NotContains(t, bindFlow.Payload, "INV-PLAINTEXT")
}

func TestExistingOAuthIdentityIgnoresInvitationRequirement(t *testing.T) {
	db := setupOAuthInvitationTest(t)
	_, err := model.UpdateInvitationCodeSettings(true, []string{common.InvitationRegistrationMethodLinuxDO})
	require.NoError(t, err)
	codes, err := model.CreateInvitationCodes("existing", 1, 1, 0)
	require.NoError(t, err)
	user := &model.User{Username: "existing-oauth", DisplayName: "Existing", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	require.NoError(t, model.EnsureAuthIdentity(user.Id, model.AuthIdentityProviderLinuxDO, "existing-subject"))

	found, err := findOrCreateOAuthUser(
		common.InvitationRegistrationMethodLinuxDO,
		invitationOAuthProvider{name: "Linux DO", prefix: "linuxdo_"},
		&oauth.OAuthUser{ProviderUserID: "existing-subject"},
		oauthFlowPayload{},
	)
	require.NoError(t, err)
	assert.Equal(t, user.Id, found.Id)
	var code model.InvitationCode
	require.NoError(t, db.Where("code_hash = ?", model.HashInvitationCode(codes[0])).First(&code).Error)
	assert.Equal(t, common.InvitationCodeStatusEnabled, code.Status)
}

func TestOAuthInvitationMethodForEveryProvider(t *testing.T) {
	builtIn := invitationOAuthProvider{name: "built-in", prefix: "oauth_"}
	custom := oauth.NewGenericOAuthProvider(&model.CustomOAuthProvider{Id: 77, Name: "Custom", Slug: "custom"})
	testCases := []struct {
		providerName string
		provider     oauth.Provider
		expected     string
	}{
		{providerName: "github", provider: builtIn, expected: common.InvitationRegistrationMethodGitHub},
		{providerName: "discord", provider: builtIn, expected: common.InvitationRegistrationMethodDiscord},
		{providerName: "linuxdo", provider: builtIn, expected: common.InvitationRegistrationMethodLinuxDO},
		{providerName: "oidc", provider: builtIn, expected: common.InvitationRegistrationMethodOIDC},
		{providerName: "custom", provider: custom, expected: common.InvitationRegistrationMethodCustomOAuth},
	}
	for _, testCase := range testCases {
		t.Run(testCase.providerName, func(t *testing.T) {
			assert.Equal(t, testCase.expected, invitationMethodForOAuthProvider(testCase.providerName, testCase.provider))
		})
	}
}
