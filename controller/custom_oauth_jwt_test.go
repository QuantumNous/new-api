package controller

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

type oauthJWTAPIResponse struct {
	Success bool              `json:"success"`
	Message string            `json:"message"`
	Data    common.RawMessage `json:"data"`
}

type oauthJWTLoginResponse struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Role     int    `json:"role"`
	Group    string `json:"group"`
}

type oauthJWTBindResponse struct {
	Action string `json:"action"`
}

func setupCustomOAuthJWTControllerTestDB(t *testing.T) {
	t.Helper()

	prevDB := model.DB
	prevLogDB := model.LOG_DB
	prevUsingSQLite := common.UsingSQLite
	prevUsingMySQL := common.UsingMySQL
	prevUsingPostgreSQL := common.UsingPostgreSQL
	prevRedisEnabled := common.RedisEnabled
	prevRegisterEnabled := common.RegisterEnabled
	prevQuotaForNewUser := common.QuotaForNewUser
	prevQuotaForInvitee := common.QuotaForInvitee
	prevQuotaForInviter := common.QuotaForInviter

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false
	common.RegisterEnabled = true
	common.QuotaForNewUser = 0
	common.QuotaForInvitee = 0
	common.QuotaForInviter = 0

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}
	model.DB = db
	model.LOG_DB = db
	if err := db.AutoMigrate(&model.User{}, &model.Log{}, &model.CustomOAuthProvider{}, &model.UserOAuthBinding{}); err != nil {
		t.Fatalf("failed to migrate test tables: %v", err)
	}

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
		model.DB = prevDB
		model.LOG_DB = prevLogDB
		common.UsingSQLite = prevUsingSQLite
		common.UsingMySQL = prevUsingMySQL
		common.UsingPostgreSQL = prevUsingPostgreSQL
		common.RedisEnabled = prevRedisEnabled
		common.RegisterEnabled = prevRegisterEnabled
		common.QuotaForNewUser = prevQuotaForNewUser
		common.QuotaForInvitee = prevQuotaForInvitee
		common.QuotaForInviter = prevQuotaForInviter
	})
}

func newCustomOAuthJWTRouter(t *testing.T) *gin.Engine {
	t.Helper()
	router := gin.New()
	store := cookie.NewStore([]byte("test-session-secret"))
	router.Use(sessions.Sessions("session", store))
	router.GET("/api/oauth/state", GenerateOAuthCode)
	router.POST("/api/auth/external/:provider/jwt/login", HandleCustomOAuthJWTLogin)
	router.GET("/test/login-as/:id", func(c *gin.Context) {
		var user model.User
		if err := model.DB.First(&user, c.Param("id")).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": err.Error()})
			return
		}
		session := sessions.Default(c)
		session.Set("id", user.Id)
		session.Set("username", user.Username)
		session.Set("role", user.Role)
		session.Set("status", user.Status)
		session.Set("group", user.Group)
		if err := session.Save(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	})
	return router
}

type jwtDirectProviderTestOptions struct {
	AutoRegister               bool
	AutoMergeByEmail           bool
	SyncGroupOnLogin           bool
	SyncRoleOnLogin            bool
	JWTIdentityMode            string
	UserInfoEndpoint           string
	JWTHeader                  string
	JWTAcquireMode             string
	TicketExchangeURL          string
	TicketExchangeMethod       string
	TicketExchangePayloadMode  string
	TicketExchangeTicketField  string
	TicketExchangeTokenField   string
	TicketExchangeServiceField string
	TicketExchangeExtraParams  string
	TicketExchangeHeaders      string
}

func createJWTDirectProviderForTest(t *testing.T, privateKey *rsa.PrivateKey, options jwtDirectProviderTestOptions) *model.CustomOAuthProvider {
	t.Helper()
	provider := &model.CustomOAuthProvider{
		Name:                       "Acme SSO",
		Slug:                       "acme-sso",
		Kind:                       model.CustomOAuthProviderKindJWTDirect,
		Enabled:                    true,
		AuthorizationEndpoint:      "https://issuer.example.com/oauth2/authorize",
		ClientId:                   "new-api-client",
		Scopes:                     "openid profile email",
		Issuer:                     "https://issuer.example.com",
		Audience:                   "new-api",
		PublicKey:                  mustEncodeControllerRSAPublicKeyPEM(t, &privateKey.PublicKey),
		JWTIdentityMode:            options.JWTIdentityMode,
		UserInfoEndpoint:           options.UserInfoEndpoint,
		JWTHeader:                  options.JWTHeader,
		UserIdField:                "sub",
		UsernameField:              "preferred_username",
		DisplayNameField:           "name",
		EmailField:                 "email",
		GroupField:                 "groups",
		GroupMapping:               `{"engineering":"vip"}`,
		RoleField:                  "roles",
		RoleMapping:                `{"platform-admin":"admin"}`,
		AutoRegister:               options.AutoRegister,
		AutoMergeByEmail:           options.AutoMergeByEmail,
		SyncGroupOnLogin:           options.SyncGroupOnLogin,
		SyncRoleOnLogin:            options.SyncRoleOnLogin,
		JWTAcquireMode:             options.JWTAcquireMode,
		TicketExchangeURL:          options.TicketExchangeURL,
		TicketExchangeMethod:       options.TicketExchangeMethod,
		TicketExchangePayloadMode:  options.TicketExchangePayloadMode,
		TicketExchangeTicketField:  options.TicketExchangeTicketField,
		TicketExchangeTokenField:   options.TicketExchangeTokenField,
		TicketExchangeServiceField: options.TicketExchangeServiceField,
		TicketExchangeExtraParams:  options.TicketExchangeExtraParams,
		TicketExchangeHeaders:      options.TicketExchangeHeaders,
	}
	if err := model.CreateCustomOAuthProvider(provider); err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}
	return provider
}

