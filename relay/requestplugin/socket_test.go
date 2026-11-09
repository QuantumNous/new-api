package requestplugin

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

// realtimePlugin checks the text of Realtime client events at ingress: it
// rejects "forbidden", rewrites "secret", and finds the format and the view
// members it read.
const realtimePlugin = `export const meta = {apiVersion: 1, key: "rp-realtime", name: "Realtime", version: "1.0.0", author: {name: "Test"}};
export function ingress(ctx, req) {
  const body = req.body;
  const texts = [];
  if (typeof body.instructions === "string") texts.push(["/instructions", body.instructions]);
  (body.input || []).forEach((item, i) => (item.content || []).forEach((part, k) => {
    if (typeof part.text === "string") texts.push(["/input/" + i + "/content/" + k + "/text", part.text]);
    if ("audio" in part) texts.push(["", "audio reached the hook"]);
  }));
  const ops = [];
  for (const [path, text] of texts) {
    if (text.includes("forbidden") || text.includes("audio reached")) return {action: "reject", code: "blocked.rt", message: "Blocked"};
    if (text.includes("secret")) ops.push({op: "replace", path, value: text.replaceAll("secret", "[hidden]")});
  }
  const seen = ctx.format + ":" + ctx.path + ":" + Object.keys(body).sort().join(",");
  return {action: "continue", effects: ops.length ? [{type: "json.patch", ops}] : [], findings: [{rule: "seen", category: seen, count: 1}]};
}`

// realtimeSession is a Realtime session's plugins, and what they sent to the
// client and the upstream.
type realtimeSession struct {
	*Realtime
	client []string
	target []string
}

func newRealtimeSession(t *testing.T) *realtimeSession {
	t.Helper()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/realtime", nil)
	c.Set("group", "default")
	c.Set("id", 5)
	c.Set("username", "alice")
	c.Set("token_id", 9)
	c.Set("token_name", "ci")
	c.Set(common.RequestIdKey, "req-1")
	StartRealtime(c)
	info := replyInfo(types.RelayFormatOpenAIRealtime, relayconstant.RelayModeRealtime)
	session := &realtimeSession{}
	session.Realtime = NewRealtime(c, info, func(message []byte) {
		session.client = append(session.client, string(message))
	}, func(message []byte) {
		session.target = append(session.target, string(message))
	})
	return session
}

func registerRealtimePlugin(t *testing.T) {
	t.Helper()
	plugin, err := jsplugin.DefaultRegistry.Register(realtimePlugin, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { _ = jsplugin.DefaultRegistry.Unregister(plugin.Meta.Key) })
}

// realtimeDelta is a Realtime delta event of response resp_1.
func realtimeDelta(name, delta string) []byte {
	encoded, _ := common.Marshal(gin.H{"type": name, "event_id": "event_up", "response_id": "resp_1", "item_id": "item_1", "output_index": 0, "content_index": 0, "delta": delta})
	return encoded
}

// realtimeDone is the response.done of resp_1 with one message item.
func realtimeDone(part gin.H) []byte {
	encoded, _ := common.Marshal(gin.H{"type": "response.done", "event_id": "event_up", "response": gin.H{"id": "resp_1", "status": "completed",
		"output": []gin.H{{"id": "item_1", "type": "message", "role": "assistant", "content": []gin.H{part}}},
		"usage":  gin.H{"total_tokens": 30, "input_tokens": 20, "output_tokens": 10}}})
	return encoded
}

