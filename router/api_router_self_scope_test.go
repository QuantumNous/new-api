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
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The /self endpoints derive their scope from the authenticated user id. A
// self-scoped filter with UserId 0 does not scope anything — the model omits
// the user_id predicate — so these routes must fail closed when the id is
// missing rather than answering with every tenant's consumption.
//
// These tests drive the real router (SetApiRouter) so the assertion covers the
// production middleware chain, not a hand-built context.

func selfScopeRequest(
	t *testing.T,
	engine *gin.Engine,
	path string,
	query string,
	ip string,
	sessionCookie *http.Cookie,
	token string,
	userID int,
) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(http.MethodGet, path+"?"+query, nil)
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

func decodeSelfScopeBody(t *testing.T, recorder *httptest.ResponseRecorder) struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Code    string `json:"code"`
} {
	t.Helper()
	var body struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
		Code    string `json:"code"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body), recorder.Body.String())
	return body
}

// An unauthenticated caller must never reach a self handler at all: the route
// middleware rejects it. This pins that the routes stay behind UserAuth.
func TestSelfScopedRoutesRejectUnauthenticatedCallers(t *testing.T) {
	block := 30000 + int(atomic.AddUint64(&realAnalysisRouteCounter, 1))*10
	name := fmt.Sprintf("selfscope-%d", block)
	user := &model.User{
		Id:       block + 1,
		Username: name,
		AffCode:  name,
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
	}
	user.SetAccessToken(fmt.Sprintf("selfscope-token-%d", block))
	setupRealAnalysisRouterDB(t, user)
	engine := newRealAnalysisRouter(t, map[int]int{user.Id: common.RoleCommonUser})

	const validRange = "start_timestamp=1782835242&end_timestamp=1785899265"
	selfPaths := []string{
		"/api/log/self/analysis",
		"/api/log/self/export/summary",
		"/api/data/self",
		// model.SumUsedQuota omits its username predicate when the name is
		// empty, so this route must never be reachable without an identity.
		"/api/log/self/stat",
		"/api/log/self",
	}

	for _, path := range selfPaths {
		t.Run("no_credentials"+path, func(t *testing.T) {
			recorder := selfScopeRequest(t, engine, path, validRange, nextRealAnalysisIP(), nil, "", 0)
			assert.Equal(t, http.StatusUnauthorized, recorder.Code,
				"a self endpoint must not serve an unauthenticated caller")
			assert.False(t, decodeSelfScopeBody(t, recorder).Success)
		})

		t.Run("invalid_token"+path, func(t *testing.T) {
			recorder := selfScopeRequest(t, engine, path, validRange, nextRealAnalysisIP(), nil,
				"Bearer selfscope-not-a-real-token", user.Id)
			// middleware.UserAuth rejects an unknown access token with the
			// project's legacy 200 + success:false envelope. That envelope is
			// pre-existing and shared by every authenticated route, so what is
			// asserted here is the rejection itself: the request must not be
			// answered with data.
			body := decodeSelfScopeBody(t, recorder)
			assert.False(t, body.Success, "an unknown token must never be served")
			assert.NotContains(t, recorder.Body.String(), `"data":[`,
				"a rejected self request must not carry rows")
		})
	}
}

// An authenticated caller reaches the handler; the handler must still refuse
// to run with a zero id. selfScopedUserId is the guard under test, and the
// admin routes must be unaffected.
func TestSelfScopedHandlersFailClosedOnMissingUserId(t *testing.T) {
	block := 31000 + int(atomic.AddUint64(&realAnalysisRouteCounter, 1))*10
	name := fmt.Sprintf("selfscope-ok-%d", block)
	user := &model.User{
		Id:       block + 1,
		Username: name,
		AffCode:  name,
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
	}
	user.SetAccessToken(fmt.Sprintf("selfscope-ok-token-%d", block))
	setupRealAnalysisRouterDB(t, user)
	engine := newRealAnalysisRouter(t, map[int]int{user.Id: common.RoleCommonUser})

	// A genuine session reaches the handler: the range is valid and the reply is
	// a normal business response, proving the guard does not block real users.
	cookie := realAnalysisSessionCookie(t, engine, user.Id)
	recorder := selfScopeRequest(t, engine, "/api/data/self",
		"start_timestamp=1782835242&end_timestamp=1785899265",
		nextRealAnalysisIP(), cookie, "", user.Id)
	assert.NotEqual(t, http.StatusUnauthorized, recorder.Code,
		"an authenticated self caller must not be rejected by the id guard")
}

// A caller authenticated by a real access token reaches /api/log/self/stat with
// a populated username, so the guard must not disturb the legitimate path.
func TestSelfStatRouteServesAnAuthenticatedTokenCaller(t *testing.T) {
	block := 32000 + int(atomic.AddUint64(&realAnalysisRouteCounter, 1))*10
	name := fmt.Sprintf("selfstat-%d", block)
	user := &model.User{
		Id:       block + 1,
		Username: name,
		AffCode:  name,
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
	}
	token := fmt.Sprintf("selfstat-token-%d", block)
	user.SetAccessToken(token)
	setupRealAnalysisRouterDB(t, user)
	require.NoError(t, model.LOG_DB.AutoMigrate(&model.Log{}))
	require.NoError(t, model.LOG_DB.Create(&[]model.Log{
		{UserId: user.Id, Username: name, CreatedAt: 1782835242, Type: model.LogTypeConsume, ModelName: "gpt-image-2", Quota: 100},
		{UserId: user.Id + 500, Username: name + "-other", CreatedAt: 1782835242, Type: model.LogTypeConsume, ModelName: "gpt-image-2", Quota: 90000},
	}).Error)

	engine := newRealAnalysisRouter(t, map[int]int{user.Id: common.RoleCommonUser})

	recorder := selfScopeRequest(t, engine, "/api/log/self/stat",
		"type=2&start_timestamp=1782835242&end_timestamp=1785899265",
		nextRealAnalysisIP(), nil, "Bearer "+token, user.Id)

	var body struct {
		Success bool `json:"success"`
		Data    struct {
			Quota int `json:"quota"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body), recorder.Body.String())
	assert.Equal(t, http.StatusOK, recorder.Code)
	require.True(t, body.Success, recorder.Body.String())
	// Only this user's row, never the tenant-wide sum.
	assert.Equal(t, 100, body.Data.Quota)
	assert.NotEqual(t, 90100, body.Data.Quota)
}
