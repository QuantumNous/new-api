package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service/hydra"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
)

func setupTestRouter(mock *hydra.MockProvider) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	// Set up cookie session store for testing
	store := cookie.NewStore([]byte("test-secret"))
	r.Use(sessions.Sessions("session", store))

	ctrl := NewOAuthProviderController(mock)

	// OAuth login routes
	r.GET("/oauth/login", ctrl.OAuthLogin)
	r.POST("/oauth/login", ctrl.OAuthLoginSubmit)
	r.POST("/oauth/login/2fa", ctrl.OAuthLogin2FA)

	// OAuth consent routes
	r.GET("/oauth/consent", ctrl.OAuthConsent)
	r.POST("/oauth/consent", ctrl.OAuthConsentSubmit)
	r.POST("/oauth/consent/reject", ctrl.OAuthConsentReject)

	// OAuth logout routes
	r.GET("/oauth/logout", ctrl.OAuthLogout)

	// Test helper to set session cookie
	r.GET("/_test/set-session", func(c *gin.Context) {
		idParam := c.Query("id")
		if idParam == "" {
			c.JSON(http.StatusBadRequest, gin.H{"success": false})
			return
		}
		id, err := strconv.Atoi(idParam)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false})
			return
		}
		session := sessions.Default(c)
		session.Set("id", id)
		if err := session.Save(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	return r
}

