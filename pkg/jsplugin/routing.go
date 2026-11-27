package jsplugin

import (
	"fmt"
	"maps"
	"net/http"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pluginkit"
	"github.com/gin-gonic/gin"
)

// RouteGroup is one method and path shape of the inner router with every
// binding that serves it, in ascending key order. GinPath names each wildcard
// by its segment position (:s2, *s3), so bindings that name the same position
// differently share one registration.
type RouteGroup struct {
	Method   string
	Shape    string
	GinPath  string
	Bindings []RouteBinding
}

// SkippedRoute is a declared top-level route the gateway does not register;
// the plugin's /{key} copy still serves it. Reason is host_route or
// key_namespace.
type SkippedRoute struct {
	PluginKey string
	Route     Route
	Reason    string
}

type ProtocolBinding struct {
	Plugin    *LoadedPlugin
	Protocol  string
	Operation HostProtocolOperation
	Model     string
}

const (
	ContextKeyPinnedPlugin    = "task_plugin_pinned_plugin"
	ContextKeyPinnedRoute     = "task_plugin_pinned_route"
	ContextKeyPinnedEndpoint  = "task_plugin_pinned_endpoint"
	ContextKeyRouteRequest    = "task_plugin_route_request"
	ContextKeyProtocolRequest = "task_plugin_protocol_request"
	// ContextKeyEffectiveImageRequest holds the current attempt's image request
	// after channel overrides. ProtocolRequest remains the immutable retry source.
	ContextKeyEffectiveImageRequest = "task_plugin_effective_image_request"
	// ContextKeyRequestBodyText holds, for a plugin that preserves JSON
	// order, the decoded requestBody as JSON text (json.RawMessage) beside
	// the Go value in task_request.
	ContextKeyRequestBodyText = "task_plugin_request_body_text"
	// ContextKeyRelayEndpoint retains the shared endpoint candidates when an
	// ordinary channel wins, so task USD expressions cannot become relay prices.
	ContextKeyRelayEndpoint = "task_plugin_relay_endpoint"
	// ContextKeyRequestRefreshed is set once a request plugin changed the
	// stored body of a task submission: the task adaptor then runs the
	// plugin's decoder again on every attempt.
	ContextKeyRequestRefreshed = "task_plugin_request_refreshed"
)

type PinnedPlugin struct {
	Generation *RoutingGeneration
	Plugin     *LoadedPlugin
}

// PinnedRoute carries the generation and the bindings of the matched native
// route. Plugin and Route name the binding that decodes or renders; on a path
// several plugins declare, Candidates lists them all and distribution may
// rebind Plugin and Route to the candidate the selected channel executes.
type PinnedRoute struct {
	Generation *RoutingGeneration
	Plugin     *LoadedPlugin
	Route      Route
	Candidates []RouteBinding
}

// PinnedEndpoint carries the exact generation and endpoint candidates selected
// before distribution. Plugin initially names the deterministic request parser;
// distribution may rebind it to another candidate from the same generation
// when multiple legacy providers expose the same model.
type PinnedEndpoint struct {
	Generation  *RoutingGeneration
	Plugin      *LoadedPlugin
	Protocol    string
	Operation   HostProtocolOperation
	Model       string
	MappedModel string
	Candidates  []ProtocolBinding
}

// DiscardsImmediateResult reports whether this submission delivers a terminal
// result inline and omits its task data from storage.
func DiscardsImmediateResult(c *gin.Context) bool {
	route, _ := common.GetContextKeyType[PinnedRoute](c, ContextKeyPinnedRoute)
	if route.Route.RetainResult != nil && !*route.Route.RetainResult {
		return true
	}
	endpoint, _ := common.GetContextKeyType[PinnedEndpoint](c, ContextKeyPinnedEndpoint)
	return endpoint.Protocol == ProtocolOpenAIImage
}

// RoutingGeneration is an immutable, request-pinnable view of all effective
// plugins and their deterministic routing indexes.
type RoutingGeneration struct {
	Number      uint64
	PublishedAt time.Time

	byKey                map[string]*LoadedPlugin
	byModel              map[string]*LoadedPlugin
	modelPlugins         map[string][]*LoadedPlugin
	canonicalModelByFold map[string]string
	byChannelType        map[int][]*LoadedPlugin
	routeIndex           map[string][]RouteBinding
	protocolIndex        map[string][]ProtocolBinding
	plugins              []*LoadedPlugin
	routes               []RouteBinding
	runtime              http.Handler
	retainCurrent        map[string]struct{}
	// factoryKeys are the keys of the built-in plugins, overridden or
	// switched off included.
	factoryKeys map[string]struct{}
	skipped     []SkippedRoute
}

