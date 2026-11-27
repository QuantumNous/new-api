package pluginkit

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSupportsRegisteredHostProtocols(t *testing.T) {
	assert.True(t, SupportsHostProtocol("openai_responses"))
	assert.True(t, SupportsHostProtocol("openai_video"))
	assert.True(t, SupportsHostProtocol(ProtocolOpenAIImage))
	assert.False(t, SupportsHostProtocol("plugin_owned_wire"))
}

func TestLookupHostProtocolOperationExcludesRetrieveWithoutModelField(t *testing.T) {
	_, _, ok := LookupHostProtocolOperation(http.MethodGet, "/v1/responses/:response_id")
	assert.False(t, ok)
	_, _, ok = LookupHostProtocolOperation(http.MethodPost, "/v1/responses")
	assert.True(t, ok)
	for _, path := range []string{"/v1/images/generations", "/v1/images/edits"} {
		protocol, operation, found := LookupHostProtocolOperation(http.MethodPost, path)
		require.True(t, found, path)
		assert.Equal(t, ProtocolOpenAIImage, protocol)
		assert.Equal(t, "model", operation.ModelField)
		assert.Empty(t, operation.Modes, "the synchronous image protocol has no request modes")
	}
}

func TestFileReferenceRoundTripAddressesRepeatedFieldFiles(t *testing.T) {
	assert.Equal(t, "request_file:image[]", FileReference("image[]", 0))
	assert.Equal(t, "request_file:image[]#2", FileReference("image[]", 2))
	for _, tc := range []struct {
		ref   string
		field string
		index int
		ok    bool
	}{
		{"request_file:input_reference", "input_reference", 0, true},
		{"request_file:image[]#1", "image[]", 1, true},
		{"request_file:image[]#01", "", 0, false},
		{"request_file:image[]#-1", "", 0, false},
		{"request_file:#1", "", 0, false},
		{"request_file:", "", 0, false},
		{"image", "", 0, false},
	} {
		field, index, ok := ParseFileReference(tc.ref)
		assert.Equal(t, tc.ok, ok, tc.ref)
		assert.Equal(t, tc.field, field, tc.ref)
		assert.Equal(t, tc.index, index, tc.ref)
	}
}

func TestProtocolClaimDecodeAndValidation(t *testing.T) {
	tests := []struct {
		name          string
		models        string
		metaFields    string
		exports       string
		errContains   string
		wantProtocols []ProtocolClaim
	}{
		{
			name:       "string and object entries mix",
			models:     `["gpt-5.5", "gpt-5.6"]`,
			metaFields: `protocols: [{name: "openai_responses", supports: ["stream", "sync", "background"]}, {name: "openai_video", models: ["gpt-5.5"]}],`,
			exports: `export const protocols = {
				openai_responses: {
					decodeRequest: function(ctx) { return ctx; },
					renderEvents: function() { return {events: [], state: null, done: false}; },
					renderFinal: function(ctx, task) { return task; }
				},
				openai_video: {
					decodeRequest: function(ctx) { return ctx; },
					render: function(ctx, task) { return task; }
				}
			};
			export function listArtifacts() { return []; }
			export function buildContentRequest() { return {}; }`,
			wantProtocols: []ProtocolClaim{
				{Name: "openai_responses", Supports: []string{"stream", "sync", "background"}, objectForm: true},
				{Name: "openai_video", Models: []string{"gpt-5.5"}, objectForm: true},
			},
		},
		{
			name:          "absent protocols is fine",
			models:        `["gpt-5.5"]`,
			wantProtocols: []ProtocolClaim{},
		},
		{
			name:        "object with unknown field",
			models:      `["gpt-5.5"]`,
			metaFields:  `protocols: [{name: "openai_responses", models: ["gpt-5.5"], extra: true}],`,
			errContains: `unknown field "extra"`,
		},
		{
			name:        "model outside meta models",
			models:      `["gpt-5.5"]`,
			metaFields:  `protocols: [{name: "openai_responses", models: ["gpt-9.9"], supports: ["stream", "sync", "background"]}],`,
			errContains: "is not declared in plugin meta models",
		},
		{
			name:        "duplicate models in claim",
			models:      `["gpt-5.5"]`,
			metaFields:  `protocols: [{name: "openai_responses", models: ["gpt-5.5", "gpt-5.5"], supports: ["stream", "sync", "background"]}],`,
			errContains: "models must be unique",
		},
		{
			name:        "blank model in claim",
			models:      `["gpt-5.5"]`,
			metaFields:  `protocols: [{name: "openai_responses", models: [" "], supports: ["stream", "sync", "background"]}],`,
			errContains: "non-empty canonical names",
		},
		{
			name:        "empty models rejected",
			models:      `["gpt-5.5"]`,
			metaFields:  `protocols: [{name: "openai_responses", models: []}],`,
			errContains: "models must contain at least one model",
		},
		{
			name:        "explicit null protocols",
			models:      `["gpt-5.5"]`,
			metaFields:  `protocols: null,`,
			errContains: "must be an array",
		},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			exports := testCase.exports
			if exports == "" && testCase.errContains != "" {
				exports = routingProtocolExport("openai_responses")
			}
			plugin, err := CompilePlugin(
				routingTestPluginSource("claim-decode", 0, testCase.models, testCase.metaFields, exports),
				Options{},
			)
			if testCase.errContains != "" {
				require.ErrorContains(t, err, testCase.errContains)
				return
			}
			require.NoError(t, err)
			require.Equal(t, testCase.wantProtocols, plugin.Meta.Protocols)
		})
	}
}