func createUserForBindTest(t *testing.T, username string) *model.User {
	t.Helper()
	password, err := common.Password2Hash("12345678")
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}
	user := &model.User{
		Username:    username,
		Password:    password,
		DisplayName: username,
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AffCode:     username + "-aff",
	}
	if err := model.DB.Create(user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}
	return user
}

func createUserWithEmailForTest(t *testing.T, username string, email string) *model.User {
	t.Helper()
	password, err := common.Password2Hash("12345678")
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}
	user := &model.User{
		Username:    username,
		Password:    password,
		DisplayName: username,
		Email:       email,
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AffCode:     username + "-aff",
	}
	if err := model.DB.Create(user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}
	return user
}

func getLatestSystemLogForUser(t *testing.T, userID int) *model.Log {
	t.Helper()
	var log model.Log
	if err := model.LOG_DB.Where("user_id = ? AND type = ?", userID, model.LogTypeSystem).Order("created_at desc").First(&log).Error; err != nil {
		t.Fatalf("failed to load latest system log for user %d: %v", userID, err)
	}
	return &log
}

func TestHandleCustomOAuthJWTLoginCreatesUser(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate private key: %v", err)
	}
	provider := createJWTDirectProviderForTest(t, privateKey, jwtDirectProviderTestOptions{
		AutoRegister: true,
	})

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	token := signJWTForControllerTest(t, privateKey, jwt.MapClaims{
		"iss":                "https://issuer.example.com",
		"aud":                "new-api",
		"sub":                "ext-user-1",
		"preferred_username": "alice",
		"name":               "Alice",
		"email":              "alice@example.com",
		"groups":             []string{"engineering"},
		"roles":              []string{"platform-admin"},
		"exp":                time.Now().Add(time.Hour).Unix(),
	})

	response := postJWTLoginForTest(t, client, server.URL, state, token)
	if !response.Success {
		t.Fatalf("expected success response, got message: %s", response.Message)
	}

	var loginData oauthJWTLoginResponse
	if err := common.Unmarshal(response.Data, &loginData); err != nil {
		t.Fatalf("failed to decode login response: %v", err)
	}
	if loginData.Role != common.RoleAdminUser {
		t.Fatalf("expected admin role, got %d", loginData.Role)
	}
	if loginData.Group != "vip" {
		t.Fatalf("expected mapped group vip, got %s", loginData.Group)
	}

	var user model.User
	if err := model.DB.Where("username = ?", "alice").First(&user).Error; err != nil {
		t.Fatalf("expected created user alice, got error: %v", err)
	}
	if user.Role != common.RoleAdminUser || user.Group != "vip" {
		t.Fatalf("unexpected persisted user role/group: role=%d group=%s", user.Role, user.Group)
	}
	if !model.IsProviderUserIdTaken(provider.Id, "ext-user-1") {
		t.Fatal("expected oauth binding to be created")
	}
	log := getLatestSystemLogForUser(t, user.Id)
	if !strings.Contains(log.Content, "provider_slug=acme-sso") ||
		!strings.Contains(log.Content, "provider_kind=jwt_direct") ||
		!strings.Contains(log.Content, "action=login") ||
		!strings.Contains(log.Content, "external_id="+redactOAuthAuditID("ext-user-1")) ||
		!strings.Contains(log.Content, "auto_register=true") ||
		!strings.Contains(log.Content, "email_merge=false") ||
		!strings.Contains(log.Content, "group_result=vip") ||
		!strings.Contains(log.Content, "role_result=admin") {
		t.Fatalf("unexpected enterprise auth audit log: %s", log.Content)
	}
	if strings.Contains(log.Content, "external_id=ext-user-1") {
		t.Fatalf("expected enterprise auth audit log to redact external id, got %s", log.Content)
	}
}

