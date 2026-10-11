package plugins_test

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	builtinplugins "github.com/QuantumNous/new-api/plugins"
	"github.com/QuantumNous/new-api/relay/channel"
	taskplugin "github.com/QuantumNous/new-api/relay/channel/task/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newXAIPlugin(t *testing.T) *jsplugin.LoadedPlugin {
	t.Helper()
	source, err := builtinplugins.Source("xai")
	require.NoError(t, err)
	plugin, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: "xai"})
	require.NoError(t, err)
	return plugin
}

func callXAI(t *testing.T, plugin *jsplugin.LoadedPlugin, path []string, args ...any) (map[string]any, error) {
	t.Helper()
	var value any
	var err error
	if len(path) == 1 {
		value, err = plugin.Engine.Call(t.Context(), path[0], args...)
	} else {
		value, err = plugin.Engine.CallPath(t.Context(), path[0], path[1:], args...)
	}
	if err != nil || value == nil {
		return nil, err
	}
	return alibabaObject(t, value), nil
}

func TestXAIResponsesProtocol(t *testing.T) {
	testVideoResponsesProtocol(t, videoResponsesTestCase{
		pluginKey: "xai",
		model:     "grok-imagine-video-1.5",
		requestBody: map[string]any{
			"model": "grok-imagine-video-1.5",
			"input": []any{map[string]any{"role": "user", "content": []any{
				map[string]any{"type": "input_text", "text": "a fox runs through snow"},
				map[string]any{"type": "input_image", "image_url": "https://cdn.example/fox.png"},
			}}},
			"seconds": 10,
			"size":    "1280x720",
		},
		wantAction: "image_to_video",
		wantRequest: map[string]any{
			"model":        "grok-imagine-video-1.5",
			"prompt":       "a fox runs through snow",
			"image":        map[string]any{"url": "https://cdn.example/fox.png"},
			"duration":     float64(10),
			"resolution":   "720p",
			"aspect_ratio": "16:9",
		},
		wantUsageKeys:       []string{"input_images", "input_video_seconds", "moderated", "resolution", "seconds"},
		wantSubmitUsageKeys: []string{"input_images", "moderated", "resolution", "seconds"},
		wantVendorName:      "xai",
	})
}