// The client's text events run the ingress instances on a Responses-shaped
// view and get their changes; a rejection answers with an error event and
// drops the event. Audio input is never read; the record says so once.
func TestRealtimeClientEvents(t *testing.T) {
	setupReplyPlugins(t, `[{"id":"rt","name":"Realtime","plugin":"rp-realtime","enabled":true,"global":true}]`)
	registerRealtimePlugin(t)
	session := newRealtimeSession(t)
	require.NotNil(t, session.Realtime)

	patched, dropped := session.ClientEvent("session.update", []byte(`{"type":"session.update","session":{"instructions":"keep the secret","voice":"alloy"}}`))
	require.False(t, dropped)
	assert.JSONEq(t, `{"type":"session.update","session":{"instructions":"keep the [hidden]","voice":"alloy"}}`, string(patched))

	item := `{"type":"conversation.item.create","event_id":"evt_2","item":{"type":"message","role":"user","content":[{"type":"input_text","text":"a secret word"},{"type":"input_audio","audio":"UklGRgAAAABXQVZF"}]}}`
	patched, dropped = session.ClientEvent("conversation.item.create", []byte(item))
	require.False(t, dropped)
	assert.JSONEq(t, `{"type":"conversation.item.create","event_id":"evt_2","item":{"type":"message","role":"user","content":[{"type":"input_text","text":"a [hidden] word"},{"type":"input_audio","audio":"UklGRgAAAABXQVZF"}]}}`, string(patched))

	patched, dropped = session.ClientEvent("response.create", []byte(`{"type":"response.create","response":{"modalities":["text"]}}`))
	assert.Nil(t, patched, "nothing to read, nothing run")
	assert.False(t, dropped)

	patched, dropped = session.ClientEvent("response.create", []byte(`{"type":"response.create","event_id":"evt_3","response":{"instructions":"say forbidden things"}}`))
	assert.Nil(t, patched)
	require.True(t, dropped)
	require.Len(t, session.client, 1)
	answer := gjson.Parse(session.client[0])
	assert.Equal(t, "error", answer.Get("type").Str)
	assert.Equal(t, "request_rejected", answer.Get("error.code").Str)
	assert.Equal(t, "evt_3", answer.Get("error.event_id").Str)
	assert.Contains(t, answer.Get("error.message").Str, "Blocked (code: blocked.rt)")

	audio := []byte(`{"type":"input_audio_buffer.append","audio":"` + strings.Repeat("A", 64<<10) + `"}`)
	for range 3 {
		patched, dropped = session.ClientEvent("input_audio_buffer.append", audio)
		assert.Nil(t, patched)
		assert.False(t, dropped)
	}
	// The audio is not read at all: no parse, no allocation.
	assert.Zero(t, testing.AllocsPerRun(100, func() { session.ClientEvent("input_audio_buffer.append", audio) }))
	clear := []byte(`{"type":"input_audio_buffer.clear"}`)
	assert.Zero(t, testing.AllocsPerRun(100, func() { session.ClientEvent("input_audio_buffer.clear", clear) }))

	info := replyInfo(types.RelayFormatOpenAIRealtime, relayconstant.RelayModeRealtime)
	session.Close(info)
	var categories []string
	var audioEntries int
	for _, entry := range info.RequestPluginRecord {
		for _, finding := range entry.Findings {
			categories = append(categories, finding.Category)
		}
		if entry.Audio {
			audioEntries++
			assert.True(t, entry.Unchecked)
			assert.Equal(t, StageIngress, entry.Stage)
		}
	}
	assert.Equal(t, []string{
		"openai_responses:/v1/realtime:instructions",
		"openai_responses:/v1/realtime:input",
	}, categories)
	assert.Equal(t, 1, audioEntries, "once per session")
	assert.Equal(t, &relaycommon.RequestPluginRejected{Code: "blocked.rt"}, info.RequestPluginRecord[len(info.RequestPluginRecord)-2].Rejected)
	assert.Equal(t, "unchecked", info.RequestPluginSteps[len(info.RequestPluginSteps)-1].Action)
}

// A session no instance matches gets no plugin state; one whose instances
// do not check replies or report passes every server event untouched.
func TestRealtimeUnusedIsFree(t *testing.T) {
	setupReplyPlugins(t, `[{"id":"other","name":"Other","plugin":"rp-reply","enabled":true,"global":true,"models":["other-model"]}]`)
	assert.Nil(t, newRealtimeSession(t).Realtime)

	setInstances(t, `[{"id":"stages","name":"Stages","plugin":"rp-stages","enabled":true,"global":true}]`)
	session := newRealtimeSession(t)
	require.NotNil(t, session.Realtime)
	delta := realtimeDelta("response.text.delta", "hello")
	session.ServerEvent("response.text.delta", delta, nil, 0)
	assert.Equal(t, []string{string(delta)}, session.client)
	session.toClient = func([]byte) {}
	assert.Zero(t, testing.AllocsPerRun(100, func() { session.ServerEvent("response.text.delta", delta, nil, 0) }))
}