func TestHandleCustomOAuthJWTLoginRejectsWhenAutoRegisterDisabled(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate private key: %v", err)
	}
	createJWTDirectProviderForTest(t, privateKey, jwtDirectProviderTestOptions{
		AutoRegister: false,
	})

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	token := signJWTForControllerTest(t, privateKey, jwt.MapClaims{
		"iss": "https://issuer.example.com",
		"aud": "new-api",
		"sub": "ext-user-2",
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	response := postJWTLoginForTest(t, client, server.URL, state, token)
	if response.Success {
		t.Fatal("expected auto-register disabled login to fail")
	}

	var count int64
	if err := model.DB.Model(&model.User{}).Count(&count).Error; err != nil {
		t.Fatalf("failed to count users: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected no users to be created, got %d", count)
	}
}

func TestHandleCustomOAuthJWTLoginBindsExistingSessionUser(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate private key: %v", err)
	}
	provider := createJWTDirectProviderForTest(t, privateKey, jwtDirectProviderTestOptions{
		AutoRegister: true,
	})
	user := createUserForBindTest(t, "bind-user")

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	loginReq, err := http.NewRequest(http.MethodGet, server.URL+"/test/login-as/"+strconv.Itoa(user.Id), nil)
	if err != nil {
		t.Fatalf("failed to build login-as request: %v", err)
	}
	loginResp, err := client.Do(loginReq)
	if err != nil {
		t.Fatalf("failed to establish session: %v", err)
	}
	_ = loginResp.Body.Close()

	state := fetchOAuthStateForTest(t, client, server.URL)
	token := signJWTForControllerTest(t, privateKey, jwt.MapClaims{
		"iss": "https://issuer.example.com",
		"aud": "new-api",
		"sub": "ext-bind-1",
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	response := postJWTLoginForTest(t, client, server.URL, state, token)
	if !response.Success {
		t.Fatalf("expected bind response success, got message: %s", response.Message)
	}

	var bindData oauthJWTBindResponse
	if err := common.Unmarshal(response.Data, &bindData); err != nil {
		t.Fatalf("failed to decode bind response: %v", err)
	}
	if bindData.Action != "bind" {
		t.Fatalf("expected bind action, got %s", bindData.Action)
	}
	if !model.IsProviderUserIdTaken(provider.Id, "ext-bind-1") {
		t.Fatal("expected binding to be created for current user")
	}
}

func TestHandleCustomOAuthJWTLoginDoesNotSyncAttributesDuringBind(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate private key: %v", err)
	}
	provider := createJWTDirectProviderForTest(t, privateKey, jwtDirectProviderTestOptions{
		AutoRegister:     true,
		SyncGroupOnLogin: true,
		SyncRoleOnLogin:  true,
	})
	user := createUserForBindTest(t, "bind-no-sync-user")

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	loginReq, err := http.NewRequest(http.MethodGet, server.URL+"/test/login-as/"+strconv.Itoa(user.Id), nil)
	if err != nil {
		t.Fatalf("failed to build login-as request: %v", err)
	}
	loginResp, err := client.Do(loginReq)
	if err != nil {
		t.Fatalf("failed to establish session: %v", err)
	}
	_ = loginResp.Body.Close()

	state := fetchOAuthStateForTest(t, client, server.URL)
	token := signJWTForControllerTest(t, privateKey, jwt.MapClaims{
		"iss":    "https://issuer.example.com",
		"aud":    "new-api",
		"sub":    "ext-bind-sync-ignored",
		"groups": []string{"engineering"},
		"roles":  []string{"platform-admin"},
		"exp":    time.Now().Add(time.Hour).Unix(),
	})

	response := postJWTLoginForTest(t, client, server.URL, state, token)
	if !response.Success {
		t.Fatalf("expected bind response success, got message: %s", response.Message)
	}

	reloadedUser, err := model.GetUserById(user.Id, false)
	if err != nil {
		t.Fatalf("failed to reload bound user: %v", err)
	}
	if reloadedUser.Role != common.RoleCommonUser || reloadedUser.Group != "default" {
		t.Fatalf("expected bind flow to keep local attributes unchanged, got role=%d group=%s", reloadedUser.Role, reloadedUser.Group)
	}
	if !model.IsProviderUserIdTaken(provider.Id, "ext-bind-sync-ignored") {
		t.Fatal("expected binding to be created during bind flow")
	}
	log := getLatestSystemLogForUser(t, user.Id)
	if !strings.Contains(log.Content, "action=bind") ||
		!strings.Contains(log.Content, "external_id="+redactOAuthAuditID("ext-bind-sync-ignored")) {
		t.Fatalf("expected bind audit log, got %s", log.Content)
	}
	if strings.Contains(log.Content, "external_id=ext-bind-sync-ignored") {
		t.Fatalf("expected bind audit log to redact external id, got %s", log.Content)
	}
}

func TestHandleCustomOAuthJWTLoginMergesByEmailWhenEnabled(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate private key: %v", err)
	}
	provider := createJWTDirectProviderForTest(t, privateKey, jwtDirectProviderTestOptions{
		AutoRegister:     false,
		AutoMergeByEmail: true,
	})
	existingUser := createUserWithEmailForTest(t, "merged-user", "alice@example.com")

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	token := signJWTForControllerTest(t, privateKey, jwt.MapClaims{
		"iss":                "https://issuer.example.com",
		"aud":                "new-api",
		"sub":                "ext-user-merge",
		"preferred_username": "alice",
		"email":              "alice@example.com",
		"exp":                time.Now().Add(time.Hour).Unix(),
	})

	response := postJWTLoginForTest(t, client, server.URL, state, token)
	if !response.Success {
		t.Fatalf("expected merge login to succeed, got message: %s", response.Message)
	}

	var loginData oauthJWTLoginResponse
	if err := common.Unmarshal(response.Data, &loginData); err != nil {
		t.Fatalf("failed to decode login response: %v", err)
	}
	if loginData.ID != existingUser.Id {
		t.Fatalf("expected merged existing user id %d, got %d", existingUser.Id, loginData.ID)
	}

	var count int64
	if err := model.DB.Model(&model.User{}).Count(&count).Error; err != nil {
		t.Fatalf("failed to count users: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected no new user to be created, got %d users", count)
	}
	if !model.IsProviderUserIdTaken(provider.Id, "ext-user-merge") {
		t.Fatal("expected oauth binding to be created for merged user")
	}
}

