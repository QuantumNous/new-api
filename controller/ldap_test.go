package controller

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type ldapAPIResponse struct {
	Success bool                   `json:"success"`
	Message string                 `json:"message"`
	Data    map[string]interface{} `json:"data"`
}

func setupLDAPControllerTest(t *testing.T) *gin.Engine {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.Log{}, &model.UserLDAPBinding{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	model.DB = db
	model.LOG_DB = db
	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
	})

	ldapSettings := system_setting.GetLDAPSettings()
	originalSettings := *ldapSettings
	ldapSettings.Enabled = true
	t.Cleanup(func() {
		*ldapSettings = originalSettings
	})

	originalRegisterEnabled := common.RegisterEnabled
	originalRedisEnabled := common.RedisEnabled
	common.RegisterEnabled = true
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.RegisterEnabled = originalRegisterEnabled
		common.RedisEnabled = originalRedisEnabled
	})

	originalAuthenticator := authenticateLDAPUser
	authenticateLDAPUser = func(ctx context.Context, username, password string) (*service.LDAPAuthenticatedUser, error) {
		return &service.LDAPAuthenticatedUser{
			LDAPUserID:  "CN=Alice,OU=Company,DC=example,DC=com",
			Username:    username,
			DisplayName: "Alice",
			Email:       "alice@example.com",
			Groups:      []string{"g-engineering", "g-ai"},
		}, nil
	}
	t.Cleanup(func() {
		authenticateLDAPUser = originalAuthenticator
	})

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("ldap-test-secret"))))
	router.POST("/api/oauth/ldap/login", LDAPLogin)
	router.POST("/api/oauth/ldap/bind", func(c *gin.Context) {
		c.Set("id", 1)
		LDAPBind(c)
	})
	return router
}

func postLDAPLogin(t *testing.T, router *gin.Engine, username, password string) (*httptest.ResponseRecorder, ldapAPIResponse) {
	t.Helper()

	payload, err := common.Marshal(map[string]string{
		"username": username,
		"password": password,
	})
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/oauth/ldap/login", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	var response ldapAPIResponse
	if err := common.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	return recorder, response
}

func TestLDAPLoginUsesExistingBinding(t *testing.T) {
	router := setupLDAPControllerTest(t)

	user := model.User{
		Username:    "existing",
		Password:    "password",
		DisplayName: "Existing",
		Status:      common.UserStatusEnabled,
		AffCode:     "a001",
	}
	if err := model.DB.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := model.CreateUserLDAPBinding(&model.UserLDAPBinding{
		UserId:       user.Id,
		LDAPUserId:   "CN=Alice,OU=Company,DC=example,DC=com",
		LDAPUsername: "alice",
	}); err != nil {
		t.Fatalf("create ldap binding: %v", err)
	}

	recorder, response := postLDAPLogin(t, router, "alice", "secret")
	if recorder.Code != http.StatusOK || !response.Success {
		t.Fatalf("expected successful login, status=%d response=%#v", recorder.Code, response)
	}
	if int(response.Data["id"].(float64)) != user.Id {
		t.Fatalf("expected user id %d, got %#v", user.Id, response.Data["id"])
	}

	binding, err := model.GetUserLDAPBindingByUserId(user.Id)
	if err != nil {
		t.Fatalf("get ldap binding: %v", err)
	}
	groups := binding.GroupList()
	if len(groups) != 2 || groups[0] != "g-engineering" || groups[1] != "g-ai" {
		t.Fatalf("expected LDAP groups to be refreshed, got %#v", groups)
	}

	refreshedUser, err := model.GetUserById(user.Id, false)
	if err != nil {
		t.Fatalf("get refreshed user: %v", err)
	}
	if refreshedUser.DisplayName != "Alice" || refreshedUser.Email != "alice@example.com" {
		t.Fatalf("expected local profile to sync from LDAP, got %#v", refreshedUser)
	}
}