// Text deltas go through the reply check: a mask rewrites the text the
// client gets, response.done included.
func TestRealtimeReplyMasksText(t *testing.T) {
	setupReplyPlugins(t, `[{"id":"mask","name":"Mask","plugin":"rp-reply","enabled":true,"global":true,"config":{"words":["secret"]}}]`)
	session := newRealtimeSession(t)
	session.ServerEvent("response.created", []byte(`{"type":"response.created","response":{"id":"resp_1"}}`), nil, 0)
	session.ServerEvent("response.text.delta", realtimeDelta("response.text.delta", "the secret "), nil, 0)
	session.ServerEvent("response.text.delta", realtimeDelta("response.text.delta", "is out"), nil, 0)
	session.ServerEvent("response.audio.delta", []byte(`{"type":"response.audio.delta","response_id":"resp_1","delta":"AAAA"}`), nil, 0)
	session.ServerEvent("response.text.done", []byte(`{"type":"response.text.done","response_id":"resp_1","item_id":"item_1","output_index":0,"content_index":0,"text":"the secret is out"}`), nil, 0)
	session.ServerEvent("response.done", realtimeDone(gin.H{"type": "text", "text": "the secret is out"}), nil, 0)

	var text strings.Builder
	var kinds []string
	for _, message := range session.client {
		event := gjson.Parse(message)
		kinds = append(kinds, event.Get("type").Str)
		if event.Get("type").Str == "response.text.delta" {
			text.WriteString(event.Get("delta").Str)
		}
	}
	assert.Equal(t, "the *** is out", text.String())
	assert.Contains(t, kinds, "response.audio.delta")
	last := gjson.Parse(session.client[len(session.client)-1])
	assert.Equal(t, "response.done", last.Get("type").Str)
	assert.Equal(t, "the *** is out", last.Get("response.output.0.content.0.text").Str)
	assert.Empty(t, session.target)
	for _, message := range session.client {
		assert.NotContains(t, message, "secret")
	}

	info := replyInfo(types.RelayFormatOpenAIRealtime, relayconstant.RelayModeRealtime)
	session.Close(info)
	require.Len(t, info.RequestPluginRecord, 1)
	assert.Equal(t, StageReply, info.RequestPluginRecord[0].Stage)
	assert.Equal(t, 1, info.RequestPluginRecord[0].Masked)
}

