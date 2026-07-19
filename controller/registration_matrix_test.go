package controller

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRegistrationMatrixDB(t *testing.T) *gorm.DB {
	t.Helper()

	oldDB, oldLogDB := model.DB, model.LOG_DB
	oldRedisEnabled := common.RedisEnabled
	oldQuotaForNewUser := common.QuotaForNewUser
	oldSettings := common.GetInvitationCodeSettings()
	oldMainDatabaseType, oldLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()
	oldOptionMap := common.OptionMap

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Token{},
		&model.InvitationCode{},
		&model.CustomOAuthProvider{},
		&model.UserOAuthBinding{},
		&model.AuthIdentity{},
		&model.Log{},
		&model.Option{},
		&model.Setup{},
		&model.TwoFA{},
	))
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.QuotaForNewUser = 0
	_, err = model.UpdateInvitationCodeSettings(false, []string{common.InvitationRegistrationMethodLinuxDO})
	require.NoError(t, err)
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	gin.SetMode(gin.TestMode)

	t.Cleanup(func() {
		_, settingsErr := common.ApplyInvitationCodeSettings(oldSettings.Required, oldSettings.Methods)
		require.NoError(t, settingsErr)
		common.RedisEnabled = oldRedisEnabled
		common.QuotaForNewUser = oldQuotaForNewUser
		common.SetDatabaseTypes(oldMainDatabaseType, oldLogDatabaseType)
		common.OptionMap = oldOptionMap
		model.DB, model.LOG_DB = oldDB, oldLogDB
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})
	return db
}

func setMatrixInvitationSettings(t *testing.T, required bool, methods []string) {
	t.Helper()
	_, err := model.UpdateInvitationCodeSettings(required, methods)
	require.NoError(t, err)
}

func createMatrixInvitationCode(t *testing.T, name string, createdBy int) string {
	t.Helper()
	codes, err := model.CreateInvitationCodes(name, 1, createdBy, 0)
	require.NoError(t, err)
	require.Len(t, codes, 1)
	return codes[0]
}

func requireMatrixInvitationEnabled(t *testing.T, db *gorm.DB, rawCode string) {
	t.Helper()
	var invitation model.InvitationCode
	require.NoError(t, db.Where("code_hash = ?", model.HashInvitationCode(rawCode)).First(&invitation).Error)
	assert.Equal(t, common.InvitationCodeStatusEnabled, invitation.Status)
	assert.Zero(t, invitation.UsedUserId)
	assert.Zero(t, invitation.UsedTime)
}

func requireMatrixInvitationUsedBy(t *testing.T, db *gorm.DB, rawCode string, userID int) {
	t.Helper()
	var invitation model.InvitationCode
	require.NoError(t, db.Where("code_hash = ?", model.HashInvitationCode(rawCode)).First(&invitation).Error)
	assert.Equal(t, common.InvitationCodeStatusUsed, invitation.Status)
	assert.Equal(t, userID, invitation.UsedUserId)
}

func requireNoMatrixDefaultToken(t *testing.T, db *gorm.DB, userID int) {
	t.Helper()
	var tokenCount int64
	require.NoError(t, db.Model(&model.Token{}).Where("user_id = ?", userID).Count(&tokenCount).Error)
	assert.Zero(t, tokenCount)
}

type matrixBuiltInOAuthProvider struct {
	method string
}

func (provider matrixBuiltInOAuthProvider) GetName() string {
	return provider.method
}

func (matrixBuiltInOAuthProvider) IsEnabled() bool {
	return true
}

func (matrixBuiltInOAuthProvider) ExchangeToken(context.Context, string, *gin.Context) (*oauth.OAuthToken, error) {
	return nil, nil
}

func (matrixBuiltInOAuthProvider) GetUserInfo(context.Context, *oauth.OAuthToken) (*oauth.OAuthUser, error) {
	return nil, nil
}

func (matrixBuiltInOAuthProvider) IsUserIDTaken(string) bool {
	return false
}

func (matrixBuiltInOAuthProvider) FillUserByProviderID(*model.User, string) error {
	return gorm.ErrRecordNotFound
}

func (provider matrixBuiltInOAuthProvider) SetProviderUserID(user *model.User, providerUserID string) {
	switch provider.method {
	case common.InvitationRegistrationMethodGitHub:
		user.GitHubId = providerUserID
	case common.InvitationRegistrationMethodDiscord:
		user.DiscordId = providerUserID
	case common.InvitationRegistrationMethodLinuxDO:
		user.LinuxDOId = providerUserID
	case common.InvitationRegistrationMethodOIDC:
		user.OidcId = providerUserID
	}
}

func (provider matrixBuiltInOAuthProvider) GetProviderPrefix() string {
	return provider.method + "_"
}

