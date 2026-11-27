package jsplugin

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCloneMetaDeepCopiesSupports(t *testing.T) {
	registry := NewRegistry()
	_, err := registry.Register(protocolPluginSource(
		"acme",
		`["model"]`,
		`[{name: "openai_responses", supports: ["stream", "sync", "background"]}]`,
		responsesDecodeBoth,
	), Options{})
	require.NoError(t, err)

	snapshot := registry.Snapshot()
	require.Len(t, snapshot.Override, 1)
	require.Len(t, snapshot.Override[0].Protocols, 1)
	snapshot.Override[0].Protocols[0].Supports[0] = "mutated"

	plugin, ok := registry.Get("acme")
	require.True(t, ok)
	assert.Equal(t, []string{"stream", "sync", "background"}, plugin.Meta.Protocols[0].Supports)
}

const responsesDecodeBoth = `export const protocols = {openai_responses: {
		decodeRequest: function(ctx) { return ctx; },
		renderEvents: function() { return {events: [], state: null, done: false}; },
		renderFinal: function(ctx, task) { return task; }
	}};`

func protocolPluginSource(key, models, protocols, exports string) string {
	return fmt.Sprintf(`
export const meta = {
	apiVersion: 1, key: %q, name: %q, version: "1.0.0",
	author: {name: "Test"},
	models: %s, fetchMode: "per_task",
	protocols: %s,
};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {}; }
%s
`, key, key, models, protocols, exports)
}
