package pluginkit

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// channelConfigMeta declares a region with choices, a second upstream address
// and a region per model.
const channelConfigMeta = `channelConfig: {type: "object", properties: {
  region: {type: "string", title: {en: "Region"}, enum: ["us", "eu"], default: "us"},
  uploadBase: {type: "string", format: "url", title: {en: "Upload address"}, default: "https://upload.example/"},
  regions: {type: "object", title: {en: "Region per model"}, additionalProperties: {type: "string", title: {en: "Region"}, enum: ["us", "eu"]}},
}}, keyHint: {en: "AccessKey|SecretKey", zh: "AccessKey|SecretKey"}`

func TestChannelConfigIsValidatedAndReadWithDefaults(t *testing.T) {
	plugin, err := CompilePlugin(`export const meta = {`+providerMeta+`, relay: `+simpleRelay+`, `+channelConfigMeta+`};`, Options{})
	require.NoError(t, err)
	assert.Equal(t, LocalizedText{"en": "AccessKey|SecretKey", "zh": "AccessKey|SecretKey"}, plugin.Meta.KeyHint)
	assert.Contains(t, string(plugin.Meta.ChannelConfigSchemaJSON()), `"additionalProperties":{"type":"string"`)

	stored, err := plugin.ValidateChannelConfig(json.RawMessage(`{"region":"eu","extra":1,"uploadBase":"https://up.example/v1/","regions":{"m1":"eu"}}`))
	require.NoError(t, err)
	assert.JSONEq(t, `{"region":"eu","uploadBase":"https://up.example/v1","regions":{"m1":"eu"}}`, string(stored), "undeclared keys dropped, addresses normalized")
	stored, err = plugin.ValidateChannelConfig(json.RawMessage(`{"regions":{}}`))
	require.NoError(t, err)
	assert.JSONEq(t, `{"regions":{}}`, string(stored), "defaults are not stored")
	stored, err = plugin.ValidateChannelConfig(nil)
	require.NoError(t, err)
	assert.JSONEq(t, `{}`, string(stored))

	for config, message := range map[string]string{
		`[]`:                                "must be a JSON object",
		`{"region":"xx"}`:                   "region",
		`{"uploadBase":"ftp://up.example"}`: "uploadBase",
		`{"uploadBase":"https://u:p@up.example"}`:  "uploadBase",
		`{"uploadBase":"https://up.example/?a=1"}`: "uploadBase",
		`{"regions":{"m1":3}}`:                     "regions",
		`{"regions":{"m1":"mars"}}`:                "regions",
		`{"regions":"us"}`:                         "regions",
	} {
		_, err := plugin.ValidateChannelConfig(json.RawMessage(config))
		assert.ErrorContains(t, err, message, config)
	}

	assert.JSONEq(t, `{"region":"us","uploadBase":"https://upload.example"}`, string(plugin.ChannelConfigFor(nil)))
	assert.JSONEq(t, `{"region":"eu","uploadBase":"https://upload.example","regions":{"m1":"eu"}}`, string(plugin.ChannelConfigFor(json.RawMessage(`{"region":"eu","old":true,"regions":{"m1":"eu"}}`))),
		"unknown keys are ignored and missing keys take defaults")
	assert.JSONEq(t, `{"region":"xx","uploadBase":"https://upload.example"}`, string(plugin.ChannelConfigFor(json.RawMessage(`{"region":"xx"}`))),
		"a value a newer schema rejects reaches the plugin as stored")

	withoutSchema := compileProviderPlugin(t, simpleRelay, "")
	stored, err = withoutSchema.ValidateChannelConfig(json.RawMessage(`{"region":"eu"}`))
	require.NoError(t, err)
	assert.JSONEq(t, `{}`, string(stored))
	assert.JSONEq(t, `{}`, string(withoutSchema.ChannelConfigFor(json.RawMessage(`{"region":"eu"}`))))
	assert.Nil(t, withoutSchema.Meta.ChannelConfigSchemaJSON())
}

