package router

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/plugins"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestPluginDispatcherMissFallsThroughWithoutLeakingInnerResponse(t *testing.T) {
	outer, registry := newPluginRouterTest(t, nil, nil)
	dispatcher := (&pluginRouteDispatcher{registry: registry}).dispatch
	outer.NoRoute(
		dispatcher,
		func(c *gin.Context) {
			assert.Equal(t, "before", c.GetString(middleware.RouteTagKey))
			c.Header("X-Fallback", "true")
			c.String(http.StatusOK, "spa")
		},
	)

	recorder := performPluginRequest(outer, http.MethodGet, "/not-owned")

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "spa", recorder.Body.String())
	assert.Equal(t, "true", recorder.Header().Get("X-Fallback"))
	assert.Empty(t, recorder.Header().Get("Location"))
}

func TestPluginDebugLogsOnlyOwnedRoutes(t *testing.T) {
	previousDebug := common.DebugEnabled
	common.DebugEnabled = true
	t.Cleanup(func() { common.DebugEnabled = previousDebug })

	var output bytes.Buffer
	common.LogWriterMu.Lock()
	previousWriter := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &output
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultErrorWriter = previousWriter
		common.LogWriterMu.Unlock()
	})

	plugin := compileRouterPlugin(t, "debug-owner", "1.0.0", `[
		{method: "GET", path: "/vendor/debug", type: "dynamic"}
	]`)
	handlers := func(generation *jsplugin.RoutingGeneration, group jsplugin.RouteGroup) []gin.HandlerFunc {
		production := productionPluginRouteHandlers(generation, group)
		return []gin.HandlerFunc{
			production[0],
			func(c *gin.Context) { c.Status(http.StatusNoContent) },
		}
	}
	outer, registry := newPluginRouterTest(t, []*jsplugin.LoadedPlugin{plugin}, handlers)
	outer.NoRoute(
		(&pluginRouteDispatcher{registry: registry}).dispatch,
		func(c *gin.Context) { c.String(http.StatusOK, "fallback") },
	)
	output.Reset()

	owned := performPluginRequest(outer, http.MethodGet, "/vendor/debug")
	require.Equal(t, http.StatusNoContent, owned.Code)
	logOutput := output.String()
	assert.Contains(t, logOutput, "request-phase-two")
	assert.Contains(t, logOutput, "task_plugin subsystem=router event=route_matched")
	assert.Contains(t, logOutput, `plugin="debug-owner"`)
	assert.NotContains(t, logOutput, "/vendor/debug")
	assert.Contains(t, logOutput, "event=route_complete")

	output.Reset()
	miss := performPluginRequest(outer, http.MethodGet, "/not-owned")
	require.Equal(t, http.StatusOK, miss.Code)
	assert.Equal(t, "fallback", miss.Body.String())
	assert.NotContains(t, output.String(), "task_plugin")
}

func TestPluginAuthoredHeaderOnly404PassesThrough(t *testing.T) {
	plugin := compileRouterPlugin(t, "authored-404", "1.0.0", `[
		{method: "GET", path: "/vendor/missing", type: "dynamic"}
	]`)
	handlers := testPluginRouteHandlers(func(c *gin.Context, _ *jsplugin.RoutingGeneration, _ jsplugin.RouteBinding) {
		c.Header("X-Plugin", "authored")
		c.Status(http.StatusNotFound)
	})
	outer, registry := newPluginRouterTest(t, []*jsplugin.LoadedPlugin{plugin}, handlers)
	outer.NoRoute(
		(&pluginRouteDispatcher{registry: registry}).dispatch,
		func(c *gin.Context) { c.String(http.StatusOK, "fallback") },
	)

	recorder := performPluginRequest(outer, http.MethodGet, "/vendor/missing")

	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Empty(t, recorder.Body.String())
	assert.Equal(t, "authored", recorder.Header().Get("X-Plugin"))
}

func TestPluginOwnedPathMethodMismatchReturns405(t *testing.T) {
	plugin := compileRouterPlugin(t, "method-owner", "1.0.0", `[
		{method: "GET", path: "/vendor/jobs/:task_id", type: "query", render: "native"}
	]`)
	outer, registry := newPluginRouterTest(t, []*jsplugin.LoadedPlugin{plugin}, testPluginRouteHandlers(
		func(c *gin.Context, _ *jsplugin.RoutingGeneration, _ jsplugin.RouteBinding) {
			c.String(http.StatusOK, "plugin")
		},
	))
	outer.NoRoute(
		(&pluginRouteDispatcher{registry: registry}).dispatch,
		func(c *gin.Context) { c.String(http.StatusOK, "fallback") },
	)

	recorder := performPluginRequest(outer, http.MethodPost, "/vendor/jobs/task-1")

	assert.Equal(t, http.StatusMethodNotAllowed, recorder.Code)
	assert.Empty(t, recorder.Body.String())
}

func TestPluginTrailingSlashMissDoesNotRedirect(t *testing.T) {
	for _, testCase := range []struct {
		name        string
		routePath   string
		requestPath string
	}{
		{name: "declared without slash", routePath: "/vendor/job", requestPath: "/vendor/job/"},
		{name: "declared with slash", routePath: "/vendor/job/", requestPath: "/vendor/job"},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			plugin := compileRouterPlugin(t, "slash-owner", "1.0.0", fmt.Sprintf(`[
				{method: "GET", path: %q, type: "dynamic"}
			]`, testCase.routePath))
			outer, registry := newPluginRouterTest(t, []*jsplugin.LoadedPlugin{plugin}, testPluginRouteHandlers(
				func(c *gin.Context, _ *jsplugin.RoutingGeneration, _ jsplugin.RouteBinding) {
					c.String(http.StatusOK, "plugin")
				},
			))
			outer.NoRoute(
				(&pluginRouteDispatcher{registry: registry}).dispatch,
				func(c *gin.Context) { c.String(http.StatusOK, "fallback") },
			)

			recorder := performPluginRequest(outer, http.MethodGet, testCase.requestPath)

			assert.Equal(t, http.StatusOK, recorder.Code)
			assert.Equal(t, "fallback", recorder.Body.String())
			assert.Empty(t, recorder.Header().Get("Location"))
		})
	}
}

func TestPluginSSEFlushesWithoutFallbackBuffering(t *testing.T) {
	plugin := compileRouterPlugin(t, "stream-owner", "1.0.0", `[
		{method: "GET", path: "/vendor/stream", type: "dynamic"}
	]`)
	handlers := testPluginRouteHandlers(func(c *gin.Context, _ *jsplugin.RoutingGeneration, _ jsplugin.RouteBinding) {
		c.Header("Content-Type", "text/event-stream")
		_, _ = c.Writer.WriteString("data: ready\n\n")
		c.Writer.Flush()
	})
	outer, registry := newPluginRouterTest(t, []*jsplugin.LoadedPlugin{plugin}, handlers)
	outer.NoRoute(
		(&pluginRouteDispatcher{registry: registry}).dispatch,
		middleware.RouteTag("web"),
		gzip.Gzip(gzip.DefaultCompression),
		middleware.Cache(),
		func(c *gin.Context) { c.String(http.StatusOK, "fallback") },
	)

	request := httptest.NewRequest(http.MethodGet, "/vendor/stream", nil)
	request.Header.Set("Accept-Encoding", "gzip")
	recorder := httptest.NewRecorder()
	outer.ServeHTTP(recorder, request)

	assert.True(t, recorder.Flushed)
	assert.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
	assert.Equal(t, "data: ready\n\n", recorder.Body.String())
	assert.Empty(t, recorder.Header().Get("Content-Encoding"))
	assert.Empty(t, recorder.Header().Get("Cache-Control"))
	assert.Empty(t, recorder.Header().Get("Cache-Version"))
}

