package jsplugin

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRegistryIndexesNativeRoutesAndProtocolsInOneGeneration(t *testing.T) {
	registry := NewRegistry()
	plugin, err := CompilePlugin(routingTestPluginSource(
		"routing-alpha",
		50,
		`["video-alpha"]`,
		`routes: [
			{method: "POST", path: "/vendor/videos", type: "submit", action: "generate", decode: "decodeVideo", render: "videoCreated"},
			{method: "GET", path: "/vendor/videos/:task_id", type: "query", render: "videoStatus"}
		],
		protocols: [{name: "openai_responses", supports: ["stream", "sync", "background"]}],`,
		`export const native = {
			decodeVideo: function(ctx) { return {kind: "submit", model: "video-alpha", requestBody: ctx.body.value}; },
			videoCreated: function(ctx, task) { return task; },
			videoStatus: function(ctx, task) { return task; }
		};
		export const protocols = {openai_responses: {
			decodeRequest: function(ctx) { return {kind: "submit", model: ctx.model, requestBody: ctx.body.value}; },
			renderEvents: function() { return {events: [], state: null, done: false}; },
			renderFinal: function(ctx, task) { return task; }
		}};`,
	), Options{})
	require.NoError(t, err)

	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{plugin}))
	generation := registry.Generation()
	assert.Equal(t, uint64(1), generation.Number)

	byKey, ok := generation.Get("routing-alpha")
	require.True(t, ok)
	assert.Same(t, plugin, byKey)
	assert.Equal(t, []*LoadedPlugin{plugin}, generation.PluginsByChannelType(50))
	byModel, ok := generation.GetByModel("video-alpha")
	require.True(t, ok)
	assert.Same(t, plugin, byModel)

	route, ok := generation.LookupDeclaredRoute("get", "/vendor/videos/:id")
	require.True(t, ok)
	assert.Equal(t, "routing-alpha", route.Plugin.Meta.Key)
	assert.Equal(t, "task_id", route.Route.TaskIDParam)

	endpoint, ok := generation.LookupEndpoint("POST", "/v1/responses", "video-alpha")
	require.True(t, ok)
	assert.Equal(t, "openai_responses", endpoint.Protocol)
	assert.Equal(t, []ProtocolBinding{endpoint}, generation.LookupEndpointCandidates("POST", "/v1/responses", "video-alpha"))
}

func TestRegistryIndexesSharedEndpointCandidatesForDistinctLegacyProviders(t *testing.T) {
	registry := NewRegistry()
	gemini := mustCompileRoutingPlugin(t, "gemini-provider", 24, `["shared-video"]`,
		`protocols: [{name: "openai_responses", supports: ["stream", "sync", "background"]}],`,
		routingProtocolExport("openai_responses"))
	vertex := mustCompileRoutingPlugin(t, "vertex-provider", 41, `["shared-video"]`,
		`protocols: [{name: "openai_responses", supports: ["stream", "sync", "background"]}],`,
		routingProtocolExport("openai_responses"))

	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{vertex, gemini}))
	candidates := registry.Generation().LookupEndpointCandidates("POST", "/v1/responses", "shared-video")
	require.Len(t, candidates, 2)
	assert.Equal(t, "gemini-provider", candidates[0].Plugin.Meta.Key)
	assert.Equal(t, "vertex-provider", candidates[1].Plugin.Meta.Key)
	assert.Empty(t, registry.RoutingErrors())
}

