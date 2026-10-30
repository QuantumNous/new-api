package router

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/gin-gonic/gin"
)

type pluginDispatchStateKey struct{}

type pluginDispatchState struct {
	generation *jsplugin.RoutingGeneration
	hit        atomic.Bool
	writer     *gatedResponseWriter
	requestID  string
	language   string
}

func (s *pluginDispatchState) markHit() {
	s.hit.Store(true)
	s.writer.activate()
}

type pluginRouteHandlers func(*jsplugin.RoutingGeneration, jsplugin.RouteGroup) []gin.HandlerFunc

type pluginGenerationBuilder struct {
	staticRoutes []gin.RouteInfo
	// hostSegments are the first path segments the host serves: api and the
	// literal first segment of every static route.
	hostSegments   map[string]struct{}
	trustedProxies []string
	routeHandlers  pluginRouteHandlers
	registerRoute  func(*gin.Engine, jsplugin.RouteGroup, []gin.HandlerFunc)
	configure      func(*gin.Engine) error
}

type pluginRouteDispatcher struct {
	registry *jsplugin.Registry
}

// defaultPluginDispatcher serves the default registry's plugin routes from the
// outer engine's NoRoute and from the host routes that hand requests to plugin
// routes first.
var defaultPluginDispatcher = &pluginRouteDispatcher{registry: jsplugin.DefaultRegistry}

// pluginHandoffRoutes are the host routes that offer matching requests to the
// plugin routes before their own handlers run, so a plugin route may overlap
// them: GET /v1/videos/:task_id offers a task to its own plugin's query route
// (handOffNativeTaskQuery) and the Gemini relay offers :predictLongRunning.
var pluginHandoffRoutes = map[string]struct{}{
	http.MethodGet + " /v1/videos/:task_id":   {},
	http.MethodPost + " /v1beta/models/*path": {},
}

func SetPluginRouter(outer *gin.Engine) gin.HandlerFunc {
	trustedProxies, _, err := common.ResolveTrustedProxies(os.Getenv("TRUSTED_PROXIES"))
	dispatcher := defaultPluginDispatcher
	if err != nil {
		common.SysError(common.LogText("configure plugin router trusted proxies: %s", err.Error()))
		return dispatcher.dispatch
	}
	builder := newPluginGenerationBuilder(outer.Routes(), trustedProxies, productionPluginRouteHandlers)
	if err = jsplugin.DefaultRegistry.SetGenerationPreparer(builder.prepare); err != nil {
		common.SysError(common.LogText("build initial plugin router: %s", err.Error()))
	}
	return dispatcher.dispatch
}

func newPluginGenerationBuilder(staticRoutes []gin.RouteInfo, trustedProxies []string, handlers pluginRouteHandlers) *pluginGenerationBuilder {
	builder := &pluginGenerationBuilder{
		staticRoutes:   append([]gin.RouteInfo(nil), staticRoutes...),
		hostSegments:   map[string]struct{}{"api": {}},
		trustedProxies: append([]string(nil), trustedProxies...),
		routeHandlers:  handlers,
	}
	for _, staticRoute := range staticRoutes {
		first, _, _ := strings.Cut(strings.TrimPrefix(staticRoute.Path, "/"), "/")
		if first != "" && !strings.HasPrefix(first, ":") && !strings.HasPrefix(first, "*") {
			builder.hostSegments[first] = struct{}{}
		}
	}
	builder.registerRoute = func(engine *gin.Engine, group jsplugin.RouteGroup, routeHandlers []gin.HandlerFunc) {
		engine.Handle(group.Method, group.GinPath, routeHandlers...)
	}
	builder.configure = func(engine *gin.Engine) error {
		return common.ConfigureTrustedProxies(engine, builder.trustedProxies)
	}
	return builder
}

