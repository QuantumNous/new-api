package router

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

var realAnalysisRouteCounter uint64

func setupRealAnalysisRouterDB(t *testing.T, users ...*model.User) {
	t.Helper()
	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousSQLite := common.UsingSQLite
	previousMySQL := common.UsingMySQL
	previousPostgreSQL := common.UsingPostgreSQL
	previousRedis := common.RedisEnabled
	previousCriticalEnabled := common.CriticalRateLimitEnable
	previousCriticalNum := common.CriticalRateLimitNum
	previousCriticalDuration := common.CriticalRateLimitDuration
	previousGlobalAPIEnabled := common.GlobalApiRateLimitEnable

	dsn := fmt.Sprintf(
		"file:real-analysis-router-%d?mode=memory&cache=shared",
		atomic.AddUint64(&realAnalysisRouteCounter, 1),
	)
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
	common.RedisEnabled = false
	common.CriticalRateLimitEnable = true
	common.CriticalRateLimitNum = 1
	common.CriticalRateLimitDuration = 20 * 60
	// Disable only the pre-existing generic API guard so this test isolates
	// route authentication and the AN/CT buckets. Production keeps this guard.
	common.GlobalApiRateLimitEnable = false

	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.UsingSQLite = previousSQLite
		common.UsingMySQL = previousMySQL
		common.UsingPostgreSQL = previousPostgreSQL
		common.RedisEnabled = previousRedis
		common.CriticalRateLimitEnable = previousCriticalEnabled
		common.CriticalRateLimitNum = previousCriticalNum
		common.CriticalRateLimitDuration = previousCriticalDuration
		common.GlobalApiRateLimitEnable = previousGlobalAPIEnabled
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})
}

func newRealAnalysisRouter(t *testing.T, roles map[int]int) *gin.Engine {
	t.Helper()
	engine := gin.New()
	store := cookie.NewStore([]byte("real-analysis-router-test-secret"))
	engine.Use(sessions.Sessions("session", store))

	// This route is test-only; SetApiRouter below registers the actual
	// /api/log/analysis and /api/log/self/analysis handlers and middleware.
	engine.GET("/test/seed-session/:id", func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		require.NoError(t, err)
		role, ok := roles[id]
		require.True(t, ok)
		session := sessions.Default(c)
		session.Set("id", id)
		session.Set("username", fmt.Sprintf("real-route-user-%d", id))
		session.Set("role", role)
		session.Set("status", common.UserStatusEnabled)
		require.NoError(t, session.Save())
		c.Status(http.StatusNoContent)
	})

	SetApiRouter(engine)
	return engine
}

func realAnalysisSessionCookie(t *testing.T, engine *gin.Engine, id int) *http.Cookie {
	t.Helper()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/test/seed-session/"+strconv.Itoa(id), nil)
	engine.ServeHTTP(recorder, request)
	require.Equal(t, http.StatusNoContent, recorder.Code)
	cookies := recorder.Result().Cookies()
	require.NotEmpty(t, cookies)
	return cookies[0]
}

func serveRealAnalysisRequest(
	t *testing.T,
	engine *gin.Engine,
	path string,
	ip string,
	sessionCookie *http.Cookie,
	token string,
	userID int,
) *httptest.ResponseRecorder {
	t.Helper()
	// A malformed dimension makes the real controller return 400 without
	// touching log tables. Thus 400 proves auth and AN passed; 429 proves the
	// limiter ran before the controller.
	request := httptest.NewRequest(
		http.MethodGet,
		path+"?start_timestamp=1&end_timestamp=2&dimensions=not_supported",
		nil,
	)
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
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)
	return recorder
}

func requireBusinessFailure(t *testing.T, response *httptest.ResponseRecorder) {
	t.Helper()
	var body struct {
		Success bool `json:"success"`
	}
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &body))
	require.False(t, body.Success)
}

func nextRealAnalysisIP() string {
	return fmt.Sprintf(
		"198.51.100.%d",
		atomic.AddUint64(&realAnalysisRouteCounter, 1)%200+20,
	)
}

