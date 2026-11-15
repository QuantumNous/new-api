package jsplugin

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRegistryOverrideTakesPrecedenceOverFactory(t *testing.T) {
	registry := NewRegistry()
	require.NoError(t, registerTestPlugin(registry, "1.0.0-factory", true))
	require.NoError(t, registerTestPlugin(registry, "1.0.0-override", false))

	plugin, ok := registry.Get("test")
	require.True(t, ok)
	assert.Equal(t, "1.0.0-override", plugin.Meta.Version)
}

func TestRegistryUnregisterFallsBackToFactory(t *testing.T) {
	registry := NewRegistry()
	require.NoError(t, registerTestPlugin(registry, "1.0.0-factory", true))
	require.NoError(t, registerTestPlugin(registry, "1.0.0-override", false))

	registry.Unregister("test")

	plugin, ok := registry.Get("test")
	require.True(t, ok)
	assert.Equal(t, "1.0.0-factory", plugin.Meta.Version)
}

func TestRegistrySnapshotSeparatesLayersWithoutExposingEntries(t *testing.T) {
	registry := NewRegistry()
	require.NoError(t, registerTestPlugin(registry, "1.0.0-factory", true))
	require.NoError(t, registerTestPlugin(registry, "1.0.0-override", false))

	snapshot := registry.Snapshot()

	require.Len(t, snapshot.Factory, 1)
	require.Len(t, snapshot.Override, 1)
	assert.Equal(t, "1.0.0-factory", snapshot.Factory[0].Version)
	assert.Equal(t, "1.0.0-override", snapshot.Override[0].Version)
	snapshot.Override[0].Version = "changed"
	plugin, ok := registry.Get("test")
	require.True(t, ok)
	assert.Equal(t, "1.0.0-override", plugin.Meta.Version)
}

func TestRegistryRejectsPluginKeyLongerThanTaskPlatformColumn(t *testing.T) {
	source := `export const meta = {apiVersion: 1, key: "1234567890123456789012345678901", name: "Long", version: "1", author: {name: "Test"}};`
	_, err := NewRegistry().Register(source, Options{})
	require.ErrorContains(t, err, "must not exceed 30 characters")
}

func TestValidateV1MetaEnforcesTaskPluginKeyLength(t *testing.T) {
	meta := Meta{APIVersion: 1, Key: strings.Repeat("a", 30), Name: "Test", Version: "1.0.0", Author: AuthorMeta{Name: "Test"}, Models: []string{"model"}, FetchMode: "per_task"}
	require.NoError(t, ValidateV1Meta(meta))

	meta.Key += "a"
	require.ErrorContains(t, ValidateV1Meta(meta), "must not exceed 30 characters")
}

func TestRegistryDecodesAndValidatesIcon(t *testing.T) {
	absent, err := CompilePlugin(routingTestPluginSource("icon-absent", 0, `["model"]`, "", ""), Options{})
	require.NoError(t, err)
	assert.Empty(t, absent.Meta.Icon)

	accepted, err := CompilePlugin(routingTestPluginSource("icon-ok", 0, `["model"]`, `icon: "Sora.Color",`, ""), Options{})
	require.NoError(t, err)
	assert.Equal(t, "Sora.Color", accepted.Meta.Icon)

	_, err = NewRegistry().Register(routingTestPluginSource("icon-long", 0, `["model"]`, `icon: "`+strings.Repeat("a", 129)+`",`, ""), Options{})
	require.ErrorContains(t, err, "must not exceed 128 characters")

	_, err = NewRegistry().Register(`
export const meta = {
	apiVersion: 1, key: "icon-type", name: "Icon", version: "1.0.0", author: {name: "Test"},
	models: ["model"], fetchMode: "per_task", icon: 1
};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
`, Options{})
	require.ErrorContains(t, err, "must be a string")

	_, err = NewRegistry().Register(routingTestPluginSource("icon-control", 0, `["model"]`, "icon: \"Sora\\u0000.Color\",", ""), Options{})
	require.ErrorContains(t, err, "must not contain control characters")
}

func TestRegistryRequiresValidPluginAuthor(t *testing.T) {
	missing := strings.Replace(
		routingTestPluginSource("missing-author", 0, `["model"]`, "", ""),
		`author: {name: "Test"},`,
		"",
		1,
	)
	_, err := CompilePlugin(missing, Options{})
	require.ErrorContains(t, err, "author must be an object")

	meta := Meta{
		APIVersion: 1,
		Key:        "author-url",
		Name:       "Author URL",
		Version:    "1.0.0",
		Author:     AuthorMeta{Name: "Test", URL: "ftp://example.com/profile"},
		Models:     []string{"model"},
		FetchMode:  "per_task",
	}
	require.ErrorContains(t, ValidateV1Meta(meta), "absolute HTTP(S)")
	meta.Author.URL = "https://example.com/profile"
	require.NoError(t, ValidateV1Meta(meta))
}

func TestRegistryRequiresArtifactHooksAsPair(t *testing.T) {
	for _, hook := range []string{"listArtifacts", "buildContentRequest"} {
		t.Run(hook, func(t *testing.T) {
			source := routingTestPluginSource(
				"artifact-hook-pair",
				0,
				`["model"]`,
				"",
				"export function "+hook+"() { return []; }",
			)
			_, err := CompilePlugin(source, Options{})
			require.ErrorContains(t, err, "must export listArtifacts and buildContentRequest together")
		})
	}
}

func TestRegistryRejectsRemovedNativeRoutingFields(t *testing.T) {
	for _, field := range []string{"submitPaths", "actions"} {
		t.Run(field, func(t *testing.T) {
			source := `
export const meta = {
		apiVersion: 1, key: "removed-field", name: "Removed", version: "1.0.0", author: {name: "Test"},
	models: ["model"], fetchMode: "per_task", ` + field + `: []
};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
`
			_, err := NewRegistry().Register(source, Options{})
			require.ErrorContains(t, err, "declare routes instead")
		})
	}
}

func TestRegistryDecodesAndValidatesUsageSchema(t *testing.T) {
	withoutSchema, err := CompilePlugin(
		routingTestPluginSource("usage-schema-absent", 0, `["model"]`, "", ""),
		Options{},
	)
	require.NoError(t, err)
	assert.Nil(t, withoutSchema.Meta.UsageSchema)

	valid := routingTestPluginSource(
		"usage-schema",
		0,
		`["model"]`,
		`usageSchema: {
			duration: {type: "number", unit: "second", description: "Generated video duration."},
			count: {type: "number", unit: "count"},
			tokens: {type: "number", unit: "token", description: "Upstream billing tokens."},
			credits: {type: "number", unit: "credit", description: "Vendor resource-pack units."},
			mode: {enum: ["std", "pro"], description: "Provider quality tier."},
			generate_audio: {type: "boolean", description: "Whether audio is generated."},
		},
		usageExamples: [{label: "std · 1s", facts: {duration: 1, count: 1, tokens: 1, credits: 1, mode: "std", generate_audio: true}}],`,
		"",
	)
	plugin, err := CompilePlugin(valid, Options{})
	require.NoError(t, err)
	assert.Equal(t, "number", plugin.Meta.UsageSchema["duration"].Type)
	assert.Equal(t, "second", plugin.Meta.UsageSchema["duration"].Unit)
	assert.Equal(t, LocalizedText{"en": "Generated video duration."}, plugin.Meta.UsageSchema["duration"].Description)
	assert.Equal(t, "number", plugin.Meta.UsageSchema["count"].Type)
	assert.Equal(t, "count", plugin.Meta.UsageSchema["count"].Unit)
	assert.Equal(t, "number", plugin.Meta.UsageSchema["tokens"].Type)
	assert.Equal(t, "token", plugin.Meta.UsageSchema["tokens"].Unit)
	assert.Equal(t, LocalizedText{"en": "Upstream billing tokens."}, plugin.Meta.UsageSchema["tokens"].Description)
	assert.Equal(t, "number", plugin.Meta.UsageSchema["credits"].Type)
	assert.Equal(t, "credit", plugin.Meta.UsageSchema["credits"].Unit)
	assert.Equal(t, LocalizedText{"en": "Vendor resource-pack units."}, plugin.Meta.UsageSchema["credits"].Description)
	assert.Equal(t, []string{"std", "pro"}, plugin.Meta.UsageSchema["mode"].Enum)
	assert.Equal(t, LocalizedText{"en": "Provider quality tier."}, plugin.Meta.UsageSchema["mode"].Description)
	assert.Equal(t, "boolean", plugin.Meta.UsageSchema["generate_audio"].Type)
	assert.Equal(t, LocalizedText{"en": "Whether audio is generated."}, plugin.Meta.UsageSchema["generate_audio"].Description)
	require.Len(t, plugin.Meta.UsageExamples, 1)
	assert.Equal(t, "std · 1s", plugin.Meta.UsageExamples[0].Label)
	assert.Equal(t, int64(1), plugin.Meta.UsageExamples[0].Facts["tokens"])

	tests := []struct {
		name          string
		declaration   string
		expectedError string
	}{
		{
			name:          "unsupported numeric unit",
			declaration:   `{type: "number", unit: "minute"}`,
			expectedError: "unit must be second, count, token, or credit",
		},
		{
			name:          "boolean cannot mix unit",
			declaration:   `{type: "boolean", unit: "second"}`,
			expectedError: "cannot combine boolean with unit",
		},
		{
			name:          "enum cannot mix numeric shape",
			declaration:   `{type: "number", unit: "second", enum: ["std"]}`,
			expectedError: "cannot combine enum with type or unit",
		},
		{
			name:          "enum values must be unique",
			declaration:   `{enum: ["std", "std"]}`,
			expectedError: "enum values must be unique",
		},
		{
			name:          "enum must not be empty",
			declaration:   `{enum: []}`,
			expectedError: "enum must contain at least one value",
		},
		{
			name:          "empty enum cannot be hidden in numeric shape",
			declaration:   `{type: "number", unit: "second", enum: []}`,
			expectedError: "cannot combine enum with type or unit",
		},
		{
			name:          "unknown property",
			declaration:   `{type: "number", unit: "second", maximum: 5}`,
			expectedError: `unknown property "maximum"`,
		},
		{
			name:          "description must be a string or object",
			declaration:   `{type: "number", unit: "second", description: 5}`,
			expectedError: "description must be a string or object",
		},
		{
			name:          "description is bounded",
			declaration:   `{type: "number", unit: "second", description: "` + strings.Repeat("x", 257) + `"}`,
			expectedError: "description must not exceed 256 characters",
		},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			source := routingTestPluginSource(
				"invalid-usage-schema",
				0,
				`["model"]`,
				`usageSchema: {value: `+testCase.declaration+`},`,
				"",
			)
			_, err := CompilePlugin(source, Options{})
			require.ErrorContains(t, err, testCase.expectedError)
		})
	}

	for _, testCase := range []struct {
		name          string
		metaFields    string
		expectedError string
	}{
		{
			name:          "explicit null",
			metaFields:    `usageSchema: null,`,
			expectedError: "usageSchema must be an object",
		},
		{
			name:          "leading whitespace in key",
			metaFields:    `usageSchema: {" duration": {type: "number", unit: "second"}},`,
			expectedError: "keys must be non-empty canonical names",
		},
		{
			name:          "trailing whitespace in key",
			metaFields:    `usageSchema: {"duration ": {type: "number", unit: "second"}},`,
			expectedError: "keys must be non-empty canonical names",
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			source := routingTestPluginSource(
				"invalid-usage-schema",
				0,
				`["model"]`,
				testCase.metaFields,
				"",
			)
			_, err := CompilePlugin(source, Options{})
			require.ErrorContains(t, err, testCase.expectedError)
		})
	}

	t.Run("second-only schema may omit usageExamples", func(t *testing.T) {
		plugin, err := CompilePlugin(
			routingTestPluginSource(
				"usage-examples-optional",
				0,
				`["model"]`,
				`usageSchema: {seconds: {type: "number", unit: "second"}},`,
				"",
			),
			Options{},
		)
		require.NoError(t, err)
		assert.Empty(t, plugin.Meta.UsageExamples)
	})

	t.Run("ValidateV1Meta preserves explicit empty enum presence", func(t *testing.T) {
		meta := Meta{
			APIVersion: 1,
			Key:        "invalid-usage-schema",
			Name:       "Invalid Usage Schema",
			Version:    "1.0.0",
			Author:     AuthorMeta{Name: "Test"},
			Models:     []string{"model"},
			FetchMode:  "per_task",
			UsageSchema: map[string]UsageFieldSchema{
				"duration": {Type: "number", Unit: "second", Enum: []string{}},
			},
		}
		require.ErrorContains(t, ValidateV1Meta(meta), "cannot combine enum with type or unit")
	})
}

