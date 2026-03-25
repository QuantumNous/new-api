package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type authMiddlewareAPIResponse struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

type authMiddlewareInfoResponse struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Role     int    `json:"role"`
	Group    string `json:"group"`
}

func setupAuthMiddlewareTestDB(t *testing.T) {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}
	model.DB = db
	model.LOG_DB = db
	if err := db.AutoMigrate(&model.User{}); err != nil {
		t.Fatalf("failed to migrate users table: %v", err)
	}

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
}

func newAuthMiddlewareTestRouter(t *testing.T) *gin.Engine {
	t.Helper()

	router := gin.New()
	store := cookie.NewStore([]byte("auth-middleware-test-secret"))
	router.Use(sessions.Sessions("session", store))

	router.GET("/test/login/:id", func(c *gin.Context) {
		userID, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
			return
		}
		user, err := model.GetUserById(userID, false)
		if err != nil {
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

	router.GET("/auth/info", UserAuth(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"id":       c.GetInt("id"),
				"username": c.GetString("username"),
				"role":     c.GetInt("role"),
				"group":    c.GetString("group"),
			},
		})
	})

	router.GET("/admin/ping", AdminAuth(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
	})

	return router
}

func createAuthMiddlewareTestUser(t *testing.T, username string, role int, status int, group string) *model.User {
	t.Helper()

	password, err := common.Password2Hash("12345678")
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}
	user := &model.User{
		Username:    username,
		Password:    password,
		DisplayName: username,
		Role:        role,
		Status:      status,
		Group:       group,
		AffCode:     username + "-aff",
	}
	if err := model.DB.Create(user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}
	return user
}

func newAuthMiddlewareTestClient(t *testing.T) *http.Client {
	t.Helper()

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("failed to create cookie jar: %v", err)
	}
	return &http.Client{Jar: jar}
}

func establishAuthMiddlewareSession(t *testing.T, client *http.Client, baseURL string, userID int) {
	t.Helper()

	response, err := client.Get(fmt.Sprintf("%s/test/login/%d", baseURL, userID))
	if err != nil {
		t.Fatalf("failed to establish session: %v", err)
	}
	defer response.Body.Close()

	var payload authMiddlewareAPIResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatalf("failed to decode session response: %v", err)
	}
	if !payload.Success {
		t.Fatalf("expected session setup success, got message: %s", payload.Message)
	}
}

func performAuthMiddlewareRequest(t *testing.T, client *http.Client, method string, url string, userID int) authMiddlewareAPIResponse {
	t.Helper()

	request, err := http.NewRequest(method, url, nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	request.Header.Set("New-Api-User", strconv.Itoa(userID))

	response, err := client.Do(request)
	if err != nil {
		t.Fatalf("failed to execute request: %v", err)
	}
	defer response.Body.Close()

	var payload authMiddlewareAPIResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatalf("failed to decode api response: %v", err)
	}
	return payload
}

func TestUserAuthRejectsDisabledSessionImmediately(t *testing.T) {
	setupAuthMiddlewareTestDB(t)
	user := createAuthMiddlewareTestUser(t, "bob", common.RoleCommonUser, common.UserStatusEnabled, "default")

	router := newAuthMiddlewareTestRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newAuthMiddlewareTestClient(t)
	establishAuthMiddlewareSession(t, client, server.URL, user.Id)

	user.Status = common.UserStatusDisabled
	if err := user.Update(false); err != nil {
		t.Fatalf("failed to disable user: %v", err)
	}

	response := performAuthMiddlewareRequest(t, client, http.MethodGet, server.URL+"/auth/info", user.Id)
	if response.Success {
		t.Fatalf("expected disabled session request to fail")
	}
	if response.Message != "用户已被封禁" {
		t.Fatalf("unexpected error message: %s", response.Message)
	}
}

func TestAdminAuthRejectsDowngradedSessionImmediately(t *testing.T) {
	setupAuthMiddlewareTestDB(t)
	user := createAuthMiddlewareTestUser(t, "alice", common.RoleAdminUser, common.UserStatusEnabled, "vip")

	router := newAuthMiddlewareTestRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newAuthMiddlewareTestClient(t)
	establishAuthMiddlewareSession(t, client, server.URL, user.Id)

	user.Role = common.RoleCommonUser
	if err := user.Update(false); err != nil {
		t.Fatalf("failed to downgrade user: %v", err)
	}

	response := performAuthMiddlewareRequest(t, client, http.MethodGet, server.URL+"/admin/ping", user.Id)
	if response.Success {
		t.Fatalf("expected downgraded admin request to fail")
	}
	if response.Message != "无权进行此操作，权限不足" {
		t.Fatalf("unexpected error message: %s", response.Message)
	}
}

func TestUserAuthRefreshesLatestGroupFromDatabase(t *testing.T) {
	setupAuthMiddlewareTestDB(t)
	user := createAuthMiddlewareTestUser(t, "charlie", common.RoleCommonUser, common.UserStatusEnabled, "default")

	router := newAuthMiddlewareTestRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	client := newAuthMiddlewareTestClient(t)
	establishAuthMiddlewareSession(t, client, server.URL, user.Id)

	user.Group = "vip"
	if err := user.Update(false); err != nil {
		t.Fatalf("failed to update user group: %v", err)
	}

	response := performAuthMiddlewareRequest(t, client, http.MethodGet, server.URL+"/auth/info", user.Id)
	if !response.Success {
		t.Fatalf("expected refreshed session request to succeed, got message: %s", response.Message)
	}

	var info authMiddlewareInfoResponse
	if err := common.Unmarshal(response.Data, &info); err != nil {
		t.Fatalf("failed to decode auth info: %v", err)
	}
	if info.Group != "vip" {
		t.Fatalf("expected refreshed group to be vip, got %s", info.Group)
	}
	if info.Role != common.RoleCommonUser {
		t.Fatalf("expected role to remain common user, got %d", info.Role)
	}
}
