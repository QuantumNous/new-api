package controller

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/request_plugin_setting"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

// wsPlugin rejects a create that asks for "forbidden", redacts "secret" from
// its input, masks "bad" in the reply and stops a reply that says "stopword".
const wsPlugin = `export const meta = {apiVersion: 1, key: "rp-ws", name: "WS", version: "1.0.0", author: {name: "Test"}};
export function ingress(ctx, req) {
  const input = req.body.input;
  if (input.includes("forbidden")) return {action: "reject", code: "blocked.ws", message: "Blocked"};
  if (!input.includes("secret")) return {action: "continue"};
  return {action: "continue", effects: [{type: "json.patch", ops: [{op: "replace", path: "/input", value: input.replaceAll("secret", "[redacted]")}]}]};
}
export function reply(ctx, res) {
  const result = {action: "continue", mask: []};
  for (const output of res.outputs) {
    if (output.text.includes("stopword")) return {action: "stop", code: "reply.blocked"};
    for (let i = output.text.indexOf("bad"); i >= 0; i = output.text.indexOf("bad", i + 1)) {
      result.mask.push({index: output.index, start: i, end: i + 3, category: "word"});
    }
  }
  return result;
}`

// Each response.create on one connection runs the request plugins as an
// HTTP request does; a rejection or a stop ends only that response.
func TestResponsesWebSocketRunsRequestPlugins(t *testing.T) {
	require.NoError(t, i18n.Init())
	plugin, err := jsplugin.DefaultRegistry.Register(wsPlugin, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { _ = jsplugin.DefaultRegistry.Unregister(plugin.Meta.Key) })
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{request_plugin_setting.InstancesOption: `[{"id":"ws","name":"WS","plugin":"rp-ws","enabled":true,"global":true}]`}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{request_plugin_setting.InstancesOption: "[]"}))
	})
	previousErrorLog := constant.ErrorLogEnabled
	constant.ErrorLogEnabled = true
	t.Cleanup(func() { constant.ErrorLogEnabled = previousErrorLog })

	usage := `"usage":{"input_tokens":10,"output_tokens":5,"total_tokens":15}`
	received := make(chan string, 8)
	fixture := newResponsesWSBillingTest(t, `tier("request", fixed(0.002))`, func(ws *websocket.Conn, _ *http.Request) {
		send := func(event string) bool {
			return assert.NoError(t, ws.WriteMessage(websocket.TextMessage, []byte(event)))
		}
		for index := 1; ; index++ {
			_, create, err := ws.ReadMessage()
			if err != nil {
				return
			}
			received <- string(create)
			id := fmt.Sprintf("resp_%d", index)
			if !send(`{"type":"response.created","response":{"id":"` + id + `","status":"in_progress"}}`) {
				return
			}
			text := gjson.GetBytes(create, "input").Str
			switch {
			case strings.Contains(text, "[redacted]"):
				for _, delta := range []string{"a bad ", "word"} {
					if !send(`{"type":"response.output_text.delta","item_id":"msg_1","output_index":0,"content_index":0,"delta":"` + delta + `"}`) {
						return
					}
				}
				send(`{"type":"response.completed","response":{"id":"` + id + `","status":"completed","output":[{"type":"message","id":"msg_1","role":"assistant","content":[{"type":"output_text","text":"a bad word"}]}],` + usage + `}}`)
			case strings.Contains(text, "stop"):
				if !send(`{"type":"response.output_text.delta","item_id":"msg_1","output_index":0,"content_index":0,"delta":"say stopword now"}`) {
					return
				}
				_, cancel, err := ws.ReadMessage()
				if err != nil {
					return
				}
				received <- string(cancel)
				send(`{"type":"response.cancelled","response":{"id":"` + id + `","status":"cancelled",` + usage + `}}`)
			default:
				send(`{"type":"response.completed","response":{"id":"` + id + `","status":"completed","output":[{"type":"message","id":"msg_1","role":"assistant","content":[{"type":"output_text","text":"hello"}]}],` + usage + `}}`)
			}
		}
	})
	client := fixture.client
	create := func(input string) {
		require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.create","model":"ws-billing","input":"`+input+`"}`)))
	}
	upstream := func() string {
		select {
		case message := <-received:
			return message
		case <-time.After(3 * time.Second):
			t.Fatal("upstream received nothing")
			return ""
		}
	}

	// A rejected create never reaches the upstream.
	create("a forbidden question")
	rejected := readResponsesWSTestEvent(t, client)
	assert.Equal(t, "error", rejected["type"])
	assert.Equal(t, float64(http.StatusBadRequest), rejected["status"])
	assert.Equal(t, "request_rejected", rejected["error"].(map[string]any)["code"])
	assert.Empty(t, received)

	// The ingress patch reaches the upstream and the reply is masked.
	create("my secret plan")
	assert.Equal(t, "my [redacted] plan", gjson.Get(upstream(), "input").Str)
	assert.Equal(t, "response.created", readResponsesWSTestEvent(t, client)["type"])
	var deltas []any
	for range 2 {
		event := readResponsesWSTestEvent(t, client)
		assert.Equal(t, "response.output_text.delta", event["type"])
		deltas = append(deltas, event["delta"])
	}
	assert.Equal(t, []any{"a *** ", "word"}, deltas)
	completed := readResponsesWSTestEvent(t, client)
	assert.Equal(t, "response.completed", completed["type"])
	encoded, err := common.Marshal(completed)
	require.NoError(t, err)
	assert.Equal(t, "a *** word", gjson.GetBytes(encoded, "response.output.0.content.0.text").Str)

	// A stop cancels the upstream response; the client gets the error. The
	// rejected create never reached the upstream, so this is its second.
	create("please stop")
	upstream()
	assert.Equal(t, "response.created", readResponsesWSTestEvent(t, client)["type"])
	cancel := upstream()
	assert.Equal(t, "response.cancel", gjson.Get(cancel, "type").Str)
	assert.Equal(t, "resp_2", gjson.Get(cancel, "response_id").Str)
	stopped := readResponsesWSTestEvent(t, client)
	assert.Equal(t, "error", stopped["type"])
	assert.Equal(t, float64(http.StatusBadRequest), stopped["status"])
	assert.Equal(t, "resp_2", stopped["response_id"])
	assert.Equal(t, "response_rejected", stopped["error"].(map[string]any)["code"])

	// The connection still serves the next create.
	create("hello")
	upstream()
	assert.Equal(t, "response.created", readResponsesWSTestEvent(t, client)["type"])
	assert.Equal(t, "response.completed", readResponsesWSTestEvent(t, client)["type"])

	fixture.closeAndWait(t)
	assertResponsesWSAccounting(t, fixture, []int{1000, 1000, 1000})
	var logs []model.Log
	require.NoError(t, model.LOG_DB.Where("type = ?", model.LogTypeConsume).Order("id").Find(&logs).Error)
	for index, want := range []string{
		`[{"plugin":"rp-ws","stage":"ingress","changes":[{"op":"replace","path":"input","value":"my [redacted] plan"}]},{"plugin":"rp-ws","stage":"reply","masked":1,"findings":[{"category":"word","count":1}]}]`,
		`[{"plugin":"rp-ws","stage":"reply","rejected":{"code":"reply.blocked"}}]`,
		``,
	} {
		record := gjson.Get(logs[index].Other, "request_plugins")
		if want == "" {
			assert.False(t, record.Exists(), logs[index].Other)
			continue
		}
		assert.JSONEq(t, want, stripRecordNames(t, record.Raw), logs[index].Other)
	}
	var errorLogs []model.Log
	require.NoError(t, model.LOG_DB.Where("type = ?", model.LogTypeError).Find(&errorLogs).Error)
	require.Len(t, errorLogs, 1)
	assert.Contains(t, errorLogs[0].Content, "Blocked")
	assert.JSONEq(t, `[{"plugin":"rp-ws","stage":"ingress","rejected":{"code":"blocked.ws"}}]`, stripRecordNames(t, gjson.Get(errorLogs[0].Other, "request_plugins").Raw))
}

// stripRecordNames drops the display names, which come from the plugin meta.
func stripRecordNames(t *testing.T, raw string) string {
	t.Helper()
	var entries []map[string]any
	require.NoError(t, common.UnmarshalJsonStr(raw, &entries))
	for _, entry := range entries {
		delete(entry, "name")
	}
	encoded, err := common.Marshal(entries)
	require.NoError(t, err)
	return string(encoded)
}
