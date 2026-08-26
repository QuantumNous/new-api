package jsplugin

import (
	"fmt"
	"strings"
	"testing"

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

func TestRegistryDisabledOverrideFallsBackToFactoryAndCanBeRestored(t *testing.T) {
	registry := NewRegistry()
	require.NoError(t, registerTestPlugin(registry, "1.0.0-factory", true))
	require.NoError(t, registerTestPlugin(registry, "1.0.0-override", false))

	registry.SetOverrideEnabled(false)
	plugin, ok := registry.Get("test")
	require.True(t, ok)
	assert.Equal(t, "1.0.0-factory", plugin.Meta.Version)

	registry.SetOverrideEnabled(true)
	plugin, ok = registry.Get("test")
	require.True(t, ok)
	assert.Equal(t, "1.0.0-override", plugin.Meta.Version)
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
		},
		usageExamples: [{label: "std · 1s", facts: {duration: 1, count: 1, tokens: 1, credits: 1, mode: "std"}}],`,
		"",
	)
	plugin, err := CompilePlugin(valid, Options{})
	require.NoError(t, err)
	assert.Equal(t, "number", plugin.Meta.UsageSchema["duration"].Type)
	assert.Equal(t, "second", plugin.Meta.UsageSchema["duration"].Unit)
	assert.Equal(t, "Generated video duration.", plugin.Meta.UsageSchema["duration"].Description)
	assert.Equal(t, "number", plugin.Meta.UsageSchema["count"].Type)
	assert.Equal(t, "count", plugin.Meta.UsageSchema["count"].Unit)
	assert.Equal(t, "number", plugin.Meta.UsageSchema["tokens"].Type)
	assert.Equal(t, "token", plugin.Meta.UsageSchema["tokens"].Unit)
	assert.Equal(t, "Upstream billing tokens.", plugin.Meta.UsageSchema["tokens"].Description)
	assert.Equal(t, "number", plugin.Meta.UsageSchema["credits"].Type)
	assert.Equal(t, "credit", plugin.Meta.UsageSchema["credits"].Unit)
	assert.Equal(t, "Vendor resource-pack units.", plugin.Meta.UsageSchema["credits"].Description)
	assert.Equal(t, []string{"std", "pro"}, plugin.Meta.UsageSchema["mode"].Enum)
	assert.Equal(t, "Provider quality tier.", plugin.Meta.UsageSchema["mode"].Description)
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
			name:          "description must be a string",
			declaration:   `{type: "number", unit: "second", description: 5}`,
			expectedError: "description must be a string",
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