// The OpenAI Images protocol is claimed in bare-string form, binds both image
// endpoints for every declared model, and requires the render hook that shapes
// the synchronous response.
func TestOpenAIImageProtocolClaimBindsBothEndpointsAndRequiresRender(t *testing.T) {
	exports := `export const protocols = {openai_image: {
		decodeRequest: function(ctx) { return {kind: "submit", model: ctx.model, requestBody: ctx.body.value}; },
		render: function(ctx, task) { return {data: []}; }
	}};`
	registry := NewRegistry()
	plugin := mustCompileRoutingPlugin(t, "image-plugin", 17, `["image-a", "image-b"]`, `protocols: ["openai_image"],`, exports)
	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{plugin}))
	for _, path := range []string{"/v1/images/generations", "/v1/images/edits"} {
		for _, model := range []string{"image-a", "image-b"} {
			binding, ok := registry.Generation().LookupEndpoint(http.MethodPost, path, model)
			require.True(t, ok, path+" "+model)
			assert.Equal(t, ProtocolOpenAIImage, binding.Protocol)
			assert.Same(t, plugin, binding.Plugin)
		}
	}
	_, ok := registry.Generation().LookupEndpoint(http.MethodPost, "/v1/videos", "image-a")
	assert.False(t, ok, "an image claim must not bind the video endpoint")

	scoped := mustCompileRoutingPlugin(t, "image-scoped", 17, `["image-a", "image-b"]`, `protocols: [{name: "openai_image", models: ["image-a"]}],`, exports)
	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{scoped}))
	_, ok = registry.Generation().LookupEndpoint(http.MethodPost, "/v1/images/generations", "image-b")
	assert.False(t, ok, "models narrows the image endpoint bindings")

	_, err := CompilePlugin(routingTestPluginSource("image-no-render", 17, `["image-a"]`, `protocols: ["openai_image"],`,
		`export const protocols = {openai_image: {decodeRequest: function(ctx) { return {kind: "submit", model: ctx.model}; }}};`), Options{})
	require.ErrorContains(t, err, `missing hook "render"`)
	_, err = CompilePlugin(routingTestPluginSource("image-modes", 17, `["image-a"]`, `protocols: [{name: "openai_image", supports: ["sync"]}],`, exports), Options{})
	require.ErrorContains(t, err, "does not define modes")
}

func TestPerProtocolModelsNarrowEndpointBindings(t *testing.T) {
	registry := NewRegistry()
	plugin := mustCompileRoutingPlugin(t, "narrow-protocol", 50, `["gpt-5.5", "gpt-5.6"]`,
		`protocols: [{name: "openai_responses", models: ["gpt-5.5"], supports: ["stream", "sync", "background"]}],`,
		routingProtocolExport("openai_responses"))

	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{plugin}))
	generation := registry.Generation()

	bound, ok := generation.LookupEndpoint("POST", "/v1/responses", "gpt-5.5")
	require.True(t, ok)
	assert.Same(t, plugin, bound.Plugin)
	_, ok = generation.LookupEndpoint("POST", "/v1/responses", "gpt-5.6")
	assert.False(t, ok, "model outside the protocol claim must fall through to the Go relay")
	assert.Empty(t, generation.LookupEndpointCandidates("POST", "/v1/responses", "gpt-5.6"))
}

func TestPerProtocolModelsAllowDisjointPluginsOnSharedProtocol(t *testing.T) {
	registry := NewRegistry()
	left := mustCompileRoutingPlugin(t, "disjoint-left", 0, `["model-a"]`,
		`protocols: [{name: "openai_responses", models: ["model-a"], supports: ["stream", "sync", "background"]}],`,
		routingProtocolExport("openai_responses"))
	right := mustCompileRoutingPlugin(t, "disjoint-right", 0, `["model-b"]`,
		`protocols: [{name: "openai_responses", models: ["model-b"], supports: ["stream", "sync", "background"]}],`,
		routingProtocolExport("openai_responses"))

	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{left, right}))
	generation := registry.Generation()
	assert.Empty(t, registry.RoutingErrors())

	boundA, ok := generation.LookupEndpoint("POST", "/v1/responses", "model-a")
	require.True(t, ok)
	assert.Same(t, left, boundA.Plugin)
	boundB, ok := generation.LookupEndpoint("POST", "/v1/responses", "model-b")
	require.True(t, ok)
	assert.Same(t, right, boundB.Plugin)
}

func TestPreflightRoutingConflict(t *testing.T) {
	first := mustCompileRoutingPlugin(t, "preflight-first", 90, `["model-a"]`, "", "")
	second := mustCompileRoutingPlugin(t, "preflight-second", 0, `["MODEL-A"]`, "", "")
	replacement := mustCompileRoutingPlugin(t, "preflight-first", 90, `["model-a-v2"]`, "", "")
	sameType := mustCompileRoutingPlugin(t, "preflight-same-type", 90, `["model-b"]`, "", "")

	require.NoError(t, PreflightRoutingConflict(nil, first), "a lone candidate against a nil generation must be admitted")

	registry := NewRegistry()
	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{first}))
	current := registry.Generation()

	err := PreflightRoutingConflict(current, second)
	require.Error(t, err)
	assert.Contains(t, err.Error(), `plugin preflight-second model "MODEL-A" conflicts with plugin preflight-first`)

	require.NoError(t, PreflightRoutingConflict(current, replacement), "same-key re-upload must replace rather than self-conflict")
	require.NoError(t, PreflightRoutingConflict(current, sameType), "plugins may share a channel type")

	left := mustCompileRoutingPlugin(t, "preflight-left", 0, `["shared-model"]`,
		`protocols: [{name: "openai_responses", supports: ["stream", "sync", "background"]}],`,
		routingProtocolExport("openai_responses"))
	right := mustCompileRoutingPlugin(t, "preflight-right", 0, `["shared-model"]`,
		`protocols: [{name: "openai_responses", supports: ["stream", "sync", "background"]}],`,
		routingProtocolExport("openai_responses"))
	protocolRegistry := NewRegistry()
	require.NoError(t, protocolRegistry.ReplaceOverrides([]*LoadedPlugin{left}))
	require.NoError(t, PreflightRoutingConflict(protocolRegistry.Generation(), right))
}