// A plugin route reaches the client connection through the gated writer: a
// relayed stream that stopped early cuts it off, and the client sees the
// stream end as the vendor's did.
func TestPluginRouteCanCutOffItsClientStream(t *testing.T) {
	plugin := compileRouterPlugin(t, "cut-owner", "1.0.0", `[
		{method: "GET", path: "/vendor/stream", type: "dynamic"}
	]`)
	handlers := testPluginRouteHandlers(func(c *gin.Context, _ *jsplugin.RoutingGeneration, _ jsplugin.RouteBinding) {
		c.Header("Content-Type", "text/event-stream")
		_, _ = c.Writer.WriteString("data: ready\n\n")
		c.Writer.Flush()
		assert.NoError(t, http.NewResponseController(c.Writer).SetWriteDeadline(time.Now()))
	})
	outer, registry := newPluginRouterTest(t, []*jsplugin.LoadedPlugin{plugin}, handlers)
	outer.NoRoute((&pluginRouteDispatcher{registry: registry}).dispatch)
	server := httptest.NewServer(outer)
	defer server.Close()

	response, err := http.Get(server.URL + "/vendor/stream")
	require.NoError(t, err)
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	assert.Equal(t, "data: ready\n\n", string(body))
	assert.ErrorIs(t, err, io.ErrUnexpectedEOF)
}

func TestWebCacheHeadersDoNotLeakOntoPluginRoutes(t *testing.T) {
	plugin := compileRouterPlugin(t, "cache-owner", "1.0.0", `[
		{method: "GET", path: "/vendor/status/:task_id", type: "query", render: "native"}
	]`)
	outer, registry := newPluginRouterTest(t, []*jsplugin.LoadedPlugin{plugin}, testPluginRouteHandlers(
		func(c *gin.Context, _ *jsplugin.RoutingGeneration, _ jsplugin.RouteBinding) {
			c.JSON(http.StatusOK, gin.H{"status": "queued"})
		},
	))
	outer.NoRoute(
		(&pluginRouteDispatcher{registry: registry}).dispatch,
		middleware.Cache(),
		func(c *gin.Context) { c.String(http.StatusOK, "fallback") },
	)

	pluginResponse := performPluginRequest(outer, http.MethodGet, "/vendor/status/task-1")
	assert.Empty(t, pluginResponse.Header().Get("Cache-Control"))
	assert.Empty(t, pluginResponse.Header().Get("Cache-Version"))

	fallbackResponse := performPluginRequest(outer, http.MethodGet, "/unknown")
	assert.Equal(t, "max-age=604800", fallbackResponse.Header().Get("Cache-Control"))
	assert.NotEmpty(t, fallbackResponse.Header().Get("Cache-Version"))
}

func TestPluginInnerContextImportsRequestMetadataAndTrustedProxyConfig(t *testing.T) {
	plugin := compileRouterPlugin(t, "context-owner", "1.0.0", `[
		{method: "GET", path: "/vendor/context", type: "dynamic"}
	]`)
	handlers := testPluginRouteHandlers(func(c *gin.Context, _ *jsplugin.RoutingGeneration, _ jsplugin.RouteBinding) {
		c.JSON(http.StatusOK, gin.H{
			"request_id": c.GetString(common.RequestIdKey),
			"language":   c.GetString(string(constant.ContextKeyLanguage)),
			"client_ip":  c.ClientIP(),
			"route_tag":  c.GetString(middleware.RouteTagKey),
		})
	})
	outer, registry := newPluginRouterTestWithProxies(t, []*jsplugin.LoadedPlugin{plugin}, handlers, []string{"127.0.0.0/8"})
	outer.NoRoute((&pluginRouteDispatcher{registry: registry}).dispatch)

	request := httptest.NewRequest(http.MethodGet, "/vendor/context", nil)
	request.RemoteAddr = "127.0.0.1:1234"
	request.Header.Set("X-Forwarded-For", "203.0.113.20")
	recorder := httptest.NewRecorder()
	outer.ServeHTTP(recorder, request)

	assert.JSONEq(t, `{"request_id":"request-phase-two","language":"zh-CN","client_ip":"203.0.113.20","route_tag":"relay"}`, recorder.Body.String())
}

func TestPluginRequestPinsGenerationAcrossHotSwap(t *testing.T) {
	v1 := compileRouterPlugin(t, "hot-swap", "1.0.0", `[
		{method: "GET", path: "/vendor/version", type: "dynamic"}
	]`)
	v2 := compileRouterPlugin(t, "hot-swap", "2.0.0", `[
		{method: "GET", path: "/vendor/version", type: "dynamic"}
	]`)
	started := make(chan struct{})
	release := make(chan struct{})
	var startOnce sync.Once
	t.Cleanup(func() {
		select {
		case <-release:
		default:
			close(release)
		}
	})
	var registry *jsplugin.Registry
	handlers := testPluginRouteHandlers(func(c *gin.Context, generation *jsplugin.RoutingGeneration, binding jsplugin.RouteBinding) {
		if binding.Plugin.Meta.Version == "1.0.0" {
			startOnce.Do(func() { close(started) })
			<-release
		}
		pinnedValue, exists := c.Get(jsplugin.ContextKeyPinnedRoute)
		pinned, ok := pinnedValue.(jsplugin.PinnedRoute)
		if !exists || !ok || pinned.Plugin == nil || pinned.Generation == nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"version":            binding.Plugin.Meta.Version,
			"generation":         generation.Number,
			"pinned_version":     pinned.Plugin.Meta.Version,
			"pinned_generation":  pinned.Generation.Number,
			"current_generation": registry.Generation().Number,
		})
	})
	outer, activeRegistry := newPluginRouterTest(t, []*jsplugin.LoadedPlugin{v1}, handlers)
	registry = activeRegistry
	outer.NoRoute((&pluginRouteDispatcher{registry: registry}).dispatch)
	firstGeneration := registry.Generation().Number

	firstDone := make(chan *httptest.ResponseRecorder, 1)
	go func() {
		firstDone <- performPluginRequest(outer, http.MethodGet, "/vendor/version")
	}()
	select {
	case <-started:
	case <-time.After(2 * time.Second):
		require.FailNow(t, "first generation request did not start")
	}
	require.NoError(t, registry.ReplaceOverrides([]*jsplugin.LoadedPlugin{v2}))
	secondGeneration := registry.Generation().Number
	close(release)

	var first *httptest.ResponseRecorder
	select {
	case first = <-firstDone:
	case <-time.After(2 * time.Second):
		require.FailNow(t, "pinned first generation request did not finish")
	}
	assert.JSONEq(t, fmt.Sprintf(`{
		"version": "1.0.0",
		"generation": %d,
		"pinned_version": "1.0.0",
		"pinned_generation": %d,
		"current_generation": %d
	}`, firstGeneration, firstGeneration, secondGeneration), first.Body.String())
	second := performPluginRequest(outer, http.MethodGet, "/vendor/version")
	assert.JSONEq(t, fmt.Sprintf(`{
		"version": "2.0.0",
		"generation": %d,
		"pinned_version": "2.0.0",
		"pinned_generation": %d,
		"current_generation": %d
	}`, secondGeneration, secondGeneration, secondGeneration), second.Body.String())
}