func productionPluginRouteHandlers(generation *jsplugin.RoutingGeneration, group jsplugin.RouteGroup) []gin.HandlerFunc {
	binding := group.Bindings[0]
	keys := make([]string, 0, len(group.Bindings))
	for _, candidate := range group.Bindings {
		keys = append(keys, candidate.Plugin.Meta.Key)
	}
	pinRoute := func(c *gin.Context) {
		pinnedGeneration := generation
		if state, _ := c.Request.Context().Value(pluginDispatchStateKey{}).(*pluginDispatchState); state != nil && state.generation != nil {
			pinnedGeneration = state.generation
		}
		c.Set(jsplugin.ContextKeyPinnedPlugin, jsplugin.PinnedPlugin{
			Generation: pinnedGeneration,
			Plugin:     binding.Plugin,
		})
		c.Set(jsplugin.ContextKeyPinnedRoute, jsplugin.PinnedRoute{
			Generation: pinnedGeneration,
			Plugin:     binding.Plugin,
			Route:      binding.Route,
			Candidates: group.Bindings,
		})
		logger.LogDebug(
			c,
			"task_plugin subsystem=router event=route_matched generation=%d plugin=%q version=%q method=%q route_type=%q",
			pinnedGeneration.Number,
			binding.Plugin.Meta.Key,
			binding.Plugin.Meta.Version,
			binding.Route.Method,
			binding.Route.Type,
		)
		c.Next()
		logger.LogDebug(
			c,
			"task_plugin subsystem=router event=route_complete generation=%d plugin=%q method=%q status=%d",
			pinnedGeneration.Number,
			binding.Plugin.Meta.Key,
			binding.Route.Method,
			c.Writer.Status(),
		)
	}
	return []gin.HandlerFunc{
		pinRoute,
		middleware.NativeRouteCredential(keys...),
		middleware.TokenAuth(),
		middleware.SystemPerformanceCheck(),
		middleware.ModelRequestRateLimit(),
		middleware.PrepareTaskPluginRoute(),
		middleware.Distribute(),
		controller.RelayTask,
	}
}

func (b *pluginGenerationBuilder) prepare(candidate, current *jsplugin.RoutingGeneration) (jsplugin.PreparedRoutingGeneration, error) {
	blocked := make(map[*jsplugin.LoadedPlugin]string)
	for {
		accepted, skipped, routingErrors := b.admitPlugins(candidate, current, blocked)
		plugins := sortedPlugins(accepted)
		filtered, err := candidate.RebuildWithPlugins(plugins)
		if err != nil {
			return jsplugin.PreparedRoutingGeneration{}, err
		}
		filtered = filtered.WithSkippedRoutes(skipped)
		engine, offender, buildErr := b.buildInnerEngine(filtered)
		if buildErr == nil {
			return jsplugin.PreparedRoutingGeneration{
				Generation: filtered.WithRuntime(engine),
				Errors:     routingErrors,
			}, nil
		}
		if offender == "" {
			return jsplugin.PreparedRoutingGeneration{}, buildErr
		}

		failedPlugin := accepted[offender]
		if failedPlugin == nil {
			return jsplugin.PreparedRoutingGeneration{}, fmt.Errorf("public route rebuild attributed failure to absent plugin %q: %w", offender, buildErr)
		}
		blocked[failedPlugin] = fmt.Sprintf("plugin %s rejected while rebuilding public routes: %v", offender, buildErr)
	}
}