func TestPerProtocolModelsAcceptSharedPluginClaims(t *testing.T) {
	for _, channelType := range []int{0, 24} {
		t.Run(fmt.Sprintf("first_channel_type_%d", channelType), func(t *testing.T) {
			registry := NewRegistry()
			first := mustCompileRoutingPlugin(t, "overlap-first", channelType, `["shared-model"]`,
				`protocols: [{name: "openai_responses", models: ["shared-model"], supports: ["stream", "sync", "background"]}],`, routingProtocolExport("openai_responses"))
			second := mustCompileRoutingPlugin(t, "overlap-second", 0, `["shared-model"]`,
				`protocols: [{name: "openai_responses", models: ["shared-model"], supports: ["stream", "sync", "background"]}],`, routingProtocolExport("openai_responses"))
			require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{second, first}))
			assert.Empty(t, registry.RoutingErrors())
			generation := registry.Generation()
			candidates := generation.LookupEndpointCandidates("POST", "/v1/responses", "shared-model")
			require.Len(t, candidates, 2)
			assert.Same(t, first, candidates[0].Plugin)
			assert.Same(t, second, candidates[1].Plugin)
			assert.Equal(t, []*LoadedPlugin{first, second}, generation.PluginsByModel("shared-model"))
			metadata, ok := generation.GetByModel("shared-model")
			require.True(t, ok)
			assert.Same(t, first, metadata)
			copy := generation.PluginsByModel("shared-model")
			copy[0] = nil
			assert.Same(t, first, generation.PluginsByModel("shared-model")[0])
		})
	}
}

func TestRegistryNoOpMutationsKeepCurrentGeneration(t *testing.T) {
	registry := NewRegistry()
	plugin := mustCompileRoutingPlugin(t, "stable-generation", 0, `["model"]`, "", "")
	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{plugin}))
	current := registry.Generation()

	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{plugin}))
	assert.Same(t, current, registry.Generation())

	require.NoError(t, registry.Unregister("missing"))
	assert.Same(t, current, registry.Generation())
}

func TestAdjacentNodeGenerationsKeepPinnedPluginExecutable(t *testing.T) {
	compileVersion := func(version string) *LoadedPlugin {
		source := fmt.Sprintf(`
export const meta = {
	apiVersion: 1, key: "adjacent-node", name: "Adjacent", version: %q,
	author: {name: "Test"},
	models: ["model"], fetchMode: "per_task"
};
export function buildSubmitRequest() { return {version: %q}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
`, version, version)
		plugin, err := CompilePlugin(source, Options{})
		require.NoError(t, err)
		return plugin
	}

	nodeA := NewRegistry()
	nodeB := NewRegistry()
	nodeAV1 := compileVersion("1.0.0")
	nodeBV1 := compileVersion("1.0.0")
	require.NoError(t, nodeA.ReplaceOverrides([]*LoadedPlugin{nodeAV1}))
	require.NoError(t, nodeB.ReplaceOverrides([]*LoadedPlugin{nodeBV1}))

	nodeAV2 := compileVersion("2.0.0")
	require.NoError(t, nodeA.ReplaceOverrides([]*LoadedPlugin{nodeAV2}))
	assert.Equal(t, nodeB.Generation().Number+1, nodeA.Generation().Number)

	pinned := PinnedPlugin{Generation: nodeB.Generation(), Plugin: nodeBV1}
	nodeBV2 := compileVersion("2.0.0")
	require.NoError(t, nodeB.ReplaceOverrides([]*LoadedPlugin{nodeBV2}))

	oldResult, err := pinned.Plugin.Engine.Call(context.Background(), "buildSubmitRequest")
	require.NoError(t, err)
	oldObject, ok := oldResult.(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "1.0.0", oldObject["version"])
	current, ok := nodeB.Get("adjacent-node")
	require.True(t, ok)
	newResult, err := current.Engine.Call(context.Background(), "buildSubmitRequest")
	require.NoError(t, err)
	newObject, ok := newResult.(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "2.0.0", newObject["version"])
	assert.Equal(t, uint64(1), pinned.Generation.Number)
	assert.Equal(t, uint64(2), nodeB.Generation().Number)
}