// A host route, or the trailing-slash redirect it causes, shadows only the
// top-level route of a built-in plugin; the /{key} copy still serves it.
func TestPluginStaticRouteConflictsAreExcluded(t *testing.T) {
	tests := []struct {
		name        string
		staticPath  string
		route       string
		requestPath string
		served      bool
	}{
		{name: "parameter intersection", staticPath: "/core/:id", route: `{method: "GET", path: "/core/fixed", type: "dynamic"}`, requestPath: "/core/fixed"},
		{name: "trailing slash redirect shadow", staticPath: "/fixed", route: `{method: "GET", path: "/fixed/", type: "dynamic"}`, requestPath: "/fixed/"},
		{name: "catchall redirect shadow", staticPath: "/files/*filepath", route: `{method: "GET", path: "/files", type: "dynamic"}`, requestPath: "/files"},
		{name: "literal against a host parameter", staticPath: "/jobs/:id/content", route: `{method: "GET", path: "/jobs/fixed/:name", type: "dynamic"}`, requestPath: "/jobs/fixed/content"},
		{name: "query task id against a host parameter", staticPath: "/jobs/:id/content", route: `{method: "GET", path: "/jobs/:task_id/content", type: "query"}`, requestPath: "/jobs/task_1/content"},
		{name: "other method", staticPath: "/core/:id", route: `{method: "POST", path: "/core/fixed", type: "submit"}`, requestPath: "/core/fixed", served: true},
		{name: "query task id against a host literal", staticPath: "/jobs/:id/content", route: `{method: "GET", path: "/jobs/fixed/:task_id", type: "query"}`, requestPath: "/jobs/fixed/task_1", served: true},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			outer := newOuterPluginTestEngine()
			outer.GET(testCase.staticPath, func(c *gin.Context) { c.String(http.StatusOK, "static") })
			registry := jsplugin.NewRegistry()
			plugin, err := registry.RegisterFactory(routerPluginSource("static-conflict", "1.0.0", "["+testCase.route+"]"), jsplugin.Options{})
			require.NoError(t, err)
			builder := newPluginGenerationBuilder(outer.Routes(), nil, testPluginRouteHandlers(
				func(c *gin.Context, _ *jsplugin.RoutingGeneration, _ jsplugin.RouteBinding) {
					c.String(http.StatusOK, "plugin")
				},
			))
			require.NoError(t, registry.SetGenerationPreparer(builder.prepare))
			outer.NoRoute(
				(&pluginRouteDispatcher{registry: registry}).dispatch,
				func(c *gin.Context) { c.String(http.StatusOK, "fallback") },
			)

			method := plugin.Meta.Routes[0].Method
			_, active := registry.Get("static-conflict")
			assert.True(t, active)
			assert.Empty(t, registry.RoutingErrors())
			assert.Equal(t, "plugin", performPluginRequest(outer, method, "/static-conflict"+testCase.requestPath).Body.String())
			recorder := performPluginRequest(outer, method, testCase.requestPath)
			if testCase.served {
				assert.Equal(t, "plugin", recorder.Body.String())
				assert.Empty(t, registry.Generation().SkippedRoutes())
				return
			}
			assert.NotEqual(t, "plugin", recorder.Body.String())
			assert.Equal(t, []jsplugin.SkippedRoute{{PluginKey: "static-conflict", Route: plugin.Meta.Routes[0], Reason: "host_route"}}, registry.Generation().SkippedRoutes())
		})
	}
}

// The host's namespaces (api and the first segment of every static route)
// carry the top-level routes of built-in plugins only. Every plugin keeps its
// /{key} address, so a key may not name a host segment or a built-in plugin's
// own prefix.
func TestHostNamespacesCarryOnlyBuiltInTopLevelRoutes(t *testing.T) {
	outer := newOuterPluginTestEngine()
	outer.GET("/v1/models", func(c *gin.Context) { c.String(http.StatusOK, "host models") })
	outer.GET("/v1beta/models", func(c *gin.Context) { c.String(http.StatusOK, "host gemini") })
	outer.POST("/pg/chat/completions", func(c *gin.Context) { c.String(http.StatusOK, "host playground") })
	registry := jsplugin.NewRegistry()
	builtIn, err := registry.RegisterFactory(routerPluginSource("builtin-probe", "1.0.0", `[
		{method: "POST", path: "/v1/videos/foo", type: "submit"},
		{method: "GET", path: "/v1/models", type: "query"}
	]`), jsplugin.Options{})
	require.NoError(t, err)
	for _, key := range []string{"alibaba", "sunoapi"} {
		prefix := map[string]string{"alibaba": "ali", "sunoapi": "suno"}[key]
		_, err = registry.RegisterFactory(routerPluginSource(key, "1.0.0", `[{method: "POST", path: "/`+prefix+`/jobs", type: "submit"}]`), jsplugin.Options{})
		require.NoError(t, err)
	}
	third := compileRouterPlugin(t, "third-probe", "1.0.0", `[
		{method: "POST", path: "/v1/videos/foo", type: "submit"},
		{method: "POST", path: "/ent/v2/text2video", type: "submit"},
		{method: "POST", path: "/beta/jobs", type: "submit"}
	]`)
	overrides := []*jsplugin.LoadedPlugin{third, compileRouterPlugin(t, "beta", "1.0.0", `[{method: "POST", path: "/own/jobs", type: "submit"}]`)}
	for _, key := range []string{"pg", "v1beta", "ali", "suno"} {
		overrides = append(overrides, compileRouterPlugin(t, key, "1.0.0", `[{method: "POST", path: "/own/jobs", type: "submit"}]`))
	}
	require.NoError(t, registry.ReplaceOverrides(overrides))
	builder := newPluginGenerationBuilder(outer.Routes(), nil, testPluginRouteHandlers(func(c *gin.Context, _ *jsplugin.RoutingGeneration, binding jsplugin.RouteBinding) {
		c.String(http.StatusOK, binding.Plugin.Meta.Key)
	}))
	require.NoError(t, registry.SetGenerationPreparer(builder.prepare))
	outer.NoRoute(
		(&pluginRouteDispatcher{registry: registry}).dispatch,
		func(c *gin.Context) { c.String(http.StatusOK, "fallback") },
	)

	for _, request := range []struct{ method, path, answer string }{
		{http.MethodPost, "/v1/videos/foo", "builtin-probe"},
		{http.MethodPost, "/builtin-probe/v1/videos/foo", "builtin-probe"},
		{http.MethodPost, "/third-probe/v1/videos/foo", "third-probe"},
		{http.MethodGet, "/v1/models", "host models"},
		{http.MethodGet, "/builtin-probe/v1/models", "builtin-probe"},
		{http.MethodPost, "/ent/v2/text2video", "third-probe"},
		{http.MethodPost, "/beta/jobs", "fallback"},
		{http.MethodPost, "/third-probe/beta/jobs", "third-probe"},
		{http.MethodPost, "/beta/own/jobs", "beta"},
	} {
		assert.Equal(t, request.answer, performPluginRequest(outer, request.method, request.path).Body.String(), request.method+" "+request.path)
	}
	assert.ElementsMatch(t, []jsplugin.SkippedRoute{
		{PluginKey: "builtin-probe", Route: builtIn.Meta.Routes[1], Reason: "host_route"},
		{PluginKey: "third-probe", Route: third.Meta.Routes[0], Reason: "host_namespace"},
		{PluginKey: "third-probe", Route: third.Meta.Routes[2], Reason: "key_namespace"},
	}, registry.Generation().SkippedRoutes())
	routingErrors := registry.RoutingErrors()
	assert.Len(t, routingErrors, 4)
	assert.Contains(t, routingErrors["pg"], `plugin key "pg" is a host path segment`)
	assert.Contains(t, routingErrors["v1beta"], `plugin key "v1beta" is a host path segment`)
	assert.Contains(t, routingErrors["ali"], `plugin key "ali" is a prefix owned by built-in plugin alibaba`)
	assert.Contains(t, routingErrors["suno"], `plugin key "suno" is a prefix owned by built-in plugin sunoapi`)
}

