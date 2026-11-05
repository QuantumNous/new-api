package router

import (
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// hwPolicyMiddlewareNames are the middleware whose presence on a route is a
// promise to the customer: the response mask, the free-trial limit, the
// reserve gate and the auth that establishes the account those checks read.
var hwPolicyMiddlewareNames = []string{
	"HwMask",
	"HwFreeGroupRateLimit",
	"HwBureauReserveGate",
	"TokenAuth",
	"UserAuth",
	"TokenOrTaskArtifactAccessAuth",
}

// hwRoutePolicyRecorder is installed as the very first engine middleware. It
// records the method and the matched route pattern plus the policy middleware
// that ran, and then aborts, so no handler, controller or database work runs.
type hwRoutePolicyRecorder struct {
	seen map[string][]string
}

func (recorder *hwRoutePolicyRecorder) middleware(shortName func(string) string) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.Request.Method + " " + c.FullPath()
		policy := make([]string, 0, len(hwPolicyMiddlewareNames))
		// HandlerNames() returns the handlers in the order they will run, so the
		// recorded order is the real middleware order relative to the auth.
		for _, handler := range c.HandlerNames() {
			name := shortName(handler)
			if name == "" {
				continue
			}
			if !slices.Contains(policy, name) {
				policy = append(policy, name)
			}
			// The free-group limit and the reserve gate are no longer mounted by
			// the route: the auth hook applies them at the end of its success
			// path. Record where that hook puts them, so the table keeps
			// describing the policy the customer actually meets.
			if auth := hwPolicyAuthKind(name); auth != "" {
				freeGroup, reserve := middleware.HwAuthGatesFor(auth, c.Request.Method, c.FullPath())
				if freeGroup {
					policy = append(policy, "HwFreeGroupRateLimit")
				}
				if reserve {
					policy = append(policy, "HwBureauReserveGate")
				}
			}
		}
		recorder.seen[key] = policy
		c.AbortWithStatus(http.StatusNoContent)
	}
}

// hwPolicyAuthKind maps a recorded auth middleware to the hook's auth name; the
// artifact-token auth runs its own hook and gets no gates from this one.
func hwPolicyAuthKind(name string) string {
	switch name {
	case "TokenAuth":
		return "token"
	case "UserAuth":
		return "user"
	default:
		return ""
	}
}

// TestHwRoutePolicy walks every route of the real API router and compares the
// policy middleware on it, in order, with the golden table. It is the safety net
// for moving the usage limit into the auth: a route that gains, loses or
// reorders the mask, the free-group limit, the reserve gate or the auth fails
// here before any customer sees it.
func TestHwRoutePolicy(t *testing.T) {
	gin.SetMode(gin.TestMode)

	previousDB := model.DB
	previousMainType, previousLogType := common.MainDatabaseType(), common.LogDatabaseType()
	previousSQLitePath := common.SQLitePath
	previousMaster := common.IsMasterNode
	previousRedis := common.RedisEnabled
	common.SQLitePath = t.TempDir() + "/router-hw-route-policy.db"
	common.IsMasterNode = false
	common.RedisEnabled = false
	t.Setenv("SQL_DSN", "")
	t.Setenv("LOG_SQL_DSN", "")
	require.NoError(t, model.InitDB())
	database := model.DB
	t.Cleanup(func() {
		if sqlDB, err := database.DB(); err == nil {
			_ = sqlDB.Close()
		}
		model.DB = previousDB
		common.SetDatabaseTypes(previousMainType, previousLogType)
		common.SQLitePath = previousSQLitePath
		common.IsMasterNode = previousMaster
		common.RedisEnabled = previousRedis
	})

	recorder := &hwRoutePolicyRecorder{seen: map[string][]string{}}
	engine := gin.New()
	engine.Use(recorder.middleware(hwPolicyShortName))
	SetApiRouter(engine)
	SetDashboardRouter(engine)
	SetRelayRouter(engine)
	SetTaskPluginProtocolRouter(engine)
	SetVideoRouter(engine)
	SetTaskRouter(engine)

	// One request per registered route, with every path parameter filled in.
	// The recorder aborts, so the request never reaches a handler.
	routes := engine.Routes()
	require.NotEmpty(t, routes)
	seen := map[string]struct{}{}
	for _, route := range routes {
		key := route.Method + " " + route.Path
		seen[key] = struct{}{}
		request := httptest.NewRequest(route.Method, hwPolicyConcretePath(route.Path), nil)
		engine.ServeHTTP(httptest.NewRecorder(), request)
	}

	// A route that carries policy middleware but is missing from the golden
	// table is the dangerous direction: a new customer route nobody recorded.
	if path := os.Getenv("HW_ROUTE_POLICY_DUMP"); path != "" {
		keys := make([]string, 0, len(recorder.seen))
		for key, policy := range recorder.seen {
			if len(policy) > 0 {
				keys = append(keys, key)
			}
		}
		slices.Sort(keys)
		var out strings.Builder
		out.WriteString("package router\n\n// hwRoutePolicyGolden records, per route, the policy middleware that runs on it\n// and the order relative to the auth: the mask, the free-group limit, the\n// reserve gate and the auth itself. It was generated from the live router and is\n// meant to be updated only on purpose, when a route change is understood.\nvar hwRoutePolicyGolden = map[string][]string{\n")
		for _, key := range keys {
			quoted := make([]string, 0, len(recorder.seen[key]))
			for _, name := range recorder.seen[key] {
				quoted = append(quoted, strconv.Quote(name))
			}
			out.WriteString("\t" + strconv.Quote(key) + ": {" + strings.Join(quoted, ", ") + "},\n")
		}
		out.WriteString("}\n")
		require.NoError(t, os.WriteFile(path, []byte(out.String()), 0o600))
		t.Fatalf("dumped %d routes to %s", len(keys), path)
	}
	for _, route := range routes {
		key := route.Method + " " + route.Path
		actual := recorder.seen[key]
		golden, recorded := hwRoutePolicyGolden[key]
		if len(actual) == 0 {
			assert.False(t, recorded, "%s is in the golden table but no policy middleware runs on it", key)
			continue
		}
		if !recorded {
			t.Errorf("%s runs the policy middleware %v but is missing from hwRoutePolicyGolden", key, actual)
			continue
		}
		assert.Equal(t, golden, actual, "%s must run exactly this policy middleware, in this order", key)
	}

	// A route that is in the golden table but no longer exists means a promise
	// silently disappeared from the router.
	for key := range hwRoutePolicyGolden {
		if _, ok := seen[key]; !ok {
			t.Errorf("%s is in hwRoutePolicyGolden but the router no longer registers it", key)
		}
	}

	t.Logf("hw route policy covers %d routes", len(hwRoutePolicyGolden))
}

// hwPolicyConcretePath replaces every path parameter with a fixed value so a
// request matches the route it was registered for. A parameter name is itself a
// safe value: no product path segment matches it.
func hwPolicyConcretePath(pattern string) string {
	segments := strings.Split(pattern, "/")
	for i, segment := range segments {
		switch {
		case strings.HasPrefix(segment, "*"):
			segments[i] = "hw-policy-catch-all"
		case strings.HasPrefix(segment, ":"):
			segments[i] = segment[1:]
		}
	}
	return strings.Join(segments, "/")
}

// hwPolicyShortName keeps only the policy middleware name out of a handler name
// such as "github.com/…/middleware.HwMask.func1".
func hwPolicyShortName(handler string) string {
	for _, name := range hwPolicyMiddlewareNames {
		if strings.Contains(handler, name+".") || strings.HasSuffix(handler, "."+name) {
			return name
		}
	}
	return ""
}