func TestRegistryReportsPartialAndFailedRebuildOutcomes(t *testing.T) {
	registry := NewRegistry()
	alpha := mustCompileRoutingPlugin(t, "outcome-alpha", 0, `["alpha"]`, "", "")
	beta := mustCompileRoutingPlugin(t, "outcome-beta", 0, `["ALPHA"]`, "", "")
	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{alpha, beta}))

	partial := registry.LastRebuildOutcome()
	assert.Equal(t, "partial", partial.Status)
	assert.Equal(t, registry.Generation().Number, partial.Generation)
	assert.Empty(t, partial.Error)

	err := registry.SetGenerationPreparer(func(_, _ *RoutingGeneration) (PreparedRoutingGeneration, error) {
		return PreparedRoutingGeneration{}, fmt.Errorf("runtime rebuild unavailable")
	})
	require.ErrorContains(t, err, "runtime rebuild unavailable")
	failed := registry.LastRebuildOutcome()
	assert.Equal(t, "failed", failed.Status)
	assert.Equal(t, registry.Generation().Number, failed.Generation)
	assert.Contains(t, failed.Error, "runtime rebuild unavailable")

	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{alpha}))
	success := registry.LastRebuildOutcome()
	assert.Equal(t, "success", success.Status)
	assert.Equal(t, registry.Generation().Number, success.Generation)
	assert.Empty(t, success.Error)
}

func TestRegistryExcludesConflictingPluginWithoutBlockingGeneration(t *testing.T) {
	tests := []struct {
		name          string
		first         *LoadedPlugin
		second        *LoadedPlugin
		expectedError string
	}{
		{
			name:          "model differing only in case",
			first:         mustCompileRoutingPlugin(t, "model-alpha", 0, `["alpha"]`, "", ""),
			second:        mustCompileRoutingPlugin(t, "model-beta", 0, `["ALPHA"]`, "", ""),
			expectedError: `model "ALPHA" conflicts with plugin model-alpha`,
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			registry := NewRegistry()
			require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{testCase.first}))
			before := registry.Generation()

			err := registry.ReplaceOverrides([]*LoadedPlugin{testCase.first, testCase.second})

			require.NoError(t, err)
			assert.Equal(t, before.Number+1, registry.Generation().Number)
			_, exists := registry.Get(testCase.second.Meta.Key)
			assert.False(t, exists)
			assert.Contains(t, registry.RoutingErrors()[testCase.second.Meta.Key], testCase.expectedError)
		})
	}
}

// Several plugins may declare a built-in channel type: each is admitted, and
// a channel of the type serves them in key order.
func TestPluginsShareChannelType(t *testing.T) {
	registry := NewRegistry()
	beta := mustCompileRoutingPlugin(t, "zhipu-beta", 0, `["glm-video"]`, `channelTypes: [26, 16],`, "")
	alpha := mustCompileRoutingPlugin(t, "zhipu-alpha", 26, `["cogview"]`, "", "")
	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{beta, alpha}))

	assert.Empty(t, registry.RoutingErrors())
	assert.Equal(t, []*LoadedPlugin{alpha, beta}, registry.PluginsByChannelType(26))
	assert.Equal(t, []*LoadedPlugin{beta}, registry.PluginsByChannelType(16))
	assert.Empty(t, registry.PluginsByChannelType(1))
}