// A stop sends the client an error event and the upstream a
// response.cancel; the rest of the response is dropped and its
// response.done shows what the client got. A mask on an audio transcript
// stops the response too: its audio already went out.
func TestRealtimeReplyStops(t *testing.T) {
	tests := map[string]struct {
		config  string
		name    string
		deltas  []string
		code    string
		done    gin.H
		path    string
		kept    string
		dropped string
	}{
		"text stop": {
			config: `{"stop":"forbidden"}`, name: "response.output_text.delta",
			deltas: []string{"A harmless opening that is long enough to be checked. ", "Then the forbidden part follows, also long enough.", "more"},
			code:   "reply.blocked", done: gin.H{"type": "output_text", "text": "whole forbidden text"},
			path: "response.output.0.content.0.text", kept: "A harmless opening that is long enough to be checked. ", dropped: "forbidden",
		},
		"transcript mask": {
			config: `{"words":["secret"]}`, name: "response.audio_transcript.delta",
			deltas: []string{"An opening of the transcript that is long enough. ", "Now the secret part of the transcript follows here.", "more"},
			code:   "masked", done: gin.H{"type": "audio", "transcript": "whole secret transcript"},
			path: "response.output.0.content.0.transcript", kept: "An opening of the transcript that is long enough. ", dropped: "secret",
		},
	}
	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			setupReplyPlugins(t, `[{"id":"policy","name":"Policy","plugin":"rp-reply","enabled":true,"global":true,"config":`+tc.config+`}]`)
			session := newRealtimeSession(t)
			session.ServerEvent("response.created", []byte(`{"type":"response.created","response":{"id":"resp_1"}}`), nil, 0)
			for _, delta := range tc.deltas {
				session.ServerEvent(tc.name, realtimeDelta(tc.name, delta), nil, 0)
			}
			session.ServerEvent("response.audio.delta", []byte(`{"type":"response.audio.delta","response_id":"resp_1","delta":"AAAA"}`), nil, 0)
			require.Len(t, session.target, 1)
			cancel := gjson.Parse(session.target[0])
			assert.Equal(t, "response.cancel", cancel.Get("type").Str)
			assert.Equal(t, "resp_1", cancel.Get("response_id").Str)
			// The upstream's error about the cancel is the session's own.
			session.ServerEvent("error", []byte(`{"type":"error","error":{"type":"invalid_request_error","code":"response_cancel_not_active","event_id":"`+cancel.Get("event_id").Str+`"}}`), nil, 0)
			session.ServerEvent("response.done", realtimeDone(tc.done), &dto.RealtimeUsage{InputTokens: 20, OutputTokens: 10, TotalTokens: 30}, 900)

			require.Len(t, session.client, 4, "created, the released delta, the error, response.done: %v", session.client)
			assert.Equal(t, tc.kept, gjson.Get(session.client[1], "delta").Str)
			stop := gjson.Parse(session.client[2])
			assert.Equal(t, "error", stop.Get("type").Str)
			assert.Equal(t, "response_rejected", stop.Get("error.code").Str)
			assert.Contains(t, stop.Get("error.message").Str, "(code: "+tc.code+")")
			done := gjson.Parse(session.client[3])
			assert.Equal(t, "response.done", done.Get("type").Str)
			assert.Equal(t, tc.kept, done.Get(tc.path).Str)
			for _, message := range session.client {
				assert.NotContains(t, message, tc.dropped)
			}

			info := replyInfo(types.RelayFormatOpenAIRealtime, relayconstant.RelayModeRealtime)
			session.Close(info)
			require.Len(t, info.RequestPluginRecord, 1)
			assert.Equal(t, &relaycommon.RequestPluginRejected{Code: tc.code}, info.RequestPluginRecord[0].Rejected)
			assert.Equal(t, "stop", info.RequestPluginSteps[0].Action)
		})
	}
}

// Report runs once per response.done, with the events the client got,
// leaving out audio, and the quota the response was charged.
func TestRealtimeReport(t *testing.T) {
	server, received := newService(t)
	setupReplyPlugins(t, `[]`)
	registerNetPlugin(t)
	setInstances(t, `[{"id":"sink","name":"Sink","plugin":"rp-net","enabled":true,"global":true,"config":{"url":"`+server.URL+`/report"}}]`)
	session := newRealtimeSession(t)
	require.NotNil(t, session.Realtime)
	for range 2 {
		session.ServerEvent("response.created", []byte(`{"type":"response.created","response":{"id":"resp_1"}}`), nil, 0)
		session.ServerEvent("response.audio.delta", []byte(`{"type":"response.audio.delta","response_id":"resp_1","delta":"AAAA"}`), nil, 0)
		session.ServerEvent("response.text.delta", realtimeDelta("response.text.delta", "hello"), nil, 0)
		session.ServerEvent("response.done", realtimeDone(gin.H{"type": "text", "text": "hello"}), &dto.RealtimeUsage{InputTokens: 20, OutputTokens: 10, TotalTokens: 30}, 900)
	}
	for range 2 {
		sent := gjson.Parse(receive(t, received).Body)
		assert.Equal(t, "openai_realtime", sent.Get("ctx.format").Str)
		assert.Equal(t, "/v1/realtime", sent.Get("ctx.path").Str)
		record := sent.Get("record")
		assert.Equal(t, `null`, record.Get("request.body").Raw)
		assert.JSONEq(t, `{"quota":900,"usd":0.0018}`, record.Get("cost").Raw)
		assert.Equal(t, int64(20), record.Get("usage.promptTokens").Int())
		assert.Equal(t, "", record.Get("response.contentType").Str)
		assert.True(t, record.Get("response.stream").Bool())
		var kinds []string
		for _, event := range record.Get("response.events").Array() {
			kinds = append(kinds, event.Get("data.type").Str)
		}
		assert.Equal(t, []string{"response.created", "response.text.delta", "response.done"}, kinds)
	}
	assert.Empty(t, received)
}

