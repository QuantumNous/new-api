package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestHwAuthGatesForKeepsTheManagementSurfaceClosed proves the hook adds nothing
// to a dashboard login outside the playground and to an admin or root login at
// all, so a management call never meets a trial budget or a reserve refusal.
func TestHwAuthGatesForKeepsTheManagementSurfaceClosed(t *testing.T) {
	cases := []struct {
		name               string
		auth, method, path string
		freeGroup, reserve bool
	}{
		{"playground", hwAuthUser, http.MethodPost, "/pg/chat/completions", true, true},
		{"dashboard self", hwAuthUser, http.MethodGet, "/api/user/self", false, false},
		{"dashboard token write", hwAuthUser, http.MethodPost, "/api/token/", false, false},
		{"no auth in the helper", "", http.MethodGet, "/api/user/self", false, false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			freeGroup, reserve := HwAuthGatesFor(testCase.auth, testCase.method, testCase.path)
			assert.Equal(t, testCase.freeGroup, freeGroup, "free-group gate")
			assert.Equal(t, testCase.reserve, reserve, "reserve gate")
		})
	}
}

// TestHwAuthGatesForDefaultsANewTokenRouteToTheUsageLimit proves the safe pair
// for a route nobody listed: the trial budget on, the reserve gate off.
func TestHwAuthGatesForDefaultsANewTokenRouteToTheUsageLimit(t *testing.T) {
	freeGroup, reserve := HwAuthGatesFor(hwAuthToken, http.MethodPost, "/v1/brand-new-route")
	assert.True(t, freeGroup, "an unlisted token route must stay inside the trial budget")
	assert.False(t, reserve, "an unlisted token route must not get the reserve gate")

	exempt, exemptReserve := HwAuthGatesFor(hwAuthToken, http.MethodGet, "/v1/models")
	assert.False(t, exempt, "the model catalogue spends nothing")
	assert.False(t, exemptReserve, "the model catalogue has no reserve gate")

	relay, relayReserve := HwAuthGatesFor(hwAuthToken, http.MethodPost, "/v1/chat/completions")
	assert.True(t, relay, "a relay call stays inside the trial budget")
	assert.True(t, relayReserve, "a relay call goes through the reserve gate")
}

// TestHwAfterAuthStopsTheChainWhenAGateRefuses proves that a refusal written by
// a gate also stops the handlers behind it, which is what the auth hook relies on
// when it returns instead of calling c.Next().
func TestHwAfterAuthStopsTheChainWhenAGateRefuses(t *testing.T) {
	gin.SetMode(gin.TestMode)
	require.NoError(t, i18n.Init())
	t.Setenv("HW_FREE_GROUP_PER_MINUTE", "1")
	t.Setenv("HW_FREE_GROUP_PER_DAY", "100")
	hwFreeGroupTestDB(t)

	reached := false
	engine := gin.New()
	engine.POST("/v1/experimental-hw-gate-probe", func(c *gin.Context) {
		c.Set("id", hwFreeGroupTestUserID(c))
		setAccountGroup(c, "free")
	}, func(c *gin.Context) {
		if !hwAfterAuth(c, hwAuthToken) {
			return
		}
		c.Next()
	}, func(c *gin.Context) {
		reached = true
		c.Status(http.StatusOK)
	})

	first := httptest.NewRecorder()
	engine.ServeHTTP(first, httptest.NewRequest(http.MethodPost, "/v1/experimental-hw-gate-probe?user=7", nil))
	assert.Equal(t, http.StatusOK, first.Code)
	assert.True(t, reached, "the first request must reach the handler")

	reached = false
	second := httptest.NewRecorder()
	engine.ServeHTTP(second, httptest.NewRequest(http.MethodPost, "/v1/experimental-hw-gate-probe?user=7", nil))
	assert.Equal(t, http.StatusTooManyRequests, second.Code, "the gate must refuse the second request")
	assert.False(t, reached, "a refused request must not reach the handler")
}

// setAccountGroup puts the account in a group, the way a real auth does.
func setAccountGroup(c *gin.Context, group string) {
	common.SetContextKey(c, constant.ContextKeyUserGroup, group)
}