func TestRegistryRetainsIncumbentWhenUpdatedPluginConflicts(t *testing.T) {
	registry := NewRegistry()
	incumbent := mustCompileRoutingPlugin(t, "incumbent", 70, `["model-v1"]`, "", "")
	other := mustCompileRoutingPlugin(t, "other", 71, `["other-model"]`, "", "")
	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{incumbent, other}))

	conflictingUpdate := mustCompileRoutingPlugin(t, "incumbent", 70, `["model-v2", "OTHER-MODEL"]`, "", "")
	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{conflictingUpdate, other}))

	active, ok := registry.Get("incumbent")
	require.True(t, ok)
	assert.Same(t, incumbent, active)
	assert.Same(t, conflictingUpdate, registry.OverridePlugins()["incumbent"])
	assert.Same(t, incumbent, registry.ActiveOverridePlugins()["incumbent"])
	require.Contains(t, registry.RoutingErrors(), "incumbent")

	fixedUpdate := mustCompileRoutingPlugin(t, "incumbent", 72, `["model-v2"]`, "", "")
	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{fixedUpdate, other}))
	active, ok = registry.Get("incumbent")
	require.True(t, ok)
	assert.Same(t, fixedUpdate, active)
	assert.NotContains(t, registry.RoutingErrors(), "incumbent")
}

func TestRegistryAdmitsNewConflictsInDeterministicKeyOrder(t *testing.T) {
	registry := NewRegistry()
	alpha := mustCompileRoutingPlugin(t, "alpha", 0, `["shared-model"]`, "", "")
	beta := mustCompileRoutingPlugin(t, "beta", 0, `["SHARED-MODEL"]`, "", "")

	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{beta, alpha}))

	active, ok := registry.Get("alpha")
	require.True(t, ok)
	assert.Same(t, alpha, active)
	_, betaActive := registry.Get("beta")
	assert.False(t, betaActive)
	assert.Contains(t, registry.RoutingErrors()["beta"], `model "SHARED-MODEL" conflicts with plugin alpha`)
}

func TestRegistryPublishesHealthyUpdateAlongsideRejectedUpdate(t *testing.T) {
	registry := NewRegistry()
	healthyV1 := mustCompileRoutingPlugin(t, "healthy", 81, `["healthy-v1"]`, "", "")
	offenderV1 := mustCompileRoutingPlugin(t, "offender", 82, `["offender-v1"]`, "", "")
	owner := mustCompileRoutingPlugin(t, "owner", 83, `["owner"]`, "", "")
	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{healthyV1, offenderV1, owner}))

	healthyV2 := mustCompileRoutingPlugin(t, "healthy", 84, `["healthy-v2"]`, "", "")
	offenderV2 := mustCompileRoutingPlugin(t, "offender", 82, `["offender-v2", "OWNER"]`, "", "")
	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{healthyV2, offenderV2, owner}))

	activeHealthy, ok := registry.Get("healthy")
	require.True(t, ok)
	assert.Same(t, healthyV2, activeHealthy)
	activeOffender, ok := registry.Get("offender")
	require.True(t, ok)
	assert.Same(t, offenderV1, activeOffender)
	assert.Contains(t, registry.RoutingErrors()["offender"], `conflicts with plugin offender model "OWNER"`)
}

func TestRegistryAdmitsInterdependentUpdatesAsOneGeneration(t *testing.T) {
	tests := []struct {
		name         string
		firstModels  string
		secondModels string
	}{
		{name: "one update frees the name needed by another", firstModels: `["SECOND-OWNED"]`, secondModels: `["second-v2"]`},
		{name: "two plugins swap names", firstModels: `["SECOND-OWNED"]`, secondModels: `["FIRST-OWNED"]`},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			registry := NewRegistry()
			firstV1 := mustCompileRoutingPlugin(t, "dependent-first", 0, `["first-owned"]`, "", "")
			secondV1 := mustCompileRoutingPlugin(t, "dependent-second", 0, `["second-owned"]`, "", "")
			require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{firstV1, secondV1}))

			firstV2 := mustCompileRoutingPlugin(t, "dependent-first", 0, testCase.firstModels, "", "")
			secondV2 := mustCompileRoutingPlugin(t, "dependent-second", 0, testCase.secondModels, "", "")
			require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{firstV2, secondV2}))

			activeFirst, ok := registry.Get("dependent-first")
			require.True(t, ok)
			assert.Same(t, firstV2, activeFirst)
			activeSecond, ok := registry.Get("dependent-second")
			require.True(t, ok)
			assert.Same(t, secondV2, activeSecond)
			assert.Empty(t, registry.RoutingErrors())
		})
	}
}