// A Responses WebSocket response goes through the reply check event by
// event; its terminal event comes back for the session to send.
func TestResponsesSocket(t *testing.T) {
	setupReplyPlugins(t, `[{"id":"mask","name":"Mask","plugin":"rp-reply","enabled":true,"global":true,"config":{"words":["bad"]}}]`)
	c, _ := replyContext(t, "/v1/responses", types.RelayFormatOpenAIResponses)
	common.SetContextKey(c, constant.ContextKeyOriginalModel, "gpt")
	_, _, _, apiErr := SocketIngress(c, types.RelayFormatOpenAIResponses)
	require.Nil(t, apiErr)
	info := replyInfo(types.RelayFormatOpenAIResponses, relayconstant.RelayModeResponses)
	var sent []string
	socket := ResponsesSocket(c, info, func(message []byte) { sent = append(sent, string(message)) })
	require.NotNil(t, socket)

	delta := func(text string) []byte {
		encoded, _ := common.Marshal(gin.H{"type": "response.output_text.delta", "item_id": "msg_1", "output_index": 0, "content_index": 0, "delta": text})
		return encoded
	}
	socket.Event([]byte(`{"type":"response.created","response":{"id":"resp_1"}}`))
	socket.Event(delta("a bad "))
	socket.Event(delta("word"))
	terminal := socket.Terminal([]byte(`{"type":"response.completed","response":{"id":"resp_1","output":[{"type":"message","id":"msg_1","content":[{"type":"output_text","text":"a bad word"}]}]}}`))
	assert.Nil(t, socket.Stopped())
	require.Len(t, sent, 3)
	assert.Equal(t, "a *** ", gjson.Get(sent[1], "delta").Str)
	assert.Equal(t, "word", gjson.Get(sent[2], "delta").Str)
	assert.Equal(t, "a *** word", gjson.GetBytes(terminal, "response.output.0.content.0.text").Str)
	require.Len(t, info.RequestPluginRecord, 1)
	assert.Equal(t, 1, info.RequestPluginRecord[0].Masked)

	// Without a reply or report instance the session sends events itself.
	setInstances(t, `[{"id":"stages","name":"Stages","plugin":"rp-stages","enabled":true,"global":true}]`)
	c, _ = replyContext(t, "/v1/responses", types.RelayFormatOpenAIResponses)
	assert.Nil(t, ResponsesSocket(c, info, func([]byte) {}))
	setInstances(t, `[]`)
	c, _ = replyContext(t, "/v1/responses", types.RelayFormatOpenAIResponses)
	changed, steps, record, apiErr := SocketIngress(c, types.RelayFormatOpenAIResponses)
	assert.False(t, changed)
	assert.Nil(t, steps)
	assert.Nil(t, record)
	assert.Nil(t, apiErr)
	assert.Nil(t, ResponsesSocket(c, info, func([]byte) {}))
}