func (g *RoutingGeneration) Get(key string) (*LoadedPlugin, bool) {
	if g == nil {
		return nil, false
	}
	plugin, ok := g.byKey[key]
	return plugin, ok
}

// PluginsByChannelType returns the plugins declaring a built-in channel type
// in meta.channelTypes, in ascending key order. A channel of that type serves
// each of them.
func (g *RoutingGeneration) PluginsByChannelType(channelType int) []*LoadedPlugin {
	if g == nil {
		return nil
	}
	return slices.Clone(g.byChannelType[channelType])
}

// GetByModel returns the deterministic effective plugin metadata used for a
// model-level host concern such as billing. When multiple providers expose the
// same model name, the first plugin in generation order owns that shared
// metadata view.
func (g *RoutingGeneration) GetByModel(model string) (*LoadedPlugin, bool) {
	if g == nil || model == "" {
		return nil, false
	}
	plugin, ok := g.byModel[model]
	return plugin, ok
}

// PluginsByModel returns all plugins declaring model, in ascending key order.
func (g *RoutingGeneration) PluginsByModel(model string) []*LoadedPlugin {
	if g == nil {
		return nil
	}
	return slices.Clone(g.modelPlugins[model])
}

// SharedModel reports whether multiple plugins declare a model without copying
// its provider list on the relay hot path.
func (g *RoutingGeneration) SharedModel(model string) bool {
	return g != nil && len(g.modelPlugins[model]) >= 2
}

// CanonicalModel returns the declared spelling for model. An exact byModel
// hit wins and returns the input unchanged; otherwise the ASCII-folded
// index is consulted. Miss and nil-receiver return ("", false).
func (g *RoutingGeneration) CanonicalModel(model string) (string, bool) {
	if g == nil || model == "" {
		return "", false
	}
	if _, ok := g.byModel[model]; ok {
		return model, true
	}
	declared, ok := g.canonicalModelByFold[ASCIIFold(model)]
	return declared, ok
}

// LookupDeclaredRoute resolves a manifest path declaration, or its /{key}
// copy, to the first binding in ascending key order. It does not match an
// incoming concrete URL; runtime matching is delegated to Gin.
func (g *RoutingGeneration) LookupDeclaredRoute(method, path string) (RouteBinding, bool) {
	bindings := g.LookupDeclaredRoutes(method, path)
	if len(bindings) == 0 {
		return RouteBinding{}, false
	}
	return bindings[0], true
}

// LookupDeclaredRoutes returns every binding of a path shape, in ascending
// key order.
func (g *RoutingGeneration) LookupDeclaredRoutes(method, path string) []RouteBinding {
	if g == nil {
		return nil
	}
	normalizedMethod, err := pluginkit.NormalizeRouteMethod(method)
	if err != nil {
		return nil
	}
	shape, err := pluginkit.RoutePathShape(path)
	if err != nil {
		return nil
	}
	return slices.Clone(g.routeIndex[normalizedMethod+" "+shape])
}

func (g *RoutingGeneration) LookupEndpoint(method, path, model string) (ProtocolBinding, bool) {
	if g == nil {
		return ProtocolBinding{}, false
	}
	normalizedMethod, err := pluginkit.NormalizeRouteMethod(method)
	if err != nil {
		return ProtocolBinding{}, false
	}
	bindings := g.protocolIndex[endpointIndexKey(normalizedMethod, path, model)]
	if len(bindings) == 0 {
		return ProtocolBinding{}, false
	}
	return bindings[0], true
}

// LookupEndpointCandidates returns every plugin that can serve a shared model
// endpoint, in ascending key order. Each candidate decodes before distribution.
func (g *RoutingGeneration) LookupEndpointCandidates(method, path, model string) []ProtocolBinding {
	if g == nil {
		return nil
	}
	normalizedMethod, err := pluginkit.NormalizeRouteMethod(method)
	if err != nil {
		return nil
	}
	bindings := g.protocolIndex[endpointIndexKey(normalizedMethod, path, model)]
	return append([]ProtocolBinding(nil), bindings...)
}

