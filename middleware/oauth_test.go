package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/service/hydra"
	"github.com/gin-gonic/gin"
)

func setupOAuthTestRouter(mock *hydra.MockProvider) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(OAuthTokenAuth(mock))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"id":              c.GetInt("id"),
			"auth_method":     c.GetString("auth_method"),
			"oauth_client_id": c.GetString("oauth_client_id"),
			"oauth_scope":     c.GetString("oauth_scope"),
		})
	})
	return r
}

func TestOAuthTokenAuth_MissingToken(t *testing.T) {
	mock := hydra.NewMockProvider()
	router := setupOAuthTestRouter(mock)

	req, _ := http.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestOAuthTokenAuth_ValidToken(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetIntrospectedToken("valid-oauth-token", true, "123", "openid profile", "test-client")
	router := setupOAuthTestRouter(mock)

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer valid-oauth-token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["auth_method"] != "oauth" {
		t.Errorf("Expected auth_method 'oauth', got %v", resp["auth_method"])
	}
	if resp["oauth_client_id"] != "test-client" {
		t.Errorf("Expected oauth_client_id 'test-client', got %v", resp["oauth_client_id"])
	}
}

func TestOAuthTokenAuth_InactiveToken(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetIntrospectedToken("expired-token", false, "", "", "")
	router := setupOAuthTestRouter(mock)

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer expired-token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestOAuthTokenAuth_UnknownToken(t *testing.T) {
	mock := hydra.NewMockProvider()
	router := setupOAuthTestRouter(mock)

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer unknown-token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestOAuthTokenAuth_HydraError(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.IntrospectTokenErr = http.ErrAbortHandler
	router := setupOAuthTestRouter(mock)

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer any-token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestOAuthTokenAuth_ExtractScopes(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetIntrospectedToken("scoped-token", true, "456", "openid balance:read tokens:write", "third-party-app")
	router := setupOAuthTestRouter(mock)

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer scoped-token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["oauth_scope"] != "openid balance:read tokens:write" {
		t.Errorf("Expected full scope, got %v", resp["oauth_scope"])
	}
}

// =====================
// RequireScope Middleware Tests
// =====================

func setupScopeTestRouter(mock *hydra.MockProvider, requiredScopes ...string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(OAuthTokenAuth(mock))
	r.Use(RequireScope(requiredScopes...))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"success": true})
	})
	return r
}

func TestRequireScope_HasRequiredScope(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetIntrospectedToken("token", true, "123", "openid balance:read", "client")
	router := setupScopeTestRouter(mock, "balance:read")

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}
}

func TestRequireScope_MissingRequiredScope(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetIntrospectedToken("token", true, "123", "openid profile", "client")
	router := setupScopeTestRouter(mock, "balance:read")

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status %d, got %d", http.StatusForbidden, w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["success"] != false {
		t.Errorf("Expected success=false, got %v", resp["success"])
	}
}

func TestRequireScope_MultipleScopes_AllPresent(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetIntrospectedToken("token", true, "123", "openid balance:read tokens:write", "client")
	router := setupScopeTestRouter(mock, "balance:read", "tokens:write")

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}
}

func TestRequireScope_MultipleScopes_OneMissing(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetIntrospectedToken("token", true, "123", "openid balance:read", "client")
	router := setupScopeTestRouter(mock, "balance:read", "tokens:write")

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status %d, got %d", http.StatusForbidden, w.Code)
	}
}

func TestRequireScope_NoScopeInContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	// No OAuthTokenAuth middleware, so no scope in context
	r.Use(RequireScope("balance:read"))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"success": true})
	})

	req, _ := http.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status %d, got %d", http.StatusForbidden, w.Code)
	}
}

func TestRequireScope_EmptyRequirement(t *testing.T) {
	mock := hydra.NewMockProvider()
	mock.SetIntrospectedToken("token", true, "123", "openid", "client")
	router := setupScopeTestRouter(mock) // No scopes required

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should pass when no scopes required
	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}
}
