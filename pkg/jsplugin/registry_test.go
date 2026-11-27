package jsplugin

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
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

func TestRegistryFindsEffectivePluginByBuiltInChannelType(t *testing.T) {
	registry := NewRegistry()
	_, err := registry.RegisterFactory(`
export const meta = {apiVersion:1,key:"test",name:"Test",version:"1.0.0",author:{name:"Test"},channelTypes:[1001],models:["test-model"],fetchMode:"per_task"};
export function buildSubmitRequest(){return {}} export function parseSubmitResponse(){return {}} export function buildQueryRequest(){return {}} export function parseTaskResult(){return {}}
`, Options{})
	require.NoError(t, err)
	plugins := registry.PluginsByChannelType(1001)
	require.Len(t, plugins, 1)
	assert.Equal(t, "test", plugins[0].Meta.Key)
}

func TestTaskPluginRoutingDebugReasonDoesNotExposeRawFailure(t *testing.T) {
	for _, testCase := range []struct {
		name     string
		message  string
		expected string
	}{
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
