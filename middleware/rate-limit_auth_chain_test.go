package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupAnalysisAuthTestDB(t *testing.T, users ...*model.User) {
	t.Helper()
	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousSQLite := common.UsingSQLite
	previousMySQL := common.UsingMySQL
	previousPostgreSQL := common.UsingPostgreSQL

	dsn := fmt.Sprintf("file:analysis-auth-%s?mode=memory&cache=shared", strconv.FormatInt(int64(atomic.AddUint64(&rateLimitProbeCounter, 1)), 10))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	for _, user := range users {
		require.NoError(t, db.Create(user).Error)
	}
	model.DB = db
	model.LOG_DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.UsingSQLite = previousSQLite
		common.UsingMySQL = previousMySQL
		common.UsingPostgreSQL = previousPostgreSQL
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})
}

func newAnalysisAuthRoute(t *testing.T, admin bool) *gin.Engine {
	t.Helper()
	engine := gin.New()
	store := cookie.NewStore([]byte("dashboard-analysis-auth-test-secret"))
	engine.Use(sessions.Sessions("session", store))

	engine.GET("/seed-session/:id", func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		require.NoError(t, err)
		role := common.RoleCommonUser
		if admin {
			role = common.RoleAdminUser
		}
		session := sessions.Default(c)
		session.Set("id", id)
		session.Set("username", fmt.Sprintf("user-%d", id))
		session.Set("role", role)
		session.Set("status", common.UserStatusEnabled)
		require.NoError(t, session.Save())
		c.Status(http.StatusNoContent)
	})

	probe := func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"id": c.GetInt("id")})
	}
	auth := UserAuth()
	path := "/api/log/self/analysis"
	if admin {
		auth = AdminAuth()
		path = "/api/log/analysis"
	}
	// Keep this registration equal to the production route chain: auth first
	// establishes the stable user id, then AN rate-limits that principal.
	engine.GET(path, CORS(), auth, AnalysisRateLimit(), probe)
	engine.GET("/ct-probe", CriticalRateLimit(), probe)
	return engine
}

func analysisSessionCookie(t *testing.T, engine *gin.Engine, id int) *http.Cookie {
	t.Helper()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/seed-session/"+strconv.Itoa(id), nil)
	engine.ServeHTTP(recorder, request)
	require.Equal(t, http.StatusNoContent, recorder.Code)
	cookies := recorder.Result().Cookies()
	require.NotEmpty(t, cookies)
	return cookies[0]
}

func serveAnalysisAuthRequest(t *testing.T, engine *gin.Engine, path, ip string, sessionCookie *http.Cookie, token string, userID int) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, path, nil)
	request.RemoteAddr = ip + ":443"
	if sessionCookie != nil {
		request.AddCookie(sessionCookie)
	}
	if token != "" {
		request.Header.Set("Authorization", token)
	}
	if userID > 0 {
		request.Header.Set("New-Api-User", strconv.Itoa(userID))
	}
	engine.ServeHTTP(recorder, request)
	return recorder
}

func TestAnalysisRateLimitUsesRealSessionAndAccessTokenIdentity(t *testing.T) {
	previousEnabled := common.CriticalRateLimitEnable
	previousRedis := common.RedisEnabled
	previousNum := common.CriticalRateLimitNum
	previousDuration := common.CriticalRateLimitDuration
	t.Cleanup(func() {
		common.CriticalRateLimitEnable = previousEnabled
		common.RedisEnabled = previousRedis
		common.CriticalRateLimitNum = previousNum
		common.CriticalRateLimitDuration = previousDuration
	})
	common.CriticalRateLimitEnable = true
	common.RedisEnabled = false
	common.CriticalRateLimitNum = 1
	common.CriticalRateLimitDuration = 20 * 60

	adminTokenA := "analysis-admin-token-a"
	adminTokenB := "analysis-admin-token-b"
	userTokenA := "analysis-user-token-a"
	userTokenB := "analysis-user-token-b"
	adminA := &model.User{Id: 301, Username: "analysis-admin-a", AffCode: "analysis-admin-a", Role: common.RoleAdminUser, Status: common.UserStatusEnabled}
	adminA.SetAccessToken(adminTokenA)
	adminB := &model.User{Id: 302, Username: "analysis-admin-b", AffCode: "analysis-admin-b", Role: common.RoleAdminUser, Status: common.UserStatusEnabled}
	adminB.SetAccessToken(adminTokenB)
	userA := &model.User{Id: 401, Username: "analysis-user-a", AffCode: "analysis-user-a", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}
	userA.SetAccessToken(userTokenA)
	userB := &model.User{Id: 402, Username: "analysis-user-b", AffCode: "analysis-user-b", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}
	userB.SetAccessToken(userTokenB)
	setupAnalysisAuthTestDB(t, adminA, adminB, userA, userB)

	for _, testCase := range []struct {
		name      string
		admin     bool
		path      string
		sessionID int
		tokenA    string
		tokenB    string
		userIDA   int
		userIDB   int
	}{
		{name: "admin", admin: true, path: "/api/log/analysis", sessionID: 501, tokenA: adminTokenA, tokenB: adminTokenB, userIDA: adminA.Id, userIDB: adminB.Id},
		{name: "user", admin: false, path: "/api/log/self/analysis", sessionID: 601, tokenA: userTokenA, tokenB: userTokenB, userIDA: userA.Id, userIDB: userB.Id},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			engine := newAnalysisAuthRoute(t, testCase.admin)
			ip := fmt.Sprintf("198.51.100.%d", atomic.AddUint64(&rateLimitProbeCounter, 1)%254+1)

			sessionCookie := analysisSessionCookie(t, engine, testCase.sessionID)
			sessionResponse := serveAnalysisAuthRequest(t, engine, testCase.path, ip, sessionCookie, "", testCase.sessionID)
			require.Equal(t, http.StatusOK, sessionResponse.Code)
			require.Equal(t, http.StatusTooManyRequests, serveAnalysisAuthRequest(t, engine, testCase.path, ip, sessionCookie, "", testCase.sessionID).Code)

			// Valid access-token callers on the same NAT address must be separated
			// by the id set by the real AdminAuth/UserAuth middleware.
			require.Equal(t, http.StatusOK, serveAnalysisAuthRequest(t, engine, testCase.path, ip, nil, testCase.tokenA, testCase.userIDA).Code)
			require.Equal(t, http.StatusOK, serveAnalysisAuthRequest(t, engine, testCase.path, ip, nil, testCase.tokenB, testCase.userIDB).Code)
		})
	}
}