func TestUsageUnitLabelContract(t *testing.T) {
	source := routingTestPluginSource("unit-label", 0, `["model"]`, `usageSchema: {
		images: {type: "number", unit: "count", unitLabel: {EN: " image ", zh: "张"}},
		items: {type: "number", unit: "count", unitLabel: "item"},
		legacy: {type: "number", unit: "count"}
	},`, "")
	registry := NewRegistry()
	plugin, err := registry.Register(source, Options{})
	require.NoError(t, err)
	assert.Equal(t, LocalizedText{"en": "image", "zh": "张"}, plugin.Meta.UsageSchema["images"].UnitLabel)
	assert.Equal(t, LocalizedText{"en": "item"}, plugin.Meta.UsageSchema["items"].UnitLabel)
	assert.Nil(t, plugin.Meta.UsageSchema["legacy"].UnitLabel)
	wire, err := common.Marshal(plugin.Meta.UsageSchema)
	require.NoError(t, err)
	assert.JSONEq(t, `{"images":{"type":"number","unit":"count","unitLabel":{"en":"image","zh":"张"}},"items":{"type":"number","unit":"count","unitLabel":{"en":"item"}},"legacy":{"type":"number","unit":"count"}}`, string(wire))
	snapshot := registry.Snapshot()
	snapshot.Override[0].UsageSchema["images"].UnitLabel["en"] = "Changed"
	assert.Equal(t, "image", registry.Snapshot().Override[0].UsageSchema["images"].UnitLabel["en"])

	for _, tc := range []struct{ name, field, message string }{
		{"seconds", `{type:"number",unit:"second",unitLabel:"image"}`, "unitLabel requires a number field with count unit"},
		{"tokens", `{type:"number",unit:"token",unitLabel:"image"}`, "unitLabel requires a number field with count unit"},
		{"credits", `{type:"number",unit:"credit",unitLabel:"image"}`, "unitLabel requires a number field with count unit"},
		{"boolean", `{type:"boolean",unitLabel:"image"}`, "unitLabel requires a number field with count unit"},
		{"enum", `{enum:["a"],unitLabel:"image"}`, "unitLabel requires a number field with count unit"},
		{"missing English", `{type:"number",unit:"count",unitLabel:{zh:"张"}}`, `must include a non-empty "en"`},
		{"null", `{type:"number",unit:"count",unitLabel:null}`, "must be a string or object"},
		{"empty", `{type:"number",unit:"count",unitLabel:" "}`, "non-empty string"},
		{"invalid locale", `{type:"number",unit:"count",unitLabel:{en:"image",zh_CN:"张"}}`, "invalid locale"},
		{"too long", `{type:"number",unit:"count",unitLabel:"` + strings.Repeat("x", 257) + `"}`, "must not exceed 256 characters"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := CompilePlugin(routingTestPluginSource("invalid-unit-label", 0, `["model"]`, "usageSchema: {value: "+tc.field+"},", ""), Options{})
			require.ErrorContains(t, err, tc.message)
		})
	}
}

func TestUsageEnumLabelsContract(t *testing.T) {
	source := routingTestPluginSource("enum-labels", 0, `["model"]`, `usageSchema: {
		mode: {enum: ["none", "video", "other"], enumLabels: {none: "No video", video: {EN: " With video ", zh: "有参考视频"}}}
	},`, "")
	registry := NewRegistry()
	plugin, err := registry.Register(source, Options{})
	require.NoError(t, err)
	labels := plugin.Meta.UsageSchema["mode"].EnumLabels
	assert.Equal(t, LocalizedText{"en": "No video"}, labels["none"])
	assert.Equal(t, LocalizedText{"en": "With video", "zh": "有参考视频"}, labels["video"])
	assert.NotContains(t, labels, "other")

	wire, err := common.Marshal(plugin.Meta.UsageSchema)
	require.NoError(t, err)
	assert.JSONEq(t, `{"mode":{"enum":["none","video","other"],"enumLabels":{"none":{"en":"No video"},"video":{"en":"With video","zh":"有参考视频"}}}}`, string(wire))
	snapshot := registry.Snapshot()
	require.Len(t, snapshot.Override, 1)
	snapshot.Override[0].UsageSchema["mode"].EnumLabels["video"]["en"] = "Changed"
	delete(snapshot.Override[0].UsageSchema["mode"].EnumLabels, "none")
	current := registry.Snapshot().Override[0].UsageSchema["mode"].EnumLabels
	assert.Equal(t, "With video", current["video"]["en"])
	assert.Contains(t, current, "none")

	for _, tc := range []struct{ name, field, message string }{
		{"unknown enum value", `{enum:["a"],enumLabels:{b:"B"}}`, "undeclared enum value"},
		{"numeric field", `{type:"number",unit:"count",enumLabels:{}}`, "enumLabels requires enum"},
		{"boolean field", `{type:"boolean",enumLabels:{true:"Yes"}}`, "enumLabels requires enum"},
		{"missing English", `{enum:["a"],enumLabels:{a:{zh:"中文"}}}`, `must include a non-empty "en"`},
		{"null map", `{enum:["a"],enumLabels:null}`, "enumLabels must be an object"},
		{"null label", `{enum:["a"],enumLabels:{a:null}}`, "must be a string or object"},
		{"empty label", `{enum:["a"],enumLabels:{a:" "}}`, "non-empty string"},
		{"invalid locale", `{enum:["a"],enumLabels:{a:{en:"A",zh_CN:"甲"}}}`, "invalid locale"},
		{"too long", `{enum:["a"],enumLabels:{a:"` + strings.Repeat("x", 257) + `"}}`, "must not exceed 256 characters"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := CompilePlugin(routingTestPluginSource("invalid-labels", 0, `["model"]`, "usageSchema: {mode: "+tc.field+"},", ""), Options{})
			require.ErrorContains(t, err, tc.message)
		})
	}
}

