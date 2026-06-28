package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// authTestRouter returns a gin.Engine with cookie sessions registered and the
// given skill-auth middleware mounted at GET /probe (200 sentinel on pass).
// A GET /setup-session route is also registered so tests can pre-populate the
// session before calling /probe.
func authTestRouter(mw gin.HandlerFunc) *gin.Engine {
	r := gin.New()
	store := cookie.NewStore([]byte("test-secret-key"))
	r.Use(sessions.Sessions("mysession", store))
	r.GET("/setup-session", func(c *gin.Context) {
		sess := sessions.Default(c)
		sess.Set("username", c.Query("username"))
		role, _ := strconv.Atoi(c.Query("role"))
		sess.Set("role", role)
		id, _ := strconv.Atoi(c.Query("id"))
		sess.Set("id", id)
		status, _ := strconv.Atoi(c.Query("status"))
		sess.Set("status", status)
		_ = sess.Save()
		c.Status(http.StatusOK)
	})
	r.GET("/probe", mw, func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	return r
}

// authenticatedRequest creates a session for (role, userID) then fires GET /probe
// with the resulting session cookie and the required New-Api-User header.
func authenticatedRequest(r *gin.Engine, role, userID int) *httptest.ResponseRecorder {
	setupReq := httptest.NewRequest(http.MethodGet,
		fmt.Sprintf("/setup-session?username=testuser&role=%d&id=%d&status=%d",
			role, userID, common.UserStatusEnabled), nil)
	setupW := httptest.NewRecorder()
	r.ServeHTTP(setupW, setupReq)

	probeReq := httptest.NewRequest(http.MethodGet, "/probe", nil)
	for _, c := range setupW.Result().Cookies() {
		probeReq.AddCookie(c)
	}
	probeReq.Header.Set("New-Api-User", strconv.Itoa(userID))
	probeW := httptest.NewRecorder()
	r.ServeHTTP(probeW, probeReq)
	return probeW
}

// errorCode extracts the "code" field from the skill API error envelope.
func errorCode(t *testing.T, body []byte) string {
	t.Helper()
	var env struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	require.NoError(t, json.Unmarshal(body, &env))
	return env.Error.Code
}

// TestSkillRootAuth_NoAuth_Returns401 confirms that a request with no session
// and no Authorization header returns 401 AUTH_REQUIRED.
func TestSkillRootAuth_NoAuth_Returns401(t *testing.T) {
	r := authTestRouter(SkillRootAuth())
	req := httptest.NewRequest(http.MethodGet, "/probe", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Equal(t, "AUTH_REQUIRED", errorCode(t, w.Body.Bytes()))
}

// TestSkillAdminAuth_NoAuth_Returns401 confirms the same for SkillAdminAuth.
func TestSkillAdminAuth_NoAuth_Returns401(t *testing.T) {
	r := authTestRouter(SkillAdminAuth())
	req := httptest.NewRequest(http.MethodGet, "/probe", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Equal(t, "AUTH_REQUIRED", errorCode(t, w.Body.Bytes()))
}

// TestSkillRootAuth_AdminRole_Returns403 confirms that a user authenticated as
// AdminUser (role=10) is rejected by SkillRootAuth (requires role=100) with
// 403 FORBIDDEN, not 401.
func TestSkillRootAuth_AdminRole_Returns403(t *testing.T) {
	r := authTestRouter(SkillRootAuth())
	w := authenticatedRequest(r, common.RoleAdminUser, 42)

	assert.Equal(t, http.StatusForbidden, w.Code)
	assert.Equal(t, "FORBIDDEN", errorCode(t, w.Body.Bytes()))
}

// TestSkillAdminAuth_CommonRole_Returns403 confirms that a user authenticated as
// CommonUser (role=1) is rejected by SkillAdminAuth (requires role=10) with
// 403 FORBIDDEN, not 401.
func TestSkillAdminAuth_CommonRole_Returns403(t *testing.T) {
	r := authTestRouter(SkillAdminAuth())
	w := authenticatedRequest(r, common.RoleCommonUser, 99)

	assert.Equal(t, http.StatusForbidden, w.Code)
	assert.Equal(t, "FORBIDDEN", errorCode(t, w.Body.Bytes()))
}

// TestSkillRootAuth_RootRole_Passes confirms that RootUser (role=100) passes
// SkillRootAuth and the sentinel handler returns 200.
func TestSkillRootAuth_RootRole_Passes(t *testing.T) {
	r := authTestRouter(SkillRootAuth())
	w := authenticatedRequest(r, common.RoleRootUser, 7)

	assert.Equal(t, http.StatusOK, w.Code)
}

// TestSkillAdminAuth_AdminRole_Passes confirms that AdminUser (role=10) passes
// SkillAdminAuth and the sentinel handler returns 200.
func TestSkillAdminAuth_AdminRole_Passes(t *testing.T) {
	r := authTestRouter(SkillAdminAuth())
	w := authenticatedRequest(r, common.RoleAdminUser, 8)

	assert.Equal(t, http.StatusOK, w.Code)
}

// TestSkillRootAuth_InvalidToken_Returns401 is a C-1 regression guard: a request
// with an invalid access token (no session, Authorization header present but
// unrecognised) must return 401 AUTH_REQUIRED, not 403. Only role < minRole
// should return 403; all other auth failures stay 401.
func TestSkillRootAuth_InvalidToken_Returns401(t *testing.T) {
	// model.ValidateAccessToken queries model.DB; initialise an in-memory SQLite
	// with the users table so an unknown token yields ErrRecordNotFound → nil
	// user → 401. Without this, a nil model.DB would panic.
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	oldDB := model.DB
	model.DB = db
	oldRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB = oldDB
		common.RedisEnabled = oldRedisEnabled
	})

	r := authTestRouter(SkillRootAuth())
	req := httptest.NewRequest(http.MethodGet, "/probe", nil)
	req.Header.Set("Authorization", "Bearer invalid-test-token-xyz")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Equal(t, "AUTH_REQUIRED", errorCode(t, w.Body.Bytes()))
}

func TestSkillUserAuth_APITokenAuthenticatesWithoutNewAPIUserHeader(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}))
	require.NoError(t, db.Create(&model.User{
		Id:       101,
		Username: "api-token-user",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "pro",
	}).Error)
	require.NoError(t, db.Create(&model.Token{
		UserId:         101,
		Key:            "dr101token",
		Status:         common.TokenStatusEnabled,
		Name:           "DR-101 token",
		ExpiredTime:    -1,
		RemainQuota:    10,
		UnlimitedQuota: false,
	}).Error)

	oldDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = oldDB })

	r := gin.New()
	store := cookie.NewStore([]byte("test-secret-key"))
	r.Use(sessions.Sessions("mysession", store))
	r.GET("/probe", SkillUserAuth(), func(c *gin.Context) {
		assert.Equal(t, 101, c.GetInt("id"))
		assert.Equal(t, "pro", c.GetString("group"))
		assert.Equal(t, string(enums.EntryPointAPIToken), common.GetContextKeyString(c, constant.ContextKeySkillAuthEntryPoint))
		assert.Equal(t, "dr101token", common.GetContextKeyString(c, constant.ContextKeyTokenKey))
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/probe", nil)
	req.Header.Set("Authorization", "Bearer sk-dr101token")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}
