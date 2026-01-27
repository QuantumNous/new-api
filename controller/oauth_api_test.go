package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/hydra"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) func() {
	// Create in-memory SQLite database for testing
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}

	// Auto migrate necessary tables
	err = db.AutoMigrate(&model.User{}, &model.Token{})
	if err != nil {
		t.Fatalf("failed to migrate test database: %v", err)
	}

	// Set the global DB
	model.DB = db

	// Return cleanup function
	return func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
		model.DB = nil
	}
}

func createTestUser(t *testing.T, id int, username string) *model.User {
	user := &model.User{
		Id:           id,
		Username:     username,
		DisplayName:  "Test User " + username,
		Email:        username + "@test.com",
		Group:        "default",
		Quota:        100000,
		UsedQuota:    5000,
		RequestCount: 42,
		Status:       1,
		AffCode:      fmt.Sprintf("aff_%s_%d", username, id), // Unique aff_code
	}
	err := model.DB.Create(user).Error
	if err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}
	return user
}

func setupOAuthAPITestRouter(mock *hydra.MockProvider) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	// Apply OAuth middleware
	oauthAPI := r.Group("/api/v1/oauth")
	oauthAPI.Use(middleware.OAuthTokenAuth(mock))
	{
		oauthAPI.GET("/userinfo", OAuthGetUserInfo)
		oauthAPI.GET("/balance", OAuthGetBalance)
		oauthAPI.GET("/usage", OAuthGetUsage)
	}

	return r
}