func matrixProviderUserID(user model.User, method string) string {
	switch method {
	case common.InvitationRegistrationMethodGitHub:
		return user.GitHubId
	case common.InvitationRegistrationMethodDiscord:
		return user.DiscordId
	case common.InvitationRegistrationMethodLinuxDO:
		return user.LinuxDOId
	case common.InvitationRegistrationMethodOIDC:
		return user.OidcId
	default:
		return ""
	}
}

func TestOAuthRegistrationMatrixConsumesInvitationWithoutDefaultToken(t *testing.T) {
	methods := []string{
		common.InvitationRegistrationMethodGitHub,
		common.InvitationRegistrationMethodDiscord,
		common.InvitationRegistrationMethodLinuxDO,
		common.InvitationRegistrationMethodOIDC,
	}

	for _, method := range methods {
		t.Run(method, func(t *testing.T) {
			db := setupRegistrationMatrixDB(t)
			setMatrixInvitationSettings(t, true, []string{method})
			invitationCode := createMatrixInvitationCode(t, method, 1)
			providerUserID := method + "-provider-user"

			user, err := findOrCreateOAuthUser(
				method,
				matrixBuiltInOAuthProvider{method: method},
				&oauth.OAuthUser{
					ProviderUserID: providerUserID,
					Username:       method + "-user",
					DisplayName:    method + " user",
				},
				oauthRegistrationState{InvitationCode: invitationCode},
			)
			require.NoError(t, err)
			require.NotZero(t, user.Id)

			var stored model.User
			require.NoError(t, db.First(&stored, user.Id).Error)
			assert.Equal(t, providerUserID, matrixProviderUserID(stored, method))
			requireMatrixInvitationUsedBy(t, db, invitationCode, user.Id)
			requireNoMatrixDefaultToken(t, db, user.Id)
		})
	}
}

func TestCustomOAuthRegistrationConsumesInvitationCreatesBindingWithoutDefaultToken(t *testing.T) {
	db := setupRegistrationMatrixDB(t)
	setMatrixInvitationSettings(t, true, []string{common.InvitationRegistrationMethodCustomOAuth})
	invitationCode := createMatrixInvitationCode(t, "custom-oauth", 1)
	providerConfig := &model.CustomOAuthProvider{
		Id:      77,
		Name:    "Matrix OAuth",
		Slug:    "matrix-oauth",
		Enabled: true,
	}
	provider := oauth.NewGenericOAuthProvider(providerConfig)

	user, err := findOrCreateOAuthUser(
		providerConfig.Slug,
		provider,
		&oauth.OAuthUser{
			ProviderUserID: "custom-provider-user",
			Username:       "custom-user",
			DisplayName:    "Custom User",
		},
		oauthRegistrationState{InvitationCode: invitationCode},
	)
	require.NoError(t, err)
	require.NotZero(t, user.Id)

	var binding model.UserOAuthBinding
	require.NoError(t, db.Where("user_id = ? AND provider_id = ?", user.Id, providerConfig.Id).First(&binding).Error)
	assert.Equal(t, "custom-provider-user", binding.ProviderUserId)
	requireMatrixInvitationUsedBy(t, db, invitationCode, user.Id)
	requireNoMatrixDefaultToken(t, db, user.Id)
}

func TestCustomOAuthBindingFailureRollsBackUserAndInvitation(t *testing.T) {
	db := setupRegistrationMatrixDB(t)
	setMatrixInvitationSettings(t, true, []string{common.InvitationRegistrationMethodCustomOAuth})
	invitationCode := createMatrixInvitationCode(t, "custom-oauth-rollback", 1)
	require.NoError(t, db.Exec(`
		CREATE TRIGGER fail_matrix_oauth_binding
		BEFORE INSERT ON user_oauth_bindings
		BEGIN
			SELECT RAISE(FAIL, 'matrix binding failure');
		END;
	`).Error)
	provider := oauth.NewGenericOAuthProvider(&model.CustomOAuthProvider{
		Id:      88,
		Name:    "Failing OAuth",
		Slug:    "failing-oauth",
		Enabled: true,
	})

	user, err := findOrCreateOAuthUser(
		"failing-oauth",
		provider,
		&oauth.OAuthUser{
			ProviderUserID: "binding-must-fail",
			Username:       "rollback-user",
			DisplayName:    "Rollback User",
		},
		oauthRegistrationState{InvitationCode: invitationCode},
	)
	require.Error(t, err)
	assert.Nil(t, user)
	assert.ErrorContains(t, err, "matrix binding failure")

	var userCount int64
	require.NoError(t, db.Model(&model.User{}).Where("username = ?", "rollback-user").Count(&userCount).Error)
	assert.Zero(t, userCount)
	var bindingCount int64
	require.NoError(t, db.Model(&model.UserOAuthBinding{}).Count(&bindingCount).Error)
	assert.Zero(t, bindingCount)
	requireMatrixInvitationEnabled(t, db, invitationCode)
	var tokenCount int64
	require.NoError(t, db.Model(&model.Token{}).Count(&tokenCount).Error)
	assert.Zero(t, tokenCount)
}