// xAI still bills a generation its moderation blocks, and the host refunds
// every FAILURE task in full, so a blocked video must settle as a charged
// SUCCESS. The flow runs through the production adaptor and settlement
// evaluator with a price an administrator can save.
func TestXAIModeratedVideoKeepsItsCharge(t *testing.T) {
	plugin := newXAIPlugin(t)
	const videoModel = "grok-imagine-video-1.5"
	const expression = `u("moderated") == true ? tier("blocked", 0.05 + u("seconds") * 0) : ` +
		`u("resolution") == "1080p" ? tier("1080p", u("seconds") * 0.25 + u("input_images") * 0.01) : ` +
		`u("resolution") == "720p" ? tier("720p", u("seconds") * 0.14 + u("input_images") * 0.01) : ` +
		`tier("480p", u("seconds") * 0.08 + u("input_images") * 0.01)`
	schema, _ := plugin.Meta.UsageForModel(videoModel)
	require.NoError(t, billing_setting.SmokeTestTaskExpr(expression, schema))

	info := &relaycommon.RelayInfo{
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelBaseUrl: "https://api.x.ai", ApiKey: "xai-key", UpstreamModelName: videoModel},
		OriginModelName: videoModel,
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{PublicTaskID: "task_public", Action: "image_to_video"},
	}
	adaptor := taskplugin.New(plugin)
	adaptor.Init(info)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	c.Set("task_request", map[string]any{"model": videoModel, "prompt": "a fox", "input_reference": "https://cdn.example/fox.png", "seconds": "8", "size": "1280x720"})
	require.Nil(t, adaptor.ValidateRequestAndSetAction(c, info))
	facts, err := adaptor.ExtractUsageFactsValidated(c, info)
	require.NoError(t, err)
	assert.Equal(t, map[string]any{"seconds": float64(8), "resolution": "720p", "input_images": float64(1), "moderated": false}, facts)
	_, trace, err := billingexpr.RunExprWithRequest(expression, billingexpr.TokenParams{}, billingexpr.RequestInput{Usage: facts})
	require.NoError(t, err)
	assert.Equal(t, "720p", trace.MatchedTier)
	snapshot := &billingexpr.BillingSnapshot{
		BillingMode: billing_setting.BillingModeTieredExpr, ModelName: videoModel, ExprString: expression, ExprHash: billingexpr.ExprHashString(expression),
		GroupRatio: 1, QuotaPerUnit: 500000, ExprVersion: billingexpr.ExprVersion(expression), TaskUsageBilling: true, UsageFacts: facts,
	}

	for _, tc := range []struct {
		name         string
		httpStatus   int
		body         string
		wantStatus   string
		wantProgress string
		wantReason   string
		wantFacts    map[string]any
		wantTier     string
		wantQuota    int
		wantVideo    bool
	}{
		{name: "still rendering", httpStatus: http.StatusAccepted, body: ``, wantStatus: "IN_PROGRESS"},
		{name: "progress", httpStatus: http.StatusOK, body: `{"status":"pending","progress":42}`, wantStatus: "IN_PROGRESS", wantProgress: "42%"},
		{
			name: "delivered video settles on its length", httpStatus: http.StatusOK,
			body:       `{"status":"done","progress":100,"model":"grok-imagine-video-1.5","video":{"url":"https://vidgen.x.ai/v.mp4","duration":6,"respect_moderation":true},"usage":{"cost_in_usd_ticks":8500000000}}`,
			wantStatus: "SUCCESS", wantFacts: map[string]any{"seconds": float64(6)}, wantTier: "720p", wantQuota: 425000, wantVideo: true,
		},
		{
			name: "moderated output is charged", httpStatus: http.StatusOK,
			body:       `{"status":"done","progress":100,"video":{"url":"","duration":8,"respect_moderation":false},"usage":{"cost_in_usd_ticks":11200000000}}`,
			wantStatus: "SUCCESS", wantFacts: map[string]any{"seconds": float64(8), "moderated": true}, wantTier: "blocked", wantQuota: 25000,
		},
		{
			name: "failure xAI billed is charged", httpStatus: http.StatusOK,
			body:       `{"status":"failed","error":{"code":"invalid_argument","message":"Content blocked by moderation"},"usage":{"cost_in_usd_ticks":500000000}}`,
			wantStatus: "SUCCESS", wantFacts: map[string]any{"moderated": true}, wantTier: "blocked", wantQuota: 25000,
		},
		{
			name: "unbilled failure is refunded", httpStatus: http.StatusOK,
			body:       `{"status":"failed","error":{"code":"internal_error","message":"engine crashed"},"usage":{"cost_in_usd_ticks":0}}`,
			wantStatus: "FAILURE", wantReason: "engine crashed",
		},
		{name: "expired result", httpStatus: http.StatusOK, body: `{"status":"expired"}`, wantStatus: "FAILURE", wantReason: "the video expired before it was retrieved"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			task := &model.Task{
				TaskID: "task_public", Action: "image_to_video", Data: []byte(tc.body),
				Properties: model.Properties{OriginModelName: videoModel, UpstreamModelName: videoModel},
			}
			result, err := adaptor.ParseTaskResult(task, &http.Response{StatusCode: tc.httpStatus, Header: make(http.Header)}, []byte(tc.body))
			require.NoError(t, err)
			assert.Equal(t, tc.wantStatus, result.Status)
			assert.Equal(t, tc.wantProgress, result.Progress)
			assert.Equal(t, tc.wantReason, result.Reason)
			if tc.wantStatus == "IN_PROGRESS" {
				return
			}
			// A downstream New API gateway polls this task's native status
			// route, which omits usage, and must settle on the same facts.
			var data any
			require.NoError(t, common.UnmarshalJsonStr(tc.body, &data))
			native, err := plugin.Engine.CallPath(t.Context(), "native", []string{"videoStatus"}, map[string]any{},
				map[string]any{"task_id": "task_public", "status": result.Status, "fail_reason": result.Reason, "data": data})
			require.NoError(t, err)
			nativeBody, err := common.Marshal(native)
			require.NoError(t, err)
			assert.NotContains(t, string(nativeBody), "cost_in_usd_ticks")
			downstream, err := adaptor.ParseTaskResult(task, &http.Response{StatusCode: http.StatusOK, Header: make(http.Header)}, nativeBody)
			require.NoError(t, err)
			assert.Equal(t, result.Status, downstream.Status)
			assert.Equal(t, result.UsageFacts, downstream.UsageFacts)
			if tc.wantStatus != "SUCCESS" {
				return
			}
			assert.Equal(t, tc.wantFacts, result.UsageFacts)
			settled, _, err := service.EvaluateTaskCompletionUsage(snapshot, result.UsageFacts)
			require.NoError(t, err)
			assert.Equal(t, tc.wantTier, settled.MatchedTier)
			assert.Equal(t, tc.wantQuota, settled.ActualQuotaAfterGroup)

			task.Status = model.TaskStatusSuccess
			artifacts, err := adaptor.ListArtifacts(task)
			require.NoError(t, err)
			if !tc.wantVideo {
				assert.Empty(t, artifacts, "a blocked result has no video to proxy")
				return
			}
			assert.Equal(t, []channel.TaskArtifact{{Key: "video", Type: "video", MimeType: "video/mp4"}}, artifacts)
			content, err := adaptor.BuildContentRequest(t.Context(), task, "video", channel.TaskArtifactClientRequest{Method: http.MethodGet})
			require.NoError(t, err)
			assert.Equal(t, "https://vidgen.x.ai/v.mp4", content.URL)
		})
	}
}

