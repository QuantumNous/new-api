package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

type trustedHeaderProviderTestOptions struct {
	TrustedCIDRs           string
	AutoRegister           bool
	AutoMergeByEmail       bool
	SyncUsernameOnLogin    bool
	SyncDisplayNameOnLogin bool
	SyncEmailOnLogin       bool
	SyncGroupOnLogin       bool
	SyncRoleOnLogin        bool
	GroupMappingMode       string
	RoleMappingMode        string
}

func createTrustedHeaderProviderForTest(t *testing.T, options trustedHeaderProviderTestOptions) *model.CustomOAuthProvider {
	t.Helper()
	trustedCIDRs := options.TrustedCIDRs
	if strings.TrimSpace(trustedCIDRs) == "" {
		trustedCIDRs = `["127.0.0.1/32","::1/128"]`
	}
	groupMappingMode := options.GroupMappingMode
	if strings.TrimSpace(groupMappingMode) == "" {
		groupMappingMode = model.CustomOAuthMappingModeExplicitOnly
	}
	roleMappingMode := options.RoleMappingMode
	if strings.TrimSpace(roleMappingMode) == "" {
		roleMappingMode = model.CustomOAuthMappingModeExplicitOnly
	}
	provider := &model.CustomOAuthProvider{
		Name:                   "Acme Trusted Header",
		Slug:                   "acme-header",
		Kind:                   model.CustomOAuthProviderKindTrustedHeader,
		Enabled:                true,
		TrustedProxyCIDRs:      trustedCIDRs,
		ExternalIDHeader:       "X-Auth-User-Id",
		UsernameHeader:         "X-Auth-Username",
		DisplayNameHeader:      "X-Auth-Display-Name",
		EmailHeader:            "X-Auth-Email",
		GroupHeader:            "X-Auth-Group",
		RoleHeader:             "X-Auth-Role",
		GroupMapping:           `{"engineering":"vip"}`,
		RoleMapping:            `{"platform-admin":"admin"}`,
		AutoRegister:           options.AutoRegister,
		AutoMergeByEmail:       options.AutoMergeByEmail,
		SyncUsernameOnLogin:    options.SyncUsernameOnLogin,
		SyncDisplayNameOnLogin: options.SyncDisplayNameOnLogin,
		SyncEmailOnLogin:       options.SyncEmailOnLogin,
		SyncGroupOnLogin:       options.SyncGroupOnLogin,
		SyncRoleOnLogin:        options.SyncRoleOnLogin,
		GroupMappingMode:       groupMappingMode,
		RoleMappingMode:        roleMappingMode,
	}
	if err := model.CreateCustomOAuthProvider(provider); err != nil {
		t.Fatalf("failed to create trusted header provider: %v", err)
	}
	return provider
}

