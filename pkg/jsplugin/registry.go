package jsplugin

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"math"
	"net"
	"net/url"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/MoeForge/moego/regexp"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

const APIVersion1 = 1

const (
	maxLocalizedTextLocales       = 16
	maxMetaDescriptionRunes       = 512
	maxMetaNameRunes              = 128
	maxMetaKeyHintRunes           = 256
	maxUsageFieldDescriptionRunes = 256
)

var websiteHostLabelPattern = regexp.MustCompile(`^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$`)

var pluginKeyPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]*$`)
var pluginVersionPattern = regexp.MustCompile(`^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$`)
var localeTagPattern = regexp.MustCompile(`^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$`)

// ValidPluginKey checks the canonical identifier accepted by plugin manifests.
func ValidPluginKey(key string) bool {
	return len(key) <= 30 && pluginKeyPattern.MatchString(key)
}

// LocalizedText is locale-keyed display copy. Plugin source may use a bare
// string (normalized to {"en": s}) or a map that must include "en". API
// responses always emit an object.
type LocalizedText map[string]string

func (t LocalizedText) MarshalJSON() ([]byte, error) {
	if t == nil {
		return common.Marshal(map[string]string{})
	}
	return common.Marshal(map[string]string(t))
}

func (t *LocalizedText) UnmarshalJSON(data []byte) error {
	trimmed := strings.TrimSpace(string(data))
	if trimmed == "" || trimmed == "null" {
		*t = nil
		return nil
	}
	switch trimmed[0] {
	case '"':
		var text string
		if err := common.Unmarshal(data, &text); err != nil {
			return err
		}
		*t = LocalizedText{"en": text}
		return nil
	case '{':
		var object map[string]string
		if err := common.Unmarshal(data, &object); err != nil {
			return err
		}
		*t = LocalizedText(object)
		return nil
	default:
		return fmt.Errorf("localized text must be a string or object")
	}
}

type Meta struct {
	RequiredCapabilities []string                    `json:"requiredCapabilities,omitempty"`
	SubmitResponseTypes  []string                    `json:"submitResponseTypes,omitempty"`
	SortPriority         int                         `json:"sortPriority,omitempty"`
	Website              string                      `json:"website,omitempty"`
	APIVersion           int                         `json:"apiVersion"`
	Key                  string                      `json:"key"`
	Name                 string                      `json:"name"`
	NameI18n             LocalizedText               `json:"name_i18n,omitempty"` // the locales of a name given as an object; Name is its en text
	Icon                 string                      `json:"icon,omitempty"`
	Description          LocalizedText               `json:"description,omitempty"`
	Version              string                      `json:"version"`
	Author               AuthorMeta                  `json:"author"`
	BaseURL              string                      `json:"baseUrl,omitempty"`
	ChannelTypes         []int                       `json:"channelTypes,omitempty"`
	Models               []string                    `json:"models"`
	FetchMode            string                      `json:"fetchMode"`
	AllowedHosts         []string                    `json:"allowedHosts"`
	Upstreams            []string                    `json:"upstreams,omitempty"`
	Routes               []Route                     `json:"routes"`
	Protocols            []ProtocolClaim             `json:"protocols"`
	UsageSchema          map[string]UsageFieldSchema `json:"usageSchema,omitempty"`
	UsageExamples        []UsageExample              `json:"usageExamples,omitempty"`
	UsageProfiles        []UsageProfile              `json:"usageProfiles,omitempty"`
	Auth                 AuthMeta                    `json:"auth"`
	// Relay is the provider part: the Advanced Custom routes a type-61
	// channel bound to the plugin serves.
	Relay []dto.AdvancedCustomRoute `json:"relay,omitempty"`
	// ConfigSchema is the schema of a request processing instance's config.
	ConfigSchema *ConfigSchema `json:"configSchema,omitempty"`
	// ChannelConfig is the schema of the plugin config of a type-61 channel
	// bound to the plugin, stored in its settings as plugin_config.
	ChannelConfig *ConfigSchema `json:"channelConfig,omitempty"`
	// KeyHint is the hint and example of the channel key field.
	KeyHint LocalizedText `json:"keyHint,omitempty"`
	// Optional lets a request skip an instance of the plugin that fails at a
	// stage; without it the failure stops the request.
	Optional bool `json:"optional,omitempty"`
	// Samples are the requests the request plugin editor offers to try the
	// plugin with.
	Samples []Sample `json:"samples,omitempty"`
	// noTaskPart marks a plugin that does not export buildSubmitRequest.
	// CompilePlugin sets it; a Meta built by hand has the task part.
	noTaskPart bool
	// transformHooks are the stage hooks the plugin exports, in
	// TransformStages order, then ReportHook. CompilePlugin sets them.
	transformHooks []string
}

// ProviderConverter is the relay converter whose request and response the
// plugin's convertRequest, convertResponse and convertStreamEvent convert; on
// the model list route convertResponse alone runs. Only manifests accept it;
// Advanced Custom channel settings reject it.
const ProviderConverter = "plugin"

// chainedConverterSuffix ends a converter that chains a registered converter
// and the plugin's convert hooks: the host converts the client protocol into
// the registered converter's upstream protocol, and the hooks convert that
// protocol into the vendor's and back.
const chainedConverterSuffix = "+" + ProviderConverter

// SplitProviderConverter returns the converter the host runs for a route
// converter and whether the plugin's convert hooks run too: "plugin" is "none"
// with the hooks, "<converter>+plugin" that converter with the hooks, and any
// other value itself without them.
func SplitProviderConverter(converter string) (hostConverter string, hooks bool) {
	converter = strings.TrimSpace(converter)
	if converter == ProviderConverter {
		return "none", true
	}
	if base, chained := strings.CutSuffix(converter, chainedConverterSuffix); chained {
		return base, true
	}
	return converter, false
}

// HasTaskPart reports whether the plugin is a task driver: it exports
// buildSubmitRequest.
func (m Meta) HasTaskPart() bool {
	return !m.noTaskPart
}

// HasProviderPart reports whether the plugin declares relay routes.
func (m Meta) HasProviderPart() bool {
	return len(m.Relay) > 0
}

// RelayConfig returns the relay routes as the Advanced Custom configuration
// of one request. A plugin-converter route reaches the Advanced Custom code as
// a native route of its client protocol, and a chained one as a route of its
// registered converter; the provider adaptor converts around it.
func (m Meta) RelayConfig() *dto.AdvancedCustomConfig {
	if len(m.Relay) == 0 {
		return nil
	}
	routes := cloneRelayRoutes(m.Relay)
	for index := range routes {
		if converter, hooks := SplitProviderConverter(routes[index].Converter); hooks {
			routes[index].Converter = converter
		}
	}
	return &dto.AdvancedCustomConfig{Routes: routes}
}

// ChannelRelayConfig is RelayConfig for a channel: an upstream_path that
// starts with {config.<name>} starts with that address of the channel's plugin
// config instead, or is relative to the channel base URL when the address is
// empty. config is the config as ChannelConfigFor returns it.
func (m Meta) ChannelRelayConfig(config []byte) *dto.AdvancedCustomConfig {
	relay := m.RelayConfig()
	if relay == nil {
		return nil
	}
	for index, route := range relay.Routes {
		name, rest, ok := configAddressPath(route.UpstreamPath)
		if !ok {
			continue
		}
		address := ChannelConfigURL(config, name)
		if address == "" && rest == "" {
			rest = "/"
		}
		relay.Routes[index].UpstreamPath = address + rest
	}
	return relay
}

// configAddressPath splits an upstream_path of the form {config.<name>}<rest>.
func configAddressPath(upstreamPath string) (name, rest string, ok bool) {
	trimmed := strings.TrimSpace(upstreamPath)
	if !strings.HasPrefix(trimmed, configAddressPrefix) {
		return "", "", false
	}
	name, rest, ok = strings.Cut(trimmed[len(configAddressPrefix):], "}")
	return name, rest, ok
}

const configAddressPrefix = "{config."

// RelayRoute returns the relay route serving requestPath for model, with the
// converter as the manifest declares it.
func (m Meta) RelayRoute(requestPath, model string) (dto.AdvancedCustomRoute, bool) {
	config := dto.AdvancedCustomConfig{Routes: m.Relay}
	return config.MatchPathForModel(requestPath, model)
}

// RelaysModel reports whether a relay route accepts model for client
// requests: the plugin serves the model on chat paths, not only as a task. The
// model list and balance routes accept every model and serve none.
func (m Meta) RelaysModel(model string) bool {
	return slices.ContainsFunc(m.Relay, func(route dto.AdvancedCustomRoute) bool {
		path := strings.TrimSpace(route.IncomingPath)
		return path != dto.AdvancedCustomModelListPath && path != dto.AdvancedCustomBalancePath && route.AcceptsModel(model)
	})
}

// ServesResponsesWebSocket reports whether a Responses WebSocket session for
// model may run on the relay routes: the /v1/responses route serving it has no
// converter, so the session forwards native events as Advanced Custom does.
// An empty model asks whether any route of that path qualifies.
func (m Meta) ServesResponsesWebSocket(model string) bool {
	if model == "" {
		return slices.ContainsFunc(m.Relay, func(route dto.AdvancedCustomRoute) bool {
			config := dto.AdvancedCustomConfig{Routes: []dto.AdvancedCustomRoute{route}}
			_, ok := config.MatchPath(responsesPath)
			return ok && route.IsNative()
		})
	}
	route, ok := m.RelayRoute(responsesPath, model)
	return ok && route.IsNative()
}

const responsesPath = "/v1/responses"

// ModelListRoute returns the /v1/models relay route, with the converter as the
// manifest declares it.
func (m Meta) ModelListRoute() (dto.AdvancedCustomRoute, bool) {
	config := dto.AdvancedCustomConfig{Routes: m.Relay}
	return config.ModelListRoute()
}

func cloneRelayRoutes(routes []dto.AdvancedCustomRoute) []dto.AdvancedCustomRoute {
	if routes == nil {
		return nil
	}
	cloned := make([]dto.AdvancedCustomRoute, len(routes))
	for index, route := range routes {
		route.Models = slices.Clone(route.Models)
		if route.Auth != nil {
			auth := *route.Auth
			route.Auth = &auth
		}
		cloned[index] = route
	}
	return cloned
}

// Upstream kinds a plugin driver can address. Every driver speaks to its
// vendor; a driver that also builds its own native-route URLs when the channel
// points at another New API gateway declares UpstreamKindNewAPI in
// meta.upstreams, which is what makes it bindable to a type-60 channel.
const (
	UpstreamKindVendor = "vendor"
	UpstreamKindNewAPI = "new_api"
)

// SupportsUpstream reports whether the driver handles channels of the given
// upstream kind. The vendor kind is implied for every plugin.
func (m Meta) SupportsUpstream(kind string) bool {
	return kind == UpstreamKindVendor || slices.Contains(m.Upstreams, kind)
}

// PreservesJSONOrder reports whether the plugin declared json-order@1: its
// hooks receive JSON request bodies with members in the order the client sent
// them, and its JSON request bodies go upstream as JSON.stringify writes them.
// Other plugins keep the cheaper Go-map path, whose members enumerate sorted.
func (m Meta) PreservesJSONOrder() bool {
	return slices.Contains(m.RequiredCapabilities, CapabilityJSONOrder)
}

// JSONTextMember names the member of a hook result (a decoded requestBody, a
// request descriptor's body) that the host also takes as JSON text, for a
// plugin that preserves JSON order; it is empty for other plugins.
func (m Meta) JSONTextMember(member string) string {
	if !m.PreservesJSONOrder() {
		return ""
	}
	return member
}

// UsageProfile replaces the plugin's default usage metadata for its models.
type UsageProfile struct {
	Models   []string                    `json:"models"`
	Schema   map[string]UsageFieldSchema `json:"schema"`
	Examples []UsageExample              `json:"examples,omitempty"`
}

// UsageForModel returns read-only usage metadata for a declared model. Aliases
// must be resolved by the host first; an unknown or ambiguous model uses the
// plugin defaults. Profile examples never inherit the default examples.
func (m Meta) UsageForModel(model string) (map[string]UsageFieldSchema, []UsageExample) {
	return m.UsageForModels(model)
}

// UsageForModels returns the usage metadata of the first candidate that a
// profile declares. Runtime callers pass the final upstream model before the
// client-facing model, so a channel mapping that sends a declared model to a
// vendor endpoint ID keeps the declared model's profile. When no candidate is
// profiled, the plugin defaults apply.
func (m Meta) UsageForModels(models ...string) (map[string]UsageFieldSchema, []UsageExample) {
	for _, model := range models {
		folded := asciiFold(model)
		for _, profile := range m.UsageProfiles {
			for _, declared := range profile.Models {
				if asciiFold(declared) == folded {
					return profile.Schema, profile.Examples
				}
			}
		}
	}
	return m.UsageSchema, m.UsageExamples
}

// ProtocolSupports reports whether the named protocol claim includes mode.
func (m Meta) ProtocolSupports(protocol, mode string) bool {
	for _, claim := range m.Protocols {
		if claim.Name == protocol {
			return slices.Contains(claim.Supports, mode)
		}
	}
	return false
}

// UsageExample is a display-only pricing sample: a labeled complete vector
// over usageSchema. It never participates in billing.
type UsageExample struct {
	Label string         `json:"label"`
	Facts map[string]any `json:"facts"`
}

type AuthorMeta struct {
	Name string `json:"name"`
	URL  string `json:"url,omitempty"`
}

type AuthMeta struct {
	Type string `json:"type"`
}

// UsageFieldSchema declares how one usage fact is validated before it can
// influence billing. Numeric facts use one of the host-owned canonical units;
// boolean facts are flags; enum facts constrain non-numeric pricing selectors.
type UsageFieldSchema struct {
	Type        string                   `json:"type,omitempty"`
	Unit        string                   `json:"unit,omitempty"`
	UnitLabel   LocalizedText            `json:"unitLabel,omitempty"`
	Enum        []string                 `json:"enum,omitempty"`
	Description LocalizedText            `json:"description,omitempty"`
	EnumLabels  map[string]LocalizedText `json:"enumLabels,omitempty"`
}

type LoadedPlugin struct {
	Meta   Meta
	Engine *Engine
}

// UsesSubmitEventDelta reports whether SSE submissions go through
// parseSubmitEventDelta: the plugin declares submit-sse-delta@1, or exports
// parseSubmitEventDelta without parseSubmitEvent. A plugin that exports both
// and declares nothing keeps the snapshot hook, as before.
func UsesSubmitEventDelta(meta Meta, engine *Engine) bool {
	return slices.Contains(meta.RequiredCapabilities, CapabilitySubmitSSEDelta) ||
		engine.HasExport("parseSubmitEventDelta") && !engine.HasExport("parseSubmitEvent")
}

// RegistrySnapshot is a read-only copy of the metadata currently stored in
// each registry layer.
type RegistrySnapshot struct {
	Factory         []Meta
	Override        []Meta
	DisabledFactory []string
}

type PreparedRoutingGeneration struct {
	Generation *RoutingGeneration
	Errors     map[string]string
}

type RoutingRebuildOutcome struct {
	Status      string    `json:"status"`
	AttemptedAt time.Time `json:"attempted_at"`
	Generation  uint64    `json:"generation"`
	Error       string    `json:"error,omitempty"`
}

type RoutingStatus struct {
	Generation  *RoutingGeneration
	LastRebuild RoutingRebuildOutcome
	Errors      map[string]string
}

type RoutingGenerationPreparer func(candidate, current *RoutingGeneration) (PreparedRoutingGeneration, error)

type Registry struct {
	mu              sync.RWMutex
	factory         map[string]*LoadedPlugin
	override        map[string]*LoadedPlugin
	activeOverride  map[string]*LoadedPlugin
	disabledFactory map[string]struct{}
	masterEnabled   atomic.Bool
	generation      atomic.Pointer[RoutingGeneration]
	// switchedOff are, with the master switch off, the enabled plugins it
	// leaves out of the published generation; nil with the switch on.
	switchedOff    atomic.Pointer[map[string]*LoadedPlugin]
	preparer       RoutingGenerationPreparer
	routingErrors  map[string]string
	lastRebuildErr string
	lastRebuild    RoutingRebuildOutcome
}

func NewRegistry() *Registry {
	registry := &Registry{
		factory:        make(map[string]*LoadedPlugin),
		override:       make(map[string]*LoadedPlugin),
		activeOverride: make(map[string]*LoadedPlugin),
		routingErrors:  make(map[string]string),
	}
	registry.masterEnabled.Store(true)
	generation, _ := buildRoutingGeneration(registry.factory, registry.override, 0)
	registry.generation.Store(generation)
	registry.lastRebuild = RoutingRebuildOutcome{
		Status:      "success",
		AttemptedAt: generation.PublishedAt,
		Generation:  generation.Number,
	}
	return registry
}

var DefaultRegistry = NewRegistry()

func (r *Registry) Register(source string, options Options) (*LoadedPlugin, error) {
	return r.register(source, options, false)
}

func (r *Registry) RegisterFactory(source string, options Options) (*LoadedPlugin, error) {
	return r.register(source, options, true)
}

func (r *Registry) register(source string, options Options, factory bool) (*LoadedPlugin, error) {
	plugin, err := CompilePlugin(source, options)
	if err != nil {
		return nil, err
	}
	r.mu.Lock()
	defer r.mu.Unlock()

	factoryPlugins := clonePluginMap(r.factory)
	overridePlugins := clonePluginMap(r.override)
	if factory {
		factoryPlugins[plugin.Meta.Key] = plugin
	} else {
		overridePlugins[plugin.Meta.Key] = plugin
	}
	generation, routingErrors, err := r.prepareGeneration(filterDisabledFactory(factoryPlugins, r.disabledFactory), overridePlugins, false, nil)
	if err != nil {
		r.recordRebuildFailure(err)
		return nil, err
	}
	if rejection := routingErrors[plugin.Meta.Key]; rejection != "" {
		r.recordRebuildFailure(errors.New(rejection))
		return nil, fmt.Errorf("%s", rejection)
	}
	r.factory = factoryPlugins
	r.override = overridePlugins
	r.publishGeneration(generation, routingErrors, r.resolveActiveOverrides(generation, overridePlugins))
	return plugin, nil
}

// CompilePlugin validates a plugin without publishing it. Callers that refresh
// multiple plugins use this together with ReplaceOverrides so readers observe a
// single generation transition.
func CompilePlugin(source string, options Options) (*LoadedPlugin, error) {
	engine, err := Compile(source, options)
	if err != nil {
		return nil, err
	}
	value, members, err := engine.exportWithMemberJSON(context.Background(), "meta", "configSchema", "samples", "channelConfig")
	if err != nil {
		return nil, err
	}
	configSchema, samples, channelConfig := members[0], members[1], members[2]
	meta, err := decodeMeta(value)
	if err != nil {
		return nil, err
	}
	for _, stage := range append(slices.Clone(TransformStages), ReplyHook, ReportHook) {
		if !engine.HasExport(stage) {
			continue
		}
		callable, callableErr := engine.HasCallablePath(context.Background(), stage)
		if callableErr != nil {
			return nil, callableErr
		}
		if !callable {
			return nil, fmt.Errorf("plugin %s export %q is not a function", meta.Key, stage)
		}
		meta.transformHooks = append(meta.transformHooks, stage)
	}
	if configSchema != nil {
		if !meta.HasTransformPart() {
			return nil, fmt.Errorf("plugin %s meta configSchema belongs to the request processing part; export ingress, request, outbound, egress, reply or report, or remove it", meta.Key)
		}
		if meta.ConfigSchema, err = decodeConfigSchema(configSchema); err != nil {
			return nil, err
		}
	}
	if samples != nil {
		if !meta.HasTransformPart() {
			return nil, fmt.Errorf("plugin %s meta samples belongs to the request processing part; export ingress, request, outbound, egress, reply or report, or remove it", meta.Key)
		}
		if meta.Samples, err = decodeSamples(samples); err != nil {
			return nil, err
		}
	}
	if _, present := value.(map[string]any)["optional"]; present && !meta.HasTransformPart() {
		return nil, fmt.Errorf("plugin %s meta optional belongs to the request processing part; export ingress, request, outbound, egress, reply or report, or remove it", meta.Key)
	}
	if engine.HasExport("validateConfig") {
		if !meta.HasTransformPart() {
			return nil, fmt.Errorf("plugin %s export validateConfig belongs to the request processing part; export ingress, request, outbound, egress, reply or report, or remove it", meta.Key)
		}
		callable, callableErr := engine.HasCallablePath(context.Background(), "validateConfig")
		if callableErr != nil {
			return nil, callableErr
		}
		if !callable {
			return nil, fmt.Errorf("plugin %s export %q is not a function", meta.Key, "validateConfig")
		}
	}
	if !engine.HasExport("buildSubmitRequest") {
		if len(meta.Relay) == 0 && !meta.HasTransformPart() {
			return nil, fmt.Errorf("plugin %s has no task part (export buildSubmitRequest), provider part (meta.relay) or request processing part (export ingress, request, outbound, egress, reply or report)", meta.Key)
		}
		object, _ := value.(map[string]any)
		for _, field := range taskOnlyMetaFields {
			if _, present := object[field]; present {
				return nil, fmt.Errorf("plugin %s meta %s belongs to the task part; export buildSubmitRequest or remove it", meta.Key, field)
			}
		}
		meta.noTaskPart = true
	}
	if channelConfig != nil {
		if meta.ChannelConfig, err = decodeChannelConfigSchema(channelConfig); err != nil {
			return nil, err
		}
	}
	if meta.noTaskPart && len(meta.Relay) == 0 {
		for _, field := range []string{"channelConfig", "keyHint"} {
			if _, present := value.(map[string]any)[field]; present {
				return nil, fmt.Errorf("plugin %s meta %s belongs to a channel; export buildSubmitRequest or declare meta.relay, or remove it", meta.Key, field)
			}
		}
	}
	if engine.HasExport("buildBalanceRequest") != engine.HasExport("parseBalance") {
		return nil, fmt.Errorf("plugin %s must export both buildBalanceRequest and parseBalance, or neither", meta.Key)
	}
	if err = normalizeV1Meta(&meta); err != nil {
		return nil, err
	}
	engine.key = meta.Key
	engine.version = meta.Version
	var requiredHooks []string
	if meta.HasTaskPart() {
		requiredHooks = []string{"buildSubmitRequest", "parseSubmitResponse", "parseTaskResult"}
		if slices.Contains(meta.SubmitResponseTypes, "sse") {
			if UsesSubmitEventDelta(meta, engine) {
				requiredHooks = append(requiredHooks, "parseSubmitEventDelta")
			} else {
				requiredHooks = append(requiredHooks, "parseSubmitEvent")
			}
		}
		if meta.FetchMode == "batch" {
			requiredHooks = append(requiredHooks, "buildBatchQueryRequest", "parseBatchResult")
		} else {
			requiredHooks = append(requiredHooks, "buildQueryRequest")
		}
	}
	for _, hook := range requiredHooks {
		has, hasErr := engine.HasCallablePath(context.Background(), hook)
		if hasErr != nil {
			return nil, hasErr
		}
		if !has {
			return nil, fmt.Errorf("plugin %s is missing required export %q", meta.Key, hook)
		}
	}
	artifactHooks := make(map[string]bool, 2)
	for _, hook := range []string{"listArtifacts", "buildContentRequest"} {
		if !engine.HasExport(hook) {
			continue
		}
		callable, callableErr := engine.HasCallablePath(context.Background(), hook)
		if callableErr != nil {
			return nil, callableErr
		}
		if !callable {
			return nil, fmt.Errorf("plugin %s export %q is not a function", meta.Key, hook)
		}
		artifactHooks[hook] = true
	}
	if artifactHooks["listArtifacts"] != artifactHooks["buildContentRequest"] {
		return nil, fmt.Errorf("plugin %s must export listArtifacts and buildContentRequest together", meta.Key)
	}
	for _, route := range meta.Routes {
		for kind, member := range map[string]string{"decode": route.Decode, "render": route.Render} {
			if member == "" {
				continue
			}
			has, hasErr := engine.HasCallablePath(context.Background(), "native", member)
			if hasErr != nil {
				return nil, hasErr
			}
			if !has {
				return nil, fmt.Errorf("plugin %s route %s %s references missing native %s %q", meta.Key, route.Method, route.Path, kind, member)
			}
		}
	}
	for _, claim := range meta.Protocols {
		protocol := claim.Name
		definition, _ := HostProtocol(protocol)
		required := make(map[string]struct{})
		allowed := make(map[string]struct{})
		modeHookUsers := make(map[string][]string)
		for _, operation := range definition.Operations {
			for _, hook := range operation.RequiredProtocolMembers {
				required[hook] = struct{}{}
				allowed[hook] = struct{}{}
			}
			for _, mode := range operation.Modes {
				allowed[mode.Hook] = struct{}{}
				if !slices.Contains(modeHookUsers[mode.Hook], mode.Name) {
					modeHookUsers[mode.Hook] = append(modeHookUsers[mode.Hook], mode.Name)
				}
				if slices.Contains(claim.Supports, mode.Name) {
					required[mode.Hook] = struct{}{}
				}
			}
			for _, hook := range operation.RequiredDriverHooks {
				has, hasErr := engine.HasCallablePath(context.Background(), hook)
				if hasErr != nil {
					return nil, hasErr
				}
				if !has {
					return nil, fmt.Errorf("plugin %s protocol %q is missing driver hook %q", meta.Key, protocol, hook)
				}
			}
		}
		requiredHooks := make([]string, 0, len(required))
		for hook := range required {
			requiredHooks = append(requiredHooks, hook)
		}
		sort.Strings(requiredHooks)
		for _, hook := range requiredHooks {
			has, hasErr := engine.HasCallablePath(context.Background(), "protocols", protocol, hook)
			if hasErr != nil {
				return nil, hasErr
			}
			if !has {
				if users := modeHookUsers[hook]; len(users) > 0 {
					mentioned := ""
					for _, name := range claim.Supports {
						if slices.Contains(users, name) {
							mentioned = name
							break
						}
					}
					suggested := make([]string, 0)
					for _, mode := range definition.DefinedModes() {
						exported, exportedErr := engine.HasCallablePath(context.Background(), "protocols", protocol, mode.Hook)
						if exportedErr != nil {
							return nil, exportedErr
						}
						if exported && !slices.Contains(suggested, mode.Name) {
							suggested = append(suggested, mode.Name)
						}
					}
					message := fmt.Sprintf("plugin %s protocol %q supports %q but does not export protocols.%s.%s; implement it", meta.Key, protocol, mentioned, protocol, hook)
					if len(suggested) > 0 {
						message += fmt.Sprintf(" or declare supports: [%s]", quotedJoin(suggested, ", "))
					}
					return nil, errors.New(message)
				}
				return nil, fmt.Errorf("plugin %s protocol %q is missing hook %q", meta.Key, protocol, hook)
			}
		}
		seenModeHook := make(map[string]struct{})
		for _, operation := range definition.Operations {
			for _, mode := range operation.Modes {
				if _, seen := seenModeHook[mode.Hook]; seen {
					continue
				}
				seenModeHook[mode.Hook] = struct{}{}
				if _, need := required[mode.Hook]; need {
					continue
				}
				has, hasErr := engine.HasCallablePath(context.Background(), "protocols", protocol, mode.Hook)
				if hasErr != nil {
					return nil, hasErr
				}
				if has {
					return nil, fmt.Errorf("plugin %s protocol %q exports protocols.%s.%s but no supported mode uses it; add %s to supports or remove the hook", meta.Key, protocol, protocol, mode.Hook, quotedJoin(modeHookUsers[mode.Hook], " or "))
				}
			}
		}
		protocolValue, exportErr := engine.Export(context.Background(), "protocols")
		if exportErr != nil {
			return nil, exportErr
		}
		protocolObject, ok := protocolValue.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("plugin %s export protocols must be an object", meta.Key)
		}
		implementation, ok := protocolObject[protocol].(map[string]any)
		if !ok {
			return nil, fmt.Errorf("plugin %s protocol %q must be an object", meta.Key, protocol)
		}
		for member := range implementation {
			if _, accepted := allowed[member]; !accepted {
				return nil, fmt.Errorf("plugin %s protocol %q has unsupported member %q", meta.Key, protocol, member)
			}
		}
	}
	if protocolsValue, exportErr := engine.Export(context.Background(), "protocols"); exportErr == nil {
		if protocolsObject, ok := protocolsValue.(map[string]any); ok {
			claimed := make(map[string]struct{}, len(meta.Protocols))
			for _, claim := range meta.Protocols {
				claimed[claim.Name] = struct{}{}
			}
			for name := range protocolsObject {
				if _, ok := claimed[name]; !ok {
					return nil, fmt.Errorf("plugin %s implements unclaimed protocol %q", meta.Key, name)
				}
			}
		}
	}
	for _, removed := range []string{"resolveRequest", "renderError", "renderers"} {
		if engine.HasExport(removed) {
			return nil, fmt.Errorf("plugin %s export %q is no longer supported", meta.Key, removed)
		}
	}
	if err = validateProviderHooks(meta, engine); err != nil {
		return nil, err
	}
	return &LoadedPlugin{Meta: meta, Engine: engine}, nil
}

// taskOnlyMetaFields are the manifest fields only a task part reads.
var taskOnlyMetaFields = []string{"routes", "protocols", "fetchMode", "submitResponseTypes", "usageSchema", "usageExamples", "usageProfiles", "auth", "channelTypes", "upstreams"}

// ProviderHooks are the optional credential, relay and channel exports of a
// plugin.
var ProviderHooks = []string{"login", "refresh", "revoke", "signRequest", "prepareRequest", "credentialRejected", "convertRequest", "convertResponse", "convertStreamEvent", "exchangeKey", "checkKey", "buildBalanceRequest", "parseBalance", "scheduled"}

var providerConvertHooks = []string{"convertRequest", "convertResponse", "convertStreamEvent"}

// relayOnlyHooks act on relay requests, so only a plugin with meta.relay may
// export them. The credential hooks serve the task part as well.
var relayOnlyHooks = []string{"prepareRequest", "credentialRejected", "convertRequest", "convertResponse", "convertStreamEvent"}

func validateProviderHooks(meta Meta, engine *Engine) error {
	exported := make(map[string]bool, len(ProviderHooks))
	for _, hook := range ProviderHooks {
		if !engine.HasExport(hook) {
			continue
		}
		callable, err := engine.HasCallablePath(context.Background(), hook)
		if err != nil {
			return err
		}
		if !callable {
			return fmt.Errorf("plugin %s export %q is not a function", meta.Key, hook)
		}
		if !meta.HasProviderPart() && slices.Contains(relayOnlyHooks, hook) {
			return fmt.Errorf("plugin %s exports %s, which needs meta.relay routes", meta.Key, hook)
		}
		if !meta.HasProviderPart() && !meta.HasTaskPart() {
			return fmt.Errorf("plugin %s exports %s, which needs a task part or meta.relay routes", meta.Key, hook)
		}
		exported[hook] = true
	}
	// The model list route only reads a reply, so it needs convertResponse
	// alone; every other plugin-converter route needs all three.
	usesConverter, relaysConverter := false, false
	for _, route := range meta.Relay {
		if _, hooks := SplitProviderConverter(route.Converter); hooks {
			usesConverter = true
			relaysConverter = relaysConverter || strings.TrimSpace(route.IncomingPath) != dto.AdvancedCustomModelListPath
		}
	}
	for _, hook := range providerConvertHooks {
		needed := relaysConverter || (usesConverter && hook == "convertResponse")
		if needed && !exported[hook] {
			return fmt.Errorf("plugin %s relay routes use converter %q but the plugin does not export %s", meta.Key, ProviderConverter, hook)
		}
		if !needed && exported[hook] {
			return fmt.Errorf("plugin %s exports %s but no relay route that calls it uses converter %q", meta.Key, hook, ProviderConverter)
		}
	}
	return nil
}

func (r *Registry) Get(platform string) (*LoadedPlugin, bool) {
	return r.Generation().Get(platform)
}

// GetIgnoringMasterSwitch returns the plugin of key as Get does, and with
// the master switch off, the enabled plugin the switch leaves out. Request
// processing looks plugins up with it: the master switch covers task and
// provider plugin channels only, while a plugin switched off on its own stays
// off.
func (r *Registry) GetIgnoringMasterSwitch(key string) (*LoadedPlugin, bool) {
	if plugin, ok := r.Get(key); ok {
		return plugin, true
	}
	switchedOff := r.switchedOff.Load()
	if switchedOff == nil {
		return nil, false
	}
	plugin, ok := (*switchedOff)[key]
	return plugin, ok
}

func (r *Registry) GetByChannelType(channelType int) (*LoadedPlugin, bool) {
	return r.Generation().GetByChannelType(channelType)
}

// Enabled reports the master switch position. When false the published
// routing generation contains no plugins regardless of the other layers;
// GetIgnoringMasterSwitch still finds the enabled ones.
func (r *Registry) Enabled() bool {
	return r.masterEnabled.Load()
}

func (r *Registry) SetEnabled(enabled bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.masterEnabled.Load() == enabled {
		return
	}
	previous := r.masterEnabled.Load()
	r.masterEnabled.Store(enabled)
	var retainCurrent map[string]struct{}
	if enabled {
		retainCurrent = pluginMapKeys(r.override)
	}
	generation, routingErrors, err := r.prepareGeneration(filterDisabledFactory(r.factory, r.disabledFactory), r.override, true, retainCurrent)
	if err != nil {
		r.masterEnabled.Store(previous)
		r.recordRebuildFailure(err)
		return
	}
	r.publishGeneration(generation, routingErrors, r.resolveActiveOverrides(generation, r.override))
}

func (r *Registry) SetDisabledFactoryKeys(keys []string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	next := make(map[string]struct{}, len(keys))
	for _, key := range keys {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		next[key] = struct{}{}
	}
	if len(next) == len(r.disabledFactory) {
		same := true
		for key := range next {
			if _, ok := r.disabledFactory[key]; !ok {
				same = false
				break
			}
		}
		if same {
			return
		}
	}

	retainCurrent := pluginMapKeys(r.override)
	generation, routingErrors, err := r.prepareGeneration(filterDisabledFactory(r.factory, next), r.override, true, retainCurrent)
	if err != nil {
		r.recordRebuildFailure(err)
		return
	}
	r.disabledFactory = next
	r.publishGeneration(generation, routingErrors, r.resolveActiveOverrides(generation, r.override))
}

func (r *Registry) Unregister(key string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.override[key]; !exists {
		return nil
	}
	overridePlugins := clonePluginMap(r.override)
	delete(overridePlugins, key)
	retainCurrent := pluginMapKeys(overridePlugins)
	generation, routingErrors, err := r.prepareGeneration(filterDisabledFactory(r.factory, r.disabledFactory), overridePlugins, true, retainCurrent)
	if err != nil {
		r.recordRebuildFailure(err)
		return err
	}
	r.override = overridePlugins
	r.publishGeneration(generation, routingErrors, r.resolveActiveOverrides(generation, overridePlugins))
	return nil
}

// ReplaceOverrides atomically publishes a complete override layer.
func (r *Registry) ReplaceOverrides(plugins []*LoadedPlugin) error {
	overridePlugins := make(map[string]*LoadedPlugin, len(plugins))
	for _, plugin := range plugins {
		if plugin == nil {
			return fmt.Errorf("cannot publish a nil plugin")
		}
		if _, exists := overridePlugins[plugin.Meta.Key]; exists {
			return fmt.Errorf("duplicate override plugin key %q", plugin.Meta.Key)
		}
		overridePlugins[plugin.Meta.Key] = plugin
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	if samePluginMap(r.override, overridePlugins) {
		return nil
	}
	retainCurrent := pluginMapKeys(overridePlugins)
	generation, routingErrors, err := r.prepareGeneration(filterDisabledFactory(r.factory, r.disabledFactory), overridePlugins, true, retainCurrent)
	if err != nil {
		r.recordRebuildFailure(err)
		return err
	}
	r.override = overridePlugins
	r.publishGeneration(generation, routingErrors, r.resolveActiveOverrides(generation, overridePlugins))
	return nil
}

func (r *Registry) Generation() *RoutingGeneration {
	return r.generation.Load()
}

func (r *Registry) OverridePlugins() map[string]*LoadedPlugin {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return clonePluginMap(r.override)
}

func (r *Registry) ActiveOverridePlugins() map[string]*LoadedPlugin {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return clonePluginMap(r.activeOverride)
}

func (r *Registry) SetGenerationPreparer(preparer RoutingGenerationPreparer) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	previous := r.preparer
	r.preparer = preparer
	retainCurrent := pluginMapKeys(r.override)
	generation, routingErrors, err := r.prepareGeneration(filterDisabledFactory(r.factory, r.disabledFactory), r.override, true, retainCurrent)
	if err != nil {
		r.preparer = previous
		r.recordRebuildFailure(err)
		return err
	}
	r.publishGeneration(generation, routingErrors, r.resolveActiveOverrides(generation, r.override))
	return nil
}

func (r *Registry) RoutingErrors() map[string]string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	errorsCopy := make(map[string]string, len(r.routingErrors))
	maps.Copy(errorsCopy, r.routingErrors)
	return errorsCopy
}

func (r *Registry) LastRebuildError() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.lastRebuildErr
}

func (r *Registry) LastRebuildOutcome() RoutingRebuildOutcome {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.lastRebuild
}

func (r *Registry) RoutingStatus() RoutingStatus {
	r.mu.RLock()
	defer r.mu.RUnlock()
	errorsCopy := make(map[string]string, len(r.routingErrors))
	maps.Copy(errorsCopy, r.routingErrors)
	return RoutingStatus{
		Generation:  r.generation.Load(),
		LastRebuild: r.lastRebuild,
		Errors:      errorsCopy,
	}
}

func (r *Registry) prepareGeneration(
	factory, override map[string]*LoadedPlugin,
	tolerateConflicts bool,
	retainCurrent map[string]struct{},
) (*RoutingGeneration, map[string]string, error) {
	if !r.masterEnabled.Load() {
		factory = map[string]*LoadedPlugin{}
		override = map[string]*LoadedPlugin{}
	}
	current := r.generation.Load()
	number := uint64(1)
	if current != nil {
		number = current.Number + 1
	}
	var (
		generation    *RoutingGeneration
		routingErrors map[string]string
		err           error
	)
	if tolerateConflicts {
		generation, routingErrors, err = buildRoutingGenerationAdmitting(factory, override, number, current, retainCurrent)
	} else {
		generation, err = buildRoutingGeneration(factory, override, number)
		routingErrors = make(map[string]string)
	}
	if err != nil {
		return nil, nil, err
	}
	// The preparer decides admission by whether a key is built in, which the
	// filtered factory passed here no longer tells for a switched-off key.
	generation.factoryKeys = pluginMapKeys(r.factory)
	for key := range factory {
		generation.factoryKeys[key] = struct{}{}
	}
	if r.preparer != nil {
		prepared, prepareErr := r.preparer(generation, current)
		if prepareErr != nil {
			return nil, nil, prepareErr
		}
		if prepared.Generation == nil {
			return nil, nil, fmt.Errorf("routing generation preparer returned a nil generation")
		}
		if prepared.Generation.Number != generation.Number {
			return nil, nil, fmt.Errorf("routing generation preparer changed generation number from %d to %d", generation.Number, prepared.Generation.Number)
		}
		generation = prepared.Generation
		maps.Copy(routingErrors, prepared.Errors)
	}
	return generation, routingErrors, nil
}

func (r *Registry) publishGeneration(
	generation *RoutingGeneration,
	routingErrors map[string]string,
	activeOverride map[string]*LoadedPlugin,
) {
	previous := r.generation.Load()
	var previousNumber uint64
	if previous != nil {
		previousNumber = previous.Number
	}
	r.routingErrors = routingErrors
	r.activeOverride = activeOverride
	// Every caller updated the layers before publishing.
	var switchedOff *map[string]*LoadedPlugin
	if !r.masterEnabled.Load() {
		plugins := effectivePlugins(filterDisabledFactory(r.factory, r.disabledFactory), r.override)
		switchedOff = &plugins
	}
	r.switchedOff.Store(switchedOff)
	r.lastRebuildErr = ""
	status := "success"
	if len(routingErrors) > 0 {
		status = "partial"
	}
	r.lastRebuild = RoutingRebuildOutcome{
		Status:      status,
		AttemptedAt: time.Now(),
		Generation:  generation.Number,
	}
	r.generation.Store(generation)
	logger.LogDebug(
		context.Background(),
		"task_plugin subsystem=registry event=publish previous_generation=%d generation=%d status=%q plugins=%d routes=%d endpoint_bindings=%d channel_types=%d active_overrides=%d rejected=%d",
		previousNumber,
		generation.Number,
		status,
		len(generation.plugins),
		len(generation.routes),
		len(generation.protocolIndex),
		len(generation.byChannelType),
		len(activeOverride),
		len(routingErrors),
	)
	if len(routingErrors) > 0 {
		keys := make([]string, 0, len(routingErrors))
		for key := range routingErrors {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			logger.LogDebug(
				context.Background(),
				"task_plugin subsystem=registry event=plugin_rejected generation=%d plugin=%q reason=generation_admission_failed admission_reason=%q",
				generation.Number,
				key,
				taskPluginRoutingDebugReason(routingErrors[key]),
			)
		}
	}
}

func (r *Registry) recordRebuildFailure(err error) {
	r.lastRebuildErr = err.Error()
	generation := r.generation.Load()
	var generationNumber uint64
	if generation != nil {
		generationNumber = generation.Number
	}
	r.lastRebuild = RoutingRebuildOutcome{
		Status:      "failed",
		AttemptedAt: time.Now(),
		Generation:  generationNumber,
		Error:       err.Error(),
	}
	logger.LogDebug(
		context.Background(),
		"task_plugin subsystem=registry event=publish_failed retained_generation=%d retained_generation_active=true reason=%q",
		generationNumber,
		taskPluginRoutingDebugReason(err.Error()),
	)
}

func taskPluginRoutingDebugReason(message string) string {
	lower := strings.ToLower(message)
	switch {
	case strings.Contains(lower, "channeltype"), strings.Contains(lower, "channel type"):
		return "channel_type_conflict"
	case strings.Contains(lower, "endpoint"):
		return "endpoint_conflict"
	case strings.Contains(lower, "inner gin"), strings.Contains(lower, "rebuilding public routes"):
		return "inner_router_build_failed"
	case strings.Contains(lower, "trusted prox"):
		return "trusted_proxy_configuration_failed"
	case strings.Contains(lower, "route"):
		return "route_conflict"
	case strings.Contains(lower, "nil generation"), strings.Contains(lower, "generation number"):
		return "invalid_prepared_generation"
	default:
		return "generation_rebuild_failed"
	}
}

func (r *Registry) Snapshot() RegistrySnapshot {
	r.mu.RLock()
	defer r.mu.RUnlock()

	snapshot := RegistrySnapshot{
		Factory:         make([]Meta, 0, len(r.factory)),
		Override:        make([]Meta, 0, len(r.override)),
		DisabledFactory: make([]string, 0, len(r.disabledFactory)),
	}
	for _, plugin := range r.factory {
		snapshot.Factory = append(snapshot.Factory, cloneMeta(plugin.Meta))
	}
	for _, plugin := range r.override {
		snapshot.Override = append(snapshot.Override, cloneMeta(plugin.Meta))
	}
	for key := range r.disabledFactory {
		snapshot.DisabledFactory = append(snapshot.DisabledFactory, key)
	}
	sort.Slice(snapshot.Factory, func(i, j int) bool { return snapshot.Factory[i].Key < snapshot.Factory[j].Key })
	sort.Slice(snapshot.Override, func(i, j int) bool { return snapshot.Override[i].Key < snapshot.Override[j].Key })
	sort.Strings(snapshot.DisabledFactory)
	return snapshot
}

func cloneMeta(meta Meta) Meta {
	meta.SubmitResponseTypes = slices.Clone(meta.SubmitResponseTypes)
	meta.RequiredCapabilities = slices.Clone(meta.RequiredCapabilities)
	meta.ChannelTypes = append([]int(nil), meta.ChannelTypes...)
	meta.Models = append([]string(nil), meta.Models...)
	meta.AllowedHosts = append([]string(nil), meta.AllowedHosts...)
	meta.Upstreams = slices.Clone(meta.Upstreams)
	meta.Routes = append([]Route(nil), meta.Routes...)
	for index := range meta.Routes {
		meta.Routes[index].Models = append([]string(nil), meta.Routes[index].Models...)
	}
	meta.Protocols = append([]ProtocolClaim(nil), meta.Protocols...)
	for index := range meta.Protocols {
		meta.Protocols[index].Models = append([]string(nil), meta.Protocols[index].Models...)
		meta.Protocols[index].Supports = append([]string(nil), meta.Protocols[index].Supports...)
	}
	if meta.Description != nil {
		meta.Description = maps.Clone(meta.Description)
	}
	if meta.NameI18n != nil {
		meta.NameI18n = maps.Clone(meta.NameI18n)
	}
	if meta.KeyHint != nil {
		meta.KeyHint = maps.Clone(meta.KeyHint)
	}
	meta.UsageSchema = CloneUsageSchema(meta.UsageSchema)
	meta.UsageExamples = CloneUsageExamples(meta.UsageExamples)
	meta.UsageProfiles = append([]UsageProfile(nil), meta.UsageProfiles...)
	for index := range meta.UsageProfiles {
		profile := &meta.UsageProfiles[index]
		profile.Models = append([]string(nil), profile.Models...)
		profile.Schema = CloneUsageSchema(profile.Schema)
		profile.Examples = CloneUsageExamples(profile.Examples)
	}
	meta.Relay = cloneRelayRoutes(meta.Relay)
	meta.transformHooks = slices.Clone(meta.transformHooks)
	meta.Samples = slices.Clone(meta.Samples)
	for index := range meta.Samples {
		meta.Samples[index].Name = maps.Clone(meta.Samples[index].Name)
	}
	return meta
}

// CloneUsageSchema copies schema fields and localized metadata for independent readers.
func CloneUsageSchema(schema map[string]UsageFieldSchema) map[string]UsageFieldSchema {
	if schema == nil {
		return nil
	}
	cloned := make(map[string]UsageFieldSchema, len(schema))
	for key, field := range schema {
		if field.Enum != nil {
			field.Enum = append([]string{}, field.Enum...)
		}
		if field.Description != nil {
			field.Description = maps.Clone(field.Description)
		}
		field.UnitLabel = maps.Clone(field.UnitLabel)
		if field.EnumLabels != nil {
			labels := make(map[string]LocalizedText, len(field.EnumLabels))
			for value, label := range field.EnumLabels {
				labels[value] = maps.Clone(label)
			}
			field.EnumLabels = labels
		}
		cloned[key] = field
	}
	return cloned
}

// CloneUsageExamples copies example facts for independent readers.
func CloneUsageExamples(examples []UsageExample) []UsageExample {
	if examples == nil {
		return nil
	}
	cloned := make([]UsageExample, len(examples))
	for index, example := range examples {
		cloned[index] = UsageExample{Label: example.Label}
		if example.Facts == nil {
			continue
		}
		facts := make(map[string]any, len(example.Facts))
		maps.Copy(facts, example.Facts)
		cloned[index].Facts = facts
	}
	return cloned
}

func filterDisabledFactory(factory map[string]*LoadedPlugin, disabled map[string]struct{}) map[string]*LoadedPlugin {
	if len(disabled) == 0 {
		return factory
	}
	filtered := make(map[string]*LoadedPlugin, len(factory))
	for key, plugin := range factory {
		if _, skip := disabled[key]; skip {
			continue
		}
		filtered[key] = plugin
	}
	return filtered
}

func clonePluginMap(source map[string]*LoadedPlugin) map[string]*LoadedPlugin {
	clone := make(map[string]*LoadedPlugin, len(source))
	maps.Copy(clone, source)
	return clone
}

func samePluginMap(left, right map[string]*LoadedPlugin) bool {
	if len(left) != len(right) {
		return false
	}
	for key, plugin := range left {
		if right[key] != plugin {
			return false
		}
	}
	return true
}

func pluginMapKeys(plugins map[string]*LoadedPlugin) map[string]struct{} {
	keys := make(map[string]struct{}, len(plugins))
	for key := range plugins {
		keys[key] = struct{}{}
	}
	return keys
}

func (r *Registry) resolveActiveOverrides(
	generation *RoutingGeneration,
	override map[string]*LoadedPlugin,
) map[string]*LoadedPlugin {
	active := make(map[string]*LoadedPlugin)
	for _, plugin := range generation.plugins {
		desired, hasOverride := override[plugin.Meta.Key]
		if !hasOverride {
			continue
		}
		if plugin == desired || plugin == r.activeOverride[plugin.Meta.Key] {
			active[plugin.Meta.Key] = plugin
		}
	}
	return active
}

// UnknownMetaFieldError identifies a manifest field unsupported by this host.
type UnknownMetaFieldError struct {
	Field string
}

func (e *UnknownMetaFieldError) Error() string {
	return fmt.Sprintf("plugin meta has unknown field %q", e.Field)
}

func decodeMeta(value any) (Meta, error) {
	object, ok := value.(map[string]any)
	if !ok {
		return Meta{}, fmt.Errorf("plugin meta must be an object")
	}
	for field := range object {
		switch field {
		case "requiredCapabilities", "submitResponseTypes", "sortPriority", "website", "apiVersion", "key", "name", "icon", "description", "version", "author", "baseUrl", "channelTypes", "channelType", "compatibleChannelTypes", "models", "fetchMode", "allowedHosts", "upstreams", "routes", "protocols", "usageSchema", "usageExamples", "usageProfiles", "auth", "endpoints", "submitPaths", "actions", "relay", "configSchema", "optional", "samples", "channelConfig", "keyHint":
		default:
			return Meta{}, &UnknownMetaFieldError{Field: field}
		}
	}
	meta := Meta{}
	var err error
	meta.APIVersion, err = integerMetaField(object, "apiVersion")
	if err != nil {
		return Meta{}, err
	}
	if meta.Key, err = stringMetaField(object, "key"); err != nil {
		return Meta{}, err
	}
	if _, localized := object["name"].(map[string]any); localized {
		if meta.NameI18n, err = localizedTextMetaField(object, "name", maxMetaNameRunes); err != nil {
			return Meta{}, err
		}
		meta.Name = meta.NameI18n["en"]
	} else if meta.Name, err = stringMetaField(object, "name"); err != nil {
		return Meta{}, err
	}
	if meta.Icon, err = stringMetaField(object, "icon"); err != nil {
		return Meta{}, err
	}
	if meta.SortPriority, err = integerMetaField(object, "sortPriority"); err != nil {
		return Meta{}, err
	}
	if meta.Website, err = stringMetaField(object, "website"); err != nil {
		return Meta{}, err
	}
	meta.Icon = strings.TrimSpace(meta.Icon)
	if meta.Description, err = localizedTextMetaField(object, "description", maxMetaDescriptionRunes); err != nil {
		return Meta{}, err
	}
	if meta.KeyHint, err = localizedTextMetaField(object, "keyHint", maxMetaKeyHintRunes); err != nil {
		return Meta{}, err
	}
	if meta.Version, err = stringMetaField(object, "version"); err != nil {
		return Meta{}, err
	}
	author, ok := object["author"].(map[string]any)
	if !ok {
		return Meta{}, fmt.Errorf("plugin meta author must be an object")
	}
	for field := range author {
		if field != "name" && field != "url" {
			return Meta{}, fmt.Errorf("plugin meta author has unknown field %q", field)
		}
	}
	if meta.Author.Name, err = stringMetaField(author, "name"); err != nil {
		return Meta{}, err
	}
	if rawURL, exists := author["url"]; exists {
		meta.Author.URL, ok = rawURL.(string)
		if !ok {
			return Meta{}, fmt.Errorf("plugin meta author field %q must be a string", "url")
		}
	}
	if meta.BaseURL, err = stringMetaField(object, "baseUrl"); err != nil {
		return Meta{}, err
	}
	if _, exists := object["channelType"]; exists {
		return Meta{}, fmt.Errorf("plugin meta channelType is no longer supported; declare channelTypes instead")
	}
	if _, exists := object["compatibleChannelTypes"]; exists {
		return Meta{}, fmt.Errorf("plugin meta compatibleChannelTypes is no longer supported; declare channelTypes instead")
	}
	meta.ChannelTypes, err = integerSliceMetaField(object, "channelTypes")
	if err != nil {
		return Meta{}, err
	}
	if meta.FetchMode, err = stringMetaField(object, "fetchMode"); err != nil {
		return Meta{}, err
	}
	meta.SubmitResponseTypes = []string{"json"}
	if _, present := object["submitResponseTypes"]; present {
		meta.SubmitResponseTypes, err = strictStringSlice(object, "submitResponseTypes")
		if err != nil {
			return Meta{}, err
		}
		if len(meta.SubmitResponseTypes) == 0 {
			return Meta{}, fmt.Errorf("submitResponseTypes must not be empty")
		}
		seen := make(map[string]bool)
		for _, kind := range meta.SubmitResponseTypes {
			if (kind != "json" && kind != "sse") || seen[kind] {
				return Meta{}, fmt.Errorf("invalid or duplicate submitResponseTypes value %q", kind)
			}
			seen[kind] = true
		}
	}
	meta.RequiredCapabilities, err = strictStringSlice(object, "requiredCapabilities")
	if err != nil {
		return Meta{}, err
	}
	meta.Models, err = strictStringSlice(object, "models")
	if err != nil {
		return Meta{}, err
	}
	meta.AllowedHosts, err = strictStringSlice(object, "allowedHosts")
	if err != nil {
		return Meta{}, err
	}
	meta.Upstreams, err = strictStringSlice(object, "upstreams")
	if err != nil {
		return Meta{}, err
	}
	meta.Routes, err = decodeRoutes(object["routes"])
	if err != nil {
		return Meta{}, err
	}
	if _, exists := object["endpoints"]; exists {
		return Meta{}, fmt.Errorf("plugin meta endpoints is no longer supported; declare protocols by name")
	}
	meta.Protocols, err = decodeProtocolClaims(object, "protocols")
	if err != nil {
		return Meta{}, err
	}
	if usageSchema, exists := object["usageSchema"]; exists {
		meta.UsageSchema, err = decodeUsageSchema(usageSchema)
		if err != nil {
			return Meta{}, err
		}
	}
	if usageExamples, exists := object["usageExamples"]; exists {
		meta.UsageExamples, err = decodeUsageExamples(usageExamples)
		if err != nil {
			return Meta{}, err
		}
	}
	if usageProfiles, exists := object["usageProfiles"]; exists {
		meta.UsageProfiles, err = decodeUsageProfiles(usageProfiles)
		if err != nil {
			return Meta{}, err
		}
	}
	for _, removedField := range []string{"submitPaths", "actions"} {
		if _, exists := object[removedField]; exists {
			return Meta{}, fmt.Errorf("plugin meta %s is no longer supported; declare routes instead", removedField)
		}
	}
	if relay, exists := object["relay"]; exists {
		meta.Relay, err = decodeRelayRoutes(relay)
		if err != nil {
			return Meta{}, err
		}
	}
	if value, exists := object["optional"]; exists {
		if meta.Optional, ok = value.(bool); !ok {
			return Meta{}, fmt.Errorf("plugin meta optional must be a boolean")
		}
	}
	switch auth := object["auth"].(type) {
	case nil:
	case string:
		meta.Auth.Type = auth
	case map[string]any:
		for key := range auth {
			if key != "type" {
				return Meta{}, fmt.Errorf("plugin meta auth has unknown field %q", key)
			}
		}
		meta.Auth.Type, err = stringMetaField(auth, "type")
		if err != nil {
			return Meta{}, err
		}
	default:
		return Meta{}, fmt.Errorf("plugin meta auth must be a string or object")
	}
	meta.Auth.Type = strings.TrimSpace(meta.Auth.Type)
	if meta.Auth.Type == "vertex_oauth" {
		meta.Auth.Type = "oauth2_jwt"
	}
	if meta.Auth.Type != "" && meta.Auth.Type != "none" && meta.Auth.Type != "api_key" && meta.Auth.Type != "oauth2_jwt" {
		return Meta{}, fmt.Errorf("unsupported plugin auth type %q", meta.Auth.Type)
	}
	if meta.APIVersion != APIVersion1 {
		return Meta{}, fmt.Errorf("unsupported plugin apiVersion %d", meta.APIVersion)
	}
	if strings.TrimSpace(meta.Key) == "" || strings.TrimSpace(meta.Name) == "" || strings.TrimSpace(meta.Version) == "" {
		return Meta{}, fmt.Errorf("plugin meta key, name, and version are required")
	}
	if len(meta.Key) > 30 {
		return Meta{}, fmt.Errorf("plugin meta key must not exceed 30 characters")
	}
	return meta, nil
}

// ValidateV1Meta applies the metadata constraints published in
// docs/plugin-api/v1.schema.json to administrator uploads.
func ValidateV1Meta(meta Meta) error {
	meta = cloneMeta(meta)
	return normalizeV1Meta(&meta)
}

func normalizeV1Meta(meta *Meta) error {
	seenCapabilities := make(map[string]bool, len(meta.RequiredCapabilities))
	for _, name := range meta.RequiredCapabilities {
		if !HasCapability(name) || seenCapabilities[name] {
			return fmt.Errorf("unsupported or duplicate required capability %q", name)
		}
		if name == CapabilitySubmitSSEDelta && !slices.Contains(meta.SubmitResponseTypes, "sse") {
			return fmt.Errorf("%s requires submitResponseTypes to include sse", name)
		}
		seenCapabilities[name] = true
	}
	seenUpstreams := make(map[string]bool, len(meta.Upstreams))
	for _, kind := range meta.Upstreams {
		if (kind != UpstreamKindVendor && kind != UpstreamKindNewAPI) || seenUpstreams[kind] {
			return fmt.Errorf("unsupported or duplicate upstream kind %q", kind)
		}
		seenUpstreams[kind] = true
	}
	if meta.SortPriority < math.MinInt32 || meta.SortPriority > math.MaxInt32 {
		return fmt.Errorf("plugin meta sortPriority must be a signed 32-bit integer")
	}
	meta.Website = strings.TrimSpace(meta.Website)
	if meta.Website != "" {
		parsed, err := url.Parse(meta.Website)
		if err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" || parsed.User != nil || parsed.Opaque != "" {
			return fmt.Errorf("plugin meta website must be an absolute HTTPS URL without credentials")
		}
		for _, character := range meta.Website {
			if unicode.IsSpace(character) || unicode.IsControl(character) || character == '\\' {
				return fmt.Errorf("plugin meta website must not contain whitespace, control characters, or backslashes")
			}
		}
		host := strings.TrimSuffix(parsed.Hostname(), ".")
		if net.ParseIP(host) == nil {
			if len(host) > 253 || host == "" {
				return fmt.Errorf("plugin meta website must have a valid hostname")
			}
			for label := range strings.SplitSeq(host, ".") {
				if !websiteHostLabelPattern.MatchString(label) {
					return fmt.Errorf("plugin meta website must have a valid ASCII hostname; use punycode for internationalized domains")
				}
			}
		}
		if port := parsed.Port(); port != "" {
			number, err := strconv.Atoi(port)
			if err != nil || number < 0 || number > 65535 {
				return fmt.Errorf("plugin meta website has an invalid port")
			}
		}
	}
	if meta.APIVersion != APIVersion1 {
		return fmt.Errorf("unsupported plugin apiVersion %d", meta.APIVersion)
	}
	if strings.TrimSpace(meta.Name) == "" {
		return fmt.Errorf("plugin meta name is required")
	}
	meta.Icon = strings.TrimSpace(meta.Icon)
	if strings.HasPrefix(meta.Icon, "data:") || strings.Contains(meta.Icon, "://") {
		return fmt.Errorf("plugin meta icon must be a LobeHub icon name or text; ship an image logo as an icon.svg or icon.png file next to plugin.js instead")
	}
	if meta.Icon != "" {
		if utf8.RuneCountInString(meta.Icon) > 128 {
			return fmt.Errorf("plugin meta icon must not exceed 128 characters")
		}
		for _, character := range meta.Icon {
			if unicode.IsControl(character) {
				return fmt.Errorf("plugin meta icon must not contain control characters")
			}
		}
	}
	if meta.NameI18n != nil {
		if err := validateLocalizedText(meta.NameI18n, "name", maxMetaNameRunes); err != nil {
			return err
		}
	}
	if err := validateLocalizedText(meta.Description, "description", maxMetaDescriptionRunes); err != nil {
		return err
	}
	meta.Author.Name = strings.TrimSpace(meta.Author.Name)
	if meta.Author.Name == "" {
		return fmt.Errorf("plugin meta author name is required")
	}
	meta.Author.URL = strings.TrimSpace(meta.Author.URL)
	if meta.Author.URL != "" {
		parsedURL, err := url.Parse(meta.Author.URL)
		if err != nil || parsedURL.Host == "" || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
			return fmt.Errorf("plugin meta author url must be an absolute HTTP(S) URL")
		}
	}
	meta.BaseURL = strings.TrimSpace(meta.BaseURL)
	if meta.BaseURL != "" {
		normalized, err := normalizeMetaBaseURL(meta.BaseURL)
		if err != nil {
			return err
		}
		meta.BaseURL = normalized
	}
	if len(meta.Key) > 30 {
		return fmt.Errorf("plugin meta key must not exceed 30 characters")
	}
	if !ValidPluginKey(meta.Key) {
		return fmt.Errorf("plugin meta key must match %s", pluginKeyPattern)
	}
	// The host serves the plugin's routes under /{key}, so the key must not
	// name a host namespace.
	if meta.Key == "api" || slices.ContainsFunc(reservedRouteNamespaces, func(namespace string) bool {
		first, _, _ := strings.Cut(strings.TrimPrefix(namespace, "/"), "/")
		return first == meta.Key
	}) {
		return fmt.Errorf("plugin meta key %q is a reserved path segment", meta.Key)
	}
	if !pluginVersionPattern.MatchString(meta.Version) {
		return fmt.Errorf("plugin meta version must be semver")
	}
	if meta.HasTaskPart() {
		if meta.FetchMode != "per_task" && meta.FetchMode != "batch" {
			return fmt.Errorf("plugin meta fetchMode must be per_task or batch")
		}
		if len(meta.Models) == 0 {
			return fmt.Errorf("plugin meta models must contain at least one model")
		}
	}
	seenChannelTypes := make(map[int]struct{}, len(meta.ChannelTypes))
	for _, channelType := range meta.ChannelTypes {
		if channelType <= 0 {
			return fmt.Errorf("plugin meta channelTypes must contain positive channel types")
		}
		if channelType == constant.ChannelTypeTaskPlugin {
			return fmt.Errorf("plugin meta channelTypes must not contain the task plugin channel type")
		}
		if channelType == constant.ChannelTypeNewAPI {
			return fmt.Errorf("plugin meta channelTypes must not contain the New API channel type; bind the plugin through task_extend_plugin_keys instead")
		}
		if _, duplicate := seenChannelTypes[channelType]; duplicate {
			return fmt.Errorf("plugin meta channelTypes must be unique")
		}
		seenChannelTypes[channelType] = struct{}{}
	}
	models := make(map[string]struct{}, len(meta.Models))
	seenFold := make(map[string]struct{}, len(meta.Models))
	for _, model := range meta.Models {
		if strings.TrimSpace(model) == "" || strings.TrimSpace(model) != model {
			return fmt.Errorf("plugin meta models must contain non-empty canonical names")
		}
		folded := asciiFold(model)
		if _, exists := seenFold[folded]; exists {
			return fmt.Errorf("plugin meta models must be unique case-insensitively")
		}
		seenFold[folded] = struct{}{}
		models[model] = struct{}{}
	}
	hosts := make(map[string]struct{}, len(meta.AllowedHosts))
	for index, host := range meta.AllowedHosts {
		normalized, err := normalizeAllowedHost(host)
		if err != nil {
			return err
		}
		if _, exists := hosts[normalized]; exists {
			return fmt.Errorf("plugin meta allowedHosts must be unique")
		}
		hosts[normalized] = struct{}{}
		meta.AllowedHosts[index] = normalized
	}
	routeKeys := make(map[string]struct{}, len(meta.Routes))
	for index := range meta.Routes {
		if err := validateRoute(&meta.Routes[index]); err != nil {
			return err
		}
		for _, model := range meta.Routes[index].Models {
			if _, exists := models[model]; !exists {
				return fmt.Errorf("plugin route %s %s model %q is not declared in plugin meta models", meta.Routes[index].Method, meta.Routes[index].Path, model)
			}
		}
		shape, err := routePathShape(meta.Routes[index].Path)
		if err != nil {
			return err
		}
		key := meta.Routes[index].Method + " " + shape
		if _, exists := routeKeys[key]; exists {
			return fmt.Errorf("plugin meta routes contain duplicate route %s %s", meta.Routes[index].Method, meta.Routes[index].Path)
		}
		routeKeys[key] = struct{}{}
	}
	protocols := make(map[string]struct{}, len(meta.Protocols))
	for index := range meta.Protocols {
		claim := &meta.Protocols[index]
		definition, known := HostProtocol(claim.Name)
		modes := definition.DefinedModes()
		if len(modes) > 0 {
			modeNames := make([]string, len(modes))
			for modeIndex, mode := range modes {
				modeNames[modeIndex] = mode.Name
			}
			choosingFrom := quotedJoin(modeNames, ", ")
			if claim.Supports == nil {
				if claim.objectForm {
					return fmt.Errorf("plugin %s protocol %q must declare supports; add supports: [...] choosing from %s", meta.Key, claim.Name, choosingFrom)
				}
				return fmt.Errorf("plugin %s protocol %q must declare supports; replace the bare string with {name: %q, supports: [...]} choosing from %s", meta.Key, claim.Name, claim.Name, choosingFrom)
			}
			if len(claim.Supports) == 0 {
				return fmt.Errorf("plugin %s protocol %q supports must contain at least one of %s", meta.Key, claim.Name, choosingFrom)
			}
			seenSupports := make(map[string]struct{}, len(claim.Supports))
			for _, support := range claim.Supports {
				if _, duplicate := seenSupports[support]; duplicate {
					return fmt.Errorf("plugin %s protocol %q supports must be unique", meta.Key, claim.Name)
				}
				seenSupports[support] = struct{}{}
				if !slices.Contains(modeNames, support) {
					if support == "retrieve" {
						return fmt.Errorf("plugin %s protocol %q has no mode %q; retrieval of a created response is always available and is never declared", meta.Key, claim.Name, support)
					}
					return fmt.Errorf("plugin %s protocol %q has no mode %q", meta.Key, claim.Name, support)
				}
			}
			claim.Supports = orderProtocolSupports(claim.Name, claim.Supports)
		} else if claim.Supports != nil {
			return fmt.Errorf("plugin %s protocol %q does not define modes; supports is not allowed", meta.Key, claim.Name)
		}
		if !known {
			return fmt.Errorf("plugin meta protocol %q is unknown", claim.Name)
		}
		if _, duplicate := protocols[claim.Name]; duplicate {
			return fmt.Errorf("plugin meta protocols must be unique")
		}
		protocols[claim.Name] = struct{}{}
		if err := validateModelScope(claim.Models, fmt.Sprintf("protocol %q", claim.Name)); err != nil {
			return err
		}
		for _, model := range claim.Models {
			if _, exists := models[model]; !exists {
				return fmt.Errorf("plugin protocol %q model %q is not declared in plugin meta models", claim.Name, model)
			}
		}
	}
	if err := validateUsageSchema(meta.UsageSchema); err != nil {
		return err
	}
	if err := validateUsageExamples(meta.UsageSchema, meta.UsageExamples); err != nil {
		return err
	}
	profileModels := make(map[string]struct{})
	for index, profile := range meta.UsageProfiles {
		if len(profile.Models) == 0 {
			return fmt.Errorf("plugin meta usageProfiles[%d] models must contain at least one model", index)
		}
		if err := validateModelScope(profile.Models, fmt.Sprintf("usageProfiles[%d]", index)); err != nil {
			return err
		}
		for _, model := range profile.Models {
			if _, exists := models[model]; !exists {
				return fmt.Errorf("plugin meta usageProfiles[%d] model %q is not declared in plugin meta models", index, model)
			}
			if _, duplicate := profileModels[model]; duplicate {
				return fmt.Errorf("plugin meta usageProfiles model %q belongs to multiple profiles", model)
			}
			profileModels[model] = struct{}{}
		}
		if profile.Schema == nil {
			return fmt.Errorf("plugin meta usageProfiles[%d] schema must be an object", index)
		}
		if err := validateUsageSchema(profile.Schema); err != nil {
			return fmt.Errorf("plugin meta usageProfiles[%d]: %w", index, err)
		}
		if err := validateUsageExamples(profile.Schema, profile.Examples); err != nil {
			return fmt.Errorf("plugin meta usageProfiles[%d]: %w", index, err)
		}
	}
	return validateRelayRoutes(meta.Relay, meta.ChannelConfig)
}

// relayErrorNames renames Advanced Custom validation errors for manifests.
var relayErrorNames = strings.NewReplacer("advanced_custom.advanced_routes", "plugin meta relay", "advanced_routes[", "relay[")

var relayRouteFields = []string{"incoming_path", "upstream_path", "converter", "models", "auth", "pass_through_body_enabled"}

// decodeRelayRoutes reads meta.relay. Each route has exactly the keys of an
// Advanced Custom route.
func decodeRelayRoutes(value any) ([]dto.AdvancedCustomRoute, error) {
	items, ok := value.([]any)
	if !ok {
		return nil, fmt.Errorf("plugin meta relay must be an array")
	}
	routes := make([]dto.AdvancedCustomRoute, len(items))
	for index, item := range items {
		object, ok := item.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("plugin meta relay[%d] must be an object", index)
		}
		for field, fieldValue := range object {
			if !slices.Contains(relayRouteFields, field) {
				return nil, fmt.Errorf("plugin meta relay[%d] has unknown field %q", index, field)
			}
			if field != "auth" || fieldValue == nil {
				continue
			}
			auth, isObject := fieldValue.(map[string]any)
			if !isObject {
				return nil, fmt.Errorf("plugin meta relay[%d].auth must be an object", index)
			}
			for authField := range auth {
				if authField != "type" && authField != "name" && authField != "value" {
					return nil, fmt.Errorf("plugin meta relay[%d].auth has unknown field %q", index, authField)
				}
			}
		}
		encoded, err := common.Marshal(object)
		if err != nil {
			return nil, fmt.Errorf("plugin meta relay[%d]: %w", index, err)
		}
		if err = common.Unmarshal(encoded, &routes[index]); err != nil {
			return nil, fmt.Errorf("plugin meta relay[%d] has a member of the wrong type: %w", index, err)
		}
	}
	return routes, nil
}

// validateRelayRoutes applies the Advanced Custom route rules to meta.relay.
// A plugin-converter route is checked as a native route of its client
// endpoint, which must be one the plugin can convert, and a chained one as a
// route of its registered converter. An upstream_path that
// starts with {config.<name>} must name a url property of channelConfig and go
// on with nothing or a path; it is checked as a full URL.
func validateRelayRoutes(routes []dto.AdvancedCustomRoute, channelConfig *ConfigSchema) error {
	if len(routes) == 0 {
		return nil
	}
	config := dto.AdvancedCustomConfig{Routes: make([]dto.AdvancedCustomRoute, len(routes))}
	for index, route := range routes {
		if name, rest, ok := configAddressPath(route.UpstreamPath); ok || strings.HasPrefix(strings.TrimSpace(route.UpstreamPath), configAddressPrefix) {
			if !ok || !channelConfig.hasAddress(name) || (rest != "" && !strings.HasPrefix(rest, "/")) {
				return fmt.Errorf("plugin meta relay[%d].upstream_path must start with {config.<name>} naming a format url property of meta.channelConfig, followed by nothing or a path", index)
			}
			route.UpstreamPath = "https://config.invalid" + rest
		}
		if converter, hooks := SplitProviderConverter(route.Converter); hooks {
			if !providerConverterPath(route) {
				return fmt.Errorf("plugin meta relay[%d].converter %q does not support incoming_path %s", index, strings.TrimSpace(route.Converter), route.IncomingPath)
			}
			if route.PassThroughBodyEnabled {
				return fmt.Errorf("plugin meta relay[%d].pass_through_body_enabled requires converter none: %s", index, strings.TrimSpace(route.Converter))
			}
			if strings.TrimSpace(route.Converter) != ProviderConverter && (converter == "" || converter == "none" || converter == ProviderConverter) {
				return fmt.Errorf("plugin meta relay[%d].converter %q must chain a registered converter other than none", index, strings.TrimSpace(route.Converter))
			}
			route.Converter = converter
		}
		config.Routes[index] = route
	}
	if err := config.Validate(); err != nil {
		return errors.New(relayErrorNames.Replace(err.Error()))
	}
	return nil
}

// providerConverterPath reports whether the convert hooks can serve the client
// endpoint of route: every relayed one but realtime, which is a WebSocket
// session, and the model list, whose reply convertResponse converts. The
// balance path is a channel management request with no hook.
func providerConverterPath(route dto.AdvancedCustomRoute) bool {
	if strings.TrimSpace(route.IncomingPath) == dto.AdvancedCustomBalancePath {
		return false
	}
	config := dto.AdvancedCustomConfig{Routes: []dto.AdvancedCustomRoute{route}}
	_, realtime := config.MatchPath("/v1/realtime")
	return !realtime
}

func validateUsageSchema(schema map[string]UsageFieldSchema) error {
	for name, field := range schema {
		if strings.TrimSpace(name) == "" || strings.TrimSpace(name) != name {
			return fmt.Errorf("plugin meta usageSchema keys must be non-empty canonical names")
		}
		if err := validateUsageFieldSchema(name, field); err != nil {
			return err
		}
	}
	return nil
}

func decodeUsageProfiles(value any) ([]UsageProfile, error) {
	items, ok := value.([]any)
	if !ok {
		return nil, fmt.Errorf("plugin meta usageProfiles must be an array")
	}
	profiles := make([]UsageProfile, 0, len(items))
	for index, item := range items {
		object, ok := item.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("plugin meta usageProfiles[%d] must be an object", index)
		}
		for key := range object {
			if key != "models" && key != "schema" && key != "examples" {
				return nil, fmt.Errorf("plugin meta usageProfiles[%d] has unknown field %q", index, key)
			}
		}
		models, err := strictStringSlice(object, "models")
		if err != nil {
			return nil, fmt.Errorf("plugin meta usageProfiles[%d]: %w", index, err)
		}
		schema, err := decodeUsageSchema(object["schema"])
		if err != nil {
			return nil, fmt.Errorf("plugin meta usageProfiles[%d]: %w", index, err)
		}
		profile := UsageProfile{Models: models, Schema: schema}
		if examples, exists := object["examples"]; exists {
			profile.Examples, err = decodeUsageExamples(examples)
			if err != nil {
				return nil, fmt.Errorf("plugin meta usageProfiles[%d]: %w", index, err)
			}
		}
		profiles = append(profiles, profile)
	}
	return profiles, nil
}

func decodeUsageSchema(value any) (map[string]UsageFieldSchema, error) {
	if value == nil {
		return nil, fmt.Errorf("plugin meta usageSchema must be an object")
	}
	object, ok := value.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("plugin meta usageSchema must be an object")
	}
	schema := make(map[string]UsageFieldSchema, len(object))
	for name, rawField := range object {
		fieldObject, ok := rawField.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("plugin meta usageSchema field %q must be an object", name)
		}
		for key := range fieldObject {
			switch key {
			case "type", "unit", "unitLabel", "enum", "description", "enumLabels":
			default:
				return nil, fmt.Errorf("plugin meta usageSchema field %q has unknown property %q", name, key)
			}
		}
		field := UsageFieldSchema{}
		var err error
		if field.Type, err = stringMetaField(fieldObject, "type"); err != nil {
			return nil, err
		}
		if field.Unit, err = stringMetaField(fieldObject, "unit"); err != nil {
			return nil, err
		}
		if field.UnitLabel, err = localizedTextMetaField(fieldObject, "unitLabel", maxUsageFieldDescriptionRunes); err != nil {
			return nil, err
		}
		if field.Description, err = localizedTextMetaField(fieldObject, "description", maxUsageFieldDescriptionRunes); err != nil {
			return nil, err
		}
		if _, exists := fieldObject["enum"]; exists {
			if field.Enum, err = strictStringSlice(fieldObject, "enum"); err != nil {
				return nil, err
			}
		}
		if rawLabels, exists := fieldObject["enumLabels"]; exists {
			labels, ok := rawLabels.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("plugin meta usageSchema field %q enumLabels must be an object", name)
			}
			field.EnumLabels = make(map[string]LocalizedText, len(labels))
			for value := range labels {
				label, err := localizedTextMetaField(labels, value, maxUsageFieldDescriptionRunes)
				if err != nil {
					return nil, fmt.Errorf("plugin meta usageSchema field %q enumLabels: %w", name, err)
				}
				field.EnumLabels[value] = label
			}
		}
		if err = validateUsageFieldSchema(name, field); err != nil {
			return nil, err
		}
		schema[name] = field
	}
	return schema, nil
}

func validateUsageFieldSchema(name string, field UsageFieldSchema) error {
	if field.UnitLabel != nil {
		if field.Type != "number" || field.Unit != "count" || field.Enum != nil {
			return fmt.Errorf("plugin meta usageSchema field %q unitLabel requires a number field with count unit", name)
		}
		if err := validateLocalizedText(field.UnitLabel, fmt.Sprintf("usageSchema field %q unitLabel", name), maxUsageFieldDescriptionRunes); err != nil {
			return err
		}
	}
	if err := validateLocalizedText(field.Description, fmt.Sprintf("usageSchema field %q description", name), maxUsageFieldDescriptionRunes); err != nil {
		return err
	}
	if field.EnumLabels != nil && field.Enum == nil {
		return fmt.Errorf("plugin meta usageSchema field %q enumLabels requires enum", name)
	}
	if field.Enum != nil {
		if field.Type != "" || field.Unit != "" {
			return fmt.Errorf("plugin meta usageSchema field %q cannot combine enum with type or unit", name)
		}
		if len(field.Enum) == 0 {
			return fmt.Errorf("plugin meta usageSchema field %q enum must contain at least one value", name)
		}
		values := make(map[string]struct{}, len(field.Enum))
		for _, value := range field.Enum {
			if _, exists := values[value]; exists {
				return fmt.Errorf("plugin meta usageSchema field %q enum values must be unique", name)
			}
			values[value] = struct{}{}
		}
		for value, label := range field.EnumLabels {
			if _, exists := values[value]; !exists {
				return fmt.Errorf("plugin meta usageSchema field %q enumLabels has undeclared enum value %q", name, value)
			}
			if label == nil {
				return fmt.Errorf("plugin meta usageSchema field %q enumLabels value %q must include a non-empty label", name, value)
			}
			if err := validateLocalizedText(label, fmt.Sprintf("usageSchema field %q enumLabels value %q", name, value), maxUsageFieldDescriptionRunes); err != nil {
				return err
			}
		}
		return nil
	}
	if field.Type == "boolean" {
		if field.Unit != "" {
			return fmt.Errorf("plugin meta usageSchema field %q cannot combine boolean with unit", name)
		}
		return nil
	}
	if field.Type != "number" {
		return fmt.Errorf("plugin meta usageSchema field %q type must be number or boolean", name)
	}
	if field.Unit != "second" && field.Unit != "count" && field.Unit != "token" && field.Unit != "credit" {
		return fmt.Errorf("plugin meta usageSchema field %q unit must be second, count, token, or credit", name)
	}
	return nil
}

const maxUsageExamples = 16
const maxUsageExampleLabelRunes = 48

func decodeUsageExamples(value any) ([]UsageExample, error) {
	if value == nil {
		return nil, fmt.Errorf("plugin meta usageExamples must be an array")
	}
	items, ok := value.([]any)
	if !ok {
		return nil, fmt.Errorf("plugin meta usageExamples must be an array")
	}
	if len(items) > maxUsageExamples {
		return nil, fmt.Errorf("plugin meta usageExamples must not exceed %d entries", maxUsageExamples)
	}
	examples := make([]UsageExample, 0, len(items))
	for index, item := range items {
		object, ok := item.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("plugin meta usageExamples[%d] must be an object", index)
		}
		for key := range object {
			if key != "label" && key != "facts" {
				return nil, fmt.Errorf("plugin meta usageExamples[%d] has unknown field %q", index, key)
			}
		}
		label, err := stringMetaField(object, "label")
		if err != nil {
			return nil, fmt.Errorf("plugin meta usageExamples[%d] %w", index, err)
		}
		rawFacts, exists := object["facts"]
		if !exists || rawFacts == nil {
			return nil, fmt.Errorf("plugin meta usageExamples[%d] facts must be an object", index)
		}
		facts, ok := rawFacts.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("plugin meta usageExamples[%d] facts must be an object", index)
		}
		examples = append(examples, UsageExample{Label: label, Facts: facts})
	}
	return examples, nil
}

func usageSchemaHasTokenUnit(schema map[string]UsageFieldSchema) bool {
	for _, field := range schema {
		if field.Type == "number" && field.Unit == "token" {
			return true
		}
	}
	return false
}

func validateUsageExamples(schema map[string]UsageFieldSchema, examples []UsageExample) error {
	if len(examples) == 0 {
		if usageSchemaHasTokenUnit(schema) {
			return fmt.Errorf("plugin meta usageExamples is required when usageSchema declares a token unit")
		}
		return nil
	}
	if len(schema) == 0 {
		return fmt.Errorf("plugin meta usageExamples requires usageSchema")
	}
	if len(examples) > maxUsageExamples {
		return fmt.Errorf("plugin meta usageExamples must not exceed %d entries", maxUsageExamples)
	}
	for index := range examples {
		label := strings.TrimSpace(examples[index].Label)
		if label == "" {
			return fmt.Errorf("plugin meta usageExamples[%d] label is required", index)
		}
		if utf8.RuneCountInString(label) > maxUsageExampleLabelRunes {
			return fmt.Errorf("plugin meta usageExamples[%d] label must not exceed %d characters", index, maxUsageExampleLabelRunes)
		}
		examples[index].Label = label
		if examples[index].Facts == nil {
			return fmt.Errorf("plugin meta usageExamples[%d] facts must be an object", index)
		}
		for key := range schema {
			if _, exists := examples[index].Facts[key]; !exists {
				return fmt.Errorf("plugin meta usageExamples[%d] facts missing key %q", index, key)
			}
		}
		for key, value := range examples[index].Facts {
			field, declared := schema[key]
			if !declared {
				return fmt.Errorf("plugin meta usageExamples[%d] facts has undeclared key %q", index, key)
			}
			if err := validateUsageExampleValue(value, field); err != nil {
				return fmt.Errorf("plugin meta usageExamples[%d] facts field %q %s", index, key, err.Error())
			}
		}
	}
	return nil
}

func validateUsageExampleValue(value any, field UsageFieldSchema) error {
	if len(field.Enum) > 0 {
		text, ok := value.(string)
		if !ok {
			return fmt.Errorf("enum is not an allowed value")
		}
		if slices.Contains(field.Enum, text) {
			return nil
		}
		return fmt.Errorf("enum is not an allowed value")
	}
	if field.Type == "boolean" {
		if _, ok := value.(bool); !ok {
			return fmt.Errorf("must be a boolean")
		}
		return nil
	}
	number, ok := usageExampleNumber(value)
	if !ok {
		return fmt.Errorf("must be a finite non-negative number")
	}
	if math.IsNaN(number) || math.IsInf(number, 0) || number < 0 {
		return fmt.Errorf("must be a finite non-negative number")
	}
	limit := float64(relaycommon.MaxTaskDurationSeconds)
	if field.Unit == "count" {
		limit = float64(dto.MaxImageN)
	} else if field.Unit == "token" || field.Unit == "credit" {
		limit = float64(common.MaxQuota)
	}
	if number > limit {
		return fmt.Errorf("exceeds the host limit")
	}
	return nil
}

func usageExampleNumber(value any) (float64, bool) {
	switch number := value.(type) {
	case float64:
		return number, true
	case int64:
		return float64(number), true
	case int:
		return float64(number), true
	default:
		return 0, false
	}
}

func decodeRoutes(value any) ([]Route, error) {
	if value == nil {
		return []Route{}, nil
	}
	items, ok := value.([]any)
	if !ok {
		return nil, fmt.Errorf("plugin meta routes must be an array")
	}
	routes := make([]Route, 0, len(items))
	for index, item := range items {
		object, ok := item.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("plugin meta route %d must be an object", index)
		}
		if _, exists := object["renderer"]; exists {
			return nil, fmt.Errorf("plugin meta route %d field renderer is no longer supported", index)
		}
		for key := range object {
			switch key {
			case "method", "path", "type", "action", "decode", "render", "taskIdParam", "models", "retainResult":
			default:
				return nil, fmt.Errorf("plugin meta route %d has unknown field %q", index, key)
			}
		}
		route := Route{}
		var err error
		if route.Method, err = stringMetaField(object, "method"); err != nil {
			return nil, err
		}
		if route.Path, err = stringMetaField(object, "path"); err != nil {
			return nil, err
		}
		routeType, err := stringMetaField(object, "type")
		if err != nil {
			return nil, err
		}
		route.Type = RouteType(routeType)
		if route.Action, err = stringMetaField(object, "action"); err != nil {
			return nil, err
		}
		if route.Decode, err = stringMetaField(object, "decode"); err != nil {
			return nil, err
		}
		if route.Render, err = stringMetaField(object, "render"); err != nil {
			return nil, err
		}
		if route.TaskIDParam, err = stringMetaField(object, "taskIdParam"); err != nil {
			return nil, err
		}
		if _, exists := object["models"]; exists {
			if route.Models, err = strictStringSlice(object, "models"); err != nil {
				return nil, err
			}
			if len(route.Models) == 0 {
				return nil, fmt.Errorf("plugin meta route %d models must contain at least one model", index)
			}
		}
		if value, exists := object["retainResult"]; exists {
			retain, ok := value.(bool)
			if !ok {
				return nil, fmt.Errorf("plugin meta route %d retainResult must be a boolean", index)
			}
			route.RetainResult = &retain
		}
		routes = append(routes, route)
	}
	return routes, nil
}

// decodeProtocolClaims accepts both protocol entry shapes: a bare protocol
// name string (binds every meta.models entry) and an object {name, models,
// supports}. An absent key is empty; a present null or non-array is rejected.
// The supports key is decoded only when present so an absent key stays nil.
func decodeProtocolClaims(object map[string]any, name string) ([]ProtocolClaim, error) {
	value, exists := object[name]
	if !exists {
		return []ProtocolClaim{}, nil
	}
	items, ok := value.([]any)
	if !ok {
		return nil, fmt.Errorf("plugin meta %s must be an array", name)
	}
	claims := make([]ProtocolClaim, 0, len(items))
	for index, item := range items {
		switch entry := item.(type) {
		case string:
			claims = append(claims, ProtocolClaim{Name: entry})
		case map[string]any:
			for key := range entry {
				switch key {
				case "name", "models", "supports":
				default:
					return nil, fmt.Errorf("plugin meta protocol %d has unknown field %q", index, key)
				}
			}
			claim := ProtocolClaim{objectForm: true}
			var err error
			if claim.Name, err = stringMetaField(entry, "name"); err != nil {
				return nil, err
			}
			if _, exists := entry["models"]; exists {
				if claim.Models, err = strictStringSlice(entry, "models"); err != nil {
					return nil, err
				}
				if len(claim.Models) == 0 {
					return nil, fmt.Errorf("plugin meta protocol %d models must contain at least one model", index)
				}
			}
			if _, exists := entry["supports"]; exists {
				if claim.Supports, err = strictStringSlice(entry, "supports"); err != nil {
					return nil, err
				}
				claim.Supports = orderProtocolSupports(claim.Name, claim.Supports)
			}
			claims = append(claims, claim)
		default:
			return nil, fmt.Errorf("plugin meta protocol %d must be a string or an object", index)
		}
	}
	return claims, nil
}

func integerMetaField(object map[string]any, name string) (int, error) {
	value, exists := object[name]
	if !exists {
		return 0, nil
	}
	switch number := value.(type) {
	case int64:
		converted := int(number)
		if int64(converted) != number {
			return 0, fmt.Errorf("plugin meta %s is outside the supported integer range", name)
		}
		return converted, nil
	case float64:
		if math.IsNaN(number) || math.IsInf(number, 0) || math.Trunc(number) != number {
			return 0, fmt.Errorf("plugin meta %s must be an integer", name)
		}
		converted := int(number)
		if float64(converted) != number {
			return 0, fmt.Errorf("plugin meta %s is outside the supported integer range", name)
		}
		return converted, nil
	default:
		return 0, fmt.Errorf("plugin meta %s must be an integer", name)
	}
}

func integerSliceMetaField(object map[string]any, name string) ([]int, error) {
	value, exists := object[name]
	if !exists {
		return nil, nil
	}
	items, ok := value.([]any)
	if !ok {
		return nil, fmt.Errorf("plugin meta %s must be an array of integers", name)
	}
	numbers := make([]int, 0, len(items))
	for index, item := range items {
		element := map[string]any{name: item}
		number, err := integerMetaField(element, name)
		if err != nil {
			return nil, fmt.Errorf("plugin meta %s element %d must be an integer", name, index+1)
		}
		numbers = append(numbers, number)
	}
	return numbers, nil
}

// MaxMetaBaseURLLength bounds a normalized plugin default base URL. The value
// is persisted into channel.base_url, which the pinned MySQL driver creates as
// varchar(191); a longer default would store on SQLite and PostgreSQL but fail
// on MySQL.
const MaxMetaBaseURLLength = 191

// normalizeMetaBaseURL admits an absolute http(s) URL that a channel can adopt
// verbatim as its base URL: no credentials, query, or fragment, an ASCII
// lowercase host, and no trailing slash so plugins can concatenate paths.
func normalizeMetaBaseURL(raw string) (string, error) {
	for _, character := range raw {
		if unicode.IsSpace(character) || unicode.IsControl(character) {
			return "", fmt.Errorf("plugin meta baseUrl must not contain whitespace or control characters")
		}
	}
	if strings.ContainsAny(raw, "?#") {
		return "", fmt.Errorf("plugin meta baseUrl must not contain a query or fragment")
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Opaque != "" || parsed.Host == "" || parsed.Hostname() == "" {
		return "", fmt.Errorf("plugin meta baseUrl must be an absolute HTTP(S) URL")
	}
	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return "", fmt.Errorf("plugin meta baseUrl must use the http or https scheme")
	}
	if parsed.User != nil {
		return "", fmt.Errorf("plugin meta baseUrl must not contain credentials")
	}
	hostname := parsed.Hostname()
	for _, character := range hostname {
		if character > unicode.MaxASCII {
			return "", fmt.Errorf("plugin meta baseUrl host must be ASCII; use punycode for internationalized domains")
		}
	}
	host := strings.ToLower(hostname)
	if strings.Contains(host, ":") {
		host = "[" + host + "]"
	}
	if port := parsed.Port(); port != "" {
		host += ":" + port
	}
	normalized := scheme + "://" + host + strings.TrimRight(parsed.EscapedPath(), "/")
	if len(normalized) > MaxMetaBaseURLLength {
		return "", fmt.Errorf("plugin meta baseUrl must not exceed %d characters", MaxMetaBaseURLLength)
	}
	return normalized, nil
}

// normalizeAllowedHost accepts "host" or "host:port" (IPv6 literals bracketed)
// and rejects schemes, paths, credentials, and queries so the entry stays a
// pure host match for ValidateRequestURL.
func normalizeAllowedHost(raw string) (string, error) {
	entry := strings.TrimSpace(raw)
	if entry == "" || strings.ContainsAny(entry, "/?#@") {
		return "", fmt.Errorf("plugin meta allowedHosts must contain hostnames (optionally with a port) without schemes, paths, or credentials")
	}
	host, port := entry, ""
	if splitHost, splitPort, err := net.SplitHostPort(entry); err == nil {
		host, port = splitHost, splitPort
	} else if strings.HasPrefix(entry, "[") && strings.HasSuffix(entry, "]") {
		host = entry[1 : len(entry)-1]
	}
	if host == "" {
		return "", fmt.Errorf("plugin meta allowedHosts must contain hostnames (optionally with a port) without schemes, paths, or credentials")
	}
	for _, character := range host {
		if character > unicode.MaxASCII || unicode.IsSpace(character) || unicode.IsControl(character) {
			return "", fmt.Errorf("plugin meta allowedHosts must contain ASCII hostnames; use punycode for internationalized domains")
		}
	}
	host = strings.ToLower(host)
	if strings.Contains(host, ":") {
		if net.ParseIP(host) == nil {
			return "", fmt.Errorf("plugin meta allowedHosts entries must be host or host:port; IPv6 literals must be bracketed")
		}
		host = "[" + host + "]"
	}
	if port != "" {
		number, err := strconv.Atoi(port)
		if err != nil || number < 1 || number > 65535 {
			return "", fmt.Errorf("plugin meta allowedHosts port must be between 1 and 65535")
		}
		host += ":" + port
	}
	return host, nil
}

func stringMetaField(object map[string]any, name string) (string, error) {
	value, exists := object[name]
	if !exists {
		return "", nil
	}
	text, ok := value.(string)
	if !ok {
		return "", fmt.Errorf("plugin meta %s must be a string", name)
	}
	return text, nil
}

func localizedTextMetaField(object map[string]any, name string, maxRunes int) (LocalizedText, error) {
	value, exists := object[name]
	if !exists {
		return nil, nil
	}
	return decodeLocalizedText(value, "plugin meta "+name, maxRunes)
}

// decodeLocalizedText reads a string or locale object as LocalizedText;
// subject names it in errors.
func decodeLocalizedText(value any, subject string, maxRunes int) (LocalizedText, error) {
	var text LocalizedText
	switch typed := value.(type) {
	case string:
		text = LocalizedText{"en": typed}
	case map[string]any:
		text = make(LocalizedText, len(typed))
		for locale, raw := range typed {
			item, ok := raw.(string)
			if !ok {
				return nil, fmt.Errorf("%s locale %q must be a string", subject, locale)
			}
			text[locale] = item
		}
	default:
		return nil, fmt.Errorf("%s must be a string or object", subject)
	}
	if err := validateLocalizedTextNamed(text, subject, maxRunes); err != nil {
		return nil, err
	}
	return text, nil
}

func validateLocalizedText(text LocalizedText, name string, maxRunes int) error {
	return validateLocalizedTextNamed(text, "plugin meta "+name, maxRunes)
}

func validateLocalizedTextNamed(text LocalizedText, subject string, maxRunes int) error {
	if text == nil {
		return nil
	}
	if len(text) > maxLocalizedTextLocales {
		return fmt.Errorf("%s must not exceed %d locales", subject, maxLocalizedTextLocales)
	}
	canonical := make(map[string]string, len(text))
	for locale, value := range text {
		if !localeTagPattern.MatchString(locale) {
			return fmt.Errorf("%s has invalid locale %q", subject, locale)
		}
		canonicalLocale := canonicalLocaleTag(locale)
		if _, duplicate := canonical[canonicalLocale]; duplicate {
			return fmt.Errorf("%s has duplicate locale %q", subject, canonicalLocale)
		}
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return fmt.Errorf("%s value for %q must be a non-empty string", subject, locale)
		}
		for _, character := range trimmed {
			if unicode.IsControl(character) {
				return fmt.Errorf("%s value for %q must not contain control characters", subject, locale)
			}
		}
		if utf8.RuneCountInString(trimmed) > maxRunes {
			return fmt.Errorf("%s must not exceed %d characters", subject, maxRunes)
		}
		canonical[canonicalLocale] = trimmed
	}
	if strings.TrimSpace(canonical["en"]) == "" {
		return fmt.Errorf("%s must include a non-empty \"en\" value", subject)
	}
	for locale := range text {
		delete(text, locale)
	}
	maps.Copy(text, canonical)
	return nil
}

// canonicalLocaleTag applies BCP-47 case conventions so lookups can use
// exact matching: language lowercase, 2-letter region uppercase, 4-letter
// script title case (zh-tw -> zh-TW, EN -> en, zh-hans -> zh-Hans).
func canonicalLocaleTag(tag string) string {
	parts := strings.Split(tag, "-")
	parts[0] = strings.ToLower(parts[0])
	for index := 1; index < len(parts); index++ {
		switch len(parts[index]) {
		case 2:
			parts[index] = strings.ToUpper(parts[index])
		case 4:
			lowered := strings.ToLower(parts[index])
			parts[index] = strings.ToUpper(lowered[:1]) + lowered[1:]
		default:
			parts[index] = strings.ToLower(parts[index])
		}
	}
	return strings.Join(parts, "-")
}

func quotedJoin(items []string, sep string) string {
	parts := make([]string, len(items))
	for index, item := range items {
		parts[index] = fmt.Sprintf("%q", item)
	}
	return strings.Join(parts, sep)
}

func strictStringSlice(object map[string]any, name string) ([]string, error) {
	value, exists := object[name]
	if !exists {
		return []string{}, nil
	}
	items, ok := value.([]any)
	if !ok {
		return nil, fmt.Errorf("plugin meta %s must be an array of strings", name)
	}
	result := make([]string, 0, len(items))
	for _, item := range items {
		text, ok := item.(string)
		if !ok {
			return nil, fmt.Errorf("plugin meta %s must be an array of strings", name)
		}
		result = append(result, text)
	}
	return result, nil
}