func TestRegistryValidatesUsageExamples(t *testing.T) {
	tokenSchema := `usageSchema: {tokens: {type: "number", unit: "token"}, mode: {enum: ["std", "pro"]}},`
	validExample := `{label: "std · 1 token", facts: {tokens: 1, mode: "std"}}`

	for _, testCase := range []struct {
		name          string
		metaFields    string
		expectedError string
	}{
		{
			name:          "missing schema key",
			metaFields:    tokenSchema + `usageExamples: [{label: "std", facts: {tokens: 1}}],`,
			expectedError: `facts missing key "mode"`,
		},
		{
			name:          "undeclared facts key",
			metaFields:    tokenSchema + `usageExamples: [{label: "std", facts: {tokens: 1, mode: "std", extra: 1}}],`,
			expectedError: `undeclared key "extra"`,
		},
		{
			name:          "enum value must be declared",
			metaFields:    tokenSchema + `usageExamples: [{label: "ultra", facts: {tokens: 1, mode: "ultra"}}],`,
			expectedError: "enum is not an allowed value",
		},
		{
			name:          "token unit requires at least one example",
			metaFields:    `usageSchema: {tokens: {type: "number", unit: "token"}},`,
			expectedError: "usageExamples is required when usageSchema declares a token unit",
		},
		{
			name:          "cap is 16 examples",
			metaFields:    tokenSchema + `usageExamples: [` + strings.Repeat(validExample+",", 16) + validExample + `],`,
			expectedError: "must not exceed 16 entries",
		},
		{
			name:          "label must be non-empty",
			metaFields:    tokenSchema + `usageExamples: [{label: "   ", facts: {tokens: 1, mode: "std"}}],`,
			expectedError: "label is required",
		},
		{
			name:          "label is bounded",
			metaFields:    tokenSchema + `usageExamples: [{label: "` + strings.Repeat("x", 49) + `", facts: {tokens: 1, mode: "std"}}],`,
			expectedError: "label must not exceed 48 characters",
		},
		{
			name:          "usageExamples requires usageSchema",
			metaFields:    `usageExamples: [{label: "std", facts: {tokens: 1}}],`,
			expectedError: "usageExamples requires usageSchema",
		},
		{
			name:          "token value must stay within the int32 bound",
			metaFields:    tokenSchema + `usageExamples: [{label: "overflow", facts: {tokens: 2147483648, mode: "std"}}],`,
			expectedError: "exceeds the host limit",
		},
		{
			name:          "second value must stay within the duration bound",
			metaFields:    `usageSchema: {seconds: {type: "number", unit: "second"}}, usageExamples: [{label: "too long", facts: {seconds: 3601}}],`,
			expectedError: "exceeds the host limit",
		},
		{
			name:          "negative number is rejected",
			metaFields:    tokenSchema + `usageExamples: [{label: "neg", facts: {tokens: -1, mode: "std"}}],`,
			expectedError: "finite non-negative number",
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			source := routingTestPluginSource(
				"invalid-usage-examples",
				0,
				`["model"]`,
				testCase.metaFields,
				"",
			)
			_, err := CompilePlugin(source, Options{})
			require.ErrorContains(t, err, testCase.expectedError)
		})
	}

	t.Run("accepts a complete token example vector", func(t *testing.T) {
		plugin, err := CompilePlugin(
			routingTestPluginSource(
				"valid-usage-examples",
				0,
				`["model"]`,
				tokenSchema+`usageExamples: [`+validExample+`],`,
				"",
			),
			Options{},
		)
		require.NoError(t, err)
		require.Len(t, plugin.Meta.UsageExamples, 1)
		assert.Equal(t, "std · 1 token", plugin.Meta.UsageExamples[0].Label)
		assert.Equal(t, "std", plugin.Meta.UsageExamples[0].Facts["mode"])
	})

	t.Run("ValidateV1Meta rejects a token schema without examples", func(t *testing.T) {
		meta := Meta{
			APIVersion: 1,
			Key:        "token-examples",
			Name:       "Token Examples",
			Version:    "1.0.0",
			Author:     AuthorMeta{Name: "Test"},
			Models:     []string{"model"},
			FetchMode:  "per_task",
			UsageSchema: map[string]UsageFieldSchema{
				"tokens": {Type: "number", Unit: "token"},
			},
		}
		require.ErrorContains(t, ValidateV1Meta(meta), "usageExamples is required when usageSchema declares a token unit")
		meta.UsageExamples = []UsageExample{{Label: "1 token", Facts: map[string]any{"tokens": 1}}}
		require.NoError(t, ValidateV1Meta(meta))
	})
}

func TestRegistryFindsEffectivePluginByBuiltInChannelType(t *testing.T) {
	registry := NewRegistry()
	_, err := registry.RegisterFactory(`
export const meta = {apiVersion:1,key:"test",name:"Test",version:"1.0.0",author:{name:"Test"},channelTypes:[1001],models:["test-model"],fetchMode:"per_task"};
export function buildSubmitRequest(){return {}} export function parseSubmitResponse(){return {}} export function buildQueryRequest(){return {}} export function parseTaskResult(){return {}}
`, Options{})
	require.NoError(t, err)
	plugin, ok := registry.GetByChannelType(1001)
	require.True(t, ok)
	assert.Equal(t, "test", plugin.Meta.Key)
}

func TestTaskPluginRoutingDebugReasonDoesNotExposeRawFailure(t *testing.T) {
	for _, testCase := range []struct {
		name     string
		message  string
		expected string
	}{
		{name: "channel type", message: "channelType 80 conflicts with plugin secret", expected: "channel_type_conflict"},
		{name: "endpoint", message: `endpoint https://secret.invalid/?key=hidden conflicts`, expected: "endpoint_conflict"},
		{name: "inner router", message: "inner Gin registration panic: private route", expected: "inner_router_build_failed"},
		{name: "route", message: `route /private/path conflicts`, expected: "route_conflict"},
		{name: "fallback", message: `database https://secret.invalid/?key=hidden`, expected: "generation_rebuild_failed"},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			reason := taskPluginRoutingDebugReason(testCase.message)
			assert.Equal(t, testCase.expected, reason)
			assert.NotContains(t, reason, "secret")
			assert.NotContains(t, reason, "hidden")
		})
	}
}

func registerTestPlugin(registry *Registry, version string, factory bool) error {
	source := `
export const meta = {apiVersion: 1, key: "test", name: "Test", version: "` + version + `", author: {name: "Test"}, models: ["test-model"], fetchMode: "per_task"};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
`
	if factory {
		_, err := registry.RegisterFactory(source, Options{})
		return err
	}
	_, err := registry.Register(source, Options{})
	return err
}

func TestRegistryValidatesChannelTypes(t *testing.T) {
	base := Meta{
		APIVersion: 1,
		Key:        "compat",
		Name:       "Compat",
		Version:    "1.0.0",
		Author:     AuthorMeta{Name: "Test"},
		Models:     []string{"model"},
		FetchMode:  "per_task",
	}
	for _, testCase := range []struct {
		name         string
		channelTypes []int
		wantErr      string
	}{
		{name: "valid list", channelTypes: []int{55, 1}},
		{name: "empty list", channelTypes: nil},
		{name: "zero rejected", channelTypes: []int{0}, wantErr: "positive channel types"},
		{name: "negative rejected", channelTypes: []int{-1}, wantErr: "positive channel types"},
		{name: "task plugin type rejected", channelTypes: []int{constant.ChannelTypeTaskPlugin}, wantErr: "task plugin channel type"},
		{name: "new api type rejected", channelTypes: []int{constant.ChannelTypeNewAPI}, wantErr: "New API channel type"},
		{name: "duplicates rejected", channelTypes: []int{1, 1}, wantErr: "must be unique"},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			meta := base
			meta.ChannelTypes = testCase.channelTypes
			err := ValidateV1Meta(meta)
			if testCase.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.ErrorContains(t, err, testCase.wantErr)
		})
	}

	for _, testCase := range []struct {
		name          string
		metaFields    string
		expectedError string
	}{
		{
			name:          "removed channelType field",
			metaFields:    `channelType: 55,`,
			expectedError: "channelType is no longer supported; declare channelTypes instead",
		},
		{
			name:          "removed compatibleChannelTypes field",
			metaFields:    `compatibleChannelTypes: [1],`,
			expectedError: "compatibleChannelTypes is no longer supported; declare channelTypes instead",
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			source := fmt.Sprintf(`
export const meta = {
	apiVersion: 1, key: "legacy-field", name: "Legacy", version: "1.0.0",
	author: {name: "Test"}, models: ["model"], fetchMode: "per_task", %s
};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
`, testCase.metaFields)
			_, err := CompilePlugin(source, Options{})
			require.ErrorContains(t, err, testCase.expectedError)
		})
	}
}