func TestExistingWeChatUserBypassesInvitationAndRegistrationGate(t *testing.T) {
	db := setupRegistrationMatrixDB(t)
	oldWeChatEnabled := common.WeChatAuthEnabled
	oldRegisterEnabled := common.RegisterEnabled
	oldServerAddress := common.WeChatServerAddress
	oldServerToken := common.WeChatServerToken
	t.Cleanup(func() {
		common.WeChatAuthEnabled = oldWeChatEnabled
		common.RegisterEnabled = oldRegisterEnabled
		common.WeChatServerAddress = oldServerAddress
		common.WeChatServerToken = oldServerToken
	})

	const wechatID = "existing-wechat-id"
	existingUser := &model.User{
		Username:    "existing-wechat",
		DisplayName: "Existing WeChat",
		WeChatId:    wechatID,
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(existingUser).Error)
	invitationCode := createMatrixInvitationCode(t, "wechat-existing", existingUser.Id)
	setMatrixInvitationSettings(t, true, []string{common.InvitationRegistrationMethodWeChat})

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		assert.Equal(t, "/api/wechat/user", request.URL.Path)
		assert.Equal(t, "wechat-login-code", request.URL.Query().Get("code"))
		assert.Equal(t, "matrix-wechat-token", request.Header.Get("Authorization"))
		writer.Header().Set("Content-Type", "application/json")
		_, writeErr := writer.Write([]byte(`{"success":true,"message":"","data":"existing-wechat-id"}`))
		assert.NoError(t, writeErr)
	}))
	t.Cleanup(server.Close)
	common.WeChatAuthEnabled = true
	common.RegisterEnabled = false
	common.WeChatServerAddress = server.URL
	common.WeChatServerToken = "matrix-wechat-token"

	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("01234567890123456789012345678901"))))
	router.POST("/wechat", WeChatAuth)
	request := httptest.NewRequest(http.MethodPost, "/wechat", strings.NewReader(`{"code":"wechat-login-code"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	var response struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success, recorder.Body.String())
	var userCount int64
	require.NoError(t, db.Model(&model.User{}).Count(&userCount).Error)
	assert.Equal(t, int64(1), userCount)
	requireMatrixInvitationEnabled(t, db, invitationCode)
	requireNoMatrixDefaultToken(t, db, existingUser.Id)
}

func TestWeChatNewUserConsumesInvitationWithoutDefaultToken(t *testing.T) {
	db := setupRegistrationMatrixDB(t)
	oldWeChatEnabled := common.WeChatAuthEnabled
	oldRegisterEnabled := common.RegisterEnabled
	oldServerAddress := common.WeChatServerAddress
	oldServerToken := common.WeChatServerToken
	oldGenerateDefaultToken := constant.GenerateDefaultToken
	t.Cleanup(func() {
		common.WeChatAuthEnabled = oldWeChatEnabled
		common.RegisterEnabled = oldRegisterEnabled
		common.WeChatServerAddress = oldServerAddress
		common.WeChatServerToken = oldServerToken
		constant.GenerateDefaultToken = oldGenerateDefaultToken
	})

	invitationCode := createMatrixInvitationCode(t, "wechat-new", 1)
	setMatrixInvitationSettings(t, true, []string{common.InvitationRegistrationMethodWeChat})
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, writeErr := writer.Write([]byte(`{"success":true,"message":"","data":"new-wechat-id"}`))
		assert.NoError(t, writeErr)
	}))
	t.Cleanup(server.Close)
	common.WeChatAuthEnabled = true
	common.RegisterEnabled = true
	common.WeChatServerAddress = server.URL
	common.WeChatServerToken = "matrix-wechat-token"
	constant.GenerateDefaultToken = true

	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("01234567890123456789012345678901"))))
	router.POST("/wechat", WeChatAuth)
	request := httptest.NewRequest(
		http.MethodPost,
		"/wechat",
		strings.NewReader(fmt.Sprintf(`{"code":"wechat-new-code","invitation_code":%q}`, invitationCode)),
	)
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	var response struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success, recorder.Body.String())
	var created model.User
	require.NoError(t, db.Where("wechat_id = ?", "new-wechat-id").First(&created).Error)
	requireMatrixInvitationUsedBy(t, db, invitationCode, created.Id)
	requireNoMatrixDefaultToken(t, db, created.Id)
}

func TestExistingPasswordLoginBypassesInvitationRequirement(t *testing.T) {
	db := setupRegistrationMatrixDB(t)
	oldPasswordLoginEnabled := common.PasswordLoginEnabled
	common.PasswordLoginEnabled = true
	t.Cleanup(func() { common.PasswordLoginEnabled = oldPasswordLoginEnabled })

	hashedPassword, err := common.Password2Hash("password1")
	require.NoError(t, err)
	existingUser := &model.User{
		Username:    "existing-password",
		Password:    hashedPassword,
		DisplayName: "Existing Password",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(existingUser).Error)
	invitationCode := createMatrixInvitationCode(t, "password-existing", existingUser.Id)
	setMatrixInvitationSettings(t, true, []string{common.InvitationRegistrationMethodPassword})

	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("01234567890123456789012345678901"))))
	router.POST("/login", Login)
	request := httptest.NewRequest(
		http.MethodPost,
		"/login",
		strings.NewReader(`{"username":"existing-password","password":"password1"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	var response struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success, recorder.Body.String())
	requireMatrixInvitationEnabled(t, db, invitationCode)
}

func TestAdminCreateUserBypassesInvitationAndDefaultToken(t *testing.T) {
	db := setupRegistrationMatrixDB(t)
	oldGenerateDefaultToken := constant.GenerateDefaultToken
	constant.GenerateDefaultToken = true
	t.Cleanup(func() { constant.GenerateDefaultToken = oldGenerateDefaultToken })

	admin := &model.User{
		Username: "matrix-admin",
		Password: "admin-password",
		Role:     common.RoleAdminUser,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(admin).Error)
	invitationCode := createMatrixInvitationCode(t, "admin-create", admin.Id)
	setMatrixInvitationSettings(t, true, []string{common.InvitationRegistrationMethodPassword})

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/user/",
		strings.NewReader(`{"username":"admin-created","password":"password1","role":1}`),
	)
	context.Request.Header.Set("Content-Type", "application/json")
	context.Set("id", admin.Id)
	context.Set("username", admin.Username)
	context.Set("role", common.RoleAdminUser)

	CreateUser(context)

	var response struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success, recorder.Body.String())
	var created model.User
	require.NoError(t, db.Where("username = ?", "admin-created").First(&created).Error)
	requireMatrixInvitationEnabled(t, db, invitationCode)
	requireNoMatrixDefaultToken(t, db, created.Id)
}

