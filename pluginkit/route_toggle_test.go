package pluginkit

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// toggleRelay serves chat always, Responses for model a off by default with a
// catch-all Responses route after it, and lists models.
const toggleRelay = `[
  {incoming_path: "/v1/chat/completions", upstream_path: "/chat"},
  {incoming_path: "/v1/responses", upstream_path: "/chat", models: ["a"], converter: "openai_responses_to_openai_chat_completions", default_enabled: false},
  {incoming_path: "/v1/responses", upstream_path: "/responses"},
  {incoming_path: "/v1/models", upstream_path: "/models"},
]`

func compileToggles(t *testing.T) *LoadedPlugin {
	t.Helper()
	plugin, err := CompilePlugin(`export const meta = {`+providerMeta+`, relay: `+toggleRelay+`};`, Options{})
	require.NoError(t, err)
	return plugin
}

func TestRelayRouteKeyNamesPathAndModels(t *testing.T) {
	plugin := compileToggles(t)
	keys := make([]string, 0, len(plugin.Meta.Relay))
	for _, route := range plugin.Meta.Relay {
		keys = append(keys, RelayRouteKey(route))
	}
	assert.Equal(t, []string{"/v1/chat/completions", "/v1/responses|a", "/v1/responses", "/v1/models"}, keys)
}

func TestDefaultEnabledFalseRouteIsOffUntilTheChannelTurnsItOn(t *testing.T) {
	plugin := compileToggles(t)
	assert.Equal(t, []bool{false, true, false, false}, plugin.Meta.RelayDefaultOff)

	route, ok := plugin.Meta.ChannelRelayRoute(nil, "/v1/responses", "a")
	require.True(t, ok, "the catch-all route still serves model a")
	assert.Equal(t, "/responses", route.UpstreamPath)

	route, ok = plugin.Meta.ChannelRelayRoute(map[string]bool{"/v1/responses|a": true}, "/v1/responses", "a")
	require.True(t, ok)
	assert.Equal(t, "/chat", route.UpstreamPath)
	assert.Len(t, plugin.Meta.ChannelRelayConfig(nil, map[string]bool{"/v1/responses|a": true}).Routes, 4)
	assert.Len(t, plugin.Meta.ChannelRelayConfig(nil, nil).Routes, 3)
}

func TestChannelCanSwitchOffADefaultOnRoute(t *testing.T) {
	plugin := compileToggles(t)
	toggles := map[string]bool{"/v1/responses": false}

	_, ok := plugin.Meta.ChannelRelayRoute(toggles, "/v1/responses", "b")
	assert.False(t, ok)
	_, ok = plugin.Meta.ChannelRelayRoute(toggles, "/v1/chat/completions", "b")
	assert.True(t, ok, "other paths are untouched")
	assert.False(t, plugin.Meta.ChannelServesResponsesWebSocket(toggles, "b"))
	assert.True(t, plugin.Meta.ChannelServesResponsesWebSocket(nil, "b"))
}

func TestManagementRoutesCannotBeSwitchedOff(t *testing.T) {
	plugin := compileToggles(t)
	_, ok := plugin.Meta.ChannelRelayConfig(nil, map[string]bool{"/v1/models": false}).ModelListRoute()
	assert.True(t, ok)

	_, err := CompilePlugin(`export const meta = {`+providerMeta+`, relay: [
  {incoming_path: "/v1/models", upstream_path: "/models", default_enabled: false},
]};`, Options{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "default_enabled is not allowed on /v1/models")
}

func TestDefaultEnabledMustBeBoolean(t *testing.T) {
	_, err := CompilePlugin(`export const meta = {`+providerMeta+`, relay: [
  {incoming_path: "/v1/chat/completions", upstream_path: "/chat", default_enabled: "no"},
]};`, Options{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "relay[0].default_enabled must be a boolean")
}

func TestNormalizeRouteTogglesKeepsOnlyChangesFromDefaults(t *testing.T) {
	plugin := compileToggles(t)
	normalized := plugin.Meta.NormalizeRouteToggles(map[string]bool{
		"/v1/chat/completions": true,  // its default
		"/v1/responses|a":      true,  // differs
		"/v1/responses":        false, // differs
		"/v1/models":           false, // management route
		"/v1/unknown":          false, // no such route
	})
	assert.Equal(t, map[string]bool{"/v1/responses|a": true, "/v1/responses": false}, normalized)
	assert.Nil(t, plugin.Meta.NormalizeRouteToggles(map[string]bool{"/v1/chat/completions": true}))
}