// Plugins declaring the same path shape share one registration whose
// candidates are all of them; each candidate reads the parameters under the
// names it declares, and /{key} reaches one plugin only.
func TestSharedPluginRoutesRegisterOnceWithEveryCandidate(t *testing.T) {
	alpha := compileRouterPlugin(t, "shared-alpha", "1.0.0", `[
		{method: "POST", path: "/probe/v1/jobs", type: "submit"},
		{method: "GET", path: "/probe/v1/jobs/:task_id", type: "query"}
	]`)
	beta := compileRouterPlugin(t, "shared-beta", "1.0.0", `[
		{method: "POST", path: "/probe/v1/jobs", type: "submit"},
		{method: "GET", path: "/probe/v1/jobs/:job_id", type: "query", taskIdParam: "job_id"}
	]`)
	handlers := testPluginRouteHandlers(func(c *gin.Context, _ *jsplugin.RoutingGeneration, _ jsplugin.RouteBinding) {
		pinned := c.MustGet(jsplugin.ContextKeyPinnedRoute).(jsplugin.PinnedRoute)
		answers := make([]string, 0, len(pinned.Candidates))
		for _, candidate := range pinned.Candidates {
			answers = append(answers, fmt.Sprintf("%s %v", candidate.Plugin.Meta.Key, jsplugin.RouteParams(c.Params, candidate.Route)))
		}
		c.String(http.StatusOK, strings.Join(answers, " "))
	})
	outer, registry := newPluginRouterTest(t, []*jsplugin.LoadedPlugin{beta, alpha}, handlers)
	outer.NoRoute((&pluginRouteDispatcher{registry: registry}).dispatch)
	require.Empty(t, registry.RoutingErrors())

	registrations := 0
	for _, group := range registry.Generation().RouteGroups() {
		if group.Method == http.MethodPost && group.Shape == "/probe/v1/jobs" {
			registrations++
			assert.Len(t, group.Bindings, 2)
		}
	}
	assert.Equal(t, 1, registrations)
	assert.Equal(t, "shared-alpha map[] shared-beta map[]", performPluginRequest(outer, http.MethodPost, "/probe/v1/jobs").Body.String())
	assert.Equal(t, "shared-alpha map[task_id:task_1] shared-beta map[job_id:task_1]", performPluginRequest(outer, http.MethodGet, "/probe/v1/jobs/task_1").Body.String())
	assert.Equal(t, "shared-beta map[]", performPluginRequest(outer, http.MethodPost, "/shared-beta/probe/v1/jobs").Body.String())
	assert.Equal(t, "shared-beta map[job_id:task_2]", performPluginRequest(outer, http.MethodGet, "/shared-beta/probe/v1/jobs/task_2").Body.String())
}

func TestBuiltInPluginRoutesAreServedBesideHostRoutes(t *testing.T) {
	require.Empty(t, jsplugin.DefaultRegistry.RoutingErrors())
	builtIns := jsplugin.DefaultRegistry.Generation().Plugins()
	require.NotEmpty(t, builtIns)

	// The static routes SetRouter registers before the plugin router.
	outer := gin.New()
	SetApiRouter(outer)
	SetDashboardRouter(outer)
	SetRelayRouter(outer)
	SetTaskPluginProtocolRouter(outer)
	SetVideoRouter(outer)
	SetTaskRouter(outer)
	registry := jsplugin.NewRegistry()
	for _, plugin := range builtIns {
		source, err := plugins.Source(plugin.Meta.Key)
		require.NoError(t, err)
		_, err = registry.RegisterFactory(source, jsplugin.Options{Key: plugin.Meta.Key})
		require.NoError(t, err)
	}
	builder := newPluginGenerationBuilder(outer.Routes(), nil, testPluginRouteHandlers(
		func(c *gin.Context, _ *jsplugin.RoutingGeneration, binding jsplugin.RouteBinding) {
			c.String(http.StatusOK, binding.Plugin.Meta.Key)
		},
	))
	require.NoError(t, registry.SetGenerationPreparer(builder.prepare))
	outer.NoRoute((&pluginRouteDispatcher{registry: registry}).dispatch, controller.RelayNotFound)

	require.Empty(t, registry.RoutingErrors())
	require.Empty(t, registry.Generation().SkippedRoutes())
	for _, plugin := range builtIns {
		_, active := registry.Get(plugin.Meta.Key)
		assert.True(t, active, plugin.Meta.Key)
	}
	const vertexModel = "/projects/sample/locations/us-central1/publishers/google/models/veo-3.1-generate-preview"
	for _, request := range []struct{ method, path, plugin string }{
		{http.MethodPost, "/api/v3/contents/generations/tasks", "doubao"},
		{http.MethodGet, "/api/v3/contents/generations/tasks/task_sample", "doubao"},
		{http.MethodPost, "/api/v3/images/generations", "doubao"},
		{http.MethodPost, "/doubao/api/v3/contents/generations/tasks", "doubao"},
		{http.MethodPost, "/api/v1/services/aigc/multimodal-generation/generation", "alibaba"},
		{http.MethodPost, "/api/v1/services/aigc/video-generation/video-synthesis", "alibaba"},
		{http.MethodGet, "/api/v1/tasks/task_sample", "alibaba"},
		{http.MethodPost, "/alibaba/api/v1/services/aigc/video-generation/video-synthesis", "alibaba"},
		{http.MethodPost, "/ali/api/v1/services/aigc/video-generation/video-synthesis", "alibaba"},
		{http.MethodGet, "/ali/api/v1/tasks/task_sample", "alibaba"},
		{http.MethodPost, "/v1/videos/text2video", "kling"},
		{http.MethodGet, "/v1/videos/image2video/task_sample", "kling"},
		{http.MethodPost, "/kling/v1/videos/text2video", "kling"},
		{http.MethodPost, "/v1/videos/generations", "xai"},
		{http.MethodPost, "/v1/videos/extensions", "xai"},
		{http.MethodGet, "/xai/v1/videos/task_sample", "xai"},
		{http.MethodGet, "/v1beta/models/veo-3.1-generate-preview/operations/task_sample", "google"},
		{http.MethodPost, "/google/v1beta/models/veo-3.1-generate-preview:predictLongRunning", "google"},
		{http.MethodPost, "/ent/v2/reference2video", "vidu"},
		{http.MethodGet, "/ent/v2/tasks/task_sample/creations", "vidu"},
		{http.MethodPost, "/vidu/ent/v2/text2video", "vidu"},
		{http.MethodPost, "/v1" + vertexModel + ":predictLongRunning", "vertex-ai"},
		{http.MethodPost, "/v1beta1" + vertexModel + ":predictLongRunning", "vertex-ai"},
		{http.MethodPost, "/vertex-ai/v1beta1" + vertexModel + ":fetchPredictOperation", "vertex-ai"},
		{http.MethodPost, "/v1/video_generation", "hailuo"},
		{http.MethodGet, "/v1/query/video_generation?task_id=task_sample", "hailuo"},
		{http.MethodGet, "/hailuo/v1/query/video_generation?task_id=task_sample", "hailuo"},
		{http.MethodGet, "/hailuo/v1/query/video_generation/task_sample", "hailuo"},
		{http.MethodGet, "/v1/files/retrieve?file_id=task_sample", "hailuo"},
		{http.MethodPost, "/v2/video_generation", "hailuo"},
		{http.MethodGet, "/v2/query/video_generation/task_sample", "hailuo"},
		{http.MethodPost, "/api/common/v3/submit_task_v2", "jimeng"},
		{http.MethodPost, "/api/common/v3/get_result_v2", "jimeng"},
		{http.MethodPost, "/jimeng/api/common/v3/submit_task_v2", "jimeng"},
		{http.MethodPost, "/suno/fetch", "sunoapi"},
		{http.MethodGet, "/suno/fetch/task_sample", "sunoapi"},
	} {
		recorder := performPluginRequest(outer, request.method, request.path)
		assert.Equal(t, request.plugin, recorder.Body.String(), request.method+" "+request.path)
	}
	// A prefix is never doubled, and GET /v1/files/:id is no longer a host route.
	for _, request := range []struct{ method, path string }{
		{http.MethodPost, "/sunoapi/suno/fetch"},
		{http.MethodPost, "/alibaba/ali/api/v1/services/aigc/video-generation/video-synthesis"},
		{http.MethodGet, "/v1/files/file_sample"},
	} {
		recorder := performPluginRequest(outer, request.method, request.path)
		assert.Equal(t, http.StatusNotFound, recorder.Code, request.method+" "+request.path)
		assert.Contains(t, recorder.Body.String(), "Invalid URL", request.method+" "+request.path)
	}
}
func TestPluginRouteOwnershipCanSwapWithinOneGeneration(t *testing.T) {
	alphaV1 := compileRouterPlugin(t, "route-swap-alpha", "1.0.0", `[
		{method: "GET", path: "/route-swap/alpha", type: "dynamic"}
	]`)
	betaV1 := compileRouterPlugin(t, "route-swap-beta", "1.0.0", `[
		{method: "GET", path: "/route-swap/beta", type: "dynamic"}
	]`)
	alphaV2 := compileRouterPlugin(t, "route-swap-alpha", "2.0.0", `[
		{method: "GET", path: "/route-swap/beta", type: "dynamic"}
	]`)
	betaV2 := compileRouterPlugin(t, "route-swap-beta", "2.0.0", `[
		{method: "GET", path: "/route-swap/alpha", type: "dynamic"}
	]`)
	handlers := testPluginRouteHandlers(func(c *gin.Context, _ *jsplugin.RoutingGeneration, binding jsplugin.RouteBinding) {
		c.String(http.StatusOK, binding.Plugin.Meta.Key+"@"+binding.Plugin.Meta.Version)
	})
	outer, registry := newPluginRouterTest(t, []*jsplugin.LoadedPlugin{alphaV1, betaV1}, handlers)
	outer.NoRoute((&pluginRouteDispatcher{registry: registry}).dispatch)

	require.NoError(t, registry.ReplaceOverrides([]*jsplugin.LoadedPlugin{alphaV2, betaV2}))

	assert.Equal(t, "route-swap-beta@2.0.0", performPluginRequest(outer, http.MethodGet, "/route-swap/alpha").Body.String())
	assert.Equal(t, "route-swap-alpha@2.0.0", performPluginRequest(outer, http.MethodGet, "/route-swap/beta").Body.String())
	assert.Empty(t, registry.RoutingErrors())
}