func TestOAuthGetUserInfo_Unauthorized(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	mock := hydra.NewMockProvider()
	router := setupOAuthAPITestRouter(mock)

	req, _ := http.NewRequest("GET", "/api/v1/oauth/userinfo", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestOAuthGetUserInfo_Success(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	// Create test user with ID 123
	createTestUser(t, 123, "testuser")

	mock := hydra.NewMockProvider()
	mock.SetIntrospectedToken("valid-token", true, "123", "openid profile", "test-client")
	router := setupOAuthAPITestRouter(mock)

	req, _ := http.NewRequest("GET", "/api/v1/oauth/userinfo", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["success"] != true {
		t.Errorf("Expected success=true, got %v", resp["success"])
	}

	data := resp["data"].(map[string]interface{})
	if data["username"] != "testuser" {
		t.Errorf("Expected username 'testuser', got %v", data["username"])
	}
}

func TestOAuthGetUserInfo_UserNotFound(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	// No user created - user 123 doesn't exist
	mock := hydra.NewMockProvider()
	mock.SetIntrospectedToken("valid-token", true, "123", "openid profile", "test-client")
	router := setupOAuthAPITestRouter(mock)

	req, _ := http.NewRequest("GET", "/api/v1/oauth/userinfo", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, w.Code)
	}
}

func TestOAuthGetBalance_Unauthorized(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	mock := hydra.NewMockProvider()
	router := setupOAuthAPITestRouter(mock)

	req, _ := http.NewRequest("GET", "/api/v1/oauth/balance", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestOAuthGetBalance_Success(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	createTestUser(t, 123, "testuser")

	mock := hydra.NewMockProvider()
	mock.SetIntrospectedToken("valid-token", true, "123", "balance:read", "test-client")
	router := setupOAuthAPITestRouter(mock)

	req, _ := http.NewRequest("GET", "/api/v1/oauth/balance", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["success"] != true {
		t.Errorf("Expected success=true, got %v", resp["success"])
	}

	data := resp["data"].(map[string]interface{})
	// Quota should be 100000 as set in createTestUser
	if data["quota"].(float64) != 100000 {
		t.Errorf("Expected quota 100000, got %v", data["quota"])
	}
	if data["used_quota"].(float64) != 5000 {
		t.Errorf("Expected used_quota 5000, got %v", data["used_quota"])
	}
}

func TestOAuthGetUsage_Unauthorized(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	mock := hydra.NewMockProvider()
	router := setupOAuthAPITestRouter(mock)

	req, _ := http.NewRequest("GET", "/api/v1/oauth/usage", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestOAuthGetUsage_Success(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	createTestUser(t, 123, "testuser")

	mock := hydra.NewMockProvider()
	mock.SetIntrospectedToken("valid-token", true, "123", "usage:read", "test-client")
	router := setupOAuthAPITestRouter(mock)

	req, _ := http.NewRequest("GET", "/api/v1/oauth/usage", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["success"] != true {
		t.Errorf("Expected success=true, got %v", resp["success"])
	}

	data := resp["data"].(map[string]interface{})
	if data["request_count"].(float64) != 42 {
		t.Errorf("Expected request_count 42, got %v", data["request_count"])
	}
}

func TestOAuthAPI_ScopeInContext(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	mock := hydra.NewMockProvider()
	mock.SetIntrospectedToken("scoped-token", true, "456", "openid balance:read tokens:write", "third-party-app")

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.OAuthTokenAuth(mock))
	r.GET("/test-scope", func(c *gin.Context) {
		scope := c.GetString("oauth_scope")
		clientID := c.GetString("oauth_client_id")
		c.JSON(200, gin.H{
			"scope":     scope,
			"client_id": clientID,
		})
	})

	req, _ := http.NewRequest("GET", "/test-scope", nil)
	req.Header.Set("Authorization", "Bearer scoped-token")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["scope"] != "openid balance:read tokens:write" {
		t.Errorf("Expected full scope in context, got %v", resp["scope"])
	}
	if resp["client_id"] != "third-party-app" {
		t.Errorf("Expected client_id 'third-party-app', got %v", resp["client_id"])
	}
}

func setupOAuthAPITestRouterWithTokens(mock *hydra.MockProvider) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	// Apply OAuth middleware
	oauthAPI := r.Group("/api/v1/oauth")
	oauthAPI.Use(middleware.OAuthTokenAuth(mock))
	{
		oauthAPI.GET("/userinfo", OAuthGetUserInfo)
		oauthAPI.GET("/balance", OAuthGetBalance)
		oauthAPI.GET("/usage", OAuthGetUsage)
		oauthAPI.GET("/tokens", OAuthListTokens)
		oauthAPI.POST("/tokens", OAuthCreateToken)
		oauthAPI.DELETE("/tokens/:id", OAuthDeleteToken)
	}

	return r
}

func TestOAuthListTokens_Success(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	createTestUser(t, 123, "testuser")

	// Create some test tokens for the user
	token1 := &model.Token{
		UserId:         123,
		Name:           "Test Token 1",
		Key:            "sk-test1",
		Status:         1,
		UnlimitedQuota: false,
		RemainQuota:    1000,
	}
	token2 := &model.Token{
		UserId:         123,
		Name:           "Test Token 2",
		Key:            "sk-test2",
		Status:         1,
		UnlimitedQuota: true,
	}
	model.DB.Create(token1)
	model.DB.Create(token2)

	mock := hydra.NewMockProvider()
	mock.SetIntrospectedToken("valid-token", true, "123", "tokens:read", "test-client")
	router := setupOAuthAPITestRouterWithTokens(mock)

	req, _ := http.NewRequest("GET", "/api/v1/oauth/tokens", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["success"] != true {
		t.Errorf("Expected success=true, got %v", resp["success"])
	}

	tokens := resp["data"].([]interface{})
	if len(tokens) != 2 {
		t.Errorf("Expected 2 tokens, got %d", len(tokens))
	}

	// Verify key is not exposed in list
	firstToken := tokens[0].(map[string]interface{})
	if _, hasKey := firstToken["key"]; hasKey {
		t.Error("Token key should not be exposed in list")
	}
}

func TestOAuthCreateToken_Success(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	createTestUser(t, 123, "testuser")

	mock := hydra.NewMockProvider()
	mock.SetIntrospectedToken("valid-token", true, "123", "tokens:write", "test-client")
	router := setupOAuthAPITestRouterWithTokens(mock)

	body := strings.NewReader(`{"name": "New API Token"}`)
	req, _ := http.NewRequest("POST", "/api/v1/oauth/tokens", body)
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["success"] != true {
		t.Errorf("Expected success=true, got %v", resp["success"])
	}

	data := resp["data"].(map[string]interface{})
	if data["name"] != "New API Token" {
		t.Errorf("Expected name 'New API Token', got %v", data["name"])
	}
	// Key should be returned on creation
	if data["key"] == nil || data["key"] == "" {
		t.Error("Token key should be returned on creation")
	}
}

func TestOAuthCreateToken_InvalidRequest(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	createTestUser(t, 123, "testuser")

	mock := hydra.NewMockProvider()
	mock.SetIntrospectedToken("valid-token", true, "123", "tokens:write", "test-client")
	router := setupOAuthAPITestRouterWithTokens(mock)

	// Missing required name field
	body := strings.NewReader(`{}`)
	req, _ := http.NewRequest("POST", "/api/v1/oauth/tokens", body)
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestOAuthDeleteToken_Success(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	createTestUser(t, 123, "testuser")

	// Create a token to delete
	token := &model.Token{
		UserId: 123,
		Name:   "Token to Delete",
		Key:    "sk-delete-me",
		Status: 1,
	}
	model.DB.Create(token)
	tokenId := token.Id

	mock := hydra.NewMockProvider()
	mock.SetIntrospectedToken("valid-token", true, "123", "tokens:write", "test-client")
	router := setupOAuthAPITestRouterWithTokens(mock)

	req, _ := http.NewRequest("DELETE", fmt.Sprintf("/api/v1/oauth/tokens/%d", tokenId), nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should succeed
	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
	}
}

func TestOAuthDeleteToken_NotOwned(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	createTestUser(t, 123, "testuser")
	createTestUser(t, 456, "otheruser")

	// Create a token owned by another user
	token := &model.Token{
		UserId: 456,
		Name:   "Other User's Token",
		Key:    "sk-other",
		Status: 1,
	}
	model.DB.Create(token)
	tokenId := token.Id

	mock := hydra.NewMockProvider()
	mock.SetIntrospectedToken("valid-token", true, "123", "tokens:write", "test-client")
	router := setupOAuthAPITestRouterWithTokens(mock)

	req, _ := http.NewRequest("DELETE", fmt.Sprintf("/api/v1/oauth/tokens/%d", tokenId), nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should fail - can't delete other user's token
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, w.Code)
	}
}