func TestRootSetupBypassesInvitationAndDefaultToken(t *testing.T) {
	db := setupRegistrationMatrixDB(t)
	oldSetup := constant.Setup
	oldGenerateDefaultToken := constant.GenerateDefaultToken
	oldSelfUseMode := operation_setting.SelfUseModeEnabled
	oldDemoSite := operation_setting.DemoSiteEnabled
	oldSelfUseOption, hadSelfUseOption := common.OptionMap["SelfUseModeEnabled"]
	oldDemoOption, hadDemoOption := common.OptionMap["DemoSiteEnabled"]
	constant.Setup = false
	constant.GenerateDefaultToken = true
	t.Cleanup(func() {
		constant.Setup = oldSetup
		constant.GenerateDefaultToken = oldGenerateDefaultToken
		operation_setting.SelfUseModeEnabled = oldSelfUseMode
		operation_setting.DemoSiteEnabled = oldDemoSite
		if hadSelfUseOption {
			common.OptionMap["SelfUseModeEnabled"] = oldSelfUseOption
		} else {
			delete(common.OptionMap, "SelfUseModeEnabled")
		}
		if hadDemoOption {
			common.OptionMap["DemoSiteEnabled"] = oldDemoOption
		} else {
			delete(common.OptionMap, "DemoSiteEnabled")
		}
	})

	invitationCode := createMatrixInvitationCode(t, "root-setup", 1)
	setMatrixInvitationSettings(t, true, []string{common.InvitationRegistrationMethodPassword})
	requestBody := fmt.Sprintf(
		`{"username":"root-user","password":"password1","confirmPassword":"password1","SelfUseModeEnabled":%t,"DemoSiteEnabled":%t}`,
		oldSelfUseMode,
		oldDemoSite,
	)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPost, "/api/setup", strings.NewReader(requestBody))
	context.Request.Header.Set("Content-Type", "application/json")

	PostSetup(context)

	var response struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success, recorder.Body.String())
	var rootUser model.User
	require.NoError(t, db.Where("role = ?", common.RoleRootUser).First(&rootUser).Error)
	requireMatrixInvitationEnabled(t, db, invitationCode)
	requireNoMatrixDefaultToken(t, db, rootUser.Id)
}