func (g *RoutingGeneration) Plugins() []*LoadedPlugin {
	if g == nil {
		return nil
	}
	return append([]*LoadedPlugin(nil), g.plugins...)
}

func (g *RoutingGeneration) Routes() []RouteBinding {
	if g == nil {
		return nil
	}
	return append([]RouteBinding(nil), g.routes...)
}

// RouteGroups returns the inner router's registrations: one per method and
// path shape, without the skipped routes.
func (g *RoutingGeneration) RouteGroups() []RouteGroup {
	if g == nil {
		return nil
	}
	skipped := make(map[string]struct{}, len(g.skipped))
	for _, route := range g.skipped {
		skipped[route.PluginKey+" "+route.Route.Method+" "+route.Route.Path] = struct{}{}
	}
	groups := make([]RouteGroup, 0, len(g.routes))
	positions := make(map[string]int, len(g.routes))
	for _, binding := range g.routes {
		if _, skip := skipped[binding.Plugin.Meta.Key+" "+binding.Route.Method+" "+binding.Route.Path]; skip {
			continue
		}
		shape, err := pluginkit.RoutePathShape(binding.Route.Path)
		if err != nil {
			continue
		}
		indexKey := binding.Route.Method + " " + shape
		position, exists := positions[indexKey]
		if !exists {
			segments := strings.Split(strings.TrimPrefix(shape, "/"), "/")
			for index, segment := range segments {
				if segment == ":" || segment == "*" {
					segments[index] = segment + "s" + strconv.Itoa(index)
				}
			}
			position = len(groups)
			positions[indexKey] = position
			groups = append(groups, RouteGroup{Method: binding.Route.Method, Shape: shape, GinPath: "/" + strings.Join(segments, "/")})
		}
		groups[position].Bindings = append(groups[position].Bindings, binding)
	}
	return groups
}

// RouteParams names the inner router's positional wildcards after the
// parameters route declares.
func RouteParams(params gin.Params, route Route) map[string]string {
	named := make(map[string]string, len(params))
	for index, segment := range strings.Split(strings.TrimPrefix(route.Path, "/"), "/") {
		name, wildcard := strings.CutPrefix(segment, ":")
		if !wildcard {
			name, wildcard = strings.CutPrefix(segment, "*")
		}
		if !wildcard {
			continue
		}
		if value, found := params.Get("s" + strconv.Itoa(index)); found {
			named[name] = value
		}
	}
	return named
}

// FactoryKey reports whether key belongs to a built-in plugin, whether or not
// an override or the disabled list replaces it in this generation.
func (g *RoutingGeneration) FactoryKey(key string) bool {
	if g == nil {
		return false
	}
	_, found := g.factoryKeys[key]
	return found
}

// SkippedRoutes returns the declared top-level routes the gateway does not
// register.
func (g *RoutingGeneration) SkippedRoutes() []SkippedRoute {
	if g == nil {
		return nil
	}
	return slices.Clone(g.skipped)
}

// WithSkippedRoutes returns a shallow immutable copy that leaves the given
// routes out of RouteGroups. Callers use it before publication.
func (g *RoutingGeneration) WithSkippedRoutes(skipped []SkippedRoute) *RoutingGeneration {
	if g == nil {
		return nil
	}
	prepared := *g
	prepared.skipped = slices.Clone(skipped)
	return &prepared
}

// RuntimeHandler is the inner router built for this exact generation. It is
// published in the same atomic pointer as the routing indexes.
func (g *RoutingGeneration) RuntimeHandler() http.Handler {
	if g == nil {
		return nil
	}
	return g.runtime
}

func (g *RoutingGeneration) RetainsIncumbent(key string) bool {
	if g == nil {
		return false
	}
	_, retained := g.retainCurrent[key]
	return retained
}