func TestRejectedUpdateDoesNotRestoreIncumbentAheadOfHealthyPeer(t *testing.T) {
	registry := NewRegistry()
	alphaV1 := mustCompileRoutingPlugin(t, "fallback-alpha", 0, `["alpha-owned"]`, "", "")
	betaV1 := mustCompileRoutingPlugin(t, "fallback-beta", 0, `["beta-v1"]`, "", "")
	owner := mustCompileRoutingPlugin(t, "fallback-owner", 0, `["owner"]`, "", "")
	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{alphaV1, betaV1, owner}))

	alphaV2 := mustCompileRoutingPlugin(t, "fallback-alpha", 0, `["alpha-v2", "OWNER"]`, "", "")
	betaV2 := mustCompileRoutingPlugin(t, "fallback-beta", 0, `["beta-v2", "ALPHA-OWNED"]`, "", "")
	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{alphaV2, betaV2, owner}))

	_, alphaActive := registry.Get("fallback-alpha")
	assert.False(t, alphaActive)
	activeBeta, ok := registry.Get("fallback-beta")
	require.True(t, ok)
	assert.Same(t, betaV2, activeBeta)
	activeOwner, ok := registry.Get("fallback-owner")
	require.True(t, ok)
	assert.Same(t, owner, activeOwner)
	assert.Contains(t, registry.RoutingErrors()["fallback-alpha"], `conflicts with plugin fallback-alpha model "OWNER"`)
	assert.NotContains(t, registry.RoutingErrors(), "fallback-beta")
}

func TestRemovingOverrideNeverRetainsRemovedIncumbent(t *testing.T) {
	registry := NewRegistry()
	override := mustCompileRoutingPlugin(t, "fallback", 0, `["override"]`, "", "")
	owner := mustCompileRoutingPlugin(t, "owner", 0, `["owner"]`, "", "")
	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{override, owner}))
	factory, err := registry.RegisterFactory(routingTestPluginSource("fallback", 0, `["factory", "OWNER"]`, "", ""), Options{})
	require.NoError(t, err)

	require.NoError(t, registry.Unregister("fallback"))

	_, fallbackActive := registry.Get("fallback")
	assert.False(t, fallbackActive)
	ownerActive, ok := registry.Get("owner")
	require.True(t, ok)
	assert.Same(t, owner, ownerActive)
	assert.NotContains(t, registry.OverridePlugins(), "fallback")
	assert.NotContains(t, registry.ActiveOverridePlugins(), "fallback")
	assert.Contains(t, registry.RoutingErrors()["fallback"], `conflicts with plugin fallback model "OWNER"`)

	require.NoError(t, registry.Unregister("owner"))
	fallbackPlugin, ok := registry.Get("fallback")
	require.True(t, ok)
	assert.Same(t, factory, fallbackPlugin)
}

func TestRejectedNewOverrideRetainsFactoryIncumbent(t *testing.T) {
	registry := NewRegistry()
	factorySource := routingTestPluginSource("factory-fallback", 0, `["factory"]`, "", "")
	factory, err := registry.RegisterFactory(factorySource, Options{})
	require.NoError(t, err)
	owner := mustCompileRoutingPlugin(t, "factory-owner", 0, `["owner"]`, "", "")
	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{owner}))

	conflictingOverride := mustCompileRoutingPlugin(t, "factory-fallback", 0, `["override", "OWNER"]`, "", "")
	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{conflictingOverride, owner}))

	active, ok := registry.Get("factory-fallback")
	require.True(t, ok)
	assert.Same(t, factory, active)
	assert.Same(t, conflictingOverride, registry.OverridePlugins()["factory-fallback"])
	assert.NotContains(t, registry.ActiveOverridePlugins(), "factory-fallback")
	assert.Contains(t, registry.RoutingErrors()["factory-fallback"], `conflicts with plugin factory-fallback model "OWNER"`)
}

func TestGenericChannelTypesDoNotCreateLegacyIdentityConflicts(t *testing.T) {
	for _, channelType := range []int{0, constant.ChannelTypeTaskPlugin} {
		t.Run(fmt.Sprintf("channel_%d", channelType), func(t *testing.T) {
			registry := NewRegistry()
			first := mustCompileRoutingPlugin(t, "generic-alpha", channelType, `["alpha"]`, "", "")
			second := mustCompileRoutingPlugin(t, "generic-beta", channelType, `["beta"]`, "", "")

			require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{first, second}))
			assert.Empty(t, registry.PluginsByChannelType(channelType))
		})
	}
}