// Overlapping routes of different plugins are all admitted: per method, Gin
// answers a literal segment before a parameter.
func TestPluginPathOwnershipIsExclusivePerMethod(t *testing.T) {
	alpha := compileRouterPlugin(t, "alpha-owner", "1.0.0", `[
		{method: "GET", path: "/shared/jobs/:task_id", type: "query", render: "native"}
	]`)
	beta := compileRouterPlugin(t, "beta-owner", "1.0.0", `[
		{method: "POST", path: "/shared/jobs/:task_id", type: "submit"}
	]`)
	gamma := compileRouterPlugin(t, "gamma-owner", "1.0.0", `[
		{method: "GET", path: "/shared/jobs/fixed", type: "dynamic"}
	]`)
	// Display priority must not change route ownership.
	alpha.Meta.SortPriority = -100
	gamma.Meta.SortPriority = 100
	handlers := testPluginRouteHandlers(func(c *gin.Context, _ *jsplugin.RoutingGeneration, binding jsplugin.RouteBinding) {
		c.String(http.StatusOK, binding.Plugin.Meta.Key)
	})
	outer, registry := newPluginRouterTest(t, []*jsplugin.LoadedPlugin{gamma, beta, alpha}, handlers)
	outer.NoRoute(
		(&pluginRouteDispatcher{registry: registry}).dispatch,
		func(c *gin.Context) { c.String(http.StatusOK, "fallback") },
	)

	assert.Equal(t, "alpha-owner", performPluginRequest(outer, http.MethodGet, "/shared/jobs/task-1").Body.String())
	assert.Equal(t, "beta-owner", performPluginRequest(outer, http.MethodPost, "/shared/jobs/task-1").Body.String())
	assert.Equal(t, "gamma-owner", performPluginRequest(outer, http.MethodGet, "/shared/jobs/fixed").Body.String())
	assert.Equal(t, http.StatusMethodNotAllowed, performPluginRequest(outer, http.MethodPut, "/shared/jobs/task-1").Code)
	assert.Empty(t, registry.RoutingErrors())
}

func TestOnePluginMayOwnMultipleMethodsForSamePath(t *testing.T) {
	plugin := compileRouterPlugin(t, "multi-method", "1.0.0", `[
		{method: "GET", path: "/vendor/multi/:task_id", type: "query", render: "native"},
		{method: "POST", path: "/vendor/multi/:task_id", type: "submit"}
	]`)
	handlers := testPluginRouteHandlers(func(c *gin.Context, _ *jsplugin.RoutingGeneration, _ jsplugin.RouteBinding) {
		c.String(http.StatusOK, c.Request.Method)
	})
	outer, registry := newPluginRouterTest(t, []*jsplugin.LoadedPlugin{plugin}, handlers)
	outer.NoRoute((&pluginRouteDispatcher{registry: registry}).dispatch)

	assert.Equal(t, http.MethodGet, performPluginRequest(outer, http.MethodGet, "/vendor/multi/task-1").Body.String())
	assert.Equal(t, http.MethodPost, performPluginRequest(outer, http.MethodPost, "/vendor/multi/task-1").Body.String())
	assert.NotContains(t, registry.RoutingErrors(), "multi-method")
}

// The inner router names wildcards by position, so routes may name the same
// position differently; each reads its own parameter names.
func TestPositionalWildcardsKeepDeclaredParameterNames(t *testing.T) {
	plugin := compileRouterPlugin(t, "wildcard-names", "1.0.0", `[
		{method: "GET", path: "/vendor/:id/first", type: "query", render: "native", taskIdParam: "id"},
		{method: "GET", path: "/vendor/:name/second", type: "query", render: "native", taskIdParam: "name"}
	]`)
	outer, registry := newPluginRouterTest(t, []*jsplugin.LoadedPlugin{plugin}, func(generation *jsplugin.RoutingGeneration, group jsplugin.RouteGroup) []gin.HandlerFunc {
		return []gin.HandlerFunc{func(c *gin.Context) {
			c.String(http.StatusOK, fmt.Sprint(jsplugin.RouteParams(c.Params, group.Bindings[0].Route)))
		}}
	})
	outer.NoRoute(
		(&pluginRouteDispatcher{registry: registry}).dispatch,
		func(c *gin.Context) { c.String(http.StatusOK, "fallback") },
	)

	assert.Equal(t, "map[id:1]", performPluginRequest(outer, http.MethodGet, "/vendor/1/first").Body.String())
	assert.Equal(t, "map[name:2]", performPluginRequest(outer, http.MethodGet, "/vendor/2/second").Body.String())
	assert.Equal(t, "map[name:3]", performPluginRequest(outer, http.MethodGet, "/wildcard-names/vendor/3/second").Body.String())
	assert.Empty(t, registry.RoutingErrors())
}