func (b *pluginGenerationBuilder) admitPlugins(
	candidate, current *jsplugin.RoutingGeneration,
	blocked map[*jsplugin.LoadedPlugin]string,
) (map[string]*jsplugin.LoadedPlugin, []jsplugin.SkippedRoute, map[string]string) {
	accepted := make(map[string]*jsplugin.LoadedPlugin)
	var skipped []jsplugin.SkippedRoute
	currentByKey := make(map[string]*jsplugin.LoadedPlugin)
	if current != nil && current.RuntimeHandler() != nil {
		for _, plugin := range current.Plugins() {
			currentByKey[plugin.Meta.Key] = plugin
		}
	}

	unchangedKeys := make([]string, 0)
	changedKeys := make([]string, 0)
	newKeys := make([]string, 0)
	for _, plugin := range candidate.Plugins() {
		incumbent, existed := currentByKey[plugin.Meta.Key]
		switch {
		case existed && incumbent == plugin:
			unchangedKeys = append(unchangedKeys, plugin.Meta.Key)
		case existed:
			changedKeys = append(changedKeys, plugin.Meta.Key)
		default:
			newKeys = append(newKeys, plugin.Meta.Key)
		}
	}
	sort.Strings(unchangedKeys)
	sort.Strings(changedKeys)
	sort.Strings(newKeys)

	routingErrors := make(map[string]string)
	orderedKeys := append(unchangedKeys, changedKeys...)
	orderedKeys = append(orderedKeys, newKeys...)
	rejectedKeys := make([]string, 0)
	for _, key := range orderedKeys {
		plugin, _ := candidate.Get(key)
		if blockedError := blocked[plugin]; blockedError != "" {
			routingErrors[key] = blockedError
		} else if pluginSkipped, err := b.validatePlugin(plugin, candidate); err != nil {
			routingErrors[key] = fmt.Sprintf("plugin %s rejected from public routes: %v", key, err)
		} else {
			accepted[key] = plugin
			skipped = append(skipped, pluginSkipped...)
			continue
		}
		rejectedKeys = append(rejectedKeys, key)
	}

	for _, key := range rejectedKeys {
		plugin, _ := candidate.Get(key)
		incumbent := currentByKey[key]
		if incumbent == nil || incumbent == plugin || !candidate.RetainsIncumbent(key) {
			continue
		}
		if blockedError := blocked[incumbent]; blockedError != "" {
			routingErrors[key] = blockedError
			continue
		}
		if incumbentSkipped, err := b.validatePlugin(incumbent, candidate); err == nil {
			accepted[key] = incumbent
			skipped = append(skipped, incumbentSkipped...)
		}
	}
	return accepted, skipped, routingErrors
}

// validatePlugin returns the declared top-level routes the gateway does not
// register for plugin; their /{key} copies still serve them. A key that names
// a host path segment, or a built-in plugin's own prefix, rejects the plugin:
// its /{key} address would not reach it.
//
// A top-level route is skipped when its first segment is a host namespace and
// the plugin is not built in (host_namespace), when a host route of the same
// method answers it first (host_route), or when its first segment is another
// plugin's key or a built-in plugin's own prefix (key_namespace). A route
// under the plugin's own prefix meets only the first two checks.
func (b *pluginGenerationBuilder) validatePlugin(plugin *jsplugin.LoadedPlugin, candidate *jsplugin.RoutingGeneration) ([]jsplugin.SkippedRoute, error) {
	key := plugin.Meta.Key
	if _, hostSegment := b.hostSegments[key]; hostSegment {
		return nil, fmt.Errorf("plugin key %q is a host path segment", key)
	}
	// Taken from the whole candidate generation, so the outcome does not
	// depend on the admission order.
	otherKeys := make(map[string]struct{})
	builtInPrefixes := make(map[string]string)
	for _, other := range candidate.Plugins() {
		if other.Meta.Key == key {
			continue
		}
		otherKeys[other.Meta.Key] = struct{}{}
		if !candidate.FactoryKey(other.Meta.Key) {
			continue
		}
		for _, binding := range jsplugin.PluginRouteBindings(other) {
			if binding.OwnPrefix {
				first, _, _ := strings.Cut(strings.TrimPrefix(binding.Route.Path, "/"), "/")
				builtInPrefixes[first] = other.Meta.Key
			}
		}
	}
	if owner, owned := builtInPrefixes[key]; owned {
		return nil, fmt.Errorf("plugin key %q is a prefix owned by built-in plugin %s", key, owner)
	}

	var skipped []jsplugin.SkippedRoute
	for _, binding := range jsplugin.PluginRouteBindings(plugin) {
		if binding.Pinned {
			continue
		}
		route := binding.Route
		first, _, _ := strings.Cut(strings.TrimPrefix(route.Path, "/"), "/")
		_, hostSegment := b.hostSegments[first]
		_, otherKey := otherKeys[first]
		_, builtInPrefix := builtInPrefixes[first]
		reason := ""
		switch {
		case hostSegment && !candidate.FactoryKey(key):
			reason = "host_namespace"
		case b.routeAnsweredByHost(route):
			reason = "host_route"
		case (otherKey || builtInPrefix) && !binding.OwnPrefix:
			reason = "key_namespace"
		}
		if reason != "" {
			skipped = append(skipped, jsplugin.SkippedRoute{PluginKey: key, Route: route, Reason: reason})
		}
	}
	return skipped, nil
}