func TestRouteModelsDecodeAndValidation(t *testing.T) {
	routeExports := `export const native = {
		decodeJob: function(ctx) { return {kind: "submit", model: "gpt-5.5", requestBody: ctx.body.value}; },
		jobCreated: function(ctx, task) { return task; },
		jobStatus: function(ctx, task) { return task; }
	};`
	tests := []struct {
		name        string
		models      string
		metaFields  string
		errContains string
	}{
		{
			name:       "submit route with models",
			models:     `["gpt-5.5", "gpt-5.6"]`,
			metaFields: `routes: [{method: "POST", path: "/v1/batch", type: "submit", models: ["gpt-5.5"], decode: "decodeJob", render: "jobCreated"}],`,
		},
		{
			name:        "query route rejects models",
			models:      `["gpt-5.5"]`,
			metaFields:  `routes: [{method: "GET", path: "/v1/batch/:task_id", type: "query", models: ["gpt-5.5"], render: "jobStatus"}],`,
			errContains: "must not declare models",
		},
		{
			name:        "model outside meta models",
			models:      `["gpt-5.5"]`,
			metaFields:  `routes: [{method: "POST", path: "/v1/batch", type: "submit", models: ["gpt-9.9"], decode: "decodeJob", render: "jobCreated"}],`,
			errContains: "is not declared in plugin meta models",
		},
		{
			name:        "duplicate models",
			models:      `["gpt-5.5"]`,
			metaFields:  `routes: [{method: "POST", path: "/v1/batch", type: "submit", models: ["gpt-5.5", "gpt-5.5"], decode: "decodeJob", render: "jobCreated"}],`,
			errContains: "models must be unique",
		},
		{
			name:        "blank model entry",
			models:      `["gpt-5.5"]`,
			metaFields:  `routes: [{method: "POST", path: "/v1/batch", type: "submit", models: [" "], decode: "decodeJob", render: "jobCreated"}],`,
			errContains: "non-empty canonical names",
		},
		{
			name:        "empty models rejected",
			models:      `["gpt-5.5"]`,
			metaFields:  `routes: [{method: "POST", path: "/v1/batch", type: "submit", models: [], decode: "decodeJob", render: "jobCreated"}],`,
			errContains: "models must contain at least one model",
		},
		{
			name:        "query route empty models rejected",
			models:      `["gpt-5.5"]`,
			metaFields:  `routes: [{method: "GET", path: "/v1/batch/:task_id", type: "query", models: [], render: "jobStatus"}],`,
			errContains: "models must contain at least one model",
		},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			plugin, err := CompilePlugin(
				routingTestPluginSource("route-models", 0, testCase.models, testCase.metaFields, routeExports),
				Options{},
			)
			if testCase.errContains != "" {
				require.ErrorContains(t, err, testCase.errContains)
				return
			}
			require.NoError(t, err)
			require.Len(t, plugin.Meta.Routes, 1)
			assert.Equal(t, []string{"gpt-5.5"}, plugin.Meta.Routes[0].Models)
		})
	}
}

