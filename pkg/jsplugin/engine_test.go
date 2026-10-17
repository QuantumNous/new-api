package jsplugin

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEngineCallsESMExportWithInjectedUtils(t *testing.T) {
	t.Parallel()
	logs := make([]string, 0, 1)
	engine, err := Compile(`
export function sign(ctx) {
  console.log("called", ctx.name);
  return {
    now: utils.unixNow(),
    digest: utils.hmacSHA256(ctx.message, ctx.secret),
    encoded: utils.base64(ctx.message),
  };
}
export const meta = { apiVersion: 1, key: "mock" };
`, Options{
		Key: "mock", Version: "1.0.0",
		Now: func() time.Time { return time.Unix(1234, 0) },
		Log: func(message string) { logs = append(logs, message) },
	})
	require.NoError(t, err)

	result, err := engine.Call(context.Background(), "sign", map[string]any{
		"name": "fixture", "message": "hello", "secret": "secret",
	})
	require.NoError(t, err)
	assert.Equal(t, map[string]any{
		"now": int64(1234), "digest": "88aab3ede8d3adf94d26ab90d3bafd4a2083070c3bcce9c014ee04a443847c0b", "encoded": "aGVsbG8=",
	}, result)
	assert.Equal(t, []string{"[plugin:mock@1.0.0] called fixture"}, logs)

	meta, err := engine.Export(context.Background(), "meta")
	require.NoError(t, err)
	assert.Equal(t, map[string]any{"apiVersion": int64(1), "key": "mock"}, meta)
}

func TestEngineConsoleLogUsesDebugLoggerAndRequestContext(t *testing.T) {
	previousDebug := common.DebugEnabled
	common.DebugEnabled = false
	t.Cleanup(func() { common.DebugEnabled = previousDebug })

	var output bytes.Buffer
	common.LogWriterMu.Lock()
	previousWriter := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &output
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultErrorWriter = previousWriter
		common.LogWriterMu.Unlock()
	})

	plugin, err := CompilePlugin(`
export const meta = {
  apiVersion: 1,
  key: "console-debug",
  name: "Console debug",
  version: "1.2.3",
  author: {name: "Test"},
  models: ["debug-model"],
  fetchMode: "per_task",
};
export function run(label) {
  console.log("checkpoint", label);
  return true;
}
export function buildSubmitRequest() { return {url: "https://example.com"}; }
export function parseSubmitResponse() { return {taskId: "one"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
`, Options{})
	require.NoError(t, err)
	engine := plugin.Engine

	disabledContext := context.WithValue(context.Background(), common.RequestIdKey, "plugin-console-disabled")
	_, err = engine.Call(disabledContext, "run", "disabled")
	require.NoError(t, err)
	assert.Empty(t, output.String())

	common.DebugEnabled = true
	contextA := context.WithValue(context.Background(), common.RequestIdKey, "plugin-console-request-a")
	_, err = engine.Call(contextA, "run", "context-a")
	require.NoError(t, err)
	logA := output.String()
	output.Reset()

	contextB := context.WithValue(context.Background(), common.RequestIdKey, "plugin-console-request-b")
	_, err = engine.Call(contextB, "run", "context-b")
	require.NoError(t, err)
	logB := output.String()
	output.Reset()

	_, err = engine.Call(context.Background(), "run", "background")
	require.NoError(t, err)
	logBackground := output.String()

	assert.Contains(t, logA, "plugin-console-request-a")
	assert.NotContains(t, logA, "plugin-console-request-b")
	assert.Contains(t, logA, "task_plugin subsystem=runtime event=console")
	assert.Contains(t, logA, "[plugin:console-debug@1.2.3] checkpoint context-a")
	assert.NotContains(t, logA, "disabled")

	assert.Contains(t, logB, "plugin-console-request-b")
	assert.NotContains(t, logB, "plugin-console-request-a")
	assert.Contains(t, logB, "[plugin:console-debug@1.2.3] checkpoint context-b")

	assert.Contains(t, logBackground, "| SYSTEM |")
	assert.NotContains(t, logBackground, "plugin-console-request-a")
	assert.NotContains(t, logBackground, "plugin-console-request-b")
	assert.Contains(t, logBackground, "[plugin:console-debug@1.2.3] checkpoint background")
}