func TestLocalizedTextContract(t *testing.T) {
	validMeta := func() Meta {
		return Meta{
			APIVersion: 1,
			Key:        "localized-text",
			Name:       "Localized Text",
			Version:    "1.0.0",
			Author:     AuthorMeta{Name: "Test"},
			Models:     []string{"model"},
			FetchMode:  "per_task",
		}
	}

	t.Run("bare string meta description normalizes to en", func(t *testing.T) {
		plugin, err := CompilePlugin(
			routingTestPluginSource("localized-text", 0, `["model"]`, `description: "Video generation via the vendor API",`, ""),
			Options{},
		)
		require.NoError(t, err)
		assert.Equal(t, LocalizedText{"en": "Video generation via the vendor API"}, plugin.Meta.Description)
	})

	t.Run("bare string usage field description normalizes to en", func(t *testing.T) {
		plugin, err := CompilePlugin(
			routingTestPluginSource(
				"localized-text",
				0,
				`["model"]`,
				`usageSchema: {seconds: {type: "number", unit: "second", description: "Generated media duration."}},`,
				"",
			),
			Options{},
		)
		require.NoError(t, err)
		assert.Equal(t, LocalizedText{"en": "Generated media duration."}, plugin.Meta.UsageSchema["seconds"].Description)
	})

	t.Run("map form is accepted when en is present", func(t *testing.T) {
		plugin, err := CompilePlugin(
			routingTestPluginSource(
				"localized-text",
				0,
				`["model"]`,
				`description: {en: "Video generation via the vendor API", zh: "通过厂商接口生成视频"},
				usageSchema: {seconds: {type: "number", unit: "second", description: {en: "Generated media duration.", "zh-TW": "產生的媒體時長"}}},`,
				"",
			),
			Options{},
		)
		require.NoError(t, err)
		assert.Equal(t, LocalizedText{"en": "Video generation via the vendor API", "zh": "通过厂商接口生成视频"}, plugin.Meta.Description)
		assert.Equal(t, LocalizedText{"en": "Generated media duration.", "zh-TW": "產生的媒體時長"}, plugin.Meta.UsageSchema["seconds"].Description)
	})

	t.Run("object name keeps its locales and reads en as the name", func(t *testing.T) {
		plugin, err := CompilePlugin(
			routingTestPluginSource("localized-text", 0, `["model"]`, `name: {en: " Localized Text ", "zh-cn": "多语言名称"},`, ""),
			Options{},
		)
		require.NoError(t, err)
		assert.Equal(t, "Localized Text", plugin.Meta.Name)
		assert.Equal(t, LocalizedText{"en": "Localized Text", "zh-CN": "多语言名称"}, plugin.Meta.NameI18n)
		encoded, err := common.Marshal(plugin.Meta)
		require.NoError(t, err)
		assert.Contains(t, string(encoded), `"name":"Localized Text","name_i18n":{"en":"Localized Text","zh-CN":"多语言名称"}`)
	})

	t.Run("string name has no name_i18n", func(t *testing.T) {
		plugin, err := CompilePlugin(routingTestPluginSource("localized-text", 0, `["model"]`, "", ""), Options{})
		require.NoError(t, err)
		assert.Equal(t, "localized-text", plugin.Meta.Name)
		assert.Nil(t, plugin.Meta.NameI18n)
		encoded, err := common.Marshal(plugin.Meta)
		require.NoError(t, err)
		assert.NotContains(t, string(encoded), "name_i18n")
	})

	t.Run("trim is written back", func(t *testing.T) {
		plugin, err := CompilePlugin(
			routingTestPluginSource("localized-text", 0, `["model"]`, `description: "  Video generation via the vendor API  ",`, ""),
			Options{},
		)
		require.NoError(t, err)
		assert.Equal(t, LocalizedText{"en": "Video generation via the vendor API"}, plugin.Meta.Description)
	})

	t.Run("locale tags are canonicalized to BCP-47 casing", func(t *testing.T) {
		plugin, err := CompilePlugin(
			routingTestPluginSource(
				"localized-text",
				0,
				`["model"]`,
				`description: {EN: "Video generation via the vendor API", "zh-tw": "透過廠商介面產生影片", "zh-hans": "通过厂商接口生成视频"},`,
				"",
			),
			Options{},
		)
		require.NoError(t, err)
		assert.Equal(t, LocalizedText{
			"en":      "Video generation via the vendor API",
			"zh-TW":   "透過廠商介面產生影片",
			"zh-Hans": "通过厂商接口生成视频",
		}, plugin.Meta.Description)
	})

	for _, testCase := range []struct {
		name          string
		metaFields    string
		expectedError string
	}{
		{
			name:          "map missing en",
			metaFields:    `description: {zh: "通过厂商接口生成视频"},`,
			expectedError: `must include a non-empty "en" value`,
		},
		{
			name:          "name map missing en",
			metaFields:    `name: {zh: "多语言名称"},`,
			expectedError: `plugin meta name must include a non-empty "en" value`,
		},
		{
			name:          "name exceeds 128 runes",
			metaFields:    `name: {en: "` + strings.Repeat("x", 129) + `"},`,
			expectedError: "name must not exceed 128 characters",
		},
		{
			name:          "en is whitespace",
			metaFields:    `description: {en: "   ", zh: "通过厂商接口生成视频"},`,
			expectedError: `value for "en" must be a non-empty string`,
		},
		{
			name:          "chinese locale key",
			metaFields:    `description: {en: "Video generation via the vendor API", "英文": "通过厂商接口生成视频"},`,
			expectedError: `invalid locale "英文"`,
		},
		{
			name:          "empty locale key",
			metaFields:    `description: {en: "Video generation via the vendor API", "": "through the vendor API"},`,
			expectedError: `invalid locale ""`,
		},
		{
			name:          "oversized locale key",
			metaFields:    `description: {en: "Video generation via the vendor API", toolonglocalekey123456: "through the vendor API"},`,
			expectedError: `invalid locale "toolonglocalekey123456"`,
		},
		{
			name:          "case-variant duplicate locale",
			metaFields:    `description: {en: "Video generation via the vendor API", EN: "duplicate"},`,
			expectedError: `duplicate locale "en"`,
		},
		{
			name:          "meta description exceeds 512 runes",
			metaFields:    `description: "` + strings.Repeat("x", 513) + `",`,
			expectedError: "description must not exceed 512 characters",
		},
		{
			name:          "usage field description exceeds 256 runes",
			metaFields:    `usageSchema: {seconds: {type: "number", unit: "second", description: "` + strings.Repeat("x", 257) + `"}},`,
			expectedError: "description must not exceed 256 characters",
		},
		{
			name:          "control character",
			metaFields:    `description: "Video\u0000 generation via the vendor API",`,
			expectedError: "must not contain control characters",
		},
		{
			name:          "more than 16 locales",
			metaFields:    `description: {en:"a",aa:"a",ab:"a",af:"a",ak:"a",am:"a",an:"a",ar:"a",as:"a",av:"a",ay:"a",az:"a",ba:"a",be:"a",bg:"a",bh:"a",bi:"a"},`,
			expectedError: "must not exceed 16 locales",
		},
		{
			name:          "description number",
			metaFields:    `description: 1,`,
			expectedError: "description must be a string or object",
		},
		{
			name:          "description array",
			metaFields:    `description: ["Video generation via the vendor API"],`,
			expectedError: "description must be a string or object",
		},
		{
			name:          "unknown meta field is still rejected",
			metaFields:    `description: "Video generation via the vendor API", extra: true,`,
			expectedError: `unknown field "extra"`,
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			_, err := CompilePlugin(
				routingTestPluginSource("localized-text", 0, `["model"]`, testCase.metaFields, ""),
				Options{},
			)
			require.ErrorContains(t, err, testCase.expectedError)
		})
	}

	t.Run("boundary rune lengths and 16 locales are accepted", func(t *testing.T) {
		plugin, err := CompilePlugin(
			routingTestPluginSource(
				"localized-text",
				0,
				`["model"]`,
				`description: {en:"a",aa:"a",ab:"a",af:"a",ak:"a",am:"a",an:"a",ar:"a",as:"a",av:"a",ay:"a",az:"a",ba:"a",be:"a",bg:"a",bh:"a"},
				usageSchema: {seconds: {type: "number", unit: "second", description: "`+strings.Repeat("x", 256)+`"}},`,
				"",
			),
			Options{},
		)
		require.NoError(t, err)
		assert.Len(t, plugin.Meta.Description, 16)
		assert.Equal(t, 256, len([]rune(plugin.Meta.UsageSchema["seconds"].Description["en"])))

		plugin, err = CompilePlugin(
			routingTestPluginSource("localized-text-max", 0, `["model"]`, `description: "`+strings.Repeat("x", 512)+`",`, ""),
			Options{},
		)
		require.NoError(t, err)
		assert.Equal(t, 512, len([]rune(plugin.Meta.Description["en"])))
	})

	for _, testCase := range []struct {
		name          string
		mutate        func(*Meta)
		expectedError string
	}{
		{
			name: "ValidateV1Meta map missing en",
			mutate: func(meta *Meta) {
				meta.Description = LocalizedText{"zh": "通过厂商接口生成视频"}
			},
			expectedError: `must include a non-empty "en" value`,
		},
		{
			name: "ValidateV1Meta blank en",
			mutate: func(meta *Meta) {
				meta.Description = LocalizedText{"en": "  "}
			},
			expectedError: `value for "en" must be a non-empty string`,
		},
		{
			name: "ValidateV1Meta invalid locale",
			mutate: func(meta *Meta) {
				meta.Description = LocalizedText{"en": "Video generation via the vendor API", "英文": "通过厂商接口生成视频"}
			},
			expectedError: `invalid locale "英文"`,
		},
		{
			name: "ValidateV1Meta usage field too long",
			mutate: func(meta *Meta) {
				meta.UsageSchema = map[string]UsageFieldSchema{
					"seconds": {Type: "number", Unit: "second", Description: LocalizedText{"en": strings.Repeat("x", 257)}},
				}
			},
			expectedError: "description must not exceed 256 characters",
		},
		{
			name: "ValidateV1Meta name map missing en",
			mutate: func(meta *Meta) {
				meta.NameI18n = LocalizedText{"zh": "多语言名称"}
			},
			expectedError: `plugin meta name must include a non-empty "en" value`,
		},
		{
			name: "ValidateV1Meta control character",
			mutate: func(meta *Meta) {
				meta.Description = LocalizedText{"en": "Video\u0000 generation via the vendor API"}
			},
			expectedError: "must not contain control characters",
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			meta := validMeta()
			testCase.mutate(&meta)
			require.ErrorContains(t, ValidateV1Meta(meta), testCase.expectedError)
		})
	}

	t.Run("MarshalJSON of Meta description is an object", func(t *testing.T) {
		meta := validMeta()
		meta.Description = LocalizedText{"en": "Video generation via the vendor API", "zh": "通过厂商接口生成视频"}
		encoded, err := common.Marshal(meta)
		require.NoError(t, err)
		var raw map[string]any
		require.NoError(t, common.Unmarshal(encoded, &raw))
		object, ok := raw["description"].(map[string]any)
		require.True(t, ok, "API description must be an object, got %T", raw["description"])
		assert.Equal(t, "Video generation via the vendor API", object["en"])
		assert.Equal(t, "通过厂商接口生成视频", object["zh"])
	})

	t.Run("UnmarshalJSON accepts string and object", func(t *testing.T) {
		var fromString LocalizedText
		require.NoError(t, common.Unmarshal([]byte(`"Video generation via the vendor API"`), &fromString))
		assert.Equal(t, LocalizedText{"en": "Video generation via the vendor API"}, fromString)

		var fromObject LocalizedText
		require.NoError(t, common.Unmarshal([]byte(`{"en":"Video generation via the vendor API","zh":"通过厂商接口生成视频"}`), &fromObject))
		assert.Equal(t, LocalizedText{"en": "Video generation via the vendor API", "zh": "通过厂商接口生成视频"}, fromObject)

		encoded, err := common.Marshal(fromString)
		require.NoError(t, err)
		assert.Equal(t, `{"en":"Video generation via the vendor API"}`, string(encoded))
	})

	t.Run("cloneMeta deep-copies localized text", func(t *testing.T) {
		registry := NewRegistry()
		_, err := registry.Register(
			routingTestPluginSource(
				"localized-text",
				0,
				`["model"]`,
				`description: {en: "Video generation via the vendor API", zh: "通过厂商接口生成视频"},
				usageSchema: {seconds: {type: "number", unit: "second", description: {en: "Generated media duration."}}},`,
				"",
			),
			Options{},
		)
		require.NoError(t, err)
		snapshot := registry.Snapshot()
		require.Len(t, snapshot.Override, 1)
		snapshot.Override[0].Description["en"] = "changed"
		snapshot.Override[0].UsageSchema["seconds"].Description["en"] = "changed"
		plugin, ok := registry.Get("localized-text")
		require.True(t, ok)
		assert.Equal(t, "Video generation via the vendor API", plugin.Meta.Description["en"])
		assert.Equal(t, "Generated media duration.", plugin.Meta.UsageSchema["seconds"].Description["en"])
	})
}