func TestGinRegistrationPanicRebuildsWithoutOffender(t *testing.T) {
	alpha := compileRouterPlugin(t, "panic-alpha", "1.0.0", `[
		{method: "GET", path: "/panic/alpha", type: "dynamic"}
	]`)
	beta := compileRouterPlugin(t, "panic-beta", "1.0.0", `[
		{method: "GET", path: "/panic/beta", type: "dynamic"}
	]`)
	registry := jsplugin.NewRegistry()
	require.NoError(t, registry.ReplaceOverrides([]*jsplugin.LoadedPlugin{alpha, beta}))
	outer := newOuterPluginTestEngine()
	builder := newPluginGenerationBuilder(outer.Routes(), nil, testPluginRouteHandlers(
		func(c *gin.Context, _ *jsplugin.RoutingGeneration, binding jsplugin.RouteBinding) {
			c.String(http.StatusOK, binding.Plugin.Meta.Key)
		},
	))
	normalRegister := builder.registerRoute
	builder.registerRoute = func(engine *gin.Engine, group jsplugin.RouteGroup, handlers []gin.HandlerFunc) {
		if group.Bindings[0].Plugin.Meta.Key == "panic-beta" {
			panic("registration failed")
		}
		normalRegister(engine, group, handlers)
	}
	require.NoError(t, registry.SetGenerationPreparer(builder.prepare))
	outer.NoRoute(
		(&pluginRouteDispatcher{registry: registry}).dispatch,
		func(c *gin.Context) { c.String(http.StatusOK, "fallback") },
	)

	assert.Equal(t, "panic-alpha", performPluginRequest(outer, http.MethodGet, "/panic/alpha").Body.String())
	assert.Equal(t, "fallback", performPluginRequest(outer, http.MethodGet, "/panic/beta").Body.String())
	assert.Contains(t, registry.RoutingErrors()["panic-beta"], "registration panic")
}

func TestGinRegistrationPanicReadmitsPluginBlockedByOffender(t *testing.T) {
	alpha := compileRouterPlugin(t, "panic-owner-alpha", "1.0.0", `[
		{method: "GET", path: "/panic/reconsider", type: "dynamic"}
	]`)
	beta := compileRouterPlugin(t, "panic-owner-beta", "1.0.0", `[
		{method: "GET", path: "/panic/:name", type: "dynamic"}
	]`)
	registry := jsplugin.NewRegistry()
	require.NoError(t, registry.ReplaceOverrides([]*jsplugin.LoadedPlugin{alpha, beta}))
	outer := newOuterPluginTestEngine()
	builder := newPluginGenerationBuilder(outer.Routes(), nil, testPluginRouteHandlers(
		func(c *gin.Context, _ *jsplugin.RoutingGeneration, binding jsplugin.RouteBinding) {
			c.String(http.StatusOK, binding.Plugin.Meta.Key)
		},
	))
	normalRegister := builder.registerRoute
	builder.registerRoute = func(engine *gin.Engine, group jsplugin.RouteGroup, handlers []gin.HandlerFunc) {
		if group.Bindings[0].Plugin.Meta.Key == "panic-owner-alpha" {
			panic("registration failed")
		}
		normalRegister(engine, group, handlers)
	}
	require.NoError(t, registry.SetGenerationPreparer(builder.prepare))
	outer.NoRoute((&pluginRouteDispatcher{registry: registry}).dispatch)

	_, alphaActive := registry.Get("panic-owner-alpha")
	assert.False(t, alphaActive)
	activeBeta, ok := registry.Get("panic-owner-beta")
	require.True(t, ok)
	assert.Same(t, beta, activeBeta)
	assert.Equal(t, "panic-owner-beta", performPluginRequest(outer, http.MethodGet, "/panic/reconsider").Body.String())
	assert.Contains(t, registry.RoutingErrors()["panic-owner-alpha"], "registration panic")
	assert.NotContains(t, registry.RoutingErrors(), "panic-owner-beta")
}

func TestUpdatedRegistrationPanicRestoresIncumbent(t *testing.T) {
	v1 := compileRouterPlugin(t, "panic-update", "1.0.0", `[
		{method: "GET", path: "/panic/stable", type: "dynamic"}
	]`)
	v2 := compileRouterPlugin(t, "panic-update", "2.0.0", `[
		{method: "GET", path: "/panic/stable", type: "dynamic"}
	]`)
	registry := jsplugin.NewRegistry()
	require.NoError(t, registry.ReplaceOverrides([]*jsplugin.LoadedPlugin{v1}))
	outer := newOuterPluginTestEngine()
	handlers := testPluginRouteHandlers(func(c *gin.Context, _ *jsplugin.RoutingGeneration, binding jsplugin.RouteBinding) {
		c.String(http.StatusOK, binding.Plugin.Meta.Version)
	})
	builder := newPluginGenerationBuilder(outer.Routes(), nil, handlers)
	normalRegister := builder.registerRoute
	builder.registerRoute = func(engine *gin.Engine, group jsplugin.RouteGroup, routeHandlers []gin.HandlerFunc) {
		if group.Bindings[0].Plugin.Meta.Version == "2.0.0" {
			panic("new version registration failed")
		}
		normalRegister(engine, group, routeHandlers)
	}
	require.NoError(t, registry.SetGenerationPreparer(builder.prepare))
	outer.NoRoute((&pluginRouteDispatcher{registry: registry}).dispatch)

	require.NoError(t, registry.ReplaceOverrides([]*jsplugin.LoadedPlugin{v2}))

	active, ok := registry.Get("panic-update")
	require.True(t, ok)
	assert.Same(t, v1, active)
	assert.Equal(t, "1.0.0", performPluginRequest(outer, http.MethodGet, "/panic/stable").Body.String())
	assert.Contains(t, registry.RoutingErrors()["panic-update"], "registration panic")
}

func TestUnattributableRebuildFailureRetainsOldGeneration(t *testing.T) {
	v1 := compileRouterPlugin(t, "rebuild-stable", "1.0.0", `[
		{method: "GET", path: "/rebuild/version", type: "dynamic"}
	]`)
	v2 := compileRouterPlugin(t, "rebuild-stable", "2.0.0", `[
		{method: "GET", path: "/rebuild/version", type: "dynamic"}
	]`)
	handlers := testPluginRouteHandlers(func(c *gin.Context, _ *jsplugin.RoutingGeneration, binding jsplugin.RouteBinding) {
		c.String(http.StatusOK, binding.Plugin.Meta.Version)
	})
	outer := newOuterPluginTestEngine()
	registry := jsplugin.NewRegistry()
	require.NoError(t, registry.ReplaceOverrides([]*jsplugin.LoadedPlugin{v1}))
	builder := newPluginGenerationBuilder(outer.Routes(), nil, handlers)
	require.NoError(t, registry.SetGenerationPreparer(builder.prepare))
	outer.NoRoute((&pluginRouteDispatcher{registry: registry}).dispatch)
	before := registry.Generation()

	normalConfigure := builder.configure
	builder.configure = func(*gin.Engine) error { return errors.New("engine configuration failed") }
	require.Error(t, registry.ReplaceOverrides([]*jsplugin.LoadedPlugin{v2}))
	assert.Same(t, before, registry.Generation())

	assert.Equal(t, "1.0.0", performPluginRequest(outer, http.MethodGet, "/rebuild/version").Body.String())
	assert.Contains(t, registry.LastRebuildError(), "engine configuration failed")

	builder.configure = normalConfigure
	require.NoError(t, registry.ReplaceOverrides([]*jsplugin.LoadedPlugin{v2}))
	assert.Equal(t, "2.0.0", performPluginRequest(outer, http.MethodGet, "/rebuild/version").Body.String())
}