func TestHandleCustomOAuthJWTLoginSyncsExistingBoundUserOnLogin(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate private key: %v", err)
	}
	provider := createJWTDirectProviderForTest(t, privateKey, jwtDirectProviderTestOptions{
		AutoRegister:     true,
		SyncGroupOnLogin: true,
		SyncRoleOnLogin:  true,
	})
	user := createUserForBindTest(t, "existing-bound-user")
	if err := model.CreateUserOAuthBinding(&model.UserOAuthBinding{
		UserId:         user.Id,
		ProviderId:     provider.Id,
		ProviderUserId: "ext-sync-existing",
	}); err != nil {
		t.Fatalf("failed to seed oauth binding: %v", err)
	}

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	token := signJWTForControllerTest(t, privateKey, jwt.MapClaims{
		"iss":                "https://issuer.example.com",
		"aud":                "new-api",
		"sub":                "ext-sync-existing",
		"preferred_username": "existing-bound-user",
		"groups":             []string{"engineering"},
		"roles":              []string{"platform-admin"},
		"exp":                time.Now().Add(time.Hour).Unix(),
	})

	response := postJWTLoginForTest(t, client, server.URL, state, token)
	if !response.Success {
		t.Fatalf("expected existing bound login to succeed, got message: %s", response.Message)
	}

	var loginData oauthJWTLoginResponse
	if err := common.Unmarshal(response.Data, &loginData); err != nil {
		t.Fatalf("failed to decode login response: %v", err)
	}
	if loginData.Role != common.RoleAdminUser || loginData.Group != "vip" {
		t.Fatalf("expected synced login response, got role=%d group=%s", loginData.Role, loginData.Group)
	}

	reloadedUser, err := model.GetUserById(user.Id, false)
	if err != nil {
		t.Fatalf("failed to reload synced user: %v", err)
	}
	if reloadedUser.Role != common.RoleAdminUser || reloadedUser.Group != "vip" {
		t.Fatalf("expected synced persisted user, got role=%d group=%s", reloadedUser.Role, reloadedUser.Group)
	}
	if !strings.Contains(reloadedUser.GetSetting().SidebarModules, "\"admin\"") {
		t.Fatalf("expected admin sidebar section to be added after role promotion, got %s", reloadedUser.GetSetting().SidebarModules)
	}
}

func TestHandleCustomOAuthJWTLoginSyncsMergedUserOnLogin(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate private key: %v", err)
	}
	provider := createJWTDirectProviderForTest(t, privateKey, jwtDirectProviderTestOptions{
		AutoRegister:     false,
		AutoMergeByEmail: true,
		SyncGroupOnLogin: true,
		SyncRoleOnLogin:  true,
	})
	existingUser := createUserWithEmailForTest(t, "merged-sync-user", "merged-sync@example.com")

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	token := signJWTForControllerTest(t, privateKey, jwt.MapClaims{
		"iss":                "https://issuer.example.com",
		"aud":                "new-api",
		"sub":                "ext-merge-sync",
		"preferred_username": "merged-sync-user",
		"email":              "merged-sync@example.com",
		"groups":             []string{"engineering"},
		"roles":              []string{"platform-admin"},
		"exp":                time.Now().Add(time.Hour).Unix(),
	})

	response := postJWTLoginForTest(t, client, server.URL, state, token)
	if !response.Success {
		t.Fatalf("expected merged sync login to succeed, got message: %s", response.Message)
	}

	var loginData oauthJWTLoginResponse
	if err := common.Unmarshal(response.Data, &loginData); err != nil {
		t.Fatalf("failed to decode login response: %v", err)
	}
	if loginData.ID != existingUser.Id || loginData.Role != common.RoleAdminUser || loginData.Group != "vip" {
		t.Fatalf("expected merged sync response for user %d, got id=%d role=%d group=%s", existingUser.Id, loginData.ID, loginData.Role, loginData.Group)
	}

	reloadedUser, err := model.GetUserById(existingUser.Id, false)
	if err != nil {
		t.Fatalf("failed to reload merged synced user: %v", err)
	}
	if reloadedUser.Role != common.RoleAdminUser || reloadedUser.Group != "vip" {
		t.Fatalf("expected merged synced persisted user, got role=%d group=%s", reloadedUser.Role, reloadedUser.Group)
	}
	if !model.IsProviderUserIdTaken(provider.Id, "ext-merge-sync") {
		t.Fatal("expected merged user oauth binding to be created")
	}
}

func TestHandleCustomOAuthJWTLoginRejectsEmailMergeConflict(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate private key: %v", err)
	}
	createJWTDirectProviderForTest(t, privateKey, jwtDirectProviderTestOptions{
		AutoRegister:     false,
		AutoMergeByEmail: true,
	})
	createUserWithEmailForTest(t, "merge-user-1", "alice@example.com")
	createUserWithEmailForTest(t, "merge-user-2", "alice@example.com")

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	token := signJWTForControllerTest(t, privateKey, jwt.MapClaims{
		"iss":   "https://issuer.example.com",
		"aud":   "new-api",
		"sub":   "ext-user-merge-conflict",
		"email": "alice@example.com",
		"exp":   time.Now().Add(time.Hour).Unix(),
	})

	response := postJWTLoginForTest(t, client, server.URL, state, token)
	if response.Success {
		t.Fatal("expected ambiguous email merge to fail")
	}
}

