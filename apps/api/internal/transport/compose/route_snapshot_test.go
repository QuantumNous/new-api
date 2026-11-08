package compose

import (
	"context"
	"os"
	"path"
	"sort"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/internal/transport/contract"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRegisteredRoutesMatchSnapshot(t *testing.T) {
	assert.Equal(t, 394, totalSnapshotRoutes(t), "route snapshot count after scoped access token endpoints")
	for _, tc := range []struct {
		group    string
		register func(contract.Engine)
	}{
		{"api", SetApiRouter},
		{"dashboard", SetDashboardRouter},
		{"relay", SetRelayRouter},
		{"video", SetVideoRouter},
	} {
		t.Run(tc.group, func(t *testing.T) {
			engine := newRouteSnapshotEngine()
			tc.register(engine)
			registered := append([]string(nil), (*engine.routes)...)
			sort.Strings(registered)
			assert.Equal(t, readRouteSnapshot(t, tc.group), registered)
		})
	}
}

func TestRelayRouterRegistersStreamingEndpoints(t *testing.T) {
	engine := newRouteSnapshotEngine()
	SetRelayRouter(engine)
	registered := routeSet(*engine.routes)
	for _, route := range []string{"POST /v1/chat/completions", "POST /v1/messages", "POST /v1/responses", "POST /pg/chat/completions", "GET /v1/realtime", "POST /v1beta/models/*path"} {
		assert.Contains(t, registered, route, "streaming-capable route missing: %s", route)
	}
}

func TestVideoRouterRegistersTaskContentRoutes(t *testing.T) {
	engine := newRouteSnapshotEngine()
	SetVideoRouter(engine)
	registered := routeSet(*engine.routes)
	for _, route := range []string{"GET /v1/videos/:task_id/content", "GET /v1/video/generations/:task_id", "POST /v1/videos/:video_id/remix"} {
		assert.Contains(t, registered, route, "video route missing: %s", route)
	}
}

func readRouteSnapshot(t *testing.T, group string) []string {
	t.Helper()
	raw, err := os.ReadFile("testdata/routes_" + group + ".txt")
	require.NoError(t, err)
	var routes []string
	for _, line := range strings.Split(strings.TrimSpace(string(raw)), "\n") {
		if line = strings.TrimSpace(line); line != "" {
			routes = append(routes, line)
		}
	}
	require.NotEmpty(t, routes)
	return routes
}

func totalSnapshotRoutes(t *testing.T) int {
	t.Helper()
	total := 0
	for _, group := range []string{"api", "dashboard", "relay", "video"} {
		total += len(readRouteSnapshot(t, group))
	}
	return total
}

type routeSnapshotEngine struct {
	routes  *[]string
	prefix  string
	methods []string
	noRoute []contract.Chainable
}

func newRouteSnapshotEngine() *routeSnapshotEngine {
	routes := make([]string, 0)
	return &routeSnapshotEngine{routes: &routes, methods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CONNECT", "TRACE"}}
}

func (r *routeSnapshotEngine) Group(relative string) contract.Routes {
	return &routeSnapshotEngine{routes: r.routes, prefix: joinSnapshotPath(r.prefix, relative), methods: r.methods, noRoute: r.noRoute}
}
func (r *routeSnapshotEngine) Use(...contract.Chainable)                      {}
func (r *routeSnapshotEngine) UseCORS()                                       {}
func (r *routeSnapshotEngine) UseCompression()                                {}
func (r *routeSnapshotEngine) NoRoute(h ...contract.Chainable)                { r.noRoute = h }
func (r *routeSnapshotEngine) TrustProxies([]string) error                    { return nil }
func (r *routeSnapshotEngine) ServeAssets(string, contract.AssetFS)           {}
func (r *routeSnapshotEngine) UseRequestLog(func(contract.RequestLog) string) {}
func (r *routeSnapshotEngine) Serve(string) error                             { return nil }
func (r *routeSnapshotEngine) Shutdown(context.Context) error                 { return nil }
func (r *routeSnapshotEngine) Handle(method, routePath string, _ ...contract.Chainable) {
	*r.routes = append(*r.routes, method+" "+joinSnapshotPath(r.prefix, routePath))
}
func (r *routeSnapshotEngine) GET(routePath string, h ...contract.Chainable) {
	r.Handle("GET", routePath, h...)
}
func (r *routeSnapshotEngine) POST(routePath string, h ...contract.Chainable) {
	r.Handle("POST", routePath, h...)
}
func (r *routeSnapshotEngine) PUT(routePath string, h ...contract.Chainable) {
	r.Handle("PUT", routePath, h...)
}
func (r *routeSnapshotEngine) PATCH(routePath string, h ...contract.Chainable) {
	r.Handle("PATCH", routePath, h...)
}
func (r *routeSnapshotEngine) DELETE(routePath string, h ...contract.Chainable) {
	r.Handle("DELETE", routePath, h...)
}
func (r *routeSnapshotEngine) Any(routePath string, h ...contract.Chainable) {
	for _, method := range r.methods {
		r.Handle(method, routePath, h...)
	}
}

func joinSnapshotPath(base, relative string) string {
	if relative == "" {
		return base
	}
	joined := path.Join(base, relative)
	if !strings.HasPrefix(joined, "/") {
		joined = "/" + joined
	}
	if strings.HasSuffix(relative, "/") && !strings.HasSuffix(joined, "/") {
		return joined + "/"
	}
	return joined
}

func routeSet(routes []string) map[string]struct{} {
	set := make(map[string]struct{}, len(routes))
	for _, route := range routes {
		set[route] = struct{}{}
	}
	return set
}