func setSessionCookie(router *gin.Engine, userID string) string {
	req, _ := http.NewRequest("GET", "/_test/set-session?id="+userID, nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w.Header().Get("Set-Cookie")
}

func TestOAuthLogin_MissingChallenge(t *testing.T) {
	mock := hydra.NewMockProvider()
	router := setupTestRouter(mock)

	req, _ := http.NewRequest("GET", "/oauth/login", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["success"] != false {
		t.Error("Expected success=false")
	}
	if resp["message"] != "missing login_challenge" {
		t.Errorf("Expected 'missing login_challenge', got %v", resp["message"])
	}
}

func TestOAuthLogin_InvalidChallenge(t *testing.T) {
	mock := hydra.NewMockProvider()
	router := setupTestRouter(mock)

	req, _ := http.NewRequest("GET", "/oauth/login?login_challenge=invalid", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["success"] != false {
		t.Error("Expected success=false")
	}
}

func TestOAuthLogin_SkipTrue(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetLoginRequest("skip-challenge", "test-client", "Test App", []string{"openid"}, true, "123")
	router := setupTestRouter(mock)

	req, _ := http.NewRequest("GET", "/oauth/login?login_challenge=skip-challenge", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should return redirect info when skip=true
	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	// Check that login was accepted
	if _, ok := mock.AcceptedLogins["skip-challenge"]; !ok {
		t.Error("Login should have been accepted")
	}
}

func TestOAuthLogin_ShowLoginPage(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetLoginRequest("login-challenge", "test-client", "Test App", []string{"openid", "profile"}, false, "")
	router := setupTestRouter(mock)

	req, _ := http.NewRequest("GET", "/oauth/login?login_challenge=login-challenge", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should return login page info
	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["success"] != true {
		t.Error("Expected success=true")
	}

	data := resp["data"].(map[string]interface{})
	if data["challenge"] != "login-challenge" {
		t.Errorf("Expected challenge 'login-challenge', got %v", data["challenge"])
	}
	if data["client_id"] != "test-client" {
		t.Errorf("Expected client_id 'test-client', got %v", data["client_id"])
	}
}

func TestOAuthLogin_HydraError(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetLoginRequest("error-challenge", "test-client", "Test App", []string{"openid"}, true, "123")
	mock.AcceptLoginErr = http.ErrAbortHandler
	router := setupTestRouter(mock)

	req, _ := http.NewRequest("GET", "/oauth/login?login_challenge=error-challenge", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status %d, got %d", http.StatusInternalServerError, w.Code)
	}
}

func TestOAuthLoginSubmit_MissingChallenge(t *testing.T) {
	mock := hydra.NewMockProvider()
	router := setupTestRouter(mock)

	form := url.Values{}
	form.Set("username", "testuser")
	form.Set("password", "testpass")
	req, _ := http.NewRequest("POST", "/oauth/login", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["message"] != "missing challenge" {
		t.Errorf("Expected 'missing challenge', got %v", resp["message"])
	}
}

func TestOAuthLoginSubmit_MissingCredentials(t *testing.T) {
	mock := hydra.NewMockProvider()
	router := setupTestRouter(mock)

	form := url.Values{}
	form.Set("challenge", "test-challenge")
	req, _ := http.NewRequest("POST", "/oauth/login", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["message"] != "missing username or password" {
		t.Errorf("Expected 'missing username or password', got %v", resp["message"])
	}
}

func TestOAuthConsent_MissingChallenge(t *testing.T) {
	mock := hydra.NewMockProvider()
	router := setupTestRouter(mock)

	req, _ := http.NewRequest("GET", "/oauth/consent", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["message"] != "missing consent_challenge" {
		t.Errorf("Expected 'missing consent_challenge', got %v", resp["message"])
	}
}

func TestOAuthConsent_InvalidChallenge(t *testing.T) {
	mock := hydra.NewMockProvider()
	router := setupTestRouter(mock)

	req, _ := http.NewRequest("GET", "/oauth/consent?consent_challenge=invalid", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestOAuthConsent_RequiresSession(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetConsentRequest("consent-no-session", "third-party-app", "Third Party", "123", []string{"openid"}, false)
	router := setupTestRouter(mock)

	req, _ := http.NewRequest("GET", "/oauth/consent?consent_challenge=consent-no-session", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	if mock.RejectedConsents["consent-no-session"] != "login_required" {
		t.Error("Consent should have been rejected with login_required")
	}
}

func TestOAuthConsent_SessionMismatch(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetConsentRequest("consent-mismatch", "third-party-app", "Third Party", "123", []string{"openid"}, false)
	router := setupTestRouter(mock)
	cookie := setSessionCookie(router, "456")

	req, _ := http.NewRequest("GET", "/oauth/consent?consent_challenge=consent-mismatch", nil)
	req.Header.Set("Cookie", cookie)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	if mock.RejectedConsents["consent-mismatch"] != "login_required" {
		t.Error("Consent should have been rejected with login_required")
	}
}

func TestOAuthConsent_SkipTrue(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetConsentRequest("skip-consent", "test-client", "Test App", "123", []string{"openid"}, true)
	router := setupTestRouter(mock)
	cookie := setSessionCookie(router, "123")

	req, _ := http.NewRequest("GET", "/oauth/consent?consent_challenge=skip-consent", nil)
	req.Header.Set("Cookie", cookie)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should return redirect info when skip=true
	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	// Check that consent was accepted
	if _, ok := mock.AcceptedConsents["skip-consent"]; !ok {
		t.Error("Consent should have been accepted")
	}
}

func TestOAuthConsent_TrustedClient(t *testing.T) {
	// Setup trusted clients for this test
	oldTrustedClients := common.HydraTrustedClients
	common.HydraTrustedClients = []string{"new-api-web", "new-api-admin"}
	defer func() { common.HydraTrustedClients = oldTrustedClients }()

	mock := hydra.NewMockProvider()
	// "new-api-web" is a trusted client
	mock.SetConsentRequest("trusted-consent", "new-api-web", "Web App", "123", []string{"openid", "profile"}, false)
	router := setupTestRouter(mock)
	cookie := setSessionCookie(router, "123")

	req, _ := http.NewRequest("GET", "/oauth/consent?consent_challenge=trusted-consent", nil)
	req.Header.Set("Cookie", cookie)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should return redirect info for trusted client (auto-consent)
	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	// Check that consent was accepted
	if _, ok := mock.AcceptedConsents["trusted-consent"]; !ok {
		t.Error("Consent should have been accepted for trusted client")
	}
}

func TestOAuthConsent_ShowConsentPage(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetConsentRequest("consent-challenge", "third-party-app", "Third Party", "123", []string{"openid", "profile", "email"}, false)
	router := setupTestRouter(mock)
	cookie := setSessionCookie(router, "123")

	req, _ := http.NewRequest("GET", "/oauth/consent?consent_challenge=consent-challenge", nil)
	req.Header.Set("Cookie", cookie)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should return consent page info for non-trusted clients
	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["success"] != true {
		t.Error("Expected success=true")
	}

	data := resp["data"].(map[string]interface{})
	if data["challenge"] != "consent-challenge" {
		t.Errorf("Expected challenge 'consent-challenge', got %v", data["challenge"])
	}
	if data["client_id"] != "third-party-app" {
		t.Errorf("Expected client_id 'third-party-app', got %v", data["client_id"])
	}
}

func TestOAuthConsentSubmit_MissingChallenge(t *testing.T) {
	mock := hydra.NewMockProvider()
	router := setupTestRouter(mock)

	form := url.Values{}
	form.Add("grant_scope", "openid")
	req, _ := http.NewRequest("POST", "/oauth/consent", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["message"] != "missing challenge" {
		t.Errorf("Expected 'missing challenge', got %v", resp["message"])
	}
}

func TestOAuthConsentSubmit_Success(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetConsentRequest("consent-submit", "test-client", "Test App", "123", []string{"openid", "profile"}, false)
	router := setupTestRouter(mock)
	cookie := setSessionCookie(router, "123")

	form := url.Values{}
	form.Set("consent_challenge", "consent-submit")
	form.Add("grant_scope", "openid")
	form.Add("grant_scope", "profile")
	form.Set("remember", "true")
	req, _ := http.NewRequest("POST", "/oauth/consent", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Cookie", cookie)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["success"] != true {
		t.Error("Expected success=true")
	}
	if resp["redirect_to"] == nil {
		t.Error("Expected redirect_to in response")
	}

	// Check that consent was accepted with correct scopes
	if scopes, ok := mock.AcceptedConsents["consent-submit"]; !ok {
		t.Error("Consent should have been accepted")
	} else if len(scopes) != 2 {
		t.Errorf("Expected 2 scopes, got %d", len(scopes))
	}
}

func TestOAuthConsentSubmit_RequiresSession(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetConsentRequest("consent-submit-no-session", "test-client", "Test App", "123", []string{"openid"}, false)
	router := setupTestRouter(mock)

	form := url.Values{}
	form.Set("consent_challenge", "consent-submit-no-session")
	form.Add("grant_scope", "openid")
	req, _ := http.NewRequest("POST", "/oauth/consent", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	if mock.RejectedConsents["consent-submit-no-session"] != "login_required" {
		t.Error("Consent submit should have been rejected with login_required")
	}
	if _, ok := mock.AcceptedConsents["consent-submit-no-session"]; ok {
		t.Error("Consent submit should not be accepted without session")
	}
}

func TestOAuthConsentReject_MissingChallenge(t *testing.T) {
	mock := hydra.NewMockProvider()
	router := setupTestRouter(mock)

	form := url.Values{}
	req, _ := http.NewRequest("POST", "/oauth/consent/reject", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestOAuthConsentReject_Success(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetConsentRequest("reject-consent", "test-client", "Test App", "123", []string{"openid"}, false)
	router := setupTestRouter(mock)
	cookie := setSessionCookie(router, "123")

	form := url.Values{}
	form.Set("consent_challenge", "reject-consent")
	req, _ := http.NewRequest("POST", "/oauth/consent/reject", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Cookie", cookie)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	// Check that consent was rejected
	if _, ok := mock.RejectedConsents["reject-consent"]; !ok {
		t.Error("Consent should have been rejected")
	}
}

func TestOAuthConsentReject_RequiresSession(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetConsentRequest("reject-no-session", "test-client", "Test App", "123", []string{"openid"}, false)
	router := setupTestRouter(mock)

	form := url.Values{}
	form.Set("consent_challenge", "reject-no-session")
	req, _ := http.NewRequest("POST", "/oauth/consent/reject", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	if mock.RejectedConsents["reject-no-session"] != "login_required" {
		t.Error("Consent reject should have been rejected with login_required")
	}
}

func TestOAuthLogout_MissingChallenge(t *testing.T) {
	mock := hydra.NewMockProvider()
	router := setupTestRouter(mock)

	req, _ := http.NewRequest("GET", "/oauth/logout", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["message"] != "missing logout_challenge" {
		t.Errorf("Expected 'missing logout_challenge', got %v", resp["message"])
	}
}

func TestOAuthLogout_InvalidChallenge(t *testing.T) {
	mock := hydra.NewMockProvider()
	router := setupTestRouter(mock)

	req, _ := http.NewRequest("GET", "/oauth/logout?logout_challenge=invalid", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestOAuthLogout_Success(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetLogoutRequest("logout-challenge", "123", "session-456")
	router := setupTestRouter(mock)

	req, _ := http.NewRequest("GET", "/oauth/logout?logout_challenge=logout-challenge", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should return redirect info after accepting logout
	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	// Check that logout was accepted
	if _, ok := mock.AcceptedLogouts["logout-challenge"]; !ok {
		t.Error("Logout should have been accepted")
	}
}

func TestIsTrustedOAuthClient(t *testing.T) {
	// Setup trusted clients for this test
	oldTrustedClients := common.HydraTrustedClients
	common.HydraTrustedClients = []string{"new-api-web", "new-api-admin"}
	defer func() { common.HydraTrustedClients = oldTrustedClients }()

	tests := []struct {
		clientID string
		expected bool
	}{
		{"new-api-web", true},
		{"new-api-admin", true},
		{"third-party-app", false},
		{"unknown", false},
		{"", false},
	}

	for _, tt := range tests {
		result := isTrustedOAuthClient(tt.clientID)
		if result != tt.expected {
			t.Errorf("isTrustedOAuthClient(%q) = %v, expected %v", tt.clientID, result, tt.expected)
		}
	}
}