func TestLDAPLoginMovesExistingBindingToLDAPEmailOwner(t *testing.T) {
	router := setupLDAPControllerTest(t)

	wrongUser := model.User{
		Username:    "axera",
		Password:    "password",
		DisplayName: "Root User",
		Status:      common.UserStatusEnabled,
		AffCode:     "a020",
	}
	if err := model.DB.Create(&wrongUser).Error; err != nil {
		t.Fatalf("create wrong user: %v", err)
	}
	ldapEmailUser := model.User{
		Username:    "alice",
		Password:    "password",
		DisplayName: "Local Alice",
		Email:       "alice@example.com",
		Status:      common.UserStatusEnabled,
		AffCode:     "a021",
	}
	if err := model.DB.Create(&ldapEmailUser).Error; err != nil {
		t.Fatalf("create ldap email user: %v", err)
	}
	if err := model.CreateUserLDAPBinding(&model.UserLDAPBinding{
		UserId:       wrongUser.Id,
		LDAPUserId:   "CN=Alice,OU=Company,DC=example,DC=com",
		LDAPUsername: "alice",
		LDAPEmail:    "alice@example.com",
	}); err != nil {
		t.Fatalf("create wrong ldap binding: %v", err)
	}

	recorder, response := postLDAPLogin(t, router, "alice", "secret")
	if recorder.Code != http.StatusOK || !response.Success {
		t.Fatalf("expected successful login, status=%d response=%#v", recorder.Code, response)
	}
	if int(response.Data["id"].(float64)) != ldapEmailUser.Id {
		t.Fatalf("expected LDAP email owner id %d, got %#v", ldapEmailUser.Id, response.Data["id"])
	}

	if _, err := model.GetUserLDAPBindingByUserId(wrongUser.Id); err == nil {
		t.Fatal("wrong user must no longer own the LDAP binding")
	}
	binding, err := model.GetUserLDAPBindingByUserId(ldapEmailUser.Id)
	if err != nil {
		t.Fatalf("get moved ldap binding: %v", err)
	}
	if binding.LDAPEmail != "alice@example.com" {
		t.Fatalf("expected moved binding to be refreshed, got %#v", binding)
	}
}

func TestLDAPLoginCreatesUserWhenRegistrationEnabled(t *testing.T) {
	router := setupLDAPControllerTest(t)

	recorder, response := postLDAPLogin(t, router, "alice", "secret")
	if recorder.Code != http.StatusOK || !response.Success {
		t.Fatalf("expected successful registration login, status=%d response=%#v", recorder.Code, response)
	}

	var count int64
	if err := model.DB.Model(&model.UserLDAPBinding{}).Where("ldap_user_id = ?", "CN=Alice,OU=Company,DC=example,DC=com").Count(&count).Error; err != nil {
		t.Fatalf("count ldap binding: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one LDAP binding, got %d", count)
	}

	binding, err := model.GetUserLDAPBindingByLDAPUserId("CN=Alice,OU=Company,DC=example,DC=com")
	if err != nil {
		t.Fatalf("get ldap binding: %v", err)
	}
	if binding.LDAPDisplayName != "Alice" || binding.LDAPEmail != "alice@example.com" {
		t.Fatalf("expected ldap profile snapshot, got %#v", binding)
	}
}

func TestLDAPLoginBindsExistingUserWithSameEmail(t *testing.T) {
	router := setupLDAPControllerTest(t)

	user := model.User{
		Username:    "yanghong",
		Password:    "password",
		DisplayName: "yanghong",
		Email:       "alice@example.com",
		Status:      common.UserStatusEnabled,
		AffCode:     "a012",
	}
	if err := model.DB.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	recorder, response := postLDAPLogin(t, router, "yanghong", "secret")
	if recorder.Code != http.StatusOK || !response.Success {
		t.Fatalf("expected successful login, status=%d response=%#v", recorder.Code, response)
	}
	if int(response.Data["id"].(float64)) != user.Id {
		t.Fatalf("expected existing user id %d, got %#v", user.Id, response.Data["id"])
	}

	var userCount int64
	if err := model.DB.Model(&model.User{}).Count(&userCount).Error; err != nil {
		t.Fatalf("count users: %v", err)
	}
	if userCount != 1 {
		t.Fatalf("expected LDAP login to reuse existing user, got %d users", userCount)
	}

	binding, err := model.GetUserLDAPBindingByUserId(user.Id)
	if err != nil {
		t.Fatalf("get ldap binding: %v", err)
	}
	if binding.LDAPUsername != "yanghong" || binding.LDAPEmail != "alice@example.com" {
		t.Fatalf("expected ldap binding snapshot for existing user, got %#v", binding)
	}

	refreshedUser, err := model.GetUserById(user.Id, false)
	if err != nil {
		t.Fatalf("get refreshed user: %v", err)
	}
	if refreshedUser.DisplayName != "Alice" || refreshedUser.Email != "alice@example.com" {
		t.Fatalf("expected local profile to sync from LDAP, got %#v", refreshedUser)
	}
}

