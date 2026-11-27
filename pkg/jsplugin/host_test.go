package jsplugin

import (
	"bytes"
	"context"
	"testing"

	"github.com/MoeForge/moejs"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pluginkit"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// pluginkit owns the plugin contract's copies of these host values; they
// must not drift from new-api's.
func TestPluginkitConstantsMatchHost(t *testing.T) {
	assert.Equal(t, constant.ChannelTypeNewAPI, pluginkit.ChannelTypeNewAPI)
	assert.Equal(t, constant.ChannelTypeTaskPlugin, pluginkit.ChannelTypeTaskPlugin)
	assert.Equal(t, relaycommon.MaxTaskDurationSeconds, pluginkit.MaxUsageSeconds)
	assert.Equal(t, common.MaxQuota, pluginkit.MaxUsageQuota)
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

func TestEngineMemoryLimitFollowsSetting(t *testing.T) {
	previous := constant.PluginMemoryLimitMB
	t.Cleanup(func() { constant.PluginMemoryLimitMB = previous })
	// Many small objects: past the limit the runtime stops the call, where a
	// single large ArrayBuffer would throw a RangeError instead.
	const source = `export function run(n) { const keep = []; for (let i = 0; i < n; i++) keep.push({i}); return keep.length; }`

	constant.PluginMemoryLimitMB = 8
	limited, err := Compile(source, Options{Key: "memory", Version: "1", Concurrency: 1})
	require.NoError(t, err)
	_, err = limited.Call(t.Context(), "run", 400_000)
	require.ErrorIs(t, err, moejs.ErrMemoryLimit)

	constant.PluginMemoryLimitMB = 0
	unlimited, err := Compile(source, Options{Key: "memory", Version: "1", Concurrency: 1})
	require.NoError(t, err)
	value, err := unlimited.Call(t.Context(), "run", 400_000)
	require.NoError(t, err, "0 means no limit")
	assert.Equal(t, int64(400_000), value)
}