func TestCompileRejectsAsynchronousAndImportedPlugins(t *testing.T) {
	t.Parallel()
	for name, source := range map[string]string{
		"async":           `export async function run() {}`,
		"static import":   `import value from "dependency"; export function run() { return value; }`,
		"dynamic import":  `export function run() { return import("dependency"); }`,
		"top-level await": `const value = await work(); export function run() { return value; }`,
	} {
		t.Run(name, func(t *testing.T) {
			_, err := Compile(source, Options{Key: "invalid"})
			require.Error(t, err)
			assert.Contains(t, err.Error(), "unsupported plugin syntax")
		})
	}

	_, err := Compile(`export function run() { return "import async await"; }`, Options{Key: "valid"})
	require.NoError(t, err)
}

func TestCompileIgnoresSourceMapDirectives(t *testing.T) {
	t.Parallel()
	// A sourceMappingURL comment must stay inert. Sobek's default loader
	// os.ReadFiles the referenced server path during Compile and turns any
	// load failure into a compile error, so an unresolvable path compiling
	// cleanly proves the loader is disabled.
	engine, err := Compile("export function run() { return 1; }\n//# sourceMappingURL=/nonexistent/leak-probe.map\n", Options{Key: "sourcemap"})
	require.NoError(t, err)

	value, err := engine.Call(context.Background(), "run")
	require.NoError(t, err)
	assert.Equal(t, int64(1), value)
}

func TestEngineInterruptsLongRunningHook(t *testing.T) {
	t.Parallel()
	engine, err := Compile(`export function run() { while (true) {} }`, Options{
		Key: "loop", Version: "1", Timeout: 20 * time.Millisecond,
	})
	require.NoError(t, err)

	_, err = engine.Call(context.Background(), "run")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "timed out")
	var hookErr *HookError
	assert.False(t, errors.As(err, &hookErr), "timeouts must not be HookError")
}

func TestEngineHookErrorExtractsSanitizedJSMessage(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name        string
		source      string
		wantMessage string
		wantLen     int
	}{
		{
			name:        "Error object",
			source:      `export function run() { throw new Error("model is required"); }`,
			wantMessage: "model is required",
		},
		{
			name:        "raw string throw",
			source:      `export function run() { throw "raw string"; }`,
			wantMessage: "raw string",
		},
		{
			name:        "truncates to 512 runes",
			source:      `export function run() { throw new Error("x".repeat(2000)); }`,
			wantLen:     512,
			wantMessage: strings.Repeat("x", 512),
		},
		{
			name:        "scrubs control characters",
			source:      "export function run() { throw new Error(\"line1\\nline2\\x1b[31mred\"); }",
			wantMessage: "line1 line2 [31mred",
		},
		{
			name:        "throwing message getter falls back without crashing",
			source:      `export function run() { throw {get message() { throw {get message() { return "deep"; }}; }}; }`,
			wantMessage: "plugin hook failed",
		},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			engine, err := Compile(testCase.source, Options{Key: "diag", Version: "1.0.0"})
			require.NoError(t, err)

			_, err = engine.Call(context.Background(), "run")
			require.Error(t, err)

			var hookErr *HookError
			require.True(t, errors.As(err, &hookErr))
			assert.Equal(t, "run", hookErr.Hook)
			assert.Equal(t, testCase.wantMessage, hookErr.Message)
			if testCase.wantLen > 0 {
				assert.Equal(t, testCase.wantLen, utf8.RuneCountInString(hookErr.Message))
			}
			assert.Contains(t, hookErr.Error(), "plugin diag@1.0.0")
			assert.NotContains(t, hookErr.Message, "Error:")
			assert.NotContains(t, hookErr.Message, "plugin diag@")
		})
	}
}

func TestEngineReportsProtocolAdmissionTimeoutSeparately(t *testing.T) {
	engine, err := Compile(`
export const protocols = {
	responses: {renderEvents: function() { return {events: [], done: false}; }},
};
`, Options{Key: "admission", Version: "1", Concurrency: 1})
	require.NoError(t, err)

	engine.semaphore <- struct{}{}
	_, err = engine.CallPathWithAdmissionTimeout(
		context.Background(),
		time.Nanosecond,
		"protocols",
		[]string{"responses", "renderEvents"},
	)
	<-engine.semaphore

	require.ErrorIs(t, err, ErrCallAdmissionTimeout)
	result, err := engine.CallPathWithAdmissionTimeout(
		context.Background(),
		time.Second,
		"protocols",
		[]string{"responses", "renderEvents"},
	)
	require.NoError(t, err)
	assert.Equal(t, map[string]any{"events": []any{}, "done": false}, result)
}