func TestChannelConfigSchemaRules(t *testing.T) {
	compile := func(meta string) error {
		_, err := CompilePlugin(`export const meta = {`+providerMeta+`, relay: `+simpleRelay+`, `+meta+`};`, Options{})
		return err
	}
	perModel := func(item string) string {
		return `channelConfig: {type: "object", properties: {regions: {type: "object", title: {en: "R"}, additionalProperties: ` + item + `}}}`
	}
	require.NoError(t, compile(perModel(`{type: "number", title: {en: "R"}, minimum: 0}`)))
	assert.ErrorContains(t, compile(perModel(`{type: "object", title: {en: "R"}}`)), "additionalProperties")
	assert.ErrorContains(t, compile(perModel(`{type: "string", title: {en: "R"}, default: "us"}`)), "default")
	assert.ErrorContains(t, compile(perModel(`{type: "string"}`)), "title")
	assert.ErrorContains(t, compile(`channelConfig: {type: "object", properties: {regions: {type: "object", title: {en: "R"}, properties: {a: {type: "string", title: {en: "A"}}}, additionalProperties: {type: "string", title: {en: "R"}}}}}`), "additionalProperties")
	assert.ErrorContains(t, compile(`keyHint: {en: "`+strings.Repeat("k", 257)+`"}`), "keyHint")

	// A request processing plugin's configSchema has no per-model values, and
	// only a channel plugin declares channel fields.
	_, err := CompilePlugin(`export const meta = {`+providerMeta+`, configSchema: {type: "object", properties: {regions: {type: "object", title: {en: "R"}, additionalProperties: {type: "string", title: {en: "R"}}}}}}; export function ingress() {}`, Options{})
	assert.ErrorContains(t, err, "additionalProperties")
	_, err = CompilePlugin(`export const meta = {`+providerMeta+`, `+channelConfigMeta+`}; export function ingress() {}`, Options{})
	assert.ErrorContains(t, err, "belongs to a channel")
}

func TestConfigAddressRoutes(t *testing.T) {
	relay := `[
  {incoming_path: "/v1/chat/completions", upstream_path: "/chat"},
  {incoming_path: "/v1/files", upstream_path: "{config.uploadBase}/v1/files"},
  {incoming_path: "/v1/uploads", upstream_path: "{config.uploadBase}"},
]`
	plugin, err := CompilePlugin(`export const meta = {`+providerMeta+`, relay: `+relay+`, channelConfig: {type: "object", properties: {
  uploadBase: {type: "string", format: "url", title: {en: "Upload address"}},
}}};`, Options{})
	require.NoError(t, err)
	paths := func(config string) []string {
		var upstream []string
		for _, route := range plugin.Meta.ChannelRelayConfig(plugin.ChannelConfigFor(json.RawMessage(config))).Routes {
			upstream = append(upstream, route.UpstreamPath)
		}
		return upstream
	}
	assert.Equal(t, []string{"/chat", "https://up.example/base/v1/files", "https://up.example/base"}, paths(`{"uploadBase":"https://up.example/base/"}`))
	assert.Equal(t, []string{"/chat", "/v1/files", "/"}, paths(`{}`), "an empty address is the channel base URL")
	assert.Equal(t, "{config.uploadBase}/v1/files", plugin.Meta.Relay[1].UpstreamPath, "the manifest keeps its template")

	// Only a url property names an address.
	for _, upstreamPath := range []string{"{config.missing}/x", "{config.region}/x", "{config.region"} {
		_, err := CompilePlugin(`export const meta = {`+providerMeta+`, relay: [{incoming_path: "/v1/files", upstream_path: "`+upstreamPath+`"}], channelConfig: {type: "object", properties: {
  region: {type: "string", title: {en: "Region"}},
}}};`, Options{})
		assert.ErrorContains(t, err, "naming a format url property of meta.channelConfig", upstreamPath)
	}
}

func TestServesResponsesWebSocket(t *testing.T) {
	native := compileProviderPlugin(t, `[{incoming_path: "/v1/responses", upstream_path: "/responses", models: ["m1"]}]`, "")
	assert.True(t, native.Meta.ServesResponsesWebSocket("m1"))
	assert.True(t, native.Meta.ServesResponsesWebSocket(""))
	assert.False(t, native.Meta.ServesResponsesWebSocket("m2"), "the route does not serve the model")

	converted := compileProviderPlugin(t, `[{incoming_path: "/v1/responses", upstream_path: "/responses", converter: "plugin"}]`, providerConverters)
	assert.False(t, converted.Meta.ServesResponsesWebSocket("m1"))
	assert.False(t, converted.Meta.ServesResponsesWebSocket(""))

	chatOnly := compileProviderPlugin(t, simpleRelay, "")
	assert.False(t, chatOnly.Meta.ServesResponsesWebSocket(""))
}