func TestRouteRetainResultDecodeAndValidation(t *testing.T) {
	routeExports := `export const native = {
		decodeJob: function(ctx) { return {kind: "submit", model: "gpt-5.5", requestBody: ctx.body.value}; },
		jobCreated: function(ctx, task) { return task; },
		jobStatus: function(ctx, task) { return task; }
	};`
	falseValue := false
	tests := []struct {
		name        string
		metaFields  string
		want        *bool
		errContains string
	}{
		{
			name:       "undeclared route retains",
			metaFields: `routes: [{method: "POST", path: "/v1/batch", type: "submit", decode: "decodeJob", render: "jobCreated"}],`,
		},
		{
			name:       "submit route declines retention",
			metaFields: `routes: [{method: "POST", path: "/v1/batch", type: "submit", decode: "decodeJob", render: "jobCreated", retainResult: false}],`,
			want:       &falseValue,
		},
		{
			name:        "query route rejects retainResult",
			metaFields:  `routes: [{method: "GET", path: "/v1/batch/:task_id", type: "query", render: "jobStatus", retainResult: true}],`,
			errContains: "must not declare retainResult",
		},
		{
			name:        "non-boolean value",
			metaFields:  `routes: [{method: "POST", path: "/v1/batch", type: "submit", decode: "decodeJob", render: "jobCreated", retainResult: "no"}],`,
			errContains: "retainResult must be a boolean",
		},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			plugin, err := CompilePlugin(
				routingTestPluginSource("route-retain", 0, `["gpt-5.5"]`, testCase.metaFields, routeExports),
				Options{},
			)
			if testCase.errContains != "" {
				require.ErrorContains(t, err, testCase.errContains)
				return
			}
			require.NoError(t, err)
			require.Len(t, plugin.Meta.Routes, 1)
			assert.Equal(t, testCase.want, plugin.Meta.Routes[0].RetainResult)
		})
	}
}

func TestRouteRequestContextKeepsFormAndMultipartValuesAcrossDecoderWrites(t *testing.T) {
	plugin, err := CompilePlugin(routingTestPluginSource("route-request-writes", 0, `["gpt-5.5"]`, "", `
export function decodeJob(ctx) {
	const seen = {
		prompt: ctx.body.fields.prompt[0],
		filename: ctx.body.files[0].filename,
		params: Object.keys(ctx.params).length,
		query: Object.keys(ctx.query).length
	};
	ctx.body.fields.prompt[0] = "mutated";
	ctx.body.files[0].filename = "mutated.png";
	return seen;
}`), Options{})
	require.NoError(t, err)
	fields := map[string][]string{"prompt": {"original"}}
	files := []map[string]any{{"ref": "request_file:image", "filename": "safe.png"}}
	request := RouteRequestContext{Body: map[string]any{"kind": "multipart", "fields": fields, "files": files}}
	for range 2 {
		seen, err := plugin.Engine.Call(context.Background(), "decodeJob", request.JSValue())
		require.NoError(t, err)
		assert.Equal(t, map[string]any{"prompt": "original", "filename": "safe.png", "params": int64(0), "query": int64(0)}, seen)
	}
	assert.Equal(t, "original", fields["prompt"][0])
	assert.Equal(t, "safe.png", files[0]["filename"])
}

// configureTestHost sets the host for one test and restores the previous one.
func configureTestHost(t *testing.T, host Host) {
	t.Helper()
	previous := *hostConfig()
	Configure(host)
	t.Cleanup(func() { Configure(previous) })
}