func TestEngineExportInterruptsLongRunningGetter(t *testing.T) {
	t.Parallel()
	engine, err := Compile(`
export const meta = {
	apiVersion: 1,
	get name() { while (true) {} },
};
`, Options{Key: "meta-loop", Version: "1.0.0", Timeout: 20 * time.Millisecond})
	require.NoError(t, err)

	_, err = engine.Export(context.Background(), "meta")
	require.ErrorContains(t, err, "export meta interrupted")
}

func TestEngineExportReturnsThrownGetterError(t *testing.T) {
	t.Parallel()
	engine, err := Compile(`
export const meta = {
	apiVersion: 1,
	get name() { throw new Error("getter failed"); },
};
`, Options{Key: "meta-throw", Version: "1.0.0"})
	require.NoError(t, err)

	_, err = engine.Export(context.Background(), "meta")
	require.ErrorContains(t, err, "export meta failed")
	assert.Contains(t, err.Error(), "getter failed")
}

func TestEngineNestedHooksRequireOwnProperties(t *testing.T) {
	t.Parallel()
	engine, err := Compile(`
const inheritedRenderers = {
	inherited: function(value) { return value; },
	constructor: function(value) { return value; },
	toString: function(value) { return value; },
	["__proto__"]: function(value) { return value; },
};
export const renderers = Object.create(inheritedRenderers);
renderers.own = function(value) { return {id: value.id}; };

const inheritedProtocol = {
	renderFinal: function(value) { return value; },
};
export const protocols = {
	responses: Object.create(inheritedProtocol),
};
`, Options{Key: "own-hooks", Version: "1.0.0"})
	require.NoError(t, err)

	found, err := engine.HasCallablePath(context.Background(), "renderers", "own")
	require.NoError(t, err)
	assert.True(t, found)
	result, err := engine.CallMember(context.Background(), "renderers", "own", map[string]any{"id": "task-1"})
	require.NoError(t, err)
	assert.Equal(t, map[string]any{"id": "task-1"}, result)

	for _, member := range []string{"inherited", "constructor", "toString", "__proto__"} {
		t.Run(member, func(t *testing.T) {
			found, err := engine.HasCallablePath(context.Background(), "renderers", member)
			require.NoError(t, err)
			assert.False(t, found)

			_, err = engine.CallMember(context.Background(), "renderers", member)
			require.ErrorContains(t, err, "not found")
		})
	}

	found, err = engine.HasCallablePath(context.Background(), "protocols", "responses", "renderFinal")
	require.NoError(t, err)
	assert.False(t, found)
	_, err = engine.CallPath(context.Background(), "protocols", []string{"responses", "renderFinal"})
	require.ErrorContains(t, err, "not found")
}

func TestCompileInterruptsLongRunningInitialization(t *testing.T) {
	t.Parallel()
	_, err := Compile(`while (true) {}; export function run() {}`, Options{
		Key: "loop", Version: "1", Timeout: 20 * time.Millisecond,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "initialization timed out")
}

func TestValidateRequestURL(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name         string
		requestURL   string
		baseURL      string
		allowedHosts []string
		wantError    string
	}{
		{name: "same host", requestURL: "https://api.example.com/v1/task", baseURL: "https://api.example.com/v1"},
		{name: "default port", requestURL: "https://api.example.com:443/v1/task", baseURL: "https://api.example.com"},
		{name: "approved host", requestURL: "https://upload.example.com/task", baseURL: "https://api.example.com", allowedHosts: []string{"upload.example.com"}},
		{name: "subdomain is not implicit", requestURL: "https://evil.api.example.com/task", baseURL: "https://api.example.com", wantError: "not allowed"},
		{name: "userinfo trick", requestURL: "https://api.example.com@evil.example/task", baseURL: "https://api.example.com", wantError: "not allowed"},
		{name: "relative URL", requestURL: "/v1/task", baseURL: "https://api.example.com", wantError: "absolute"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateRequestURL(test.requestURL, test.baseURL, test.allowedHosts)
			if test.wantError == "" {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
			assert.True(t, strings.Contains(err.Error(), test.wantError), err.Error())
		})
	}
}