func TestHandleCustomOAuthJWTLoginRejectsBindWhenAlreadyBound(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate private key: %v", err)
	}
	provider := createJWTDirectProviderForTest(t, privateKey, jwtDirectProviderTestOptions{
		AutoRegister: true,
	})
	boundUser := createUserForBindTest(t, "bound-user")
	otherUser := createUserForBindTest(t, "other-user")
	if err := model.CreateUserOAuthBinding(&model.UserOAuthBinding{
		UserId:         boundUser.Id,
		ProviderId:     provider.Id,
		ProviderUserId: "ext-bound-user",
	}); err != nil {
		t.Fatalf("failed to seed oauth binding: %v", err)
	}

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	loginReq, err := http.NewRequest(http.MethodGet, server.URL+"/test/login-as/"+strconv.Itoa(otherUser.Id), nil)
	if err != nil {
		t.Fatalf("failed to build login-as request: %v", err)
	}
	loginResp, err := client.Do(loginReq)
	if err != nil {
		t.Fatalf("failed to establish session: %v", err)
	}
	_ = loginResp.Body.Close()

	state := fetchOAuthStateForTest(t, client, server.URL)
	token := signJWTForControllerTest(t, privateKey, jwt.MapClaims{
		"iss": "https://issuer.example.com",
		"aud": "new-api",
		"sub": "ext-bound-user",
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	response := postJWTLoginForTest(t, client, server.URL, state, token)
	if response.Success {
		t.Fatal("expected bind with existing external id to fail")
	}
}

func TestHandleCustomOAuthJWTLoginDoesNotBindDisabledMergedUser(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate private key: %v", err)
	}
	provider := createJWTDirectProviderForTest(t, privateKey, jwtDirectProviderTestOptions{
		AutoRegister:     false,
		AutoMergeByEmail: true,
	})
	disabledUser := createUserWithEmailForTest(t, "disabled-merge-user", "disabled@example.com")
	disabledUser.Status = common.UserStatusDisabled
	if err := model.DB.Model(disabledUser).Update("status", common.UserStatusDisabled).Error; err != nil {
		t.Fatalf("failed to disable user: %v", err)
	}

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	token := signJWTForControllerTest(t, privateKey, jwt.MapClaims{
		"iss":   "https://issuer.example.com",
		"aud":   "new-api",
		"sub":   "ext-disabled-merge",
		"email": "disabled@example.com",
		"exp":   time.Now().Add(time.Hour).Unix(),
	})

	response := postJWTLoginForTest(t, client, server.URL, state, token)
	if response.Success {
		t.Fatal("expected disabled merged user login to fail")
	}
	if model.IsProviderUserIdTaken(provider.Id, "ext-disabled-merge") {
		t.Fatal("expected disabled merged user not to receive oauth binding")
	}
	log := getLatestSystemLogForUser(t, disabledUser.Id)
	if !strings.Contains(log.Content, "email_merge=true") || !strings.Contains(log.Content, "failure_reason=user_disabled") {
		t.Fatalf("expected disabled merged audit log, got %s", log.Content)
	}
}

func TestHandleCustomOAuthJWTLoginWithTicketExchangeAndUserInfoModeCreatesUser(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate private key: %v", err)
	}

	exchangeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payload, err := common.Marshal(map[string]any{
			"data": map[string]any{
				"access_token": "opaque-access-token",
			},
		})
		if err != nil {
			t.Fatalf("failed to marshal exchange response: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(payload)
	}))
	defer exchangeServer.Close()

	userInfoServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("x-access-token"); got != "opaque-access-token" {
			t.Fatalf("expected exchanged token in x-access-token header, got %q", got)
		}
		payload, err := common.Marshal(map[string]any{
			"info": map[string]any{
				"userCode": "1410833903245320192",
				"loginid":  "liangmingsen",
				"userName": "梁明森",
				"mailbox":  "liangmingsen@qdama.cn",
			},
		})
		if err != nil {
			t.Fatalf("failed to marshal userinfo payload: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(payload)
	}))
	defer userInfoServer.Close()

	createJWTDirectProviderForTest(t, privateKey, jwtDirectProviderTestOptions{
		AutoRegister:               true,
		JWTIdentityMode:            model.CustomJWTIdentityModeUserInfo,
		UserInfoEndpoint:           userInfoServer.URL,
		JWTHeader:                  "x-access-token",
		JWTAcquireMode:             model.CustomJWTAcquireModeTicketExchange,
		TicketExchangeURL:          exchangeServer.URL,
		TicketExchangeMethod:       http.MethodGet,
		TicketExchangePayloadMode:  model.CustomTicketExchangePayloadModeQuery,
		TicketExchangeTicketField:  "ticket",
		TicketExchangeTokenField:   "data.access_token",
		TicketExchangeServiceField: "service",
	})

	// Override field mappings for qdama-like userinfo payload.
	if err := model.DB.Model(&model.CustomOAuthProvider{}).
		Where("slug = ?", "acme-sso").
		Updates(map[string]any{
			"user_id_field":      "info.userCode",
			"username_field":     "info.loginid",
			"display_name_field": "info.userName",
			"email_field":        "info.mailbox",
			"group_field":        "",
			"role_field":         "",
			"group_mapping":      "",
			"role_mapping":       "",
		}).Error; err != nil {
		t.Fatalf("failed to update provider mappings: %v", err)
	}

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	previousServerAddress := system_setting.ServerAddress
	system_setting.ServerAddress = server.URL
	t.Cleanup(func() {
		system_setting.ServerAddress = previousServerAddress
	})

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	response := postJWTTicketLoginForTest(t, client, server.URL, state, "ST-123")
	if !response.Success {
		t.Fatalf("expected success response, got message: %s", response.Message)
	}

	var loginData oauthJWTLoginResponse
	if err := common.Unmarshal(response.Data, &loginData); err != nil {
		t.Fatalf("failed to decode login response: %v", err)
	}
	if loginData.Username != "liangmingsen" {
		t.Fatalf("unexpected login username: %s", loginData.Username)
	}

	var user model.User
	if err := model.DB.Where("username = ?", "liangmingsen").First(&user).Error; err != nil {
		t.Fatalf("expected created user liangmingsen, got error: %v", err)
	}
	if user.Email != "liangmingsen@qdama.cn" {
		t.Fatalf("unexpected persisted email: %s", user.Email)
	}
}

