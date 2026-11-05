package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/common/dbx"
	"github.com/QuantumNous/new-api/internal/dbinfra"
	"github.com/QuantumNous/new-api/internal/identity"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"
	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// cnPeer is a mainland-China client address used as the simulated peer for the
// blocked-region cases (no trusted proxy is configured on these engines, so the
// peer address is authoritative).
const cnPeer = "114.114.114.114:23456"

// withGeoGateEnv prepares an in-memory database with the options and users
// tables, enables the gate through the real option pipeline, and makes every
// client IP resolve to CN so the tests need no MMDB fixture. The country lookup
// indirection is what production replaces with the MaxMind-backed resolver.
func withGeoGateEnv(t *testing.T) {
	t.Helper()

	previousDB, previousRedis := dbx.DB, common.RedisEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&dbinfra.Option{}, &identity.User{}))
	dbx.DB = db
	common.RedisEnabled = false

	// ApplyOption writes back to OptionMap, which the test binary may not have
	// initialized yet.
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	common.OptionMapRWMutex.Unlock()

	previousLookup := geoCountryLookup
	geoCountryLookup = func(ip string) string {
		if ip == "114.114.114.114" {
			return "CN"
		}
		return ""
	}

	require.NoError(t, dbinfra.UpdateOption("geo_block_setting.enabled", "true"))
	require.NoError(t, dbinfra.UpdateOption("geo_block_setting.blocked_countries", `["CN"]`))

	t.Cleanup(func() {
		// Reset the process-wide state first, then restore the database handle:
		// the reverse order would leave the enabled flag in memory and pollute
		// tests that do not involve the gate.
		_ = dbinfra.UpdateOption("geo_block_setting.enabled", "false")
		geoCountryLookup = previousLookup
		geoGateCacheMu.Lock()
		geoGateCache = map[string]geoGateVerdict{}
		geoGateCacheMu.Unlock()
		dbx.DB = previousDB
		common.RedisEnabled = previousRedis
	})
}

// withGeoTokens records dashboard credentials on the users table. Both users
// are enabled; they differ only in role, which is what the gate must judge.
func withGeoUser(t *testing.T, id, role int, accessToken string) {
	t.Helper()
	require.NoError(t, dbx.DB.Create(&identity.User{
		Id:          id,
		Username:    "geo-user-" + accessToken,
		Password:    "not-used-in-this-test",
		Role:        role,
		Status:      common.UserStatusEnabled,
		AccessToken: &accessToken,
		AffCode:     accessToken + "-aff",
	}).Error)
}

// newGeoGateRouter registers the gate plus probe routes for every path class
// the gate distinguishes, and returns the engine and its fiber app.
func newGeoGateRouter(t *testing.T) (contract.Engine, *fiber.App) {
	t.Helper()

	server := fiberadapter.NewEngine(func(c contract.Context, recovered any) {
		c.AbortWithStatus(http.StatusInternalServerError)
	})
	server.Use(GeoBlock())

	ok := func(c contract.Context) { _ = c.String(http.StatusOK, "ok") }
	for _, path := range []string{
		"/pricing",               // blocked web page
		"/sign-in",               // sign-in shell stays reachable
		"/404",                   // block landing page stays reachable
		"/assets/app.js",         // SPA bundle stays reachable
		"/api/status",            // public bootstrap config
		"/api/user/self",         // blocked data API
		"/v1/chat/completions",   // blocked relay API
	} {
		server.GET(path, ok)
	}
	server.POST("/api/user/login", ok)

	return server, captureEngineApp(t, server)
}

// geoGateRequest serves one request from the simulated CN peer.
func geoGateRequest(t *testing.T, app *fiber.App, method, path, authorization string) *http.Response {
	t.Helper()
	request := httptest.NewRequest(method, path, nil)
	if authorization != "" {
		request.Header.Set("Authorization", authorization)
	}
	return bufferResponseBody(t, servePeerRequest(t, app, request, cnPeer))
}