func TestDeclarativeRouteValidationProtectsNamespacesAndCanonicalSyntax(t *testing.T) {
	configureTestHost(t, Host{
		ReservedRouteNamespaces: []string{"/assets", "/v1/tasks", "/console", "/request-processing", "/security"},
		ReservedKeys:            []string{"api"},
	})
	tests := []struct {
		name          string
		route         Route
		expectedError string
	}{
		{
			name:          "static assets",
			route:         Route{Method: "GET", Path: "/assets/x", Type: RouteTypeQuery, Render: "native"},
			expectedError: "reserved namespace /assets",
		},
		{
			name:          "generic task management",
			route:         Route{Method: "GET", Path: "/v1/tasks/:task_id", Type: RouteTypeQuery, Render: "native"},
			expectedError: "reserved namespace /v1/tasks",
		},
		{
			name:          "SPA root",
			route:         Route{Method: "POST", Path: "/console/jobs", Type: RouteTypeSubmit},
			expectedError: "reserved namespace /console",
		},
		{
			name:          "request processing page",
			route:         Route{Method: "GET", Path: "/request-processing", Type: RouteTypeQuery, Render: "native"},
			expectedError: "reserved namespace /request-processing",
		},
		{
			name:          "security page",
			route:         Route{Method: "GET", Path: "/security/:section", Type: RouteTypeQuery, Render: "native"},
			expectedError: "reserved namespace /security",
		},
		{
			name:          "dynamic root can claim reserved subtree",
			route:         Route{Method: "POST", Path: "/:root/jobs", Type: RouteTypeSubmit},
			expectedError: "intersects reserved namespace",
		},
		{
			name:          "dynamic v1 namespace can claim task management",
			route:         Route{Method: "POST", Path: "/v1/:namespace", Type: RouteTypeSubmit},
			expectedError: "reserved namespace /v1/tasks",
		},
		{
			name:          "root catch-all can claim reserved subtree",
			route:         Route{Method: "POST", Path: "/*rest", Type: RouteTypeSubmit},
			expectedError: "intersects reserved namespace",
		},
		{
			name:          "repeated slash",
			route:         Route{Method: "POST", Path: "/vendor//jobs", Type: RouteTypeSubmit},
			expectedError: "empty segments",
		},
		{
			name:          "noncanonical method",
			route:         Route{Method: " post ", Path: "/vendor/jobs", Type: RouteTypeSubmit},
			expectedError: "canonical uppercase",
		},
		{
			name:          "non-terminal catch-all",
			route:         Route{Method: "POST", Path: "/vendor/*rest/jobs", Type: RouteTypeSubmit},
			expectedError: "invalid catch-all",
		},
		{
			name:          "query declares decoder",
			route:         Route{Method: "GET", Path: "/vendor/jobs/:task_id", Type: RouteTypeQuery, Decode: "decode", Render: "show"},
			expectedError: "must not declare decode",
		},
		{
			name:          "submit missing presenter",
			route:         Route{Method: "POST", Path: "/vendor/jobs", Type: RouteTypeSubmit, Decode: "decode"},
			expectedError: "must declare decode and render",
		},
		{
			name:          "dynamic missing decoder",
			route:         Route{Method: "POST", Path: "/vendor/query", Type: RouteTypeDynamic, Render: "show"},
			expectedError: "must declare decode and render",
		},
		{
			name:          "dynamic missing presenter",
			route:         Route{Method: "POST", Path: "/vendor/query", Type: RouteTypeDynamic, Decode: "decode"},
			expectedError: "must declare decode and render",
		},
		{
			name:          "query declares action",
			route:         Route{Method: "GET", Path: "/vendor/jobs/:task_id", Type: RouteTypeQuery, Render: "show", Action: "retrieve"},
			expectedError: "must not declare action",
		},
		{
			name:          "submit declares task id parameter",
			route:         Route{Method: "POST", Path: "/vendor/jobs", Type: RouteTypeSubmit, Decode: "decode", Render: "created", TaskIDParam: "task_id"},
			expectedError: "must not declare taskIdParam",
		},
		{
			name:          "dynamic declares task id parameter",
			route:         Route{Method: "POST", Path: "/vendor/query", Type: RouteTypeDynamic, Decode: "decode", Render: "show", TaskIDParam: "task_id"},
			expectedError: "must not declare taskIdParam",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			meta := Meta{APIVersion: 1, Key: "validation", Name: "Validation", Version: "1.0.0", Author: AuthorMeta{Name: "Test"}, Models: []string{"model"}, FetchMode: "per_task", Routes: []Route{testCase.route}}
			require.ErrorContains(t, ValidateV1Meta(meta), testCase.expectedError)
		})
	}
}

