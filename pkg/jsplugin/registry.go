package jsplugin

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/logger"
)

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

func (r *Registry) PluginsByChannelType(channelType int) []*LoadedPlugin {
	return r.Generation().PluginsByChannelType(channelType)
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
		snapshot.Factory = append(snapshot.Factory, plugin.Meta.Clone())
	}
	for _, plugin := range r.override {
		snapshot.Override = append(snapshot.Override, plugin.Meta.Clone())
	}
	for key := range r.disabledFactory {
		snapshot.DisabledFactory = append(snapshot.DisabledFactory, key)
	}
	sort.Slice(snapshot.Factory, func(i, j int) bool { return snapshot.Factory[i].Key < snapshot.Factory[j].Key })
	sort.Slice(snapshot.Override, func(i, j int) bool { return snapshot.Override[i].Key < snapshot.Override[j].Key })
	sort.Strings(snapshot.DisabledFactory)
	return snapshot
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