func TestRegistryNormalizesBaseURL(t *testing.T) {
	absent, err := CompilePlugin(routingTestPluginSource("base-url-absent", 0, `["model"]`, "", ""), Options{})
	require.NoError(t, err)
	assert.Empty(t, absent.Meta.BaseURL)

	_, err = CompilePlugin(routingTestPluginSource("base-url-type", 0, `["model"]`, "baseUrl: 1,", ""), Options{})
	require.ErrorContains(t, err, "baseUrl must be a string")

	tests := []struct {
		name      string
		input     string
		want      string
		wantError string
	}{
		{name: "https accepted", input: "https://api.example.com", want: "https://api.example.com"},
		{name: "http accepted", input: "http://api.example.com", want: "http://api.example.com"},
		{name: "loopback with port accepted", input: "http://127.0.0.1:8000", want: "http://127.0.0.1:8000"},
		{name: "ipv6 literal with port and path accepted", input: "http://[::1]:8000/api/", want: "http://[::1]:8000/api"},
		{name: "trailing slashes stripped", input: "https://api.example.com/v1//", want: "https://api.example.com/v1"},
		{name: "scheme and host lowercased, path preserved", input: "HTTPS://API.Example.COM/V1", want: "https://api.example.com/V1"},
		{name: "userinfo rejected", input: "https://user:pass@api.example.com", wantError: "credentials"},
		{name: "query rejected", input: "https://api.example.com/?x=1", wantError: "query or fragment"},
		{name: "fragment rejected", input: "https://api.example.com/#x", wantError: "query or fragment"},
		{name: "non-http scheme rejected", input: "ftp://api.example.com", wantError: "http or https"},
		{name: "relative value rejected", input: "/v1", wantError: "absolute"},
		{name: "non-ascii host rejected", input: "https://例子.com", wantError: "ASCII"},
		{name: "embedded whitespace rejected", input: "https://api.example.com/a b", wantError: "whitespace"},
		{name: "192 characters rejected", input: "https://api.example.com/" + strings.Repeat("a", 168), wantError: "191"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			loaded, err := CompilePlugin(routingTestPluginSource("base-url", 0, `["model"]`, fmt.Sprintf("baseUrl: %q,", test.input), ""), Options{})
			if test.wantError != "" {
				require.ErrorContains(t, err, test.wantError)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, test.want, loaded.Meta.BaseURL)
		})
	}
}

func TestRegistryNormalizesAllowedHosts(t *testing.T) {
	tests := []struct {
		name      string
		hosts     string
		want      []string
		wantError string
	}{
		{name: "hostname lowercased", hosts: `["Upload.Example.com"]`, want: []string{"upload.example.com"}},
		{name: "host with port accepted", hosts: `["upload.example.com:8443"]`, want: []string{"upload.example.com:8443"}},
		{name: "bracketed ipv6 with port accepted", hosts: `["[::1]:8080"]`, want: []string{"[::1]:8080"}},
		{name: "bracketed ipv6 accepted", hosts: `["[::1]"]`, want: []string{"[::1]"}},
		{name: "bare ipv6 normalized to brackets", hosts: `["::1"]`, want: []string{"[::1]"}},
		{name: "scheme rejected", hosts: `["https://upload.example.com"]`, wantError: "without schemes"},
		{name: "path rejected", hosts: `["upload.example.com/v1"]`, wantError: "without schemes"},
		{name: "credentials rejected", hosts: `["user@upload.example.com"]`, wantError: "without schemes"},
		{name: "port out of range rejected", hosts: `["upload.example.com:99999"]`, wantError: "between 1 and 65535"},
		{name: "non-numeric port rejected", hosts: `["upload.example.com:abc"]`, wantError: "between 1 and 65535"},
		{name: "malformed ipv6 rejected", hosts: `["fe80::1::2"]`, wantError: "bracketed"},
		{name: "duplicate after normalization rejected", hosts: `["a.example.com", "A.example.com"]`, wantError: "unique"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			loaded, err := CompilePlugin(routingTestPluginSource("hosts", 0, `["model"]`, "allowedHosts: "+test.hosts+",", ""), Options{})
			if test.wantError != "" {
				require.ErrorContains(t, err, test.wantError)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, test.want, loaded.Meta.AllowedHosts)
		})
	}
}

func TestRegistryRejectsImageReferencesInMetaIcon(t *testing.T) {
	for _, icon := range []string{"data:image/png;base64,iVBORw0KGgo=", "https://example.com/icon.png"} {
		_, err := CompilePlugin(routingTestPluginSource("icon-ref", 0, `["model"]`, fmt.Sprintf("icon: %q,", icon), ""), Options{})
		require.ErrorContains(t, err, "icon.svg or icon.png file")
	}
}

func TestDecodeIconDataURI(t *testing.T) {
	svg := func(body string) string {
		return "data:image/svg+xml;base64," + base64.StdEncoding.EncodeToString([]byte(body))
	}
	pngBytes := append([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}, make([]byte, 16)...)
	tests := []struct {
		name      string
		icon      string
		wantType  string
		wantError string
	}{
		{name: "small svg accepted", icon: svg(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 16 16"><defs><circle id="a" cx="8" cy="8" r="6" fill="#0af"/></defs><use xlink:href="#a"/><style>@media (prefers-color-scheme: dark) { circle { fill: #fff } }</style></svg>`), wantType: "image/svg+xml"},
		{name: "small png accepted", icon: "data:image/png;base64," + base64.StdEncoding.EncodeToString(pngBytes), wantType: "image/png"},
		{name: "svg script element rejected", icon: svg(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`), wantError: "script"},
		{name: "svg foreignObject rejected", icon: svg(`<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div/></foreignObject></svg>`), wantError: "foreignObject"},
		{name: "svg event handler attribute rejected", icon: svg(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>`), wantError: "event handler"},
		{name: "svg external image href rejected", icon: svg(`<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/a.png"/></svg>`), wantError: "external"},
		{name: "svg javascript href with entity split rejected", icon: svg(`<svg xmlns="http://www.w3.org/2000/svg"><a href="java&#10;script:alert(1)"><text>x</text></a></svg>`), wantError: "external"},
		{name: "svg style import rejected", icon: svg(`<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(evil.css)</style></svg>`), wantError: "external"},
		{name: "svg doctype rejected", icon: svg(`<!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg"/>`), wantError: "DOCTYPE"},
		{name: "non-svg root rejected", icon: svg(`<html><svg/></html>`), wantError: "root element"},
		{name: "malformed svg rejected", icon: svg(`<svg xmlns="http://www.w3.org/2000/svg"><g></svg>`), wantError: "well-formed"},
		{name: "non-image media type rejected", icon: "data:text/html;base64," + base64.StdEncoding.EncodeToString([]byte("<b>x</b>")), wantError: "image/png"},
		{name: "charset parameter rejected", icon: "data:image/svg+xml;charset=utf-8;base64," + base64.StdEncoding.EncodeToString([]byte("<svg/>")), wantError: "image/png"},
		{name: "missing data prefix rejected", icon: "image/png;base64,iVBORw0KGgo=", wantError: "image/png"},
		{name: "malformed base64 rejected", icon: "data:image/png;base64,@@@", wantError: "base64"},
		{name: "png signature enforced", icon: "data:image/png;base64," + base64.StdEncoding.EncodeToString([]byte("not a png")), wantError: "not a PNG"},
		{name: "oversize payload rejected", icon: svg(`<svg xmlns="http://www.w3.org/2000/svg">` + strings.Repeat("<g/>", 140000) + `</svg>`), wantError: "must not exceed"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			mediaType, data, err := DecodeIconDataURI(test.icon)
			if test.wantError != "" {
				require.ErrorContains(t, err, test.wantError)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, test.wantType, mediaType)
			assert.NotEmpty(t, data)
		})
	}
}

func TestPluginDisplayMetadata(t *testing.T) {
	for _, tc := range []struct {
		name, fields string
		priority     int
		website      string
		invalid      bool
	}{
		{name: "omitted"},
		{name: "zero and empty", fields: `sortPriority: 0, website: "",`},
		{name: "positive", fields: `sortPriority: 20, website: " https://example.com/docs?q=1#intro ",`, priority: 20, website: "https://example.com/docs?q=1#intro"},
		{name: "minimum", fields: `sortPriority: -2147483648,`, priority: -2147483648},
		{name: "maximum", fields: `sortPriority: 2147483647,`, priority: 2147483647},
		{name: "underflow", fields: `sortPriority: -2147483649,`, invalid: true},
		{name: "overflow", fields: `sortPriority: 2147483648,`, invalid: true},
		{name: "fraction", fields: `sortPriority: 1.5,`, invalid: true},
		{name: "numeric string", fields: `sortPriority: "1",`, invalid: true},
		{name: "null priority", fields: `sortPriority: null,`, invalid: true},
		{name: "nonfinite", fields: `sortPriority: Infinity,`, invalid: true},
		{name: "website type", fields: `website: 1,`, invalid: true},
		{name: "http", fields: `website: "http://example.com",`, invalid: true},
		{name: "relative", fields: `website: "/docs",`, invalid: true},
		{name: "missing host", fields: `website: "https:///docs",`, invalid: true},
		{name: "credentials", fields: `website: "https://user:pass@example.com",`, invalid: true},
		{name: "empty credentials", fields: `website: "https://@example.com",`, invalid: true},
		{name: "javascript", fields: `website: "javascript:alert(1)",`, invalid: true},
		{name: "invalid host", fields: `website: "https://-example.com",`, invalid: true},
		{name: "invalid port", fields: `website: "https://example.com:99999",`, invalid: true},
		{name: "whitespace", fields: `website: "https://example.com/a b",`, invalid: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			loaded, err := CompilePlugin(routingTestPluginSource("display", 0, `["model"]`, tc.fields, ""), Options{})
			if tc.invalid {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.priority, loaded.Meta.SortPriority)
			assert.Equal(t, tc.website, loaded.Meta.Website)
			encoded, err := common.Marshal(loaded.Meta)
			require.NoError(t, err)
			var decoded Meta
			require.NoError(t, common.Unmarshal(encoded, &decoded))
			assert.Equal(t, tc.priority, decoded.SortPriority)
			assert.Equal(t, tc.website, decoded.Website)
		})
	}
}