// The gateway serves a plugin's routes under /{key}, so a key may not name a
// host namespace. A plugin may declare one of those addresses itself, as
// TypeSafe 1.2.0 declares /v1/systemone and /typesafe/v1/systemone; the
// declaration serves it and the copy is not added again.
func TestPluginKeyAndKeyAddressesAreValidated(t *testing.T) {
	for _, key := range []string{"api", "v1", "assets", "console"} {
		meta := Meta{APIVersion: 1, Key: key, Name: "Key", Version: "1.0.0", Author: AuthorMeta{Name: "Test"}, Models: []string{"model"}, FetchMode: "per_task"}
		require.ErrorContains(t, ValidateV1Meta(meta), "is a reserved path segment", key)
	}
	native := `export const native = {decode: function() { return {}; }, render: function(ctx, task) { return task; }};`
	plugin := mustCompileRoutingPlugin(t, "copyist", 0, `["model"]`, `routes: [
		{method: "POST", path: "/v9/jobs", type: "submit", decode: "decode", render: "render"},
		{method: "POST", path: "/copyist/v9/jobs", type: "submit", decode: "decode", render: "render"},
	],`, native)
	bindings := PluginRouteBindings(plugin)
	require.Len(t, bindings, 2)
	assert.Equal(t, "/v9/jobs", bindings[0].Route.Path)
	assert.False(t, bindings[0].Pinned)
	assert.Equal(t, "/copyist/v9/jobs", bindings[1].Route.Path)
	assert.True(t, bindings[1].OwnPrefix)
	registry := NewRegistry()
	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{plugin}))
	require.Empty(t, registry.RoutingErrors())
	_, ok := registry.Generation().LookupDeclaredRoute("POST", "/copyist/v9/jobs")
	assert.True(t, ok)
}

func TestRoutingGenerationServesDeclaredRoutesAndKeyCopies(t *testing.T) {
	native := `export const native = {status: function(ctx, task) { return task; }, decode: function() { return {}; }};`
	alibaba := mustCompileRoutingPlugin(t, "alibaba", 0, `["wan"]`, `routes: [
		{method: "GET", path: "/api/v1/tasks/:task_id", type: "query", render: "status"},
		{method: "GET", path: "/ali/api/v1/tasks/:task_id", type: "query", render: "status"},
	],`, native)
	sunoapi := mustCompileRoutingPlugin(t, "sunoapi", 0, `["suno"]`, `routes: [
		{method: "GET", path: "/suno/fetch/:task_id", type: "query", render: "status"},
	],`, native)
	alpha := mustCompileRoutingPlugin(t, "shared-alpha", 0, `["probe-model"]`, `routes: [
		{method: "GET", path: "/probe/jobs/:task_id", type: "query", render: "status"},
		{method: "GET", path: "/probe/files/*rest", type: "query", render: "status", taskIdParam: "file_id"},
	],`, native)
	beta := mustCompileRoutingPlugin(t, "shared-beta", 0, `["probe-model"]`, `routes: [
		{method: "GET", path: "/probe/jobs/:id", type: "query", render: "status", taskIdParam: "id"},
	],`, native)
	registry := NewRegistry()
	require.NoError(t, registry.ReplaceOverrides([]*LoadedPlugin{sunoapi, beta, alpha, alibaba}))
	require.Empty(t, registry.RoutingErrors())
	generation := registry.Generation()

	vendorPath, ok := generation.LookupDeclaredRoute("GET", "/api/v1/tasks/:id")
	require.True(t, ok)
	assert.False(t, vendorPath.Pinned)
	assert.False(t, vendorPath.OwnPrefix)
	copied, ok := generation.LookupDeclaredRoute("GET", "/alibaba/api/v1/tasks/:id")
	require.True(t, ok)
	assert.True(t, copied.Pinned)
	assert.Equal(t, "/alibaba/api/v1/tasks/:task_id", copied.Route.Path)
	ownPrefix, ok := generation.LookupDeclaredRoute("GET", "/ali/api/v1/tasks/:id")
	require.True(t, ok)
	assert.True(t, ownPrefix.OwnPrefix)
	suno, ok := generation.LookupDeclaredRoute("GET", "/suno/fetch/:id")
	require.True(t, ok)
	assert.True(t, suno.OwnPrefix)
	for _, path := range []string{"/alibaba/ali/api/v1/tasks/:id", "/sunoapi/suno/fetch/:id"} {
		_, found := generation.LookupDeclaredRoute("GET", path)
		assert.False(t, found, path)
	}

	shared := generation.LookupDeclaredRoutes("GET", "/probe/jobs/:x")
	require.Len(t, shared, 2)
	assert.Same(t, alpha, shared[0].Plugin)
	assert.Same(t, beta, shared[1].Plugin)
	var group RouteGroup
	for _, candidate := range generation.RouteGroups() {
		if candidate.Shape == "/probe/jobs/:" {
			group = candidate
		}
	}
	assert.Equal(t, "/probe/jobs/:s2", group.GinPath)
	require.Len(t, group.Bindings, 2)
	params := gin.Params{{Key: "s2", Value: "task_1"}}
	assert.Equal(t, map[string]string{"task_id": "task_1"}, RouteParams(params, group.Bindings[0].Route))
	assert.Equal(t, map[string]string{"id": "task_1"}, RouteParams(params, group.Bindings[1].Route))
	pinnedBeta, ok := generation.LookupDeclaredRoute("GET", "/shared-beta/probe/jobs/:x")
	require.True(t, ok)
	assert.Equal(t, map[string]string{"id": "task_2"}, RouteParams(gin.Params{{Key: "s3", Value: "task_2"}}, pinnedBeta.Route))
	files, ok := generation.LookupDeclaredRoute("GET", "/probe/files/*rest")
	require.True(t, ok)
	assert.Equal(t, map[string]string{"rest": "/a/b"}, RouteParams(gin.Params{{Key: "s2", Value: "/a/b"}}, files.Route))
	// file_id is not a path parameter, so that query route reads it from the
	// query string.
	assert.True(t, files.Route.TaskIDInQuery())
	assert.False(t, shared[0].Route.TaskIDInQuery())

	skipped := generation.WithSkippedRoutes([]SkippedRoute{{PluginKey: "shared-beta", Route: beta.Meta.Routes[0], Reason: "host_route"}})
	for _, candidate := range skipped.RouteGroups() {
		if candidate.Shape == "/probe/jobs/:" {
			require.Len(t, candidate.Bindings, 1)
			assert.Same(t, alpha, candidate.Bindings[0].Plugin)
		}
	}
	assert.Equal(t, []SkippedRoute{{PluginKey: "shared-beta", Route: beta.Meta.Routes[0], Reason: "host_route"}}, skipped.SkippedRoutes())
	assert.Empty(t, generation.SkippedRoutes())
	alphaOnly := NewRegistry()
	require.NoError(t, alphaOnly.ReplaceOverrides([]*LoadedPlugin{alpha}))
	require.NoError(t, PreflightRoutingConflict(alphaOnly.Generation(), beta), "a shared route shape is not a conflict")
}