// routeAnsweredByHost reports whether a static route of the same method, or
// the trailing-slash redirect it causes, answers requests the plugin route
// could serve. The handoff routes offer matching requests to plugin routes
// first, so only their redirect counts.
func (b *pluginGenerationBuilder) routeAnsweredByHost(route jsplugin.Route) bool {
	for _, staticRoute := range b.staticRoutes {
		if route.Method != staticRoute.Method {
			continue
		}
		_, offersToPlugins := pluginHandoffRoutes[staticRoute.Method+" "+staticRoute.Path]
		if routeIntersectsStaticRoute(route, staticRoute.Path, offersToPlugins) {
			return true
		}
	}
	return false
}

func (b *pluginGenerationBuilder) buildInnerEngine(generation *jsplugin.RoutingGeneration) (engine *gin.Engine, offender string, err error) {
	currentPlugin := ""
	defer func() {
		if recovered := recover(); recovered != nil {
			offender = currentPlugin
			err = fmt.Errorf("inner Gin registration panic: %v", recovered)
			engine = nil
		}
	}()

	engine = gin.New()
	engine.RedirectTrailingSlash = false
	engine.HandleMethodNotAllowed = true
	if err = b.configure(engine); err != nil {
		return nil, "", err
	}
	engine.Use(importPluginDispatchState())
	engine.Use(pluginRouteRecovery())
	engine.Use(middleware.BodyStorageCleanup())
	engine.NoMethod(func(c *gin.Context) {
		markPluginRouteHit(c)
		generation := uint64(0)
		if state, _ := c.Request.Context().Value(pluginDispatchStateKey{}).(*pluginDispatchState); state != nil && state.generation != nil {
			generation = state.generation.Number
		}
		logger.LogDebug(
			c,
			"task_plugin subsystem=router event=method_not_allowed generation=%d request_method=%q status=%d",
			generation,
			c.Request.Method,
			http.StatusMethodNotAllowed,
		)
		c.AbortWithStatus(http.StatusMethodNotAllowed)
	})

	for _, group := range generation.RouteGroups() {
		currentPlugin = group.Bindings[0].Plugin.Meta.Key
		b.registerRoute(engine, group, b.routeHandlers(generation, group))
	}
	currentPlugin = ""
	return engine, "", nil
}

func importPluginDispatchState() gin.HandlerFunc {
	return func(c *gin.Context) {
		state, _ := c.Request.Context().Value(pluginDispatchStateKey{}).(*pluginDispatchState)
		if state != nil {
			if c.FullPath() != "" {
				state.markHit()
			}
			if state.requestID != "" {
				c.Set(common.RequestIdKey, state.requestID)
			}
			if state.language != "" {
				c.Set(string(constant.ContextKeyLanguage), state.language)
			}
		}
		c.Set(middleware.RouteTagKey, "relay")
		c.Next()
	}
}

func markPluginRouteHit(c *gin.Context) {
	state, _ := c.Request.Context().Value(pluginDispatchStateKey{}).(*pluginDispatchState)
	if state != nil {
		state.markHit()
	}
}

func pluginRouteRecovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if recover() == nil {
				return
			}
			common.SysError(common.LogText("panic recovered in plugin route"))
			if pinnedValue, exists := c.Get(jsplugin.ContextKeyPinnedRoute); exists {
				if pinned, ok := pinnedValue.(jsplugin.PinnedRoute); ok && pinned.Plugin != nil && pinned.Generation != nil {
					logger.LogDebug(
						c,
						"task_plugin subsystem=router event=panic_recovered generation=%d plugin=%q method=%q",
						pinned.Generation.Number,
						pinned.Plugin.Meta.Key,
						pinned.Route.Method,
					)
				}
			}
			c.Abort()
			if !c.Writer.Written() {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": gin.H{
						"message": "internal plugin route error",
						"type":    "plugin_route_error",
					},
				})
			}
		}()
		c.Next()
	}
}

