package router

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The allow-list is only a UI hint unless the dashboard API enforces it, so
// these tests exercise the real router wiring rather than the middleware alone.
func TestVisibleSectionAllowListGuardsDashboardRoutes(t *testing.T) {
	engine := setupVisibleSectionRouterTest(t)

	restrictedToken := createSectionTestAdmin(t, "section-restricted", []string{"dashboard"})
	grantedToken := createSectionTestAdmin(t, "section-granted", []string{"redemption"})

	t.Run("an ungranted section is rejected", func(t *testing.T) {
		for _, path := range []string{"/api/redemption/", "/api/channel/", "/api/models/"} {
			response := sectionTestRequest(engine, http.MethodGet, path, restrictedToken, "")
			assert.Equal(t, http.StatusForbidden, response.Code, path)
			assert.Contains(t, response.Body.String(), "this section is not available", path)
		}
	})

	t.Run("a granted section still reaches its handler", func(t *testing.T) {
		response := sectionTestRequest(engine, http.MethodGet, "/api/redemption/", grantedToken, "")
		assert.Equal(t, http.StatusOK, response.Code)
		assert.NotContains(t, response.Body.String(), "this section is not available")
	})

	t.Run("authentication bootstrap is never gated", func(t *testing.T) {
		response := sectionTestRequest(engine, http.MethodGet, "/api/user/self", restrictedToken, "")
		assert.Equal(t, http.StatusOK, response.Code, response.Body.String())
	})
}

func TestCreateUserPersistsVisibleSections(t *testing.T) {
	engine := setupVisibleSectionRouterTest(t)
	adminToken := createSectionTestAdmin(t, "section-users-admin", []string{"users"})

	response := sectionTestRequest(engine, http.MethodPost, "/api/user/", adminToken, `{
		"username": "section-created-user",
		"password": "section-password-123",
		"display_name": "Section Created User",
		"role": 1,
		"visible_sections": ["dashboard", "usage_logs"]
	}`)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())

	var created model.User
	require.NoError(t, model.DB.Where("username = ?", "section-created-user").First(&created).Error)
	assert.Equal(t, []string{"dashboard", "usage_logs"}, created.GetSetting().VisibleSections)
}

// Administrative and control-plane endpoints must carry the same visible
// section guard as the rest of the control panel: a restricted administrator
// must not be able to reach them directly, even though the sidebar hides the
// matching page.
func TestAdministrativeEndpointsEnforceVisibleSections(t *testing.T) {
	engine := setupVisibleSectionRouterTest(t)

	restrictedToken := createSectionTestAdmin(t, "section-admin-restricted", []string{"dashboard"})

	cases := []struct {
		name     string
		path     string
		granted  string
		username string
	}{
		{name: "group list", path: "/api/group/", granted: "usage_logs", username: "section-admin-group"},
		{name: "prefill groups", path: "/api/prefill_group/", granted: "models", username: "section-admin-prefill"},
		{name: "task plugin options", path: "/api/task_plugin_options", granted: "channels", username: "section-admin-plugin-options"},
		{name: "permission catalog", path: "/api/authz/catalog", granted: "users", username: "section-admin-catalog"},
		{name: "status test", path: "/api/status/test", granted: "system_settings", username: "section-admin-status"},
	}

	for _, testCase := range cases {
		t.Run(testCase.name+" is closed without the section", func(t *testing.T) {
			response := sectionTestRequest(engine, http.MethodGet, testCase.path, restrictedToken, "")
			assert.Equal(t, http.StatusForbidden, response.Code, response.Body.String())
			assert.Contains(t, response.Body.String(), "this section is not available")
		})

		t.Run(testCase.name+" is open with the section", func(t *testing.T) {
			grantedToken := createSectionTestAdmin(t, testCase.username, []string{testCase.granted})
			response := sectionTestRequest(engine, http.MethodGet, testCase.path, grantedToken, "")
			assert.NotContains(t, response.Body.String(), "this section is not available", response.Body.String())
		})
	}
}

func setupVisibleSectionRouterTest(t *testing.T) *gin.Engine {
	t.Helper()
	setupRelayRouterTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(
		&model.UserSession{},
		&model.AuditLog{},
		&model.Redemption{},
		&model.Option{},
		&model.PrefillGroup{},
	))
	previousSecret := common.SessionSecret
	common.SessionSecret = "visible-section-router-test-secret"
	t.Cleanup(func() { common.SessionSecret = previousSecret })

	engine := gin.New()
	SetApiRouter(engine)
	return engine
}

func createSectionTestAdmin(t *testing.T, username string, sections []string) string {
	t.Helper()
	return createSectionTestUser(t, username, common.RoleAdminUser, sections)
}

// createSectionTestUser inserts an enabled user of any role plus a live login
// session, and returns the dashboard access token that session issued.
func createSectionTestUser(t *testing.T, username string, role int, sections []string) string {
	t.Helper()
	user := model.User{
		Username:    username,
		Password:    "section-password-123",
		DisplayName: username,
		Role:        role,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AffCode:     "aff-" + username,
	}
	require.NoError(t, model.DB.Create(&user).Error)
	setting, err := common.Marshal(map[string]any{"visible_sections": sections})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", user.Id).Update("setting", string(setting)).Error)

	now := time.Now().Unix()
	session := &model.UserSession{
		SID:             fmt.Sprintf("section-session-%d", user.Id),
		UserID:          user.Id,
		Version:         1,
		UserAuthVersion: user.AuthVersion,
		Status:          model.UserSessionStatusActive,
		RefreshHash:     fmt.Sprintf("section-refresh-%d", user.Id),
		LoginMethod:     "password",
		LastActiveAt:    now,
		ExpiresAt:       now + 3600,
	}
	require.NoError(t, model.CreateUserSession(session))
	token, _, err := service.IssueAccessToken(service.AuthIdentity{
		UserID:          user.Id,
		SessionID:       session.SID,
		UserAuthVersion: session.UserAuthVersion,
		SessionVersion:  session.Version,
	})
	require.NoError(t, err)
	return token
}

func sectionTestRequest(engine *gin.Engine, method, path, token, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, nil)
	request.Header.Set("Authorization", "Bearer "+token)
	if body != "" {
		request = httptest.NewRequest(method, path, strings.NewReader(body))
		request.Header.Set("Authorization", "Bearer "+token)
		request.Header.Set("Content-Type", "application/json")
	}
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, request)
	return response
}