func TestHandleCustomOAuthJWTLoginWithTicketExchangeCreatesUser(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate private key: %v", err)
	}

	var callbackURLSeen string
	var stateSeen string
	token := signJWTForControllerTest(t, privateKey, jwt.MapClaims{
		"iss":                "https://issuer.example.com",
		"aud":                "new-api",
		"sub":                "ext-ticket-login",
		"preferred_username": "ticket-user",
		"name":               "Ticket User",
		"email":              "ticket-user@example.com",
		"groups":             []string{"engineering"},
		"roles":              []string{"platform-admin"},
		"exp":                time.Now().Add(time.Hour).Unix(),
	})

	exchangeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Fatalf("failed to parse exchange request: %v", err)
		}
		if got := r.Form.Get("st"); got != "ST-123" {
			t.Fatalf("expected ticket field st=ST-123, got %q", got)
		}
		callbackURLSeen = r.Form.Get("service")
		stateSeen = r.Header.Get("X-State")
		payload, err := common.Marshal(map[string]any{
			"data": map[string]any{
				"token": token,
			},
		})
		if err != nil {
			t.Fatalf("failed to marshal exchange response: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(payload)
	}))
	defer exchangeServer.Close()

	createJWTDirectProviderForTest(t, privateKey, jwtDirectProviderTestOptions{
		AutoRegister:               true,
		JWTAcquireMode:             model.CustomJWTAcquireModeTicketExchange,
		TicketExchangeURL:          exchangeServer.URL,
		TicketExchangeMethod:       http.MethodPost,
		TicketExchangePayloadMode:  model.CustomTicketExchangePayloadModeForm,
		TicketExchangeTicketField:  "st",
		TicketExchangeTokenField:   "data.token",
		TicketExchangeServiceField: "service",
		TicketExchangeHeaders:      `{"X-State":"{state}"}`,
	})

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	previousServerAddress := system_setting.ServerAddress
	system_setting.ServerAddress = server.URL
	t.Cleanup(func() {
		system_setting.ServerAddress = previousServerAddress
	})

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	response := postJWTTicketLoginForTest(t, client, server.URL, state, "ST-123")
	if !response.Success {
		t.Fatalf("expected success response, got message: %s", response.Message)
	}

	if callbackURLSeen != server.URL+"/oauth/acme-sso?state="+state {
		t.Fatalf("expected callback url %q, got %q", server.URL+"/oauth/acme-sso?state="+state, callbackURLSeen)
	}
	if stateSeen != state {
		t.Fatalf("expected state header %q, got %q", state, stateSeen)
	}

	var loginData oauthJWTLoginResponse
	if err := common.Unmarshal(response.Data, &loginData); err != nil {
		t.Fatalf("failed to decode login response: %v", err)
	}
	if loginData.Username != "ticket-user" || loginData.Role != common.RoleAdminUser || loginData.Group != "vip" {
		t.Fatalf("unexpected login response: %+v", loginData)
	}
}

func TestSelectJWTLoginCredential(t *testing.T) {
	t.Run("claims mode prefers id token", func(t *testing.T) {
		provider := &model.CustomOAuthProvider{
			JWTIdentityMode: model.CustomJWTIdentityModeClaims,
		}

		token := selectJWTLoginCredential(provider, customOAuthJWTLoginRequest{
			Token:   "access-token",
			IDToken: "id-token",
			JWT:     "fallback-jwt",
		})

		if token != "id-token" {
			t.Fatalf("expected id token for claims mode, got %q", token)
		}
	})

	t.Run("userinfo mode prefers access token", func(t *testing.T) {
		provider := &model.CustomOAuthProvider{
			JWTIdentityMode: model.CustomJWTIdentityModeUserInfo,
		}

		token := selectJWTLoginCredential(provider, customOAuthJWTLoginRequest{
			Token:   "access-token",
			IDToken: "id-token",
			JWT:     "fallback-jwt",
		})

		if token != "access-token" {
			t.Fatalf("expected access token for userinfo mode, got %q", token)
		}
	})
}

func TestOAuthAuditFailureReason(t *testing.T) {
	err := oauth.NewOAuthErrorWithRaw("oauth_test_failed", nil, "token=secret user=alice@example.com")
	reason := oauthAuditFailureReason(err)

	if reason != "oauth_error:oauth_test_failed" {
		t.Fatalf("unexpected audit failure reason: %q", reason)
	}
	if strings.Contains(reason, "secret") || strings.Contains(reason, "alice@example.com") {
		t.Fatalf("audit failure reason leaked raw upstream details: %q", reason)
	}
}

