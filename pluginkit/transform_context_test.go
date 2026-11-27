package pluginkit

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The members a host fills only when it has them reach hooks only then.
func TestTransformContextHostSpecificMembers(t *testing.T) {
	plugin, err := CompilePlugin(`export const meta = {apiVersion: 1, key: "rp-host-members", name: "Host members", version: "1.0.0", author: {name: "Test"}};
export function ingress(ctx) {
	const seen = ["group", "user", "client", "session"].filter((name) => name in ctx).map((name) => name + "=" + JSON.stringify(ctx[name]));
	return {action: "reject", code: "seen", message: seen.join(" ")};
}`, Options{})
	require.NoError(t, err)
	call := func(tctx TransformContext) string {
		tctx.Stage, tctx.Config = "ingress", json.RawMessage(`{}`)
		result, err := plugin.CallTransform(context.Background(), tctx, TransformRequest{Body: json.RawMessage(`{}`)})
		require.NoError(t, err)
		return result.Message
	}
	assert.Equal(t, "", call(TransformContext{Client: "unknown", Session: &TransformSession{Turn: 2}}))
	assert.Equal(t,
		`group="default" user={"id":7,"username":"alice"} client="claude_code" session={"id":"s1","turn":3}`,
		call(TransformContext{Group: "default", User: TransformUser{ID: 7, Username: "alice"}, Client: "claude_code", Session: &TransformSession{ID: "s1", Turn: 3}}))
}