func TestPluginRouteRecoverySanitizesPanicResponse(t *testing.T) {
	plugin := compileRouterPlugin(t, "panic-route", "1.0.0", `[
		{method: "GET", path: "/vendor/panic", type: "dynamic"}
	]`)
	var calls atomic.Int32
	outer, registry := newPluginRouterTest(t, []*jsplugin.LoadedPlugin{plugin}, testPluginRouteHandlers(
		func(c *gin.Context, _ *jsplugin.RoutingGeneration, _ jsplugin.RouteBinding) {
			if calls.Add(1) == 1 {
				panic("https://secret.example/internal?token=credential")
			}
			c.String(http.StatusOK, "recovered")
		},
	))
	outer.NoRoute((&pluginRouteDispatcher{registry: registry}).dispatch)

	recorder := performPluginRequest(outer, http.MethodGet, "/vendor/panic")

	assert.Equal(t, http.StatusInternalServerError, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "internal plugin route error")
	assert.NotContains(t, recorder.Body.String(), "secret.example")
	assert.NotContains(t, recorder.Body.String(), "credential")

	second := performPluginRequest(outer, http.MethodGet, "/vendor/panic")
	assert.Equal(t, http.StatusOK, second.Code)
	assert.Equal(t, "recovered", second.Body.String())
}

func TestProductionPluginRoutePipelineRequiresTokenAuth(t *testing.T) {
	plugin := compileRouterPlugin(t, "forced-auth", "1.0.0", `[
		{method: "GET", path: "/vendor/protected/:task_id", type: "query", render: "native"}
	]`)
	outer, registry := newPluginRouterTest(t, []*jsplugin.LoadedPlugin{plugin}, productionPluginRouteHandlers)
	outer.NoRoute((&pluginRouteDispatcher{registry: registry}).dispatch)

	recorder := performPluginRequest(outer, http.MethodGet, "/vendor/protected/task-1")

	assert.NotEqual(t, http.StatusNotImplemented, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "error")
}

func TestProductionPluginNativeQueryTraversesInnerRouter(t *testing.T) {
	previousDB := model.DB
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, database.AutoMigrate(&model.Task{}))
	model.DB = database
	t.Cleanup(func() { model.DB = previousDB })
	require.NoError(t, database.Create(&model.Task{
		TaskID:    "task_native_router",
		Platform:  constant.TaskPlatform("kling"),
		UserId:    91,
		Status:    model.TaskStatusSuccess,
		Progress:  "100%",
		ChannelId: 17,
		PrivateData: model.TaskPrivateData{
			UpstreamTaskID: "private_upstream_id",
			ResultURL:      "https://secret.example/video.mp4",
		},
	}).Error)

	kling, found := jsplugin.DefaultRegistry.Get("kling")
	require.True(t, found)
	authenticatedProductionHandlers := func(
		generation *jsplugin.RoutingGeneration,
		group jsplugin.RouteGroup,
	) []gin.HandlerFunc {
		production := productionPluginRouteHandlers(generation, group)
		return []gin.HandlerFunc{
			production[0],
			func(c *gin.Context) {
				common.SetContextKey(c, constant.ContextKeyUserId, 91)
				common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
				common.SetContextKey(c, constant.ContextKeyTokenGroup, "default")
				c.Next()
			},
			production[3],
			production[4],
			production[5],
			production[6],
			production[7],
		}
	}
	outer, registry := newPluginRouterTest(t, []*jsplugin.LoadedPlugin{kling}, authenticatedProductionHandlers)
	outer.NoRoute((&pluginRouteDispatcher{registry: registry}).dispatch)

	request := httptest.NewRequest(http.MethodGet, "/kling/v1/videos/text2video/task_native_router", nil)
	recorder := httptest.NewRecorder()
	outer.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	assert.Contains(t, recorder.Body.String(), `"task_id":"task_native_router"`)
	assert.Contains(t, recorder.Body.String(), `"task_status":"succeed"`)
	assert.NotContains(t, recorder.Body.String(), "private_upstream_id")
	assert.NotContains(t, recorder.Body.String(), "secret.example")
}

// On the built-in plugin whose vendor uses it, a native route takes the
// gateway token in that vendor's API-key form; everywhere else only the Bearer
// form works. TokenAuth validates the token whatever form carried it.
func TestNativeRouteCredentialFormsAuthenticateThroughTokenAuth(t *testing.T) {
	setupRelayRouterTestDB(t)
	require.NoError(t, i18n.Init())
	user := model.User{Username: "native-auth-user", Status: common.UserStatusEnabled, Group: "default", Quota: 100}
	require.NoError(t, model.DB.Create(&user).Error)
	allowedIPs := "10.9.8.0/24"
	require.NoError(t, model.DB.Create(&model.Token{UserId: user.Id, Key: "nativeauthkey", Status: common.TokenStatusEnabled, ExpiredTime: -1, UnlimitedQuota: true}).Error)
	require.NoError(t, model.DB.Create(&model.Token{UserId: user.Id, Key: "nativeiplimited", Status: common.TokenStatusEnabled, ExpiredTime: -1, UnlimitedQuota: true, AllowIps: &allowedIPs}).Error)

	outer := gin.New()
	SetTaskPluginProtocolRouter(outer)
	registry := jsplugin.NewRegistry()
	for _, key := range []string{"vidu", "google", "doubao"} {
		source, err := plugins.Source(key)
		require.NoError(t, err)
		_, err = registry.RegisterFactory(source, jsplugin.Options{Key: key})
		require.NoError(t, err)
	}
	handlers := func(generation *jsplugin.RoutingGeneration, group jsplugin.RouteGroup) []gin.HandlerFunc {
		production := productionPluginRouteHandlers(generation, group)
		return []gin.HandlerFunc{production[0], production[1], production[2], func(c *gin.Context) {
			c.String(http.StatusOK, "user %d %s", c.GetInt("id"), c.Request.RequestURI)
		}}
	}
	require.NoError(t, registry.SetGenerationPreparer(newPluginGenerationBuilder(outer.Routes(), nil, handlers).prepare))
	require.Empty(t, registry.RoutingErrors())
	outer.NoRoute((&pluginRouteDispatcher{registry: registry}).dispatch)

	const operation = "/v1beta/models/veo-3.1-generate-preview/operations/task_1"
	for _, testCase := range []struct {
		name          string
		method        string
		path          string
		header, value string
		status        int
		requestURI    string
	}{
		{name: "Vidu Token form", method: http.MethodPost, path: "/ent/v2/text2video", header: "Authorization", value: "Token nativeauthkey", status: http.StatusOK},
		{name: "Vidu Token form under /vidu", method: http.MethodPost, path: "/vidu/ent/v2/text2video", header: "Authorization", value: "token nativeauthkey", status: http.StatusOK},
		{name: "Token form on another plugin", method: http.MethodPost, path: "/doubao/api/v3/contents/generations/tasks", header: "Authorization", value: "Token nativeauthkey", status: http.StatusUnauthorized},
		{name: "Token form on a host protocol", method: http.MethodPost, path: "/v1/videos", header: "Authorization", value: "Token nativeauthkey", status: http.StatusUnauthorized},
		{name: "Gemini header form", method: http.MethodPost, path: "/google/v1beta/models/veo-3.1-generate-preview:predictLongRunning", header: "X-Goog-Api-Key", value: "nativeauthkey", status: http.StatusOK},
		{name: "Gemini header form on a query", method: http.MethodGet, path: "/google" + operation, header: "X-Goog-Api-Key", value: "nativeauthkey", status: http.StatusOK},
		{name: "Gemini query form", method: http.MethodGet, path: "/google" + operation + "?key=nativeauthkey&alt=json", status: http.StatusOK, requestURI: "/google" + operation + "?alt=json"},
		{name: "Gemini query form at the vendor path", method: http.MethodGet, path: operation + "?key=nativeauthkey", status: http.StatusOK, requestURI: operation},
		{name: "Gemini header form on another plugin", method: http.MethodPost, path: "/vidu/ent/v2/text2video", header: "X-Goog-Api-Key", value: "nativeauthkey", status: http.StatusUnauthorized},
		{name: "Gemini query form on another plugin", method: http.MethodPost, path: "/vidu/ent/v2/text2video?key=nativeauthkey", status: http.StatusUnauthorized},
		{name: "invalid token in the Token form", method: http.MethodPost, path: "/ent/v2/text2video", header: "Authorization", value: "Token nativewrongkey", status: http.StatusUnauthorized},
		{name: "empty token in the Token form", method: http.MethodPost, path: "/ent/v2/text2video", header: "Authorization", value: "Token ", status: http.StatusUnauthorized},
		{name: "invalid token in the Gemini header form", method: http.MethodGet, path: "/google" + operation, header: "X-Goog-Api-Key", value: "nativewrongkey", status: http.StatusUnauthorized},
		{name: "invalid token in the Gemini query form", method: http.MethodGet, path: "/google" + operation + "?key=nativewrongkey", status: http.StatusUnauthorized},
		{name: "IP limits apply to the Token form", method: http.MethodPost, path: "/ent/v2/text2video", header: "Authorization", value: "Token nativeiplimited", status: http.StatusForbidden},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			request := httptest.NewRequest(testCase.method, testCase.path, strings.NewReader(`{}`))
			request.RemoteAddr = "192.0.2.10:1234"
			if testCase.header != "" {
				request.Header.Set(testCase.header, testCase.value)
			}
			recorder := httptest.NewRecorder()
			outer.ServeHTTP(recorder, request)

			assert.Equal(t, testCase.status, recorder.Code, recorder.Body.String())
			if testCase.status == http.StatusOK {
				requestURI := testCase.requestURI
				if requestURI == "" {
					requestURI = testCase.path
				}
				assert.Equal(t, fmt.Sprintf("user %d %s", user.Id, requestURI), recorder.Body.String())
				return
			}
			for _, secret := range []string{"nativeauthkey", "nativewrongkey", "nativeiplimited"} {
				assert.NotContains(t, recorder.Body.String(), secret)
			}
		})
	}
}