func (d *pluginRouteDispatcher) dispatch(c *gin.Context) {
	generation := d.registry.Generation()
	if generation == nil || generation.RuntimeHandler() == nil {
		c.Next()
		return
	}

	previousTag, hadPreviousTag := c.Get(middleware.RouteTagKey)
	c.Set(middleware.RouteTagKey, "relay")
	originalContext := c.Request.Context()
	state := &pluginDispatchState{
		generation: generation,
		requestID:  c.GetString(common.RequestIdKey),
		language:   c.GetString(string(constant.ContextKeyLanguage)),
	}
	gatedWriter := newGatedResponseWriter(c.Writer)
	state.writer = gatedWriter
	c.Request = c.Request.WithContext(context.WithValue(originalContext, pluginDispatchStateKey{}, state))

	generation.RuntimeHandler().ServeHTTP(gatedWriter, c.Request)
	if state.hit.Load() {
		if !c.Writer.Written() {
			c.Writer.WriteHeaderNow()
		}
		c.Abort()
		return
	}

	c.Request = c.Request.WithContext(originalContext)
	if hadPreviousTag {
		c.Set(middleware.RouteTagKey, previousTag)
	} else {
		delete(c.Keys, middleware.RouteTagKey)
	}
	c.Next()
}

// handOffNativeTaskQuery answers GET /v1/videos/:task_id in the task's own wire
// format when the task was submitted through one of its plugin's native routes
// (at the vendor path, under /{key} or under the plugin's own prefix) and that
// plugin serves a query route matching this request, as xAI does at its vendor
// path. Every other task keeps the OpenAI video response.
func (d *pluginRouteDispatcher) handOffNativeTaskQuery(c *gin.Context) {
	generation := d.registry.Generation()
	if generation == nil || generation.RuntimeHandler() == nil {
		return
	}
	task, exists, err := model.GetByTaskId(c.GetInt("id"), c.Param("task_id"))
	if err != nil || !exists || task.PrivateData.Execution == nil || task.PrivateData.Execution.TaskPlugin == nil {
		return
	}
	plugin, found := generation.Get(task.PrivateData.Execution.TaskPlugin.Key)
	if !found {
		return
	}
	submittedNatively := false
	queryMatches := false
	for _, binding := range jsplugin.PluginRouteBindings(plugin) {
		route := binding.Route
		switch {
		case route.Type != jsplugin.RouteTypeQuery:
			submittedNatively = submittedNatively || routePatternsIntersect(route.Path, task.PrivateData.Execution.RequestPath)
		case route.Method == c.Request.Method && routePatternsIntersect(route.Path, c.Request.URL.Path):
			queryMatches = true
		}
	}
	if submittedNatively && queryMatches {
		d.dispatch(c)
	}
}

type gatedResponseWriter struct {
	underlying    gin.ResponseWriter
	privateHeader http.Header
	active        atomic.Bool
	activateOnce  sync.Once
	pendingStatus int
}

func newGatedResponseWriter(underlying gin.ResponseWriter) *gatedResponseWriter {
	return &gatedResponseWriter{
		underlying:    underlying,
		privateHeader: underlying.Header().Clone(),
	}
}

func (w *gatedResponseWriter) activate() {
	w.activateOnce.Do(func() {
		target := w.underlying.Header()
		for key := range target {
			target.Del(key)
		}
		for key, values := range w.privateHeader {
			target[key] = append([]string(nil), values...)
		}
		w.active.Store(true)
		if w.pendingStatus != 0 {
			w.underlying.WriteHeader(w.pendingStatus)
		}
	})
}

func (w *gatedResponseWriter) Header() http.Header {
	if w.active.Load() {
		return w.underlying.Header()
	}
	return w.privateHeader
}

func (w *gatedResponseWriter) WriteHeader(statusCode int) {
	if w.active.Load() {
		w.underlying.WriteHeader(statusCode)
		return
	}
	if w.pendingStatus == 0 {
		w.pendingStatus = statusCode
	}
}

func (w *gatedResponseWriter) Write(data []byte) (int, error) {
	if !w.active.Load() {
		return len(data), nil
	}
	return w.underlying.Write(data)
}

func (w *gatedResponseWriter) Flush() {
	if w.active.Load() {
		w.underlying.Flush()
	}
}

func (w *gatedResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if !w.active.Load() {
		return nil, nil, errors.New("cannot hijack an unmatched plugin route")
	}
	return w.underlying.Hijack()
}