// RebuildWithPlugins creates a generation from the supplied exact plugin
// pointers. It is used when a rejected hot update must retain the incumbent
// runtime object for that key.
func (g *RoutingGeneration) RebuildWithPlugins(plugins []*LoadedPlugin) (*RoutingGeneration, error) {
	if g == nil {
		return nil, fmt.Errorf("cannot rebuild a nil routing generation")
	}
	byKey := make(map[string]*LoadedPlugin, len(plugins))
	for _, plugin := range plugins {
		if plugin == nil {
			return nil, fmt.Errorf("cannot rebuild routing generation with a nil plugin")
		}
		if _, exists := g.byKey[plugin.Meta.Key]; !exists {
			return nil, fmt.Errorf("plugin %q is not present in routing generation %d", plugin.Meta.Key, g.Number)
		}
		if _, duplicate := byKey[plugin.Meta.Key]; duplicate {
			return nil, fmt.Errorf("plugin %q appears more than once in routing generation rebuild", plugin.Meta.Key)
		}
		byKey[plugin.Meta.Key] = plugin
	}
	rebuilt, err := buildRoutingGeneration(byKey, nil, g.Number)
	if err != nil {
		return nil, err
	}
	rebuilt.PublishedAt = g.PublishedAt
	rebuilt.retainCurrent = cloneStringSet(g.retainCurrent)
	rebuilt.factoryKeys = g.factoryKeys
	return rebuilt, nil
}

// WithRuntime returns a shallow immutable copy carrying the prepared inner
// handler. Callers use it before publication; published generations must not
// be mutated.
func (g *RoutingGeneration) WithRuntime(handler http.Handler) *RoutingGeneration {
	if g == nil {
		return nil
	}
	prepared := *g
	prepared.runtime = handler
	return &prepared
}

func cloneStringSet(source map[string]struct{}) map[string]struct{} {
	if len(source) == 0 {
		return nil
	}
	clone := make(map[string]struct{}, len(source))
	for key := range source {
		clone[key] = struct{}{}
	}
	return clone
}

func buildRoutingGeneration(factory, override map[string]*LoadedPlugin, number uint64) (*RoutingGeneration, error) {
	effective := effectivePlugins(factory, override)
	return buildRoutingGenerationFromPlugins(effective, number)
}