// A stored task reports once from its row, at its final state, and not at
// submit; its record carries the submission, the result and the final
// quota.
func TestTaskReport(t *testing.T) {
	server, received := newService(t)
	setupPlugins(t, `[]`)
	registerNetPlugin(t)
	setInstances(t, `[
		{"id":"patch","name":"Patch","plugin":"rp-stages","enabled":true,"global":true,"config":{"effects":{"ingress":[{"type":"json.patch","ops":[{"op":"add","path":"/patched","value":true}]}]}}},
		{"id":"sink","name":"Sink","plugin":"rp-net","enabled":true,"global":true,"config":{"url":"`+server.URL+`/report","target":"`+server.URL+`/ingress"}}
	]`)
	started := time.Now().Add(-time.Minute)
	c, _ := reportContext(t, `{"model":"video","prompt":"a cat","image":"data:image/png;base64,iVBORw0KGgo="}`, started)
	c.Request.URL.Path = "/v1/video/generations"
	_, steps, record, apiErr := SubmitIngress(c, types.RelayFormatTask, "video")
	require.Nil(t, apiErr)
	assert.Equal(t, "/ingress", receive(t, received).Path)
	info := newInfo()
	info.OriginModelName = "video"
	info.SetRequestPluginIngress(steps, record)

	stored := TaskReport(c, info)
	require.NotNil(t, stored)
	assert.Equal(t, []string{"sink"}, stored.Instances)
	assert.JSONEq(t, `{"model":"video","prompt":"a cat","image":"[media:0]","patched":true}`, string(stored.Request))
	TaskCreated(c)
	Report(c, types.RelayFormatTask, info, nil, nil)

	task := &model.Task{TaskID: "task_1", UserId: 5, Group: "default", ChannelId: 7, Quota: 1200, Status: model.TaskStatusSuccess, FinishTime: time.Now().Unix(),
		Properties: model.Properties{OriginModelName: "video", UpstreamModelName: "video-up"},
		Data:       []byte(`{"id":"up_1","status":"succeeded","output":{"video_url":"https://cdn.example/v.mp4","caption":"a cat on a mat","thumb":"data:image/png;base64,AAAA"},"frames":"` + strings.Repeat("QUJD", 400) + `"}`)}
	task.PrivateData.TokenId = 9
	task.PrivateData.ResultURL = "https://gateway.example/v1/videos/task_1/content"
	task.PrivateData.Execution = &model.TaskExecutionSnapshot{RequestID: "req-1", RequestPath: "/v1/video/generations"}
	task.PrivateData.RequestPlugins = stored
	// The row as a poller on another node reads it.
	encoded, err := common.Marshal(task.PrivateData)
	require.NoError(t, err)
	var private model.TaskPrivateData
	require.NoError(t, common.Unmarshal(encoded, &private))
	task.PrivateData = private
	ReportTask(task)

	sent := gjson.Parse(receive(t, received).Body)
	assert.JSONEq(t, `{"stage":"report","format":"task","path":"/v1/video/generations","model":"video","upstreamModel":"video-up","group":"default",
		"channel":{"id":7,"type":1},"attempt":0,"user":{"id":5,"username":"alice"},"token":{"id":9,"name":"ci"},
		"instance":{"id":"sink","name":"Sink"},"config":{"url":"`+server.URL+`/report","target":"`+server.URL+`/ingress"}}`, sent.Get("ctx").Raw)
	got := sent.Get("record")
	assert.Equal(t, "req-1", got.Get("requestId").Str)
	assert.Equal(t, started.UnixMilli(), got.Get("startedAt").Int())
	assert.False(t, got.Get("response").Exists())
	assert.JSONEq(t, `{"body":{"model":"video","prompt":"a cat","image":"[media:0]","patched":true},"media":[{"index":0,"path":"/image","mimeType":"image/png","bytes":8}]}`, got.Get("request").Raw)
	assert.JSONEq(t, `{"id":"task_1","status":"SUCCESS","finishedAt":`+gjson.Get(got.Raw, "task.finishedAt").Raw+`,"result":{
		"urls":["https://gateway.example/v1/videos/task_1/content","https://cdn.example/v.mp4"],
		"texts":[{"path":"id","text":"up_1"},{"path":"status","text":"succeeded"},{"path":"output.caption","text":"a cat on a mat"}],
		"truncated":false}}`, got.Get("task").Raw)
	assert.JSONEq(t, `{"quota":1200,"usd":0.0024}`, got.Get("cost").Raw)
	assert.Equal(t, "patched", gjson.Get(got.Get("requestPlugins").Raw, "0.changes.0.path").Str)
	assert.Empty(t, received, "no report at submit")

	// A task no instance may report costs nothing.
	task.PrivateData.RequestPlugins = nil
	assert.Zero(t, testing.AllocsPerRun(100, func() { ReportTask(task) }))
}