func mustCompileRoutingPlugin(t *testing.T, key string, channelType int, models, metaFields, exports string) *LoadedPlugin {
	t.Helper()
	plugin, err := CompilePlugin(routingTestPluginSource(key, channelType, models, metaFields, exports), Options{})
	require.NoError(t, err)
	return plugin
}

func routingTestPluginSource(key string, channelType int, models, metaFields, exports string) string {
	channelTypesField := ""
	if channelType > 0 && channelType != constant.ChannelTypeTaskPlugin {
		channelTypesField = fmt.Sprintf("channelTypes: [%d],", channelType)
	}
	return fmt.Sprintf(`
export const meta = {
	apiVersion: 1,
	key: %q,
	name: %q,
	version: "1.0.0",
	author: {name: "Test"},
	%s
	models: %s,
	fetchMode: "per_task",
	%s
};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
%s
`, key, key, channelTypesField, models, metaFields, exports)
}

func routingProtocolExport(name string) string {
	return fmt.Sprintf(`export const protocols = {%s: {
		decodeRequest: function(ctx) { return ctx; },
		renderEvents: function() { return {events: [], state: null, done: false}; },
		renderFinal: function(ctx, task) { return task; }
	}};`, name)
}

// Every console page is a reserved namespace, so a plugin route cannot
// answer a reload or a direct visit of the page.
func TestReservedRouteNamespacesCoverConsolePages(t *testing.T) {
	entries, err := os.ReadDir("../../web/src/routes/_authenticated")
	if errors.Is(err, fs.ErrNotExist) {
		t.Skip("the web sources are not in this tree")
	}
	require.NoError(t, err)
	for _, entry := range entries {
		name := strings.TrimSuffix(entry.Name(), ".tsx")
		if name == "route" || strings.HasPrefix(name, "-") {
			continue
		}
		assert.Contains(t, reservedRouteNamespaces, "/"+name, "console page /%s", name)
	}
}