func TestRemovedEndpointsAndProtocolHooksAreValidatedAtCompileTime(t *testing.T) {
	removed := routingTestPluginSource(
		"removed-endpoint",
		0,
		`["model"]`,
		`endpoints: [{method: "POST", path: "/v1/chat/completions", protocol: "chat"}],`,
		routingProtocolExport("chat"),
	)
	_, err := CompilePlugin(removed, Options{})
	require.ErrorContains(t, err, "endpoints is no longer supported")

	unknown := routingTestPluginSource("unknown-protocol", 0, `["model"]`, `protocols: ["chat"],`, ``)
	_, err = CompilePlugin(unknown, Options{})
	require.ErrorContains(t, err, `protocol "chat" is unknown`)

	missingHook := routingTestPluginSource(
		"bad-protocol",
		0,
		`["model"]`,
		`protocols: ["openai_responses"],`,
		`export const protocols = {openai_responses: {
			decodeRequest: function() { return {}; },
			renderEvents: function() { return {events: [], done: false}; }
		}};`,
	)
	_, err = CompilePlugin(missingHook, Options{})
	require.ErrorContains(t, err, `plugin bad-protocol protocol "openai_responses" must declare supports; replace the bare string with {name: "openai_responses", supports: [...]} choosing from "stream", "sync", "background"`)

	for _, removedExport := range []string{"renderers", "renderError", "resolveRequest"} {
		t.Run("removed export "+removedExport, func(t *testing.T) {
			source := routingTestPluginSource("removed-export", 0, `["model"]`, "", `export const `+removedExport+` = {};`)
			_, compileErr := CompilePlugin(source, Options{})
			require.ErrorContains(t, compileErr, `export "`+removedExport+`" is no longer supported`)
		})
	}

	t.Run("removed route renderer", func(t *testing.T) {
		source := routingTestPluginSource(
			"removed-route-renderer", 0, `["model"]`,
			`routes: [{method:"GET",path:"/vendor/:task_id",type:"query",render:"show",renderer:"legacy"}],`,
			`export const native = {show: function(ctx, task) { return task; }};`,
		)
		_, compileErr := CompilePlugin(source, Options{})
		require.ErrorContains(t, compileErr, "field renderer is no longer supported")
	})
}

func TestRegistryRejectsPrototypeInheritedHooks(t *testing.T) {
	for _, member := range []string{"constructor", "toString", "__proto__"} {
		t.Run("native "+member, func(t *testing.T) {
			source := routingTestPluginSource(
				"inherited-renderer",
				0,
				`["model"]`,
				fmt.Sprintf(`routes: [{method: "GET", path: "/vendor/jobs/:task_id", type: "query", render: %q}],`, member),
				`const nativePrototype = {
					constructor: function(task) { return task; },
					toString: function(task) { return task; },
					["__proto__"]: function(task) { return task; },
				};
				export const native = Object.create(nativePrototype);`,
			)

			_, err := CompilePlugin(source, Options{})
			require.ErrorContains(t, err, fmt.Sprintf(`references missing native render %q`, member))
		})
	}

	t.Run("protocol object", func(t *testing.T) {
		source := routingTestPluginSource(
			"inherited-protocol",
			0,
			`["model"]`,
			`protocols: [{name: "openai_responses", supports: ["stream", "sync", "background"]}],`,
			`const protocol = {
				decodeRequest: function(ctx) { return ctx; },
				renderEvents: function() { return {events: [], state: null, done: false}; },
				renderFinal: function(ctx, task) { return task; },
			};
			export const protocols = Object.create({openai_responses: protocol});`,
		)

		_, err := CompilePlugin(source, Options{})
		require.ErrorContains(t, err, `protocol "openai_responses" is missing hook "decodeRequest"`)
	})

	t.Run("protocol hook", func(t *testing.T) {
		source := routingTestPluginSource(
			"inherited-protocol-hook",
			0,
			`["model"]`,
			`protocols: [{name: "openai_responses", supports: ["stream", "sync", "background"]}],`,
			`const protocolPrototype = {
				decodeRequest: function(ctx) { return ctx; },
				renderEvents: function() { return {events: [], state: null, done: false}; },
				renderFinal: function(ctx, task) { return task; },
			};
			export const protocols = {openai_responses: Object.create(protocolPrototype)};`,
		)

		_, err := CompilePlugin(source, Options{})
		require.ErrorContains(t, err, `protocol "openai_responses" is missing hook "decodeRequest"`)
	})
}