func TestAnalysisRateLimitRejectsAnonymousBeforeANAndKeepsANCTSeparate(t *testing.T) {
	previousEnabled := common.CriticalRateLimitEnable
	previousRedis := common.RedisEnabled
	previousNum := common.CriticalRateLimitNum
	previousDuration := common.CriticalRateLimitDuration
	t.Cleanup(func() {
		common.CriticalRateLimitEnable = previousEnabled
		common.RedisEnabled = previousRedis
		common.CriticalRateLimitNum = previousNum
		common.CriticalRateLimitDuration = previousDuration
	})
	common.CriticalRateLimitEnable = true
	common.RedisEnabled = false
	common.CriticalRateLimitNum = 1
	common.CriticalRateLimitDuration = 20 * 60

	user := &model.User{Id: 701, Username: "analysis-anon-test", AffCode: "analysis-anon-test", Role: common.RoleAdminUser, Status: common.UserStatusEnabled}
	validToken := "analysis-anon-valid-token"
	user.SetAccessToken(validToken)
	setupAnalysisAuthTestDB(t, user)
	engine := newAnalysisAuthRoute(t, true)
	analysisPath := "/api/log/analysis"

	// Authentication must reject both anonymous and invalid-token requests
	// before AN, so repeated attempts do not turn into an AN 429.
	ipAnonymous := "198.51.100.211"
	require.Equal(t, http.StatusUnauthorized, serveAnalysisAuthRequest(t, engine, analysisPath, ipAnonymous, nil, "", 0).Code)
	require.Equal(t, http.StatusUnauthorized, serveAnalysisAuthRequest(t, engine, analysisPath, ipAnonymous, nil, "", 0).Code)
	ipInvalid := "198.51.100.212"
	invalidResponse := serveAnalysisAuthRequest(t, engine, analysisPath, ipInvalid, nil, "Bearer invalid-analysis-token", user.Id)
	require.Equal(t, http.StatusOK, invalidResponse.Code)
	var invalidPayload struct {
		Success bool `json:"success"`
	}
	require.NoError(t, json.Unmarshal(invalidResponse.Body.Bytes(), &invalidPayload))
	require.False(t, invalidPayload.Success)
	secondInvalidResponse := serveAnalysisAuthRequest(t, engine, analysisPath, ipInvalid, nil, "Bearer invalid-analysis-token", user.Id)
	require.Equal(t, http.StatusOK, secondInvalidResponse.Code)
	require.NoError(t, json.Unmarshal(secondInvalidResponse.Body.Bytes(), &invalidPayload))
	require.False(t, invalidPayload.Success)

	// The existing API-wide GlobalAPIRateLimit is the anonymous per-IP guard
	// (router/api-router.go:19); AN itself is authenticated-user-only.
	ip := "198.51.100.213"
	require.Equal(t, http.StatusOK, serveAnalysisAuthRequest(t, engine, analysisPath, ip, nil, validToken, user.Id).Code)
	require.Equal(t, http.StatusOK, serveAnalysisAuthRequest(t, engine, "/ct-probe", ip, nil, "", 0).Code)
}