// A relay route with enabled_by serves a channel only when that boolean
// property of the channel's plugin config is true, after its default.
func TestRelayRoutesEnabledByChannelConfig(t *testing.T) {
	const toggles = `channelConfig: {type: "object", properties: {
  responses: {type: "boolean", title: {en: "Accept Responses"}, default: false},
  socket: {type: "boolean", title: {en: "Responses WebSocket"}, default: true},
  region: {type: "string", title: {en: "Region"}},
}}`
	relay := `[
  {incoming_path: "/v1/chat/completions", upstream_path: "/chat"},
  {incoming_path: "/v1/responses", upstream_path: "/chat", converter: "openai_responses_to_openai_chat_completions", models: ["m1"], enabled_by: "responses"},
  {incoming_path: "/v1/responses", upstream_path: "/responses", models: ["m2"], enabled_by: "socket"},
  {incoming_path: "/v1/models", upstream_path: "/models"}
]`
	plugin, err := CompilePlugin(`export const meta = {`+providerMeta+`, relay: `+relay+`, `+toggles+`};`, Options{})
	require.NoError(t, err)

	defaults := plugin.ChannelConfigFor(nil)
	_, ok := plugin.Meta.ChannelRelayRoute(defaults, "/v1/responses", "m1")
	assert.False(t, ok, "the route is off by default")
	_, ok = plugin.Meta.ChannelRelayRoute(defaults, "/v1/chat/completions", "m1")
	assert.True(t, ok, "a route without enabled_by is always on")
	assert.True(t, plugin.Meta.ChannelServesResponsesWebSocket(defaults, "m2"))
	assert.Len(t, plugin.Meta.ChannelRelayConfig(defaults).Routes, 3)

	on := plugin.ChannelConfigFor(json.RawMessage(`{"responses":true,"socket":false}`))
	route, ok := plugin.Meta.ChannelRelayRoute(on, "/v1/responses", "m1")
	require.True(t, ok)
	assert.Equal(t, "openai_responses_to_openai_chat_completions", route.Converter)
	assert.False(t, plugin.Meta.ChannelServesResponsesWebSocket(on, "m2"))
	relayConfig := plugin.Meta.ChannelRelayConfig(on)
	require.NoError(t, relayConfig.Validate())
	_, ok = relayConfig.MatchPathForModel("/v1/responses", "m1")
	assert.True(t, ok)
	_, ok = relayConfig.MatchPathForModel("/v1/responses", "m2")
	assert.False(t, ok)

	_, ok = plugin.Meta.RelayRoute("/v1/responses", "m1")
	assert.True(t, ok, "the manifest keeps every route")
	assert.Len(t, plugin.Meta.Relay, 4)

	for name, tc := range map[string]struct{ relay, message string }{
		"not a string":     {`[{incoming_path: "/v1/chat/completions", upstream_path: "/chat", enabled_by: true}]`, "enabled_by must be a non-empty string"},
		"empty":            {`[{incoming_path: "/v1/chat/completions", upstream_path: "/chat", enabled_by: " "}]`, "enabled_by must be a non-empty string"},
		"unknown property": {`[{incoming_path: "/v1/chat/completions", upstream_path: "/chat", enabled_by: "missing"}]`, "must name a boolean property of meta.channelConfig"},
		"not boolean":      {`[{incoming_path: "/v1/chat/completions", upstream_path: "/chat", enabled_by: "region"}]`, "must name a boolean property of meta.channelConfig"},
		"model list route": {`[{incoming_path: "/v1/chat/completions", upstream_path: "/chat"}, {incoming_path: "/v1/models", upstream_path: "/models", enabled_by: "responses"}]`, "enabled_by is not allowed on /v1/models"},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := CompilePlugin(`export const meta = {`+providerMeta+`, relay: `+tc.relay+`, `+toggles+`};`, Options{})
			assert.ErrorContains(t, err, tc.message)
		})
	}
	_, err = CompilePlugin(`export const meta = {`+providerMeta+`, relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/chat", enabled_by: "responses"}]};`, Options{})
	assert.ErrorContains(t, err, "must name a boolean property of meta.channelConfig", "a plugin without channelConfig")
}