func newPluginRouterTest(
	t *testing.T,
	plugins []*jsplugin.LoadedPlugin,
	handlers pluginRouteHandlers,
) (*gin.Engine, *jsplugin.Registry) {
	t.Helper()
	return newPluginRouterTestWithProxies(t, plugins, handlers, nil)
}

func newPluginRouterTestWithProxies(
	t *testing.T,
	plugins []*jsplugin.LoadedPlugin,
	handlers pluginRouteHandlers,
	trustedProxies []string,
) (*gin.Engine, *jsplugin.Registry) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	outer := newOuterPluginTestEngine()
	registry := jsplugin.NewRegistry()
	if plugins != nil {
		require.NoError(t, registry.ReplaceOverrides(plugins))
	}
	if handlers == nil {
		handlers = testPluginRouteHandlers(func(c *gin.Context, _ *jsplugin.RoutingGeneration, binding jsplugin.RouteBinding) {
			c.String(http.StatusOK, binding.Plugin.Meta.Key)
		})
	}
	builder := newPluginGenerationBuilder(outer.Routes(), trustedProxies, handlers)
	require.NoError(t, registry.SetGenerationPreparer(builder.prepare))
	return outer, registry
}

func newOuterPluginTestEngine() *gin.Engine {
	outer := gin.New()
	outer.Use(func(c *gin.Context) {
		c.Set(common.RequestIdKey, "request-phase-two")
		c.Set(string(constant.ContextKeyLanguage), "zh-CN")
		c.Set(middleware.RouteTagKey, "before")
		c.Next()
	})
	return outer
}

func testPluginRouteHandlers(
	handler func(*gin.Context, *jsplugin.RoutingGeneration, jsplugin.RouteBinding),
) pluginRouteHandlers {
	return func(generation *jsplugin.RoutingGeneration, group jsplugin.RouteGroup) []gin.HandlerFunc {
		binding := group.Bindings[0]
		return []gin.HandlerFunc{func(c *gin.Context) {
			pinnedGeneration := generation
			if state, _ := c.Request.Context().Value(pluginDispatchStateKey{}).(*pluginDispatchState); state != nil && state.generation != nil {
				pinnedGeneration = state.generation
			}
			c.Set(jsplugin.ContextKeyPinnedRoute, jsplugin.PinnedRoute{
				Generation: pinnedGeneration,
				Plugin:     binding.Plugin,
				Route:      binding.Route,
				Candidates: group.Bindings,
			})
			handler(c, pinnedGeneration, binding)
		}}
	}
}

func compileRouterPlugin(t *testing.T, key, version, routes string) *jsplugin.LoadedPlugin {
	t.Helper()
	plugin, err := jsplugin.CompilePlugin(routerPluginSource(key, version, routes), jsplugin.Options{Key: key, Version: version})
	require.NoError(t, err)
	return plugin
}

func routerPluginSource(key, version, routes string) string {
	return fmt.Sprintf(`
export const meta = {
	apiVersion: 1,
	key: %q,
	name: %q,
	version: %q,
	author: {name: "Test"},
	models: ["model"],
	fetchMode: "per_task",
	routes: (%s).map(function(route) {
		const migrated = Object.assign({}, route);
		delete migrated.renderer;
		migrated.render = route.render || route.renderer || "render";
		if (route.type !== "query") migrated.decode = route.decode || "decode";
		return migrated;
	}),
};
export const native = {
	decode: function(ctx) { return {kind: "submit", model: "model", requestBody: ctx.body.value}; },
	render: function(ctx, task) { return task; },
	native: function(ctx, task) { return task; },
};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
`, key, key, version, routes)
}

func performPluginRequest(handler http.Handler, method, path string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(method, path, strings.NewReader(""))
	handler.ServeHTTP(recorder, request)
	return recorder
}

func TestWebFallbackDoesNotCacheMissingAPIOrAssets(t *testing.T) {
	outer := gin.New()
	SetWebRouter(outer, WebAssets{IndexPage: []byte("dashboard")}, func(c *gin.Context) { c.Next() })
	for _, path := range []string{"/api/user/token/status", "/api/audit/self?p=1", "/v1/missing", "/assets/missing.js"} {
		t.Run(path, func(t *testing.T) {
			response := performPluginRequest(outer, http.MethodGet, path)
			assert.Equal(t, http.StatusNotFound, response.Code)
			assert.Contains(t, response.Body.String(), "Invalid URL")
			assert.Contains(t, response.Header().Get("Cache-Control"), "no-store")
			assert.NotContains(t, response.Header().Get("Cache-Control"), "604800")
		})
	}
	page := performPluginRequest(outer, http.MethodGet, "/security")
	assert.Equal(t, http.StatusOK, page.Code)
	assert.Equal(t, "dashboard", page.Body.String())
	assert.Equal(t, "no-cache", page.Header().Get("Cache-Control"))
}

func TestSecurityRoutesDisableCachingBeforeAuthentication(t *testing.T) {
	outer := gin.New()
	SetApiRouter(outer)
	for _, path := range []string{"/api/user/access_tokens", "/api/user/access_tokens/catalog", "/api/user/access_tokens/scopes", "/api/audit/self", "/api/audit"} {
		t.Run(path, func(t *testing.T) {
			response := performPluginRequest(outer, http.MethodGet, path)
			assert.Equal(t, http.StatusUnauthorized, response.Code)
			assert.Contains(t, response.Header().Get("Cache-Control"), "no-store")
		})
	}
}