// Unwrap lets http.ResponseController reach the client connection once a
// plugin route answers, as a relayed stream that stopped early needs to cut it
// off.
func (w *gatedResponseWriter) Unwrap() http.ResponseWriter {
	if !w.active.Load() {
		return nil
	}
	return w.underlying
}

func (w *gatedResponseWriter) CloseNotify() <-chan bool {
	if w.active.Load() {
		return w.underlying.CloseNotify()
	}
	never := make(chan bool)
	return never
}

func (w *gatedResponseWriter) Push(target string, options *http.PushOptions) error {
	if !w.active.Load() {
		return http.ErrNotSupported
	}
	pusher := w.underlying.Pusher()
	if pusher == nil {
		return http.ErrNotSupported
	}
	return pusher.Push(target, options)
}

func sortedPluginKeys(plugins map[string]*jsplugin.LoadedPlugin) []string {
	keys := make([]string, 0, len(plugins))
	for key := range plugins {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func sortedPlugins(plugins map[string]*jsplugin.LoadedPlugin) []*jsplugin.LoadedPlugin {
	keys := sortedPluginKeys(plugins)
	sorted := make([]*jsplugin.LoadedPlugin, 0, len(keys))
	for _, key := range keys {
		sorted = append(sorted, plugins[key])
	}
	return sorted
}

type routePatternSegment struct {
	value    string
	dynamic  bool
	catchAll bool
	// taskID marks a query route's task-id parameter, which only ever
	// receives gateway task ids and so never equals a literal segment.
	taskID bool
}

func parseRoutePattern(routePath string) []routePatternSegment {
	parts := strings.Split(strings.TrimPrefix(routePath, "/"), "/")
	segments := make([]routePatternSegment, 0, len(parts))
	for _, part := range parts {
		segments = append(segments, routePatternSegment{
			value:    part,
			dynamic:  strings.HasPrefix(part, ":") || strings.HasPrefix(part, "*"),
			catchAll: strings.HasPrefix(part, "*"),
		})
	}
	return segments
}

func routePatternsIntersect(leftPath, rightPath string) bool {
	return routeSegmentsIntersect(parseRoutePattern(leftPath), parseRoutePattern(rightPath))
}

func routeSegmentsIntersect(left, right []routePatternSegment) bool {
	for index := 0; ; index++ {
		leftDone := index >= len(left)
		rightDone := index >= len(right)
		if leftDone || rightDone {
			return leftDone && rightDone
		}
		if left[index].catchAll || right[index].catchAll {
			return true
		}
		if !left[index].dynamic && !right[index].dynamic && left[index].value != right[index].value {
			return false
		}
		if (left[index].dynamic && right[index].value == "") || (right[index].dynamic && left[index].value == "") {
			return false
		}
		if (left[index].taskID && !right[index].dynamic) || (right[index].taskID && !left[index].dynamic) {
			return false
		}
	}
}

// routeIntersectsStaticRoute reports whether a request the plugin route could
// serve is answered first by the static route or by the trailing-slash
// redirect it causes. A query route's task-id parameter meets only the static
// route's wildcards. A static route that offers matching requests to the
// plugin routes first does not answer them itself, but its redirect still does.
func routeIntersectsStaticRoute(route jsplugin.Route, staticPath string, offersToPlugins bool) bool {
	pluginSegments := parseRoutePattern(route.Path)
	if route.Type == jsplugin.RouteTypeQuery {
		for index := range pluginSegments {
			pluginSegments[index].taskID = pluginSegments[index].value == ":"+route.TaskIDParam
		}
	}
	if !offersToPlugins && routeSegmentsIntersect(pluginSegments, parseRoutePattern(staticPath)) {
		return true
	}
	if catchAllIndex := strings.LastIndex(staticPath, "/*"); catchAllIndex >= 0 && catchAllIndex+2 < len(staticPath) {
		prefix := staticPath[:catchAllIndex]
		return routeSegmentsIntersect(pluginSegments, parseRoutePattern(prefix)) || routeSegmentsIntersect(pluginSegments, parseRoutePattern(prefix+"/"))
	}
	if staticPath == "/" {
		return false
	}
	alternate := strings.TrimSuffix(staticPath, "/")
	if alternate == staticPath {
		alternate += "/"
	}
	return routeSegmentsIntersect(pluginSegments, parseRoutePattern(alternate))
}