func TestRegistryUsageProfilesReplaceDefaultsAndIsolateSnapshots(t *testing.T) {
	source := routingTestPluginSource("usage-profiles", 0, `["image", "video", "default", "empty"]`, `
usageSchema: {seconds: {type: "number", unit: "second"}},
usageExamples: [{label: "default", facts: {seconds: 1}}],
usageProfiles: [
  {models: ["image"], schema: {image_count: {type: "number", unit: "count", unitLabel: {en: "image", zh: "张"}}}},
  {models: ["video"], schema: {
    seconds: {type: "number", unit: "second", description: {en: "Duration"}},
    resolution: {enum: ["720P", "1080P"], enumLabels: {"720P": {en: "HD"}}}
  }, examples: [{label: "HD video", facts: {seconds: 5, resolution: "720P"}}]},
  {models: ["empty"], schema: {}}
],`, "")
	registry := NewRegistry()
	plugin, err := registry.Register(source, Options{})
	require.NoError(t, err)

	for _, model := range []string{"image", "IMAGE"} {
		schema, examples := plugin.Meta.UsageForModel(model)
		assert.Equal(t, map[string]UsageFieldSchema{"image_count": {Type: "number", Unit: "count", UnitLabel: LocalizedText{"en": "image", "zh": "张"}}}, schema)
		assert.Nil(t, examples, "profiles must not inherit unrelated default examples")
	}
	for _, model := range []string{"default", "unknown", ""} {
		schema, examples := plugin.Meta.UsageForModel(model)
		assert.Equal(t, plugin.Meta.UsageSchema, schema)
		assert.Equal(t, plugin.Meta.UsageExamples, examples)
	}
	schema, examples := plugin.Meta.UsageForModel("empty")
	assert.Empty(t, schema)
	assert.Nil(t, examples)

	// A channel mapping may send a declared model to an undeclared endpoint ID:
	// the first profiled candidate wins, otherwise the defaults apply.
	schema, examples = plugin.Meta.UsageForModels("ep-endpoint", "image")
	assert.Equal(t, plugin.Meta.UsageProfiles[0].Schema, schema)
	assert.Nil(t, examples)
	schema, _ = plugin.Meta.UsageForModels("video", "image")
	assert.Equal(t, plugin.Meta.UsageProfiles[1].Schema, schema)
	schema, examples = plugin.Meta.UsageForModels("ep-endpoint", "default")
	assert.Equal(t, plugin.Meta.UsageSchema, schema)
	assert.Equal(t, plugin.Meta.UsageExamples, examples)

	snapshot := registry.Snapshot()
	require.Len(t, snapshot.Override, 1)
	profile := &snapshot.Override[0].UsageProfiles[1]
	snapshot.Override[0].UsageProfiles[0].Schema["image_count"].UnitLabel["en"] = "Changed"
	imageSchema, _ := registry.Snapshot().Override[0].UsageForModel("image")
	assert.Equal(t, "image", imageSchema["image_count"].UnitLabel["en"])
	profile.Models[0] = "changed"
	profile.Schema["seconds"].Description["en"] = "Changed"
	profile.Schema["resolution"].Enum[0] = "changed"
	profile.Schema["resolution"].EnumLabels["720P"]["en"] = "Changed"
	profile.Examples[0].Label = "Changed"
	profile.Examples[0].Facts["seconds"] = 99
	delete(profile.Schema, "seconds")

	schema, examples = registry.Snapshot().Override[0].UsageForModel("video")
	assert.Equal(t, "Duration", schema["seconds"].Description["en"])
	assert.Equal(t, []string{"720P", "1080P"}, schema["resolution"].Enum)
	assert.Equal(t, "HD", schema["resolution"].EnumLabels["720P"]["en"])
	require.Len(t, examples, 1)
	assert.Equal(t, "HD video", examples[0].Label)
	assert.EqualValues(t, 5, examples[0].Facts["seconds"])

	legacy, err := CompilePlugin(routingTestPluginSource("legacy-usage", 0, `["image"]`,
		`usageSchema: {seconds: {type: "number", unit: "second"}},`, ""), Options{})
	require.NoError(t, err)
	schema, examples = legacy.Meta.UsageForModel("image")
	assert.Equal(t, legacy.Meta.UsageSchema, schema)
	assert.Nil(t, examples)
}

func TestRegistryRejectsInvalidUsageProfiles(t *testing.T) {
	for _, tc := range []struct {
		name, profiles, errorText string
	}{
		{"null", `null`, "usageProfiles must be an array"},
		{"object", `{}`, "usageProfiles must be an array"},
		{"invalid entry", `[null]`, "must be an object"},
		{"unknown property", `[{models:["image"], schema:{}, extra:true}]`, "unknown field"},
		{"missing models", `[{schema:{}}]`, "at least one model"},
		{"empty models", `[{models:[], schema:{}}]`, "at least one model"},
		{"unknown model", `[{models:["other"], schema:{}}]`, "not declared"},
		{"noncanonical model", `[{models:[" image"], schema:{}}]`, "canonical names"},
		{"wrong declared spelling", `[{models:["IMAGE"], schema:{}}]`, "not declared"},
		{"duplicate models", `[{models:["image","IMAGE"], schema:{}}]`, "unique case-insensitively"},
		{"overlapping profiles", `[{models:["image"], schema:{}}, {models:["image"], schema:{}}]`, "multiple profiles"},
		{"missing schema", `[{models:["image"]}]`, "must be an object"},
		{"invalid field", `[{models:["image"], schema:{n:{type:"number", unit:"invalid"}}}]`, "unit must be"},
		{"noncanonical field", `[{models:["image"], schema:{" n":{type:"number", unit:"count"}}}]`, "canonical names"},
		{"tokens need examples", `[{models:["image"], schema:{tokens:{type:"number", unit:"token"}}}]`, "usageExamples is required"},
		{"examples use own schema", `[{models:["image"], schema:{n:{type:"number", unit:"count"}}, examples:[{label:"wrong", facts:{seconds:1}}]}]`, "usageProfiles[0]"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			source := routingTestPluginSource("invalid-profile", 0, `["image", "video"]`,
				`usageSchema: {seconds: {type:"number", unit:"second"}}, usageExamples: [{label:"default", facts:{seconds:1}}], usageProfiles: `+tc.profiles+`,`, "")
			_, err := CompilePlugin(source, Options{})
			require.ErrorContains(t, err, tc.errorText)
		})
	}

	plugin, err := CompilePlugin(routingTestPluginSource("token-profile", 0, `["image"]`, `
usageProfiles: [{models:["image"], schema:{tokens:{type:"number", unit:"token"}}, examples:[{label:"one token", facts:{tokens:1}}]}],`, ""), Options{})
	require.NoError(t, err)
	schema, examples := plugin.Meta.UsageForModel("image")
	assert.Equal(t, "token", schema["tokens"].Unit)
	require.Len(t, examples, 1)
	assert.EqualValues(t, 1, examples[0].Facts["tokens"])
	plugin.Meta.UsageProfiles[0].Schema = nil
	require.ErrorContains(t, ValidateV1Meta(plugin.Meta), "schema must be an object")
}

func TestUpstreamsManifestContract(t *testing.T) {
	for _, tc := range []struct {
		name, metadata string
		valid, newAPI  bool
	}{
		{"omitted implies vendor", "", true, false},
		{"vendor only", `upstreams:["vendor"],`, true, false},
		{"vendor and new api", `upstreams:["vendor","new_api"],`, true, true},
		{"new api only still serves its vendor", `upstreams:["new_api"],`, true, true},
		{"unknown kind", `upstreams:["gateway"],`, false, false},
		{"duplicate", `upstreams:["new_api","new_api"],`, false, false},
		{"null", `upstreams:null,`, false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			plugin, err := CompilePlugin(routingTestPluginSource("upstreams", 0, `["model"]`, tc.metadata, ""), Options{})
			if !tc.valid {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.NoError(t, ValidateV1Meta(plugin.Meta))
			assert.True(t, plugin.Meta.SupportsUpstream(UpstreamKindVendor))
			assert.Equal(t, tc.newAPI, plugin.Meta.SupportsUpstream(UpstreamKindNewAPI))
		})
	}
}

func TestSubmitResponseTypesContract(t *testing.T) {
	for _, tc := range []struct {
		name, metadata, hook string
		valid                bool
	}{
		{"legacy JSON", "", "", true},
		{"SSE declared", `submitResponseTypes:["json","sse"],`, `export function parseSubmitEvent(){return {state:null,done:true};}`, true},
		{"host JSON utility", `requiredCapabilities:["json-clone@1"],`, "", true},
		{"SSE delta", `submitResponseTypes:["sse"],requiredCapabilities:["submit-sse-delta@1"],`, `export function parseSubmitEventDelta(){return {changes:[],state:null,done:true};}`, true},
		{"SSE delta missing hook", `submitResponseTypes:["sse"],requiredCapabilities:["submit-sse-delta@1"],`, `export function parseSubmitEvent(){return {state:null,done:true};}`, false},
		{"SSE delta hook without declaration", `submitResponseTypes:["sse"],`, `export function parseSubmitEventDelta(){return {changes:[],state:null,done:true};}`, true},
		{"SSE snapshot and delta hooks", `submitResponseTypes:["sse"],`, `export function parseSubmitEvent(){return {state:null,done:true};}
export function parseSubmitEventDelta(){return {changes:[],state:null,done:true};}`, true},
		{"delta requires SSE", `requiredCapabilities:["submit-sse-delta@1"],`, "", false},
		{"unsupported capability version", `requiredCapabilities:["json-clone@2"],`, "", false},
		{"duplicate capability", `requiredCapabilities:["json-clone@1","json-clone@1"],`, "", false},
		{"null capabilities", `requiredCapabilities:null,`, "", false},
		{"missing hook", `submitResponseTypes:["sse"],`, "", false},
		{"unknown type", `submitResponseTypes:["xml"],`, "", false},
		{"duplicate", `submitResponseTypes:["json","json"],`, "", false},
		{"empty", `submitResponseTypes:[],`, "", false},
		{"null", `submitResponseTypes:null,`, "", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			source := routingTestPluginSource("submit-types", 0, `["model"]`, tc.metadata, "") + tc.hook
			plugin, err := CompilePlugin(source, Options{})
			if tc.valid {
				require.NoError(t, err)
				require.NoError(t, ValidateV1Meta(plugin.Meta))
			} else {
				require.Error(t, err)
			}
		})
	}
}

func compileConfigPlugin(schema string) (*LoadedPlugin, error) {
	return CompilePlugin(`export const meta = {apiVersion: 1, key: "redact", name: "Redact", version: "1.0.0", author: {name: "Test"}, configSchema: `+schema+`};
export function ingress() { return {action: "continue"}; }`, Options{})
}