// TestGeoBlockRejectsBlockedRegionForAnonymous covers the visitor contract: the
// web surface lands on the site's 404 page, the API surface answers 404 JSON,
// and the sign-in / 404 shell remains reachable so an administrator can log in.
func TestGeoBlockRejectsBlockedRegionForAnonymous(t *testing.T) {
	withGeoGateEnv(t)
	_, app := newGeoGateRouter(t)

	webPage := geoGateRequest(t, app, http.MethodGet, "/pricing", "")
	assert.Equal(t, http.StatusFound, webPage.StatusCode, "web pages redirect to the 404 route")
	assert.Equal(t, "/404", webPage.Header.Get("Location"))

	api := geoGateRequest(t, app, http.MethodGet, "/api/user/self", "")
	assert.Equal(t, http.StatusNotFound, api.StatusCode)
	assert.Contains(t, responseBody(t, api), "page not found")

	relay := geoGateRequest(t, app, http.MethodGet, "/v1/chat/completions", "")
	assert.Equal(t, http.StatusNotFound, relay.StatusCode, "relay endpoints answer 404 JSON")
	assert.Contains(t, responseBody(t, relay), "page not found")

	for _, path := range []string{"/sign-in", "/404", "/assets/app.js", "/api/status"} {
		response := geoGateRequest(t, app, http.MethodGet, path, "")
		assert.Equal(t, http.StatusOK, response.StatusCode, "%s must stay reachable for sign-in", path)
	}
	login := geoGateRequest(t, app, http.MethodPost, "/api/user/login", "")
	assert.Equal(t, http.StatusOK, login.StatusCode, "the login flow must stay reachable")
}

// TestGeoBlockAdminExemption covers the operator contract: an admin credential
// passes the gate, a regular user's does not, and the switch turns the
// exemption off entirely.
func TestGeoBlockAdminExemption(t *testing.T) {
	withGeoGateEnv(t)
	withGeoUser(t, 1, common.RoleAdminUser, "admin-token")
	withGeoUser(t, 2, common.RoleCommonUser, "user-token")
	_, app := newGeoGateRouter(t)

	admin := geoGateRequest(t, app, http.MethodGet, "/api/user/self", "Bearer admin-token")
	assert.Equal(t, http.StatusOK, admin.StatusCode, "an administrator keeps full access")

	regular := geoGateRequest(t, app, http.MethodGet, "/api/user/self", "Bearer user-token")
	assert.Equal(t, http.StatusNotFound, regular.StatusCode, "a regular user is still blocked")

	invalid := geoGateRequest(t, app, http.MethodGet, "/api/user/self", "Bearer not-a-real-token")
	assert.Equal(t, http.StatusNotFound, invalid.StatusCode, "an unknown credential is blocked, not errored")

	require.NoError(t, dbinfra.UpdateOption("geo_block_setting.allow_admin", "false"))
	adminOff := geoGateRequest(t, app, http.MethodGet, "/api/user/self", "Bearer admin-token")
	require.Equal(t, http.StatusNotFound, adminOff.StatusCode,
		"allow_admin=false blocks administrators too")
}

// TestGeoBlockUnblockedRegionPasses is the control: a country outside the list
// is never touched, no matter the credential or path.
func TestGeoBlockUnblockedRegionPasses(t *testing.T) {
	withGeoGateEnv(t)
	previousLookup := geoCountryLookup
	geoCountryLookup = func(ip string) string { return "SG" }
	t.Cleanup(func() { geoCountryLookup = previousLookup })
	_, app := newGeoGateRouter(t)

	for _, path := range []string{"/pricing", "/api/user/self", "/v1/chat/completions"} {
		response := geoGateRequest(t, app, http.MethodGet, path, "")
		assert.Equal(t, http.StatusOK, response.StatusCode, "%s must pass for unblocked regions", path)
	}
}