func TestSetApiRouterAnalysisAuthRunsBeforeRateLimit(t *testing.T) {
	// The in-memory AN/CT limiter deliberately survives for the process
	// lifetime. Allocate a fresh ID/name/token block for every test invocation
	// so `-count=N` cannot reuse a prior user's bucket.
	block := 10000 + int(atomic.AddUint64(&realAnalysisRouteCounter, 1))*10
	newUser := func(offset int, role int, label string) *model.User {
		name := fmt.Sprintf("ra-%d-%s", block, label)
		user := &model.User{
			Id:       block + offset,
			Username: name,
			AffCode:  name,
			Role:     role,
			Status:   common.UserStatusEnabled,
		}
		user.SetAccessToken(fmt.Sprintf("ra-t-%d-%s", block, label))
		return user
	}
	adminSession := newUser(1, common.RoleAdminUser, "as")
	userSession := newUser(2, common.RoleCommonUser, "us")
	adminTokenA := newUser(3, common.RoleAdminUser, "ata")
	adminTokenB := newUser(4, common.RoleAdminUser, "atb")
	userTokenA := newUser(5, common.RoleCommonUser, "uta")
	userTokenB := newUser(6, common.RoleCommonUser, "utb")
	adminTokenC := newUser(7, common.RoleAdminUser, "atc")

	setupRealAnalysisRouterDB(t, adminSession, userSession, adminTokenA, adminTokenB, userTokenA, userTokenB, adminTokenC)
	roles := map[int]int{
		adminSession.Id: common.RoleAdminUser,
		userSession.Id:  common.RoleCommonUser,
	}
	engine := newRealAnalysisRouter(t, roles)

	t.Run("real admin session identity", func(t *testing.T) {
		cookie := realAnalysisSessionCookie(t, engine, adminSession.Id)
		ip := nextRealAnalysisIP()
		first := serveRealAnalysisRequest(t, engine, "/api/log/analysis", ip, cookie, "", adminSession.Id)
		require.Equal(t, http.StatusBadRequest, first.Code)
		second := serveRealAnalysisRequest(t, engine, "/api/log/analysis", ip, cookie, "", adminSession.Id)
		require.Equal(t, http.StatusTooManyRequests, second.Code)
	})

	t.Run("real user session identity", func(t *testing.T) {
		cookie := realAnalysisSessionCookie(t, engine, userSession.Id)
		ip := nextRealAnalysisIP()
		first := serveRealAnalysisRequest(t, engine, "/api/log/self/analysis", ip, cookie, "", userSession.Id)
		require.Equal(t, http.StatusBadRequest, first.Code)
		second := serveRealAnalysisRequest(t, engine, "/api/log/self/analysis", ip, cookie, "", userSession.Id)
		require.Equal(t, http.StatusTooManyRequests, second.Code)
	})

	t.Run("admin access tokens split the same NAT", func(t *testing.T) {
		ip := nextRealAnalysisIP()
		firstA := serveRealAnalysisRequest(t, engine, "/api/log/analysis", ip, nil, adminTokenA.GetAccessToken(), adminTokenA.Id)
		require.Equal(t, http.StatusBadRequest, firstA.Code)
		secondA := serveRealAnalysisRequest(t, engine, "/api/log/analysis", ip, nil, adminTokenA.GetAccessToken(), adminTokenA.Id)
		require.Equal(t, http.StatusTooManyRequests, secondA.Code)
		firstB := serveRealAnalysisRequest(t, engine, "/api/log/analysis", ip, nil, adminTokenB.GetAccessToken(), adminTokenB.Id)
		require.Equal(t, http.StatusBadRequest, firstB.Code)
	})

	t.Run("user access tokens split the same NAT", func(t *testing.T) {
		ip := nextRealAnalysisIP()
		firstA := serveRealAnalysisRequest(t, engine, "/api/log/self/analysis", ip, nil, userTokenA.GetAccessToken(), userTokenA.Id)
		require.Equal(t, http.StatusBadRequest, firstA.Code)
		secondA := serveRealAnalysisRequest(t, engine, "/api/log/self/analysis", ip, nil, userTokenA.GetAccessToken(), userTokenA.Id)
		require.Equal(t, http.StatusTooManyRequests, secondA.Code)
		firstB := serveRealAnalysisRequest(t, engine, "/api/log/self/analysis", ip, nil, userTokenB.GetAccessToken(), userTokenB.Id)
		require.Equal(t, http.StatusBadRequest, firstB.Code)
	})

	t.Run("anonymous and invalid tokens never consume AN", func(t *testing.T) {
		for _, testCase := range []struct {
			name string
			path string
		}{
			{name: "admin", path: "/api/log/analysis"},
			{name: "user", path: "/api/log/self/analysis"},
		} {
			t.Run(testCase.name, func(t *testing.T) {
				anonymousIP := nextRealAnalysisIP()
				firstAnonymous := serveRealAnalysisRequest(t, engine, testCase.path, anonymousIP, nil, "", 0)
				require.Equal(t, http.StatusUnauthorized, firstAnonymous.Code)
				secondAnonymous := serveRealAnalysisRequest(t, engine, testCase.path, anonymousIP, nil, "", 0)
				require.Equal(t, http.StatusUnauthorized, secondAnonymous.Code)

				invalidIP := nextRealAnalysisIP()
				firstInvalid := serveRealAnalysisRequest(t, engine, testCase.path, invalidIP, nil, "Bearer invalid-real-analysis-token", adminTokenC.Id)
				require.Equal(t, http.StatusOK, firstInvalid.Code)
				requireBusinessFailure(t, firstInvalid)
				secondInvalid := serveRealAnalysisRequest(t, engine, testCase.path, invalidIP, nil, "Bearer invalid-real-analysis-token", adminTokenC.Id)
				require.Equal(t, http.StatusOK, secondInvalid.Code)
				requireBusinessFailure(t, secondInvalid)
			})
		}
	})

	t.Run("analysis and critical buckets are isolated", func(t *testing.T) {
		ip := nextRealAnalysisIP()
		analysis := serveRealAnalysisRequest(t, engine, "/api/log/analysis", ip, nil, adminTokenC.GetAccessToken(), adminTokenC.Id)
		require.Equal(t, http.StatusBadRequest, analysis.Code)

		critical := httptest.NewRequest(http.MethodGet, "/api/ratio_config", nil)
		critical.RemoteAddr = ip + ":443"
		criticalRecorder := httptest.NewRecorder()
		engine.ServeHTTP(criticalRecorder, critical)
		require.NotEqual(t, http.StatusTooManyRequests, criticalRecorder.Code)
	})
}