func TestLDAPLoginRejectsWhenRegistrationDisabled(t *testing.T) {
	router := setupLDAPControllerTest(t)
	common.RegisterEnabled = false

	recorder, response := postLDAPLogin(t, router, "alice", "secret")
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected API error response status 200, got %d", recorder.Code)
	}
	if response.Success {
		t.Fatalf("expected login to fail when registration disabled: %#v", response)
	}
}

func TestLDAPBindCreatesBindingForCurrentUser(t *testing.T) {
	router := setupLDAPControllerTest(t)

	user := model.User{
		Id:          1,
		Username:    "local",
		Password:    "password",
		DisplayName: "Local",
		Status:      common.UserStatusEnabled,
		AffCode:     "a004",
	}
	if err := model.DB.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	payload, err := common.Marshal(map[string]string{
		"username": "alice",
		"password": "secret",
	})
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/oauth/ldap/bind", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	var response ldapAPIResponse
	if err := common.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if recorder.Code != http.StatusOK || !response.Success {
		t.Fatalf("expected successful ldap bind, status=%d response=%#v", recorder.Code, response)
	}

	binding, err := model.GetUserLDAPBindingByUserId(user.Id)
	if err != nil {
		t.Fatalf("get ldap binding: %v", err)
	}
	if binding.LDAPUserId != "CN=Alice,OU=Company,DC=example,DC=com" {
		t.Fatalf("expected ldap dn binding, got %q", binding.LDAPUserId)
	}

	refreshedUser, err := model.GetUserById(user.Id, false)
	if err != nil {
		t.Fatalf("get refreshed user: %v", err)
	}
	if refreshedUser.DisplayName != "Alice" || refreshedUser.Email != "alice@example.com" {
		t.Fatalf("expected local profile to sync from LDAP, got %#v", refreshedUser)
	}
}

func TestLDAPBindRejectsLDAPEmailOwnedByAnotherUser(t *testing.T) {
	router := setupLDAPControllerTest(t)

	currentUser := model.User{
		Id:          1,
		Username:    "axera",
		Password:    "password",
		DisplayName: "Root User",
		Status:      common.UserStatusEnabled,
		AffCode:     "a005",
	}
	if err := model.DB.Create(&currentUser).Error; err != nil {
		t.Fatalf("create current user: %v", err)
	}
	ldapEmailUser := model.User{
		Id:          2,
		Username:    "alice",
		Password:    "password",
		DisplayName: "Local Alice",
		Email:       "alice@example.com",
		Status:      common.UserStatusEnabled,
		AffCode:     "a006",
	}
	if err := model.DB.Create(&ldapEmailUser).Error; err != nil {
		t.Fatalf("create ldap email user: %v", err)
	}

	payload, err := common.Marshal(map[string]string{
		"username": "alice",
		"password": "secret",
	})
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/oauth/ldap/bind", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	var response ldapAPIResponse
	if err := common.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if recorder.Code != http.StatusOK || response.Success {
		t.Fatalf("expected ldap bind to be rejected, status=%d response=%#v", recorder.Code, response)
	}

	if _, err := model.GetUserLDAPBindingByUserId(currentUser.Id); err == nil {
		t.Fatal("current user must not receive LDAP binding for another user's email")
	}
	if _, err := model.GetUserLDAPBindingByUserId(ldapEmailUser.Id); err == nil {
		t.Fatal("manual bind rejection must not bind the LDAP email owner implicitly")
	}
}