func TestConfigSchemaContract(t *testing.T) {
	// The normalized schema keeps the declared property order and writes
	// every LocalizedText as an object.
	plugin, err := compileConfigPlugin(`{type: "object", required: ["rules"], properties: {
  rules: {type: "array", title: "Rules", items: {type: "object", title: "Rule", properties: {
    pattern: {type: "string", title: {en: "Pattern", zh: "规则"}, format: "regex", minLength: 1},
    mode: {type: "string", title: "Mode", enum: ["keyword", "regex"], enumTitles: ["Keyword", {en: "Regex", "ZH-cn": "正则"}], default: "keyword"},
  }, required: ["pattern"]}},
  message: {type: "string", title: "Message", format: "textarea", examples: ["Blocked"]},
  extra: {type: "object", title: "Extra", format: "json"},
}}`)
	require.NoError(t, err)
	assert.Equal(t, `{"type":"object","properties":{`+
		`"rules":{"type":"array","title":{"en":"Rules"},"items":{"type":"object","title":{"en":"Rule"},"properties":{`+
		`"pattern":{"type":"string","title":{"en":"Pattern","zh":"规则"},"minLength":1,"format":"regex"},`+
		`"mode":{"type":"string","title":{"en":"Mode"},"default":"keyword","enum":["keyword","regex"],"enumTitles":[{"en":"Keyword"},{"en":"Regex","zh-CN":"正则"}]}},`+
		`"required":["pattern"]}},`+
		`"message":{"type":"string","title":{"en":"Message"},"examples":["Blocked"],"format":"textarea"},`+
		`"extra":{"type":"object","title":{"en":"Extra"},"format":"json"}},"required":["rules"]}`, string(plugin.Meta.ConfigSchemaJSON()))
	encoded, err := common.Marshal(plugin.Meta)
	require.NoError(t, err)
	assert.Contains(t, string(encoded), `"configSchema":{"type":"object","properties":{"rules":`)

	// unit and visibleWhen are display hints: the normalized schema writes
	// every visibleWhen value as a list, and a hidden property is still
	// checked and gets its default.
	plugin, err = compileConfigPlugin(`{type: "object", properties: {
  mode: {type: "string", title: "Mode", enum: ["lossless", "lossy"], default: "lossless"},
  level: {type: "integer", title: "Level", enum: [1, 2, 3]},
  strict: {type: "boolean", title: "Strict"},
  maxSide: {type: "integer", title: "Maximum side", minimum: 16, default: 2048, unit: "pixel", visibleWhen: {mode: "lossy"}},
  minBytes: {type: "number", title: "Minimum size", unit: "byte", visibleWhen: {strict: true, mode: ["lossy", "lossless"], level: [1, 3]}},
  rules: {type: "array", title: "Rules", items: {type: "object", title: "Rule", properties: {
    kind: {type: "string", title: "Kind", enum: ["keyword", "regex"]},
    flags: {type: "string", title: "Flags", visibleWhen: {kind: "regex"}},
  }}},
}}`)
	require.NoError(t, err)
	assert.Equal(t, `{"type":"object","properties":{`+
		`"mode":{"type":"string","title":{"en":"Mode"},"default":"lossless","enum":["lossless","lossy"]},`+
		`"level":{"type":"integer","title":{"en":"Level"},"enum":[1,2,3]},`+
		`"strict":{"type":"boolean","title":{"en":"Strict"}},`+
		`"maxSide":{"type":"integer","title":{"en":"Maximum side"},"default":2048,"minimum":16,"unit":"pixel","visibleWhen":{"mode":["lossy"]}},`+
		`"minBytes":{"type":"number","title":{"en":"Minimum size"},"unit":"byte","visibleWhen":{"level":[1,3],"mode":["lossy","lossless"],"strict":[true]}},`+
		`"rules":{"type":"array","title":{"en":"Rules"},"items":{"type":"object","title":{"en":"Rule"},"properties":{`+
		`"kind":{"type":"string","title":{"en":"Kind"},"enum":["keyword","regex"]},`+
		`"flags":{"type":"string","title":{"en":"Flags"},"visibleWhen":{"kind":["regex"]}}}}}}}`, string(plugin.Meta.ConfigSchemaJSON()))
	validated, err := plugin.ValidateConfig(json.RawMessage(`{}`))
	require.NoError(t, err)
	assert.Equal(t, `{"maxSide":2048,"mode":"lossless"}`, string(validated))
	_, err = plugin.ValidateConfig(json.RawMessage(`{"mode":"lossless","maxSide":8}`))
	require.ErrorContains(t, err, "config.maxSide must be at least 16")

	for name, tc := range map[string]struct{ schema, message string }{
		"unknown member":                     {`{type: "object", properties: {a: {type: "string", title: "A", placeholder: "x"}}}`, `properties.a has unknown member "placeholder"`},
		"unknown schema member":              {`{type: "object", properties: {}, title: "Config"}`, `configSchema has unknown member "title"`},
		"member of another type":             {`{type: "object", properties: {a: {type: "number", title: "A", pattern: "x"}}}`, "pattern does not apply to a field of type number"},
		"missing title":                      {`{type: "object", properties: {a: {type: "string"}}}`, "properties.a.title is required"},
		"title without en":                   {`{type: "object", properties: {a: {type: "string", title: {zh: "甲"}}}}`, `must include a non-empty "en" value`},
		"too deep":                           {`{type: "object", properties: {a: {type: "array", title: "A", items: {type: "object", title: "B", properties: {c: {type: "array", title: "C", items: {type: "array", title: "D", items: {type: "string", title: "E"}}}}}}}}`, "nests deeper than 4 levels"},
		"enumTitles length":                  {`{type: "object", properties: {a: {type: "string", title: "A", enum: ["x", "y"], enumTitles: ["X"]}}}`, "enumTitles must be an array as long as enum"},
		"enumTitles without enum":            {`{type: "object", properties: {a: {type: "string", title: "A", enumTitles: ["X"]}}}`, "enumTitles must be an array as long as enum"},
		"enum of another type":               {`{type: "object", properties: {a: {type: "integer", title: "A", enum: [1, 1.5]}}}`, "enum values must be of type integer"},
		"bad pattern":                        {`{type: "object", properties: {a: {type: "string", title: "A", pattern: "(?<=a)b"}}}`, "pattern is not a valid RE2 regular expression"},
		"bad format":                         {`{type: "object", properties: {a: {type: "string", title: "A", format: "json"}}}`, "format must be one of textarea, regex, url, password, keywords for a field of type string"},
		"url default":                        {`{type: "object", properties: {a: {type: "string", title: "A", format: "url", default: "api.example.com/v1"}}}`, "properties.a.default must be an absolute http or https URL without credentials or fragment"},
		"invalid default":                    {`{type: "object", properties: {a: {type: "integer", title: "A", minimum: 1, default: 0}}}`, "properties.a.default must be at least 1"},
		"required not declared":              {`{type: "object", properties: {a: {type: "string", title: "A"}}, required: ["b"]}`, "required must be an array of declared property names"},
		"schema not an object":               {`{type: "array", properties: {}}`, `configSchema must be {type: "object", properties: {...}}`},
		"unit on a string":                   {`{type: "object", properties: {a: {type: "string", title: "A", unit: "byte"}}}`, "properties.a.unit does not apply to a field of type string"},
		"unknown unit":                       {`{type: "object", properties: {a: {type: "integer", title: "A", unit: "meter"}}}`, "properties.a.unit must be one of byte, pixel, character, second"},
		"visibleWhen on the schema":          {`{type: "object", properties: {a: {type: "string", title: "A"}}, visibleWhen: {a: "x"}}`, `configSchema has unknown member "visibleWhen"`},
		"visibleWhen on items":               {`{type: "object", properties: {mode: {type: "string", title: "Mode"}, a: {type: "array", title: "A", items: {type: "string", title: "B", visibleWhen: {mode: "x"}}}}}`, "properties.a.items.visibleWhen applies only to a property"},
		"visibleWhen unknown sibling":        {`{type: "object", properties: {mode: {type: "string", title: "Mode"}, a: {type: "array", title: "A", items: {type: "object", title: "B", properties: {c: {type: "string", title: "C", visibleWhen: {mode: "x"}}}}}}}`, "properties.a.items.properties.c.visibleWhen.mode must name another property of the same object"},
		"visibleWhen on itself":              {`{type: "object", properties: {a: {type: "string", title: "A", visibleWhen: {a: "x"}}}}`, "properties.a.visibleWhen.a must name another property of the same object"},
		"visibleWhen sibling of type array":  {`{type: "object", properties: {tags: {type: "array", title: "Tags"}, a: {type: "string", title: "A", visibleWhen: {tags: "x"}}}}`, "properties.a.visibleWhen.tags must name a property of type string, number, integer or boolean"},
		"visibleWhen sibling of type object": {`{type: "object", properties: {extra: {type: "object", title: "Extra"}, a: {type: "string", title: "A", visibleWhen: {extra: {}}}}}`, "properties.a.visibleWhen.extra must name a property of type string, number, integer or boolean"},
		"visibleWhen value outside enum":     {`{type: "object", properties: {mode: {type: "string", title: "Mode", enum: ["a", "b"]}, x: {type: "string", title: "X", visibleWhen: {mode: ["a", "c"]}}}}`, "properties.x.visibleWhen.mode[1] must be one of the listed values"},
		"visibleWhen value type":             {`{type: "object", properties: {on: {type: "boolean", title: "On"}, x: {type: "string", title: "X", visibleWhen: {on: "yes"}}}}`, "properties.x.visibleWhen.on must be a boolean"},
		"visibleWhen empty":                  {`{type: "object", properties: {mode: {type: "string", title: "Mode"}, x: {type: "string", title: "X", visibleWhen: {}}}}`, "properties.x.visibleWhen must be a non-empty object"},
		"visibleWhen empty list":             {`{type: "object", properties: {mode: {type: "string", title: "Mode"}, x: {type: "string", title: "X", visibleWhen: {mode: []}}}}`, "properties.x.visibleWhen.mode must be a value or a non-empty array of values"},
		"visibleWhen repeated value":         {`{type: "object", properties: {level: {type: "integer", title: "Level"}, x: {type: "string", title: "X", visibleWhen: {level: [1, 2, 1]}}}}`, "properties.x.visibleWhen.level values must be unique"},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := compileConfigPlugin(tc.schema)
			require.ErrorContains(t, err, tc.message)
		})
	}

	_, err = CompilePlugin(`export const meta = {apiVersion: 1, key: "relay", name: "Relay", version: "1.0.0", author: {name: "Test"},
  relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/v1/chat/completions"}], configSchema: {type: "object", properties: {}}};`, Options{})
	require.ErrorContains(t, err, "configSchema belongs to the request processing part")
}