func buildRoutingGenerationAdmitting(
	factory, override map[string]*LoadedPlugin,
	number uint64,
	current *RoutingGeneration,
	retainCurrent map[string]struct{},
) (*RoutingGeneration, map[string]string, error) {
	candidates := effectivePlugins(factory, override)
	accepted := make(map[string]*LoadedPlugin, len(candidates))
	currentByKey := make(map[string]*LoadedPlugin)
	if current != nil {
		for _, plugin := range current.plugins {
			currentByKey[plugin.Meta.Key] = plugin
		}
	}
	generation, err := buildRoutingGenerationFromPlugins(accepted, number)
	if err != nil {
		return nil, nil, fmt.Errorf("initialize routing generation: %w", err)
	}

	unchangedKeys := make([]string, 0)
	changedKeys := make([]string, 0)
	newKeys := make([]string, 0)
	for key, candidate := range candidates {
		incumbent, exists := currentByKey[key]
		switch {
		case exists && candidate == incumbent:
			unchangedKeys = append(unchangedKeys, key)
		case exists:
			changedKeys = append(changedKeys, key)
		default:
			newKeys = append(newKeys, key)
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
		candidate := candidates[key]
		accepted[key] = candidate
		trial, trialErr := buildRoutingGenerationFromPlugins(accepted, number)
		if trialErr == nil {
			generation = trial
			continue
		}
		delete(accepted, key)
		routingErrors[key] = fmt.Sprintf("plugin %s rejected from routing generation: %v", key, trialErr)
		rejectedKeys = append(rejectedKeys, key)
	}

	for _, key := range rejectedKeys {
		candidate := candidates[key]
		incumbent, hasIncumbent := currentByKey[key]
		_, mayRetain := retainCurrent[key]
		if !hasIncumbent || !mayRetain || incumbent == candidate {
			continue
		}
		accepted[key] = incumbent
		fallback, fallbackErr := buildRoutingGenerationFromPlugins(accepted, number)
		if fallbackErr == nil {
			generation = fallback
			continue
		}
		delete(accepted, key)
	}
	generation.retainCurrent = cloneStringSet(retainCurrent)
	return generation, routingErrors, nil
}

func effectivePlugins(factory, override map[string]*LoadedPlugin) map[string]*LoadedPlugin {
	effective := make(map[string]*LoadedPlugin, len(factory)+len(override))
	maps.Copy(effective, factory)
	maps.Copy(effective, override)
	return effective
}

func buildRoutingGenerationFromPlugins(effective map[string]*LoadedPlugin, number uint64) (*RoutingGeneration, error) {
	keys := make([]string, 0, len(effective))
	for key := range effective {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	generation := &RoutingGeneration{
		Number:               number,
		PublishedAt:          time.Now(),
		byKey:                make(map[string]*LoadedPlugin, len(effective)),
		byModel:              make(map[string]*LoadedPlugin),
		modelPlugins:         make(map[string][]*LoadedPlugin),
		canonicalModelByFold: make(map[string]string),
		byChannelType:        make(map[int][]*LoadedPlugin),
		routeIndex:           make(map[string][]RouteBinding),
		protocolIndex:        make(map[string][]ProtocolBinding),
		plugins:              make([]*LoadedPlugin, 0, len(effective)),
	}
	for _, key := range keys {
		plugin := effective[key]
		generation.byKey[key] = plugin
		generation.plugins = append(generation.plugins, plugin)
		// The models of a plugin without a task part are its relay fallback
		// list: ordinary models, not task models.
		taskModels := plugin.Meta.Models
		if !plugin.Meta.HasTaskPart() {
			taskModels = nil
		}
		for _, model := range taskModels {
			generation.modelPlugins[model] = append(generation.modelPlugins[model], plugin)
			if _, exists := generation.byModel[model]; !exists {
				generation.byModel[model] = plugin
			}
			folded := ASCIIFold(model)
			if existing, exists := generation.canonicalModelByFold[folded]; exists {
				if existing != model {
					otherKey := plugin.Meta.Key
					if other, ok := generation.byModel[existing]; ok {
						otherKey = other.Meta.Key
					}
					return nil, fmt.Errorf("plugin %s model %q conflicts with plugin %s model %q", plugin.Meta.Key, model, otherKey, existing)
				}
				continue
			}
			generation.canonicalModelByFold[folded] = model
		}

		// Several plugins may declare a channel type; a channel of the type
		// serves each of them.
		for _, channelType := range plugin.Meta.ChannelTypes {
			generation.byChannelType[channelType] = append(generation.byChannelType[channelType], plugin)
		}

		// Plugins may share a path shape; the request resolves which one
		// serves it (see PinnedRoute).
		for _, binding := range PluginRouteBindings(plugin) {
			shape, err := pluginkit.RoutePathShape(binding.Route.Path)
			if err != nil {
				return nil, err
			}
			indexKey := binding.Route.Method + " " + shape
			generation.routeIndex[indexKey] = append(generation.routeIndex[indexKey], binding)
			generation.routes = append(generation.routes, binding)
		}

		for _, claim := range plugin.Meta.Protocols {
			definition, _ := HostProtocol(claim.Name)
			boundModels := plugin.Meta.Models
			if len(claim.Models) > 0 {
				boundModels = claim.Models
			}
			for _, operation := range definition.Operations {
				if operation.ModelField == "" {
					continue
				}
				for _, method := range operation.Methods {
					for _, model := range boundModels {
						indexKey := endpointIndexKey(method, operation.Path, model)
						bindings := generation.protocolIndex[indexKey]
						if len(bindings) > 0 {
							other := bindings[0]
							if claim.Name != other.Protocol {
								return nil, fmt.Errorf("plugin %s protocol %s %s model %q conflicts with plugin %s", plugin.Meta.Key, method, operation.Path, model, other.Plugin.Meta.Key)
							}
						}
						generation.protocolIndex[indexKey] = append(bindings, ProtocolBinding{Plugin: plugin, Protocol: claim.Name, Operation: operation, Model: model})
					}
				}
			}
		}
	}
	return generation, nil
}

// PreflightRoutingConflict reports whether admitting candidate into the
// current generation would collide on a case-folded model name or a
// protocol-model binding. A same-key entry is replaced first so
// re-uploading a plugin (or overriding a factory built-in) does not
// self-conflict.
func PreflightRoutingConflict(current *RoutingGeneration, candidate *LoadedPlugin) error {
	if candidate == nil {
		return fmt.Errorf("cannot preflight a nil plugin")
	}
	effective := make(map[string]*LoadedPlugin)
	number := uint64(0)
	if current != nil {
		for _, plugin := range current.Plugins() {
			effective[plugin.Meta.Key] = plugin
		}
		number = current.Number
	}
	effective[candidate.Meta.Key] = candidate
	_, err := buildRoutingGenerationFromPlugins(effective, number)
	return err
}

func endpointIndexKey(method, path, model string) string {
	return method + "\x00" + path + "\x00" + model
}