// A submission that failed before its task existed reports at once.
func TestTaskReportBeforeTheTaskExists(t *testing.T) {
	server, received := newService(t)
	setupPlugins(t, `[]`)
	registerNetPlugin(t)
	setInstances(t, `[{"id":"sink","name":"Sink","plugin":"rp-net","enabled":true,"global":true,"config":{"url":"`+server.URL+`/report","target":"`+server.URL+`/ingress"}}]`)
	c, _ := reportContext(t, `{"model":"video","prompt":"a cat"}`, time.Now())
	_, _, _, apiErr := SubmitIngress(c, types.RelayFormatTask, "video")
	require.Nil(t, apiErr)
	receive(t, received)
	c.JSON(http.StatusInternalServerError, gin.H{"code": "task_insert_failed"})
	Report(c, types.RelayFormatTask, newInfo(), nil, types.NewErrorWithStatusCode(assert.AnError, types.ErrorCodeBadResponse, http.StatusInternalServerError))
	sent := gjson.Parse(receive(t, received).Body)
	assert.Equal(t, int64(500), sent.Get("record.response.status").Int())
	assert.False(t, sent.Get("record.task").Exists())
}

// The task result keeps URLs and texts within its bounds.
func TestTaskResultBounds(t *testing.T) {
	long := strings.Repeat("é", maxTaskTextBytes)
	result := taskResult([]byte(`{"a":"`+long+`","b":"after"}`), "")
	require.Len(t, result.Texts, 1)
	assert.True(t, result.Truncated)
	assert.LessOrEqual(t, len(result.Texts[0].Text), maxTaskTextBytes)
	assert.True(t, strings.HasPrefix(long, result.Texts[0].Text))

	var urls []string
	for i := range maxTaskURLs + 1 {
		urls = append(urls, `"https://cdn.example/`+strings.Repeat("x", i)+`"`)
	}
	result = taskResult([]byte(`[`+strings.Join(urls, ",")+`]`), "")
	assert.Len(t, result.URLs, maxTaskURLs)
	assert.True(t, result.Truncated)
	assert.Equal(t, reportTaskResult{URLs: []string{}, Texts: []reportTaskText{}}, taskResult(nil, ""))
}

// A capped record keeps counting what a Realtime session already dropped.
func TestCapRequestPluginRecordKeepsTheCount(t *testing.T) {
	record := appendCapped(nil, make([]relaycommon.RequestPluginRecord, maxRealtimeRecord+5))
	require.Len(t, record, maxRealtimeRecord+1)
	assert.Equal(t, 5, record[maxRealtimeRecord].Truncated)
	for i := range record[:maxRealtimeRecord] {
		record[i] = relaycommon.RequestPluginRecord{Plugin: "p", Stage: "ingress", Unchecked: true}
	}
	capped := relaycommon.CapRequestPluginRecord(record)
	require.Len(t, capped, maxRealtimeRecord+1)
	assert.Equal(t, 5, capped[maxRealtimeRecord].Truncated)
}

// The WebSocket capture keeps whole events only.
func TestSocketCapture(t *testing.T) {
	capture := &responseCapture{socket: true}
	capture.event([]byte(`{"a":1}`))
	capture.event([]byte("{\"b\":\n2}\n"))
	capture.event([]byte(`"` + strings.Repeat("x", maxReportResponseBytes) + `"`))
	capture.event([]byte(`{"c":3}`))
	events := reportEvents(capture.kept, capture.written > int64(len(capture.kept)))
	require.Len(t, events, 2)
	assert.JSONEq(t, `{"a":1}`, string(events[0].Data))
	assert.JSONEq(t, `{"b":2}`, string(events[1].Data))
}