// meta.optional is a boolean of a plugin with a request processing part.
func TestOptionalManifestField(t *testing.T) {
	const head = `export const meta = {apiVersion: 1, key: "opt", name: "Opt", version: "1.0.0", author: {name: "Test"}%s};`
	const relay = `, relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/v1/chat/completions"}]`
	for name, tc := range map[string]struct {
		manifest, exports, message string
		optional                   bool
	}{
		"declared":                   {manifest: `, optional: true`, exports: `export function ingress() {}`, optional: true},
		"not declared":               {exports: `export function outbound() {}`},
		"report alone":               {manifest: `, optional: true`, exports: `export function report() {}`, optional: true},
		"not a boolean":              {manifest: `, optional: "yes"`, exports: `export function ingress() {}`, message: "plugin meta optional must be a boolean"},
		"no request processing part": {manifest: relay + `, optional: false`, message: "plugin opt meta optional belongs to the request processing part"},
	} {
		t.Run(name, func(t *testing.T) {
			plugin, err := CompilePlugin(fmt.Sprintf(head, tc.manifest)+tc.exports, Options{})
			if tc.message != "" {
				require.ErrorContains(t, err, tc.message)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.optional, plugin.Meta.Optional)
		})
	}
}

func TestValidateConfig(t *testing.T) {
	plugin, err := compileConfigPlugin(`{type: "object", properties: {
  rules: {type: "array", title: "Rules", maxItems: 2, items: {type: "object", title: "Rule", properties: {
    pattern: {type: "string", title: "Pattern", pattern: "^[a-z]+$"},
    caseSensitive: {type: "boolean", title: "Case sensitive", default: false},
  }, required: ["pattern"]}},
  quality: {type: "integer", title: "Quality", minimum: 1, maximum: 100, default: 85},
  format: {type: "string", title: "Format", enum: ["auto", "jpeg"], default: "auto"},
  tags: {type: "array", title: "Tags", uniqueItems: true, items: {type: "string", title: "Tag"}},
  override: {type: "object", title: "Override", format: "json"},
  endpoint: {type: "string", title: "Endpoint", format: "url"},
  apiKey: {type: "string", title: "API key", format: "password"},
}, required: ["rules"]}`)
	require.NoError(t, err)
	for name, tc := range map[string]struct{ config, want, message string }{
		"url and password":    {config: `{"rules":[],"endpoint":"http://127.0.0.1:8080/v1/moderations?x=1","apiKey":"sk-1"}`, want: `{"apiKey":"sk-1","endpoint":"http://127.0.0.1:8080/v1/moderations?x=1","format":"auto","quality":85,"rules":[]}`},
		"empty url":           {config: `{"rules":[],"endpoint":""}`, want: `{"endpoint":"","format":"auto","quality":85,"rules":[]}`},
		"url without scheme":  {config: `{"rules":[],"endpoint":"api.example.com/v1"}`, message: "config.endpoint must be an absolute http or https URL without credentials or fragment"},
		"url of another kind": {config: `{"rules":[],"endpoint":"ftp://api.example.com/v1"}`, message: "config.endpoint must be an absolute http or https URL"},
		"url credentials":     {config: `{"rules":[],"endpoint":"https://user:pass@api.example.com/v1"}`, message: "config.endpoint must be an absolute http or https URL"},
		"url fragment":        {config: `{"rules":[],"endpoint":"https://api.example.com/v1#top"}`, message: "config.endpoint must be an absolute http or https URL"},
		"defaults applied":    {config: `{"rules":[{"pattern":"abc"}]}`, want: `{"format":"auto","quality":85,"rules":[{"caseSensitive":false,"pattern":"abc"}]}`},
		"values kept":         {config: `{"rules":[],"quality":100,"format":"jpeg","tags":["a","b"],"override":{"operations":[1]}}`, want: `{"format":"jpeg","override":{"operations":[1]},"quality":100,"rules":[],"tags":["a","b"]}`},
		"required missing":    {config: `{}`, message: "config.rules is required"},
		"string type":         {config: `{"rules":[{"pattern":1}]}`, message: "config.rules[0].pattern must be a string"},
		"integer type":        {config: `{"rules":[],"quality":1.5}`, message: "config.quality must be an integer"},
		"maximum":             {config: `{"rules":[],"quality":101}`, message: "config.quality must not exceed 100"},
		"enum":                {config: `{"rules":[],"format":"png"}`, message: "config.format must be one of the listed values"},
		"pattern":             {config: `{"rules":[{"pattern":"ABC"}]}`, message: "config.rules[0].pattern does not match the required pattern"},
		"maxItems":            {config: `{"rules":[{"pattern":"a"},{"pattern":"b"},{"pattern":"c"}]}`, message: "config.rules must not have more than 2 items"},
		"uniqueItems":         {config: `{"rules":[],"tags":["a","a"]}`, message: "config.tags[1] repeats an earlier item"},
		"unknown property":    {config: `{"rules":[],"limit":1}`, message: `config has unknown property "limit"`},
		"nested unknown":      {config: `{"rules":[{"pattern":"a","flags":"i"}]}`, message: `config.rules[0] has unknown property "flags"`},
		"object type":         {config: `{"rules":[],"override":[]}`, message: "config.override must be an object"},
		"config not object":   {config: `[]`, message: "config must be a JSON object"},
		"config not JSON":     {config: `{`, message: "config must be a JSON object"},
		"null property value": {config: `{"rules":null}`, message: "config.rules must be an array"},
	} {
		t.Run(name, func(t *testing.T) {
			validated, err := plugin.ValidateConfig(json.RawMessage(tc.config))
			if tc.message != "" {
				require.ErrorContains(t, err, tc.message)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, string(validated))
		})
	}

	// The host and port of each url value, nested ones included, are hosts
	// utils.fetch may address; other strings are not.
	withURLs, err := compileConfigPlugin(`{type: "object", properties: {
  endpoint: {type: "string", title: "Endpoint", format: "url"},
  plain: {type: "string", title: "Plain"},
  sinks: {type: "array", title: "Sinks", items: {type: "object", title: "Sink", properties: {url: {type: "string", title: "URL", format: "url"}}}},
}}`)
	require.NoError(t, err)
	assert.Equal(t, []string{"api.example.com", "127.0.0.1:3100"}, withURLs.ConfigURLHosts(json.RawMessage(
		`{"endpoint":"https://api.example.com/v1","plain":"https://other.example/","sinks":[{"url":"http://127.0.0.1:3100/ingest"},{"url":""}]}`)))

	withoutSchema, err := CompilePlugin(`export const meta = {apiVersion: 1, key: "plain", name: "Plain", version: "1.0.0", author: {name: "Test"}};
export function egress() { return {action: "continue"}; }`, Options{})
	require.NoError(t, err)
	assert.Nil(t, withoutSchema.Meta.ConfigSchemaJSON())
	for _, config := range []string{`{}`, ` `, ``} {
		validated, err := withoutSchema.ValidateConfig(json.RawMessage(config))
		require.NoError(t, err, config)
		assert.Equal(t, `{}`, string(validated))
	}
	_, err = withoutSchema.ValidateConfig(json.RawMessage(`{"a":1}`))
	require.ErrorContains(t, err, "plugin plain takes no config; config must be {}")
}

// An exported validateConfig runs after the schema check, on the config with
// its defaults, and its throw is the error the administrator sees.
func TestValidateConfigExport(t *testing.T) {
	const head = `export const meta = {apiVersion: 1, key: "checked", name: "Checked", version: "1.0.0", author: {name: "Test"}, %s};
export function ingress() { return {action: "continue"}; }
`
	const schema = `configSchema: {type: "object", properties: {pattern: {type: "string", title: "Pattern", default: "a+"}, limit: {type: "integer", title: "Limit", maximum: 10}}}`
	plugin, err := CompilePlugin(fmt.Sprintf(head, schema)+`export function validateConfig(config) {
  if (config.pattern === undefined) throw new Error("defaults were not applied");
  if (config.pattern === "(") throw new Error("Rule has an invalid regular expression");
  if (config.limit === 6) while (true) {}
  if (config.limit === 7) throw new Error("x".repeat(300));
  if (config.limit === 8) utils.fetch({url: "https://example.com"});
  if (config.limit === 9) utils.paramOverride({}, {});
}`, Options{Timeout: 200 * time.Millisecond})
	require.NoError(t, err)
	for name, tc := range map[string]struct{ config, want, message string }{
		"passes with defaults": {config: `{}`, want: `{"pattern":"a+"}`},
		"passes":               {config: `{"pattern":"b+","limit":1}`, want: `{"limit":1,"pattern":"b+"}`},
		"schema check first":   {config: `{"limit":11}`, message: "config.limit must not exceed 10"},
		"throw is the error":   {config: `{"pattern":"("}`, message: "Rule has an invalid regular expression"},
		"utils.fetch throws":   {config: `{"limit":8}`, message: "utils.fetch is not available in validateConfig"},
		"paramOverride throws": {config: `{"limit":9}`, message: "utils.paramOverride is not available in validateConfig"},
		"timeout":              {config: `{"limit":6}`, message: "plugin checked validateConfig timed out"},
	} {
		t.Run(name, func(t *testing.T) {
			validated, err := plugin.ValidateConfig(json.RawMessage(tc.config))
			if tc.message != "" {
				require.ErrorContains(t, err, tc.message)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, string(validated))
		})
	}
	_, err = plugin.ValidateConfig(json.RawMessage(`{"limit":7}`))
	require.Error(t, err)
	assert.Equal(t, 256, utf8.RuneCountInString(err.Error()), "a long thrown message is cut to 256 characters")

	withoutSchema, err := CompilePlugin(fmt.Sprintf(head, `description: "No config"`)+`export function validateConfig(config) {
  if (Object.keys(config).length !== 0) throw new Error("expected {}");
  throw new Error("refused");
}`, Options{})
	require.NoError(t, err)
	_, err = withoutSchema.ValidateConfig(nil)
	require.EqualError(t, err, "refused")

	for name, tc := range map[string]struct{ source, message string }{
		"not a function": {fmt.Sprintf(head, schema) + `export const validateConfig = 1;`, `plugin checked export "validateConfig" is not a function`},
		"no request processing part": {`export const meta = {apiVersion: 1, key: "checked", name: "Checked", version: "1.0.0", author: {name: "Test"},
  relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/v1/chat/completions"}]};
export function validateConfig() {}`, "export validateConfig belongs to the request processing part"},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := CompilePlugin(tc.source, Options{})
			require.ErrorContains(t, err, tc.message)
		})
	}
}