func TestMetaDecoderRejectsLossyOrUnknownRoutingFields(t *testing.T) {
	tests := []struct {
		name          string
		metaFields    string
		expectedError string
	}{
		{
			name:          "fractional channel type",
			metaFields:    `channelTypes: [50.5],`,
			expectedError: "channelTypes element 1 must be an integer",
		},
		{
			name:          "non-string model",
			metaFields:    `models: ["model", 2],`,
			expectedError: "models must be an array of strings",
		},
		{
			name:          "unknown route field",
			metaFields:    `routes: [{method: "POST", path: "/vendor/jobs", type: "submit", auth: false}],`,
			expectedError: `unknown field "auth"`,
		},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			source := fmt.Sprintf(`
export const meta = {
	apiVersion: 1, key: "strict-meta", name: "Strict", version: "1.0.0",
	author: {name: "Test"},
	models: ["model"], fetchMode: "per_task", %s
};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
export function resolveRequest() { return {kind: "submit", model: "model"}; }
`, testCase.metaFields)
			_, err := CompilePlugin(source, Options{})
			require.ErrorContains(t, err, testCase.expectedError)
		})
	}
}

func TestProtocolHookInspectionIsDeadlineBounded(t *testing.T) {
	source := `
export const meta = {
	apiVersion: 1, key: "getter-timeout", name: "Getter", version: "1.0.0",
	author: {name: "Test"},
	models: ["model"], fetchMode: "per_task",
	protocols: [{name: "openai_responses", supports: ["stream", "sync", "background"]}],
};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
export const protocols = {
	get openai_responses() { while (true) {} }
};
`
	_, err := CompilePlugin(source, Options{Timeout: 20 * time.Millisecond})
	require.ErrorContains(t, err, "inspection interrupted")
}

func TestReservedNamespaceChecksUseSegmentBoundaries(t *testing.T) {
	// The host namespaces the outer router reveals, /api among them, are
	// decided at admission, so these routes compile.
	for _, routePath := range []string{"/apiary/jobs", "/api/plugin", "/api/:version/jobs", "/api/v3/contents/generations/tasks", "/api/common/v3/submit_task_v2"} {
		meta := Meta{
			APIVersion: 1,
			Key:        "apiary",
			Name:       "Apiary",
			Version:    "1.0.0",
			Author:     AuthorMeta{Name: "Test"},
			Models:     []string{"model"},
			FetchMode:  "per_task",
			Routes:     []Route{{Method: "POST", Path: routePath, Type: RouteTypeSubmit, Decode: "decode", Render: "render"}},
		}
		require.NoError(t, ValidateV1Meta(meta), routePath)
	}
}

func TestResolveRouteActionPrefersResolvedAction(t *testing.T) {
	route := Route{Action: "manifest-action"}
	assert.Equal(t, "hook-action", ResolveRouteAction(route, "hook-action"))
	assert.Equal(t, "manifest-action", ResolveRouteAction(route, ""))
}

func routingTestPluginSource(key string, channelType int, models, metaFields, exports string) string {
	channelTypesField := ""
	if channelType > 0 && channelType != ChannelTypeTaskPlugin {
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