func TestXAIVideoRequests(t *testing.T) {
	plugin := newXAIPlugin(t)
	referenceImages := []any{map[string]any{"url": "https://cdn.example/a.png"}, map[string]any{"url": "https://cdn.example/b.png"}}
	inputVideo := map[string]any{"url": "https://cdn.example/in.mp4"}
	jsonBody := func(value map[string]any) map[string]any { return map[string]any{"kind": "json", "value": value} }

	for _, tc := range []struct {
		name      string
		decoder   []string
		ctx       map[string]any
		wantModel string
		wantPath  string
		wantBody  map[string]any
		wantFacts map[string]any
	}{
		{
			name:    "reference images keep only documented fields",
			decoder: []string{"native", "createGeneration"},
			ctx: map[string]any{"body": jsonBody(map[string]any{
				"model": "grok-imagine-video-1.5", "prompt": "<IMAGE_0> meets <IMAGE_1>", "reference_images": referenceImages, "resolution": "720p",
				"user": "end-user", "n": 4, "storage_options": map[string]any{"filename": "out.mp4"},
			})},
			wantModel: "grok-imagine-video-1.5",
			wantPath:  "/v1/videos/generations",
			wantBody: map[string]any{
				"model": "grok-imagine-video-1.5", "prompt": "<IMAGE_0> meets <IMAGE_1>", "reference_images": referenceImages,
				"duration": float64(8), "resolution": "720p", "user": "end-user",
			},
			wantFacts: map[string]any{"seconds": float64(8), "resolution": "720p", "input_images": float64(2), "moderated": false},
		},
		{
			name:    "edit reserves the longest input and drops output settings",
			decoder: []string{"native", "createEdit"},
			ctx: map[string]any{"body": jsonBody(map[string]any{
				"model": "grok-imagine-video", "prompt": "make it snow", "video": inputVideo, "duration": 5, "resolution": "720p",
			})},
			wantModel: "grok-imagine-video",
			wantPath:  "/v1/videos/edits",
			wantBody:  map[string]any{"model": "grok-imagine-video", "prompt": "make it snow", "video": inputVideo},
			wantFacts: map[string]any{"seconds": float64(9), "resolution": "720p", "input_images": float64(0), "input_video_seconds": float64(9), "moderated": false},
		},
		{
			name:    "extension bills the added seconds",
			decoder: []string{"native", "createExtension"},
			ctx: map[string]any{"body": jsonBody(map[string]any{
				"model": "grok-imagine-video", "prompt": "keep walking", "video": inputVideo, "duration": 4,
			})},
			wantModel: "grok-imagine-video",
			wantPath:  "/v1/videos/extensions",
			wantBody:  map[string]any{"model": "grok-imagine-video", "prompt": "keep walking", "video": inputVideo, "duration": float64(4)},
			wantFacts: map[string]any{"seconds": float64(4), "resolution": "720p", "input_images": float64(0), "input_video_seconds": float64(15), "moderated": false},
		},
		{
			name:    "OpenAI multipart upload becomes the first frame",
			decoder: []string{"protocols", "openai_video", "decodeRequest"},
			ctx: map[string]any{"model": "grok-imagine-video", "body": map[string]any{
				"kind":   "multipart",
				"fields": map[string]any{"prompt": []any{"a cat"}, "seconds": []any{"6"}, "size": []any{"720x1280"}},
				"files":  []any{map[string]any{"ref": "request_file:input_reference", "field": "input_reference", "filename": "cat.png", "mimeType": "image/png", "size": 10}},
			}},
			wantModel: "grok-imagine-video",
			wantPath:  "/v1/videos/generations",
			wantBody: map[string]any{
				"model": "grok-imagine-video", "prompt": "a cat", "duration": float64(6), "resolution": "720p", "aspect_ratio": "9:16",
				"image": map[string]any{"url": map[string]any{"__fileRef": "request_file:input_reference", "encoding": "dataUrl"}},
			},
			wantFacts: map[string]any{"seconds": float64(6), "resolution": "720p", "input_images": float64(1), "input_video_seconds": float64(0), "moderated": false},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			intent, err := callXAI(t, plugin, tc.decoder, tc.ctx)
			require.NoError(t, err)
			assert.Equal(t, tc.wantModel, intent["model"])
			driver := map[string]any{
				"model": tc.wantModel, "upstreamModel": tc.wantModel, "action": intent["action"], "requestBody": intent["requestBody"],
				"baseUrl": "https://api.x.ai", "apiKey": "xai-key", "upstream": map[string]any{"kind": "vendor"},
			}
			descriptor, err := callXAI(t, plugin, []string{"buildSubmitRequest"}, driver)
			require.NoError(t, err)
			assert.Equal(t, "https://api.x.ai"+tc.wantPath, descriptor["url"])
			assert.Equal(t, tc.wantBody, descriptor["body"])
			facts, err := callXAI(t, plugin, []string{"extractUsage"}, driver)
			require.NoError(t, err)
			assert.Equal(t, tc.wantFacts, facts)
		})
	}

	t.Run("legacy task shape reaches the driver undecoded", func(t *testing.T) {
		descriptor, err := callXAI(t, plugin, []string{"buildSubmitRequest"}, map[string]any{
			"model": "grok-imagine-video-1.5", "action": "text_to_video", "baseUrl": "https://api.x.ai", "apiKey": "xai-key",
			"requestBody": map[string]any{"prompt": "two cats", "images": []any{"https://cdn.example/a.png", "https://cdn.example/b.png"}, "seconds": "5", "size": "480p", "metadata": map[string]any{"generate_audio": false}},
		})
		require.NoError(t, err)
		assert.Equal(t, "reference_to_video", descriptor["action"])
		assert.Equal(t, map[string]any{
			"model": "grok-imagine-video-1.5", "prompt": "two cats", "reference_images": referenceImages,
			"duration": float64(5), "resolution": "480p", "generate_audio": false,
		}, descriptor["body"])
	})

	t.Run("completion settles edit and extension lengths", func(t *testing.T) {
		parsed, err := callXAI(t, plugin, []string{"parseSubmitResponse"}, map[string]any{"action": "video_extension", "requestBody": map[string]any{"duration": 4}}, map[string]any{"body": map[string]any{"request_id": "req-1"}})
		require.NoError(t, err)
		assert.Equal(t, map[string]any{"extension_seconds": float64(4)}, parsed["state"])
		done := map[string]any{"status": "done", "video": map[string]any{"url": "https://vidgen.x.ai/v.mp4", "duration": 12, "respect_moderation": true}}
		facts, err := callXAI(t, plugin, []string{"extractUsageOnComplete"}, map[string]any{"action": "video_extension", "state": parsed["state"]}, map[string]any{"status": "SUCCESS"}, done)
		require.NoError(t, err)
		assert.Equal(t, map[string]any{"input_video_seconds": float64(8)}, facts)
		facts, err = callXAI(t, plugin, []string{"extractUsageOnComplete"}, map[string]any{"action": "video_edit"}, map[string]any{"status": "SUCCESS"}, done)
		require.NoError(t, err)
		assert.Equal(t, map[string]any{"seconds": float64(9), "input_video_seconds": float64(9)}, facts)
	})

	for _, tc := range []struct {
		name    string
		decoder string
		body    map[string]any
		wantErr string
	}{
		{"edits need the video-input model", "createEdit", map[string]any{"model": "grok-imagine-video-1.5", "prompt": "x", "video": inputVideo}, "video editing and extension require grok-imagine-video"},
		{"model without 1080p", "createGeneration", map[string]any{"model": "grok-imagine-video", "prompt": "x", "resolution": "1080p"}, "grok-imagine-video resolution must be one of 480p, 720p"},
		{"reference-to-video is capped at 720p", "createGeneration", map[string]any{"model": "grok-imagine-video-1.5", "prompt": "x", "reference_images": referenceImages, "resolution": "1080p"}, "reference-to-video supports resolution 480p or 720p"},
		{"duration bound", "createGeneration", map[string]any{"model": "grok-imagine-video-1.5", "prompt": "x", "duration": 16}, "duration must be an integer between 1 and 15"},
		{"extension bound", "createExtension", map[string]any{"model": "grok-imagine-video", "prompt": "x", "video": inputVideo, "duration": 11}, "duration must be an integer between 2 and 10"},
		{"gateway files are unreachable", "createGeneration", map[string]any{"model": "grok-imagine-video-1.5", "image": map[string]any{"file_id": "file-1"}}, "image must be a URL; file_id is not supported"},
		{"reference image limit", "createGeneration", map[string]any{"model": "grok-imagine-video-1.5", "prompt": "x", "reference_images": []any{"a", "b", "c", "d", "e", "f", "g", "h"}}, "reference_images accepts at most 7 items"},
		{"text-to-video needs a prompt", "createGeneration", map[string]any{"model": "grok-imagine-video-1.5"}, "prompt is required"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := callXAI(t, plugin, []string{"native", tc.decoder}, map[string]any{"body": jsonBody(tc.body)})
			require.ErrorContains(t, err, tc.wantErr)
		})
	}
}