func TestHandleCustomOAuthJWTLoginWithTicketValidateCreatesUser(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate private key: %v", err)
	}

	validationServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Query().Get("ticket"); got != "ST-CAS-123" {
			t.Fatalf("expected ticket query param ST-CAS-123, got %q", got)
		}
		if got := r.URL.Query().Get("service"); !strings.Contains(got, "/oauth/acme-sso?state=") {
			t.Fatalf("expected service callback url to contain oauth callback, got %q", got)
		}
		w.Header().Set("Content-Type", "application/xml")
		_, _ = w.Write([]byte(`<?xml version="1.0" encoding="UTF-8"?>
<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
  <cas:authenticationSuccess>
    <cas:user>cas-user-1</cas:user>
    <cas:attributes>
      <cas:loginid>cas-user</cas:loginid>
      <cas:userName>CAS User</cas:userName>
      <cas:mailbox>cas-user@example.com</cas:mailbox>
      <cas:group>engineering</cas:group>
      <cas:role>platform-admin</cas:role>
    </cas:attributes>
  </cas:authenticationSuccess>
</cas:serviceResponse>`))
	}))
	defer validationServer.Close()

	createJWTDirectProviderForTest(t, privateKey, jwtDirectProviderTestOptions{
		AutoRegister:               true,
		JWTAcquireMode:             model.CustomJWTAcquireModeTicketValidate,
		TicketExchangeURL:          validationServer.URL,
		TicketExchangeMethod:       http.MethodGet,
		TicketExchangePayloadMode:  model.CustomTicketExchangePayloadModeQuery,
		TicketExchangeTicketField:  "ticket",
		TicketExchangeServiceField: "service",
	})

	if err := model.DB.Model(&model.CustomOAuthProvider{}).
		Where("slug = ?", "acme-sso").
		Updates(map[string]any{
			"user_id_field":      "authenticationSuccess.user",
			"username_field":     "authenticationSuccess.attributes.loginid",
			"display_name_field": "authenticationSuccess.attributes.userName",
			"email_field":        "authenticationSuccess.attributes.mailbox",
			"group_field":        "authenticationSuccess.attributes.group",
			"group_mapping":      `{"engineering":"vip"}`,
			"role_field":         "authenticationSuccess.attributes.role",
			"role_mapping":       `{"platform-admin":"admin"}`,
		}).Error; err != nil {
		t.Fatalf("failed to update provider mappings for ticket validate: %v", err)
	}

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	previousServerAddress := system_setting.ServerAddress
	system_setting.ServerAddress = server.URL
	t.Cleanup(func() {
		system_setting.ServerAddress = previousServerAddress
	})

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	response := postJWTTicketLoginForTest(t, client, server.URL, state, "ST-CAS-123")
	if !response.Success {
		t.Fatalf("expected success response, got message: %s", response.Message)
	}

	var loginData oauthJWTLoginResponse
	if err := common.Unmarshal(response.Data, &loginData); err != nil {
		t.Fatalf("failed to decode login response: %v", err)
	}
	if loginData.Username != "cas-user" || loginData.Role != common.RoleAdminUser || loginData.Group != "vip" {
		t.Fatalf("unexpected login response: %+v", loginData)
	}

	var user model.User
	if err := model.DB.Where("username = ?", "cas-user").First(&user).Error; err != nil {
		t.Fatalf("expected created user cas-user, got error: %v", err)
	}
	if user.Email != "cas-user@example.com" {
		t.Fatalf("unexpected persisted email: %s", user.Email)
	}
}

func TestHandleCustomOAuthJWTLoginWithTicketExchangeRequiresValidServerAddress(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate private key: %v", err)
	}

	exchangeCallCount := 0
	exchangeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		exchangeCallCount++
		w.WriteHeader(http.StatusOK)
	}))
	defer exchangeServer.Close()

	createJWTDirectProviderForTest(t, privateKey, jwtDirectProviderTestOptions{
		AutoRegister:               true,
		JWTAcquireMode:             model.CustomJWTAcquireModeTicketExchange,
		TicketExchangeURL:          exchangeServer.URL,
		TicketExchangeMethod:       http.MethodPost,
		TicketExchangePayloadMode:  model.CustomTicketExchangePayloadModeForm,
		TicketExchangeTicketField:  "ticket",
		TicketExchangeTokenField:   "data.token",
		TicketExchangeServiceField: "service",
	})

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	previousServerAddress := system_setting.ServerAddress
	system_setting.ServerAddress = ""
	t.Cleanup(func() {
		system_setting.ServerAddress = previousServerAddress
	})

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	response := postJWTTicketLoginForTest(t, client, server.URL, state, "ST-123")

	if response.Success {
		t.Fatalf("expected ticket login to fail when server address is empty")
	}
	if exchangeCallCount != 0 {
		t.Fatalf("expected ticket exchange not to be called without valid server address, got %d", exchangeCallCount)
	}
	if response.Message == "" {
		t.Fatalf("expected ticket login failure to include message")
	}
}

func TestBuildCustomOAuthJWTCallbackURLRequiresValidServerAddress(t *testing.T) {
	previousServerAddress := system_setting.ServerAddress
	t.Cleanup(func() {
		system_setting.ServerAddress = previousServerAddress
	})

	system_setting.ServerAddress = "://bad"
	_, err := buildCustomOAuthJWTCallbackURL("acme-sso", "state-1")
	if err == nil {
		t.Fatalf("expected invalid server address to fail callback url build")
	}

	system_setting.ServerAddress = "https://example.com/base/"
	callbackURL, err := buildCustomOAuthJWTCallbackURL("acme-sso", "state-2")
	if err != nil {
		t.Fatalf("expected valid server address to build callback url, got %v", err)
	}
	expected := "https://example.com/base/oauth/acme-sso?state=state-2"
	if callbackURL != expected {
		t.Fatalf("expected callback url %q, got %q", expected, callbackURL)
	}
}