func postTrustedHeaderLoginForTest(t *testing.T, client *http.Client, baseURL string, providerSlug string, state string, headers map[string]string) oauthJWTAPIResponse {
	t.Helper()
	payload, err := common.Marshal(map[string]any{
		"state": state,
	})
	if err != nil {
		t.Fatalf("failed to marshal trusted header login payload: %v", err)
	}
	req, err := http.NewRequest(http.MethodPost, baseURL+"/api/auth/external/"+providerSlug+"/header/login", bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("failed to build trusted header login request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("failed to post trusted header login: %v", err)
	}
	defer resp.Body.Close()

	var response oauthJWTAPIResponse
	if err := common.DecodeJson(resp.Body, &response); err != nil {
		t.Fatalf("failed to decode trusted header login response: %v", err)
	}
	return response
}

func TestHandleCustomOAuthHeaderLoginCreatesUser(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	provider := createTrustedHeaderProviderForTest(t, trustedHeaderProviderTestOptions{
		AutoRegister:     true,
		SyncGroupOnLogin: true,
		SyncRoleOnLogin:  true,
	})

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	response := postTrustedHeaderLoginForTest(t, client, server.URL, provider.Slug, state, map[string]string{
		"X-Auth-User-Id":      "trusted-user-1",
		"X-Auth-Username":     "header-alice",
		"X-Auth-Display-Name": "Header Alice",
		"X-Auth-Email":        "header-alice@example.com",
		"X-Auth-Group":        "engineering",
		"X-Auth-Role":         "platform-admin",
	})
	if !response.Success {
		t.Fatalf("expected trusted header login success, got message: %s", response.Message)
	}

	var loginData oauthJWTLoginResponse
	if err := common.Unmarshal(response.Data, &loginData); err != nil {
		t.Fatalf("failed to decode trusted header login response: %v", err)
	}
	if loginData.Username != "header-alice" || loginData.Group != "vip" || loginData.Role != common.RoleAdminUser {
		t.Fatalf("unexpected trusted header login result: %+v", loginData)
	}
	if !model.IsProviderUserIdTaken(provider.Id, "trusted-user-1") {
		t.Fatal("expected trusted header binding to be created")
	}
	log := getLatestSystemLogForUser(t, loginData.ID)
	if !strings.Contains(log.Content, "provider_kind=trusted_header") || !strings.Contains(log.Content, "action=login") {
		t.Fatalf("expected trusted header audit log, got %s", log.Content)
	}
}

func TestHandleCustomOAuthHeaderLoginRejectsUntrustedProxy(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	provider := createTrustedHeaderProviderForTest(t, trustedHeaderProviderTestOptions{
		TrustedCIDRs: `["10.0.0.0/8"]`,
		AutoRegister: true,
	})

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	response := postTrustedHeaderLoginForTest(t, client, server.URL, provider.Slug, state, map[string]string{
		"X-Auth-User-Id": "trusted-user-2",
	})
	if response.Success {
		t.Fatal("expected untrusted proxy login to fail")
	}
}

func TestHandleCustomOAuthHeaderLoginRejectsMissingExternalID(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	provider := createTrustedHeaderProviderForTest(t, trustedHeaderProviderTestOptions{
		AutoRegister: true,
	})

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	response := postTrustedHeaderLoginForTest(t, client, server.URL, provider.Slug, state, map[string]string{
		"X-Auth-Username": "missing-id-user",
	})
	if response.Success {
		t.Fatal("expected missing external id to fail")
	}
}

func TestHandleCustomOAuthHeaderLoginRejectsDuplicateExternalIDHeaderValues(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	provider := createTrustedHeaderProviderForTest(t, trustedHeaderProviderTestOptions{
		AutoRegister: true,
	})

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	response := postTrustedHeaderLoginWithHeadersForTest(t, client, server.URL, provider.Slug, state, http.Header{
		"X-Auth-User-Id": []string{"trusted-user-1", "trusted-user-2"},
	})
	if response.Success {
		t.Fatal("expected duplicate external id header values to fail")
	}
}

func TestHandleCustomOAuthHeaderLoginRejectsDuplicateGroupHeaderValues(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	provider := createTrustedHeaderProviderForTest(t, trustedHeaderProviderTestOptions{
		AutoRegister: true,
	})

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	response := postTrustedHeaderLoginWithHeadersForTest(t, client, server.URL, provider.Slug, state, http.Header{
		"X-Auth-User-Id": []string{"trusted-user-1"},
		"X-Auth-Group":   []string{"engineering", "platform-admin"},
	})
	if response.Success {
		t.Fatal("expected duplicate group header values to fail")
	}
}

func TestHandleCustomOAuthHeaderLoginBindsExistingSessionUser(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	provider := createTrustedHeaderProviderForTest(t, trustedHeaderProviderTestOptions{
		AutoRegister:     true,
		SyncGroupOnLogin: true,
		SyncRoleOnLogin:  true,
	})
	user := createUserForBindTest(t, "header-bind-user")

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
	response := postTrustedHeaderLoginForTest(t, client, server.URL, provider.Slug, state, map[string]string{
		"X-Auth-User-Id":      "trusted-bind-user",
		"X-Auth-Group":        "engineering",
		"X-Auth-Role":         "platform-admin",
		"X-Auth-Display-Name": "Trusted Bind User",
	})
	if !response.Success {
		t.Fatalf("expected trusted header bind success, got message: %s", response.Message)
	}

	var bindData oauthJWTBindResponse
	if err := common.Unmarshal(response.Data, &bindData); err != nil {
		t.Fatalf("failed to decode trusted header bind response: %v", err)
	}
	if bindData.Action != "bind" {
		t.Fatalf("expected bind action, got %s", bindData.Action)
	}
	if !model.IsProviderUserIdTaken(provider.Id, "trusted-bind-user") {
		t.Fatal("expected trusted header binding to be created")
	}
}

func TestHandleCustomOAuthHeaderLoginMergesByEmailWhenEnabled(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	provider := createTrustedHeaderProviderForTest(t, trustedHeaderProviderTestOptions{
		AutoMergeByEmail: true,
		SyncGroupOnLogin: true,
		SyncRoleOnLogin:  true,
	})
	existingUser := createUserWithEmailForTest(t, "header-merged-user", "header-merged@example.com")

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	response := postTrustedHeaderLoginForTest(t, client, server.URL, provider.Slug, state, map[string]string{
		"X-Auth-User-Id":  "trusted-merge-user",
		"X-Auth-Email":    "header-merged@example.com",
		"X-Auth-Username": "header-merged-user",
		"X-Auth-Group":    "engineering",
		"X-Auth-Role":     "platform-admin",
	})
	if !response.Success {
		t.Fatalf("expected trusted header merge login success, got message: %s", response.Message)
	}

	var loginData oauthJWTLoginResponse
	if err := common.Unmarshal(response.Data, &loginData); err != nil {
		t.Fatalf("failed to decode trusted header merge response: %v", err)
	}
	if loginData.ID != existingUser.Id || loginData.Group != "vip" || loginData.Role != common.RoleAdminUser {
		t.Fatalf("unexpected trusted header merge result: %+v", loginData)
	}
	if !model.IsProviderUserIdTaken(provider.Id, "trusted-merge-user") {
		t.Fatal("expected merged trusted header binding to be created")
	}
}

func TestHandleCustomOAuthHeaderLoginSyncsExistingBoundUserOnLogin(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	provider := createTrustedHeaderProviderForTest(t, trustedHeaderProviderTestOptions{
		AutoRegister:     true,
		SyncGroupOnLogin: true,
		SyncRoleOnLogin:  true,
	})
	user := createUserForBindTest(t, "trusted-header-existing")
	if err := model.CreateUserOAuthBinding(&model.UserOAuthBinding{
		UserId:         user.Id,
		ProviderId:     provider.Id,
		ProviderUserId: "trusted-existing-user",
	}); err != nil {
		t.Fatalf("failed to seed trusted header binding: %v", err)
	}

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	response := postTrustedHeaderLoginForTest(t, client, server.URL, provider.Slug, state, map[string]string{
		"X-Auth-User-Id":  "trusted-existing-user",
		"X-Auth-Username": "trusted-header-existing",
		"X-Auth-Group":    "engineering",
		"X-Auth-Role":     "platform-admin",
	})
	if !response.Success {
		t.Fatalf("expected trusted header existing binding login success, got message: %s", response.Message)
	}

	reloadedUser, err := model.GetUserById(user.Id, false)
	if err != nil {
		t.Fatalf("failed to reload trusted header synced user: %v", err)
	}
	if reloadedUser.Group != "vip" || reloadedUser.Role != common.RoleAdminUser {
		t.Fatalf("expected trusted header login to sync existing user, got role=%d group=%s", reloadedUser.Role, reloadedUser.Group)
	}
}

func TestHandleCustomOAuthHeaderLoginSyncsLimitedProfileAttributesOnLogin(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	provider := createTrustedHeaderProviderForTest(t, trustedHeaderProviderTestOptions{
		AutoRegister:           true,
		SyncUsernameOnLogin:    true,
		SyncDisplayNameOnLogin: true,
		SyncEmailOnLogin:       true,
	})
	user := createUserWithEmailForTest(t, "header-legacy-user", "legacy-header@example.com")
	user.DisplayName = "Legacy Header User"
	if err := user.Update(false); err != nil {
		t.Fatalf("failed to seed legacy profile: %v", err)
	}
	if err := model.CreateUserOAuthBinding(&model.UserOAuthBinding{
		UserId:         user.Id,
		ProviderId:     provider.Id,
		ProviderUserId: "trusted-profile-user",
	}); err != nil {
		t.Fatalf("failed to seed trusted header binding: %v", err)
	}

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	response := postTrustedHeaderLoginForTest(t, client, server.URL, provider.Slug, state, map[string]string{
		"X-Auth-User-Id":      "trusted-profile-user",
		"X-Auth-Username":     "header-updated-user",
		"X-Auth-Display-Name": "Header Updated User",
		"X-Auth-Email":        "updated-header@example.com",
	})
	if !response.Success {
		t.Fatalf("expected trusted header profile sync success, got message: %s", response.Message)
	}

	reloadedUser, err := model.GetUserById(user.Id, false)
	if err != nil {
		t.Fatalf("failed to reload synced trusted header user: %v", err)
	}
	if reloadedUser.Username != "header-updated-user" || reloadedUser.DisplayName != "Header Updated User" || reloadedUser.Email != "updated-header@example.com" {
		t.Fatalf("expected synced trusted header profile, got username=%s display_name=%s email=%s", reloadedUser.Username, reloadedUser.DisplayName, reloadedUser.Email)
	}
}

func TestHandleCustomOAuthHeaderLoginSkipsLimitedProfileAttributeConflicts(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	provider := createTrustedHeaderProviderForTest(t, trustedHeaderProviderTestOptions{
		AutoRegister:           true,
		SyncUsernameOnLogin:    true,
		SyncDisplayNameOnLogin: true,
		SyncEmailOnLogin:       true,
	})
	user := createUserWithEmailForTest(t, "header-safe-user", "safe@example.com")
	user.DisplayName = "Safe User"
	if err := user.Update(false); err != nil {
		t.Fatalf("failed to seed safe profile: %v", err)
	}
	_ = createUserWithEmailForTest(t, "taken-user", "taken@example.com")
	if err := model.CreateUserOAuthBinding(&model.UserOAuthBinding{
		UserId:         user.Id,
		ProviderId:     provider.Id,
		ProviderUserId: "trusted-conflict-user",
	}); err != nil {
		t.Fatalf("failed to seed trusted header binding: %v", err)
	}

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	response := postTrustedHeaderLoginForTest(t, client, server.URL, provider.Slug, state, map[string]string{
		"X-Auth-User-Id":      "trusted-conflict-user",
		"X-Auth-Username":     "taken-user",
		"X-Auth-Display-Name": "Conflict Name",
		"X-Auth-Email":        "taken@example.com",
	})
	if !response.Success {
		t.Fatalf("expected trusted header conflict sync login to succeed, got message: %s", response.Message)
	}

	reloadedUser, err := model.GetUserById(user.Id, false)
	if err != nil {
		t.Fatalf("failed to reload conflict trusted header user: %v", err)
	}
	if reloadedUser.Username != "header-safe-user" {
		t.Fatalf("expected username conflict to be skipped, got %s", reloadedUser.Username)
	}
	if reloadedUser.Email != "safe@example.com" {
		t.Fatalf("expected email conflict to be skipped, got %s", reloadedUser.Email)
	}
	if reloadedUser.DisplayName != "Conflict Name" {
		t.Fatalf("expected display name to be synced, got %s", reloadedUser.DisplayName)
	}

	var syncLog model.Log
	if err := model.LOG_DB.Where("user_id = ? AND type = ? AND content LIKE ?", user.Id, model.LogTypeSystem, "外部登录同步用户属性%").Order("created_at desc").First(&syncLog).Error; err != nil {
		t.Fatalf("failed to load trusted header sync log: %v", err)
	}
	if !strings.Contains(syncLog.Content, "跳过：") || !strings.Contains(syncLog.Content, "username taken-user 已被占用") || !strings.Contains(syncLog.Content, "email taken@example.com 已被其他用户占用") {
		t.Fatalf("expected conflict sync log to record skipped fields, got %s", syncLog.Content)
	}
}

func TestHandleCustomOAuthHeaderLoginRejectsDisabledMergedUser(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	provider := createTrustedHeaderProviderForTest(t, trustedHeaderProviderTestOptions{
		AutoMergeByEmail: true,
		SyncGroupOnLogin: true,
		SyncRoleOnLogin:  true,
	})
	disabledUser := createUserWithEmailForTest(t, "trusted-disabled-merge", "trusted-disabled@example.com")
	if err := model.DB.Model(disabledUser).Update("status", common.UserStatusDisabled).Error; err != nil {
		t.Fatalf("failed to disable trusted header merged user: %v", err)
	}

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	state := fetchOAuthStateForTest(t, client, server.URL)
	response := postTrustedHeaderLoginForTest(t, client, server.URL, provider.Slug, state, map[string]string{
		"X-Auth-User-Id": "trusted-disabled-merge-user",
		"X-Auth-Email":   "trusted-disabled@example.com",
	})
	if response.Success {
		t.Fatal("expected disabled merged trusted header user login to fail")
	}
	if model.IsProviderUserIdTaken(provider.Id, "trusted-disabled-merge-user") {
		t.Fatal("expected disabled merged trusted header user not to receive binding")
	}
	log := getLatestSystemLogForUser(t, disabledUser.Id)
	if !strings.Contains(log.Content, "email_merge=true") || !strings.Contains(log.Content, "failure_reason=user_disabled") {
		t.Fatalf("expected disabled merged trusted header audit log, got %s", log.Content)
	}
}

func TestHandleCustomOAuthHeaderLoginRejectsInvalidState(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	provider := createTrustedHeaderProviderForTest(t, trustedHeaderProviderTestOptions{
		AutoRegister: true,
	})

	router := newCustomOAuthJWTRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newTestHTTPClient(t)
	_ = fetchOAuthStateForTest(t, client, server.URL)
	response := postTrustedHeaderLoginForTest(t, client, server.URL, provider.Slug, "invalid-state", map[string]string{
		"X-Auth-User-Id": "trusted-invalid-state",
	})
	if response.Success {
		t.Fatal("expected trusted header login with invalid state to fail")
	}
}