// Clients see why a charged task has no video, and a downstream gateway
// running this plugin reads the native status as charged too.
func TestXAIModeratedTaskPresentation(t *testing.T) {
	plugin := newXAIPlugin(t)
	billedFailure := map[string]any{
		"status": "failed", "error": map[string]any{"code": "invalid_argument", "message": "Content blocked by moderation"},
		"usage": map[string]any{"cost_in_usd_ticks": 500000000},
	}
	status, err := callXAI(t, plugin, []string{"native", "videoStatus"}, map[string]any{}, map[string]any{"task_id": "task_public", "status": "SUCCESS", "data": billedFailure})
	require.NoError(t, err)
	assert.Equal(t, map[string]any{
		"status": "done", "progress": float64(100), "video": map[string]any{"respect_moderation": false},
		"error": map[string]any{"code": "invalid_argument", "message": "Content blocked by moderation"},
	}, status, "the upstream cost is not exposed")
	downstream, err := callXAI(t, plugin, []string{"parseTaskResult"}, map[string]any{}, status, map[string]any{"status": 200})
	require.NoError(t, err)
	assert.Equal(t, "SUCCESS", downstream["status"])
	facts, err := callXAI(t, plugin, []string{"extractUsageOnComplete"}, map[string]any{"action": "text_to_video"}, downstream, status)
	require.NoError(t, err)
	assert.Equal(t, map[string]any{"moderated": true}, facts)

	stalled, err := callXAI(t, plugin, []string{"native", "videoStatus"}, map[string]any{}, map[string]any{"task_id": "task_public", "status": "FAILURE", "fail_reason": "poll failures", "data": map[string]any{"status": "pending", "progress": 10}})
	require.NoError(t, err)
	assert.Equal(t, map[string]any{"status": "failed", "error": map[string]any{"code": "internal_error", "message": "poll failures"}}, stalled)

	filtered := map[string]any{"task_id": "task_public", "status": "SUCCESS", "data": map[string]any{"status": "done", "video": map[string]any{"url": "", "duration": 8, "respect_moderation": false}}}
	video, err := callXAI(t, plugin, []string{"protocols", "openai_video", "render"}, map[string]any{}, filtered)
	require.NoError(t, err)
	assert.Equal(t, map[string]any{
		"object": "video", "seconds": "8",
		"error": map[string]any{"code": "moderation_blocked", "message": "The generated video was blocked by content moderation."},
	}, video)
	final, err := callXAI(t, plugin, []string{"protocols", "openai_responses", "renderFinal"}, map[string]any{}, filtered)
	require.NoError(t, err)
	encoded, err := common.Marshal(final["output"])
	require.NoError(t, err)
	assert.Contains(t, string(encoded), "blocked by content moderation", "renderFinal explains the missing video instead of failing on the absent artifact")
}