func TestHandleCustomOAuthJWTLoginReturns200ForInvalidState(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate private key: %v", err)
	}
	createJWTDirectProviderForTest(t, privateKey, jwtDirectProviderTestOptions{
		AutoRegister: true,
	})

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	_ = fetchOAuthStateForTest(t, client, server.URL)
	token := signJWTForControllerTest(t, privateKey, jwt.MapClaims{
		"iss":                "https://issuer.example.com",
		"aud":                "new-api",
		"sub":                "ext-user-invalid-state",
		"preferred_username": "invalid-state-user",
		"exp":                time.Now().Add(time.Hour).Unix(),
	})

	payload, marshalErr := common.Marshal(map[string]any{
		"state":    "mismatched-state",
		"id_token": token,
	})
	if marshalErr != nil {
		t.Fatalf("failed to marshal login payload: %v", marshalErr)
	}
	req, reqErr := http.NewRequest(http.MethodPost, server.URL+"/api/auth/external/acme-sso/jwt/login", bytes.NewReader(payload))
	if reqErr != nil {
		t.Fatalf("failed to build login request: %v", reqErr)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, doErr := client.Do(req)
	if doErr != nil {
		t.Fatalf("failed to post jwt login: %v", doErr)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected invalid state response to keep http 200 envelope, got %d", resp.StatusCode)
	}
	var response oauthJWTAPIResponse
	if err := common.DecodeJson(resp.Body, &response); err != nil {
		t.Fatalf("failed to decode invalid state response: %v", err)
	}
	if response.Success {
		t.Fatalf("expected invalid state response to fail")
	}
	if response.Message == "" {
		t.Fatalf("expected invalid state response to include an error message")
	}
}

func TestHandleCustomOAuthJWTLoginReturns200ForUnknownProvider(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	payload, err := common.Marshal(map[string]any{
		"state":    state,
		"id_token": "fake-token",
	})
	if err != nil {
		t.Fatalf("failed to marshal login payload: %v", err)
	}
	req, err := http.NewRequest(http.MethodPost, server.URL+"/api/auth/external/missing-provider/jwt/login", bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("failed to build login request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("failed to post jwt login: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected unknown provider response to keep http 200 envelope, got %d", resp.StatusCode)
	}
	var response oauthJWTAPIResponse
	if err := common.DecodeJson(resp.Body, &response); err != nil {
		t.Fatalf("failed to decode unknown provider response: %v", err)
	}
	if response.Success {
		t.Fatalf("expected unknown provider response to fail")
	}
	if response.Message == "" {
		t.Fatalf("expected unknown provider response to include an error message")
	}
}

func newTestHTTPClient(t *testing.T) *http.Client {
	t.Helper()
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("failed to create cookie jar: %v", err)
	}
	return &http.Client{Jar: jar}
}

func fetchOAuthStateForTest(t *testing.T, client *http.Client, baseURL string) string {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, baseURL+"/api/oauth/state", nil)
	if err != nil {
		t.Fatalf("failed to build state request: %v", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("failed to fetch oauth state: %v", err)
	}
	defer resp.Body.Close()

	var response oauthJWTAPIResponse
	if err := common.DecodeJson(resp.Body, &response); err != nil {
		t.Fatalf("failed to decode state response: %v", err)
	}
	var state string
	if err := common.Unmarshal(response.Data, &state); err != nil {
		t.Fatalf("failed to decode state payload: %v", err)
	}
	return state
}

func postJWTLoginForTest(t *testing.T, client *http.Client, baseURL string, state string, token string) oauthJWTAPIResponse {
	t.Helper()
	payload, err := common.Marshal(map[string]any{
		"state":    state,
		"id_token": token,
	})
	if err != nil {
		t.Fatalf("failed to marshal login payload: %v", err)
	}
	req, err := http.NewRequest(http.MethodPost, baseURL+"/api/auth/external/acme-sso/jwt/login", bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("failed to build login request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("failed to post jwt login: %v", err)
	}
	defer resp.Body.Close()

	var response oauthJWTAPIResponse
	if err := common.DecodeJson(resp.Body, &response); err != nil {
		t.Fatalf("failed to decode login response: %v", err)
	}
	return response
}

func postJWTTicketLoginForTest(t *testing.T, client *http.Client, baseURL string, state string, ticket string) oauthJWTAPIResponse {
	t.Helper()
	payload, err := common.Marshal(map[string]any{
		"state":  state,
		"ticket": ticket,
	})
	if err != nil {
		t.Fatalf("failed to marshal ticket login payload: %v", err)
	}
	req, err := http.NewRequest(http.MethodPost, baseURL+"/api/auth/external/acme-sso/jwt/login", bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("failed to build ticket login request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("failed to post ticket login: %v", err)
	}
	defer resp.Body.Close()

	var response oauthJWTAPIResponse
	if err := common.DecodeJson(resp.Body, &response); err != nil {
		t.Fatalf("failed to decode ticket login response: %v", err)
	}
	return response
}

func signJWTForControllerTest(t *testing.T, privateKey *rsa.PrivateKey, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tokenString, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatalf("failed to sign jwt token: %v", err)
	}
	return tokenString
}

func mustEncodeControllerRSAPublicKeyPEM(t *testing.T, publicKey *rsa.PublicKey) string {
	t.Helper()
	publicKeyDER, err := x509.MarshalPKIXPublicKey(publicKey)
	if err != nil {
		t.Fatalf("failed to marshal public key: %v", err)
	}
	return string(pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: publicKeyDER,
	}))
}