// An edit or extension keeps its source's resolution, which xAI never
// reports, so the plugin reserves the 720p cap and reads the output file's
// MP4 header to settle on the resolution xAI bills.
func TestXAIEditSettlesOnOutputResolution(t *testing.T) {
	service.InitHttpClient()
	plugin := newXAIPlugin(t)
	const videoModel = "grok-imagine-video"
	box := func(kind string, payload ...[]byte) []byte {
		body := bytes.Join(payload, nil)
		header := make([]byte, 8)
		binary.BigEndian.PutUint32(header, uint32(8+len(body)))
		copy(header[4:], kind)
		return append(header, body...)
	}
	tkhd := func(version byte, width, height uint16) []byte {
		fields := 72
		if version == 1 {
			fields = 84
		}
		payload := make([]byte, 4+fields+8)
		payload[0] = version
		binary.BigEndian.PutUint16(payload[4+fields:], width)
		binary.BigEndian.PutUint16(payload[4+fields+4:], height)
		return box("tkhd", payload)
	}
	ftyp := box("ftyp", []byte("isom\x00\x00\x02\x00isomiso2mp41"))
	// moov first, as in a streaming-friendly file; the audio track has no size.
	faststart := bytes.Join([][]byte{ftyp, box("moov", box("mvhd", make([]byte, 100)), box("trak", tkhd(0, 0, 0)), box("trak", tkhd(1, 1280, 720))), box("mdat", make([]byte, 1000))}, nil)
	// moov after a media box longer than the first read.
	mdat := box("mdat", make([]byte, 300<<10))
	tail := bytes.Join([][]byte{ftyp, mdat, box("moov", box("trak", tkhd(0, 854, 480)))}, nil)
	var ranges []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/faststart.mp4": // ignores Range
			_, _ = w.Write(faststart)
		case "/tail.mp4":
			ranges = append(ranges, r.Header.Get("Range"))
			http.ServeContent(w, r, "tail.mp4", time.Time{}, bytes.NewReader(tail))
		case "/text.mp4":
			_, _ = w.Write([]byte("not a video"))
		default:
			w.WriteHeader(http.StatusForbidden)
		}
	}))
	defer server.Close()

	const expression = `u("resolution") == "720p" ? tier("720p", u("seconds") * 0.07 + u("input_video_seconds") * 0.01) : ` +
		`tier("480p", u("seconds") * 0.05 + u("input_video_seconds") * 0.01)`
	schema, _ := plugin.Meta.UsageForModel(videoModel)
	require.NoError(t, billing_setting.SmokeTestTaskExpr(expression, schema))
	info := &relaycommon.RelayInfo{
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelBaseUrl: server.URL, ApiKey: "xai-key", UpstreamModelName: videoModel},
		OriginModelName: videoModel,
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{PublicTaskID: "task_public", Action: "video_extension"},
	}
	adaptor := taskplugin.New(plugin)
	adaptor.Init(info)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/xai/v1/videos/extensions", nil)
	c.Set("task_request", map[string]any{"model": videoModel, "prompt": "keep walking", "video": map[string]any{"url": "https://cdn.example/in.mp4"}, "duration": 6})
	require.Nil(t, adaptor.ValidateRequestAndSetAction(c, info))
	reserved, err := adaptor.ExtractUsageFactsValidated(c, info)
	require.NoError(t, err)
	assert.Equal(t, map[string]any{"seconds": float64(6), "resolution": "720p", "input_images": float64(0), "input_video_seconds": float64(15), "moderated": false}, reserved)
	snapshot := &billingexpr.BillingSnapshot{
		BillingMode: billing_setting.BillingModeTieredExpr, ModelName: videoModel, ExprString: expression, ExprHash: billingexpr.ExprHashString(expression),
		GroupRatio: 1, QuotaPerUnit: 500000, ExprVersion: billingexpr.ExprVersion(expression), TaskUsageBilling: true, UsageFacts: reserved,
	}

	for _, tc := range []struct {
		name           string
		path           string
		wantResolution string
		wantTier       string
		wantQuota      int
	}{
		{name: "a file served whole settles on its 720p track", path: "/faststart.mp4", wantResolution: "720p", wantTier: "720p", wantQuota: 250000},
		{name: "a moov after the media is read by Range", path: "/tail.mp4", wantResolution: "480p", wantTier: "480p", wantQuota: 190000},
		{name: "a file that is not MP4 keeps the reserved cap", path: "/text.mp4", wantTier: "720p", wantQuota: 250000},
		{name: "an unreadable file keeps the reserved cap", path: "/missing.mp4", wantTier: "720p", wantQuota: 250000},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body := `{"status":"done","progress":100,"video":{"url":"` + server.URL + tc.path + `","duration":14,"respect_moderation":true}}`
			task := &model.Task{
				TaskID: "task_public", Action: "video_extension", Data: []byte(body),
				Properties:  model.Properties{OriginModelName: videoModel, UpstreamModelName: videoModel},
				PrivateData: model.TaskPrivateData{PluginState: []byte(`{"extension_seconds":6}`)},
			}
			result, err := adaptor.ParseTaskResult(task, &http.Response{StatusCode: http.StatusOK, Header: make(http.Header)}, []byte(body))
			require.NoError(t, err)
			assert.Equal(t, "SUCCESS", result.Status)
			wantFacts := map[string]any{"input_video_seconds": float64(8)}
			if tc.wantResolution == "" {
				assert.Empty(t, result.PluginState)
			} else {
				wantFacts["resolution"] = tc.wantResolution
				assert.JSONEq(t, `{"extension_seconds":6,"output_resolution":"`+tc.wantResolution+`"}`, string(result.PluginState))
			}
			assert.Equal(t, wantFacts, result.UsageFacts)
			settled, _, err := service.EvaluateTaskCompletionUsage(snapshot, result.UsageFacts)
			require.NoError(t, err)
			assert.Equal(t, tc.wantTier, settled.MatchedTier)
			assert.Equal(t, tc.wantQuota, settled.ActualQuotaAfterGroup)
		})
	}
	moov := len(ftyp) + len(mdat)
	assert.Equal(t, []string{"bytes=0-65535", fmt.Sprintf("bytes=%d-%d", moov, moov+65535)}, ranges, "the file is read in pieces, never whole")
}
