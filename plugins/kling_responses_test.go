package plugins_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	builtinplugins "github.com/QuantumNous/new-api/plugins"
	taskplugin "github.com/QuantumNous/new-api/relay/channel/task/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestKlingResponsesProtocol(t *testing.T) {
	testVideoResponsesProtocol(t, videoResponsesTestCase{
		pluginKey: "kling",
		model:     "kling-v3",
		requestBody: map[string]any{
			"model": "kling-v3",
			"input": []any{map[string]any{"role": "user", "content": []any{
				map[string]any{"type": "input_text", "text": "camera orbit"},
				map[string]any{"type": "input_image", "image_url": "https://cdn.example/frame.png"},
			}}},
			"seconds": 10,
			"metadata": map[string]any{
				"mode": "pro",
			},
		},
		wantAction: "image_to_video",
		wantRequest: map[string]any{
			"model":    "kling-v3",
			"prompt":   "camera orbit",
			"image":    "https://cdn.example/frame.png",
			"duration": float64(10),
			"metadata": map[string]any{"mode": "pro"},
		},
		wantUsageKeys:  []string{"units"},
		wantVendorName: "kling",
	})

	source, err := builtinplugins.Source("kling")
	require.NoError(t, err)
	plugin, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: "kling"})
	require.NoError(t, err)
	submit := func(t *testing.T, decoder []string, model string, body map[string]any) (*taskplugin.TaskAdaptor, *gin.Context, *relaycommon.RelayInfo, *dto.TaskError) {
		t.Helper()
		value, err := plugin.Engine.CallPath(t.Context(), decoder[0], decoder[1:], map[string]any{"model": model, "body": map[string]any{"kind": "json", "value": body}})
		require.NoError(t, err)
		info := &relaycommon.RelayInfo{
			ChannelMeta:     &relaycommon.ChannelMeta{ChannelBaseUrl: "https://api-singapore.klingai.com", ApiKey: "ak|sk", UpstreamModelName: model},
			OriginModelName: model,
			TaskRelayInfo:   &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
		}
		adaptor := taskplugin.New(plugin)
		adaptor.Init(info)
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
		c.Set("task_request", alibabaObject(t, value)["requestBody"])
		return adaptor, c, info, adaptor.ValidateRequestAndSetAction(c, info)
	}
	sentBody := func(t *testing.T, adaptor *taskplugin.TaskAdaptor, c *gin.Context, info *relaycommon.RelayInfo) map[string]any {
		t.Helper()
		reader, err := adaptor.BuildRequestBody(c, info)
		require.NoError(t, err)
		encoded, err := io.ReadAll(reader)
		require.NoError(t, err)
		var sent map[string]any
		require.NoError(t, common.Unmarshal(encoded, &sent))
		return sent
	}
	native := []string{"native", "decodeSubmit"}
	openaiVideo := []string{"protocols", "openai_video", "decodeRequest"}

	// Kling bills the duration it sends, and metadata.duration (the whole body
	// on native routes) overrides the top-level one, so the plugin bounds that
	// value to a whole number of seconds up to 3600 before the host reserves
	// quota. Kling checks the durations of each model itself.
	t.Run("bounds the billed duration before billing", func(t *testing.T) {
		for _, tc := range []struct {
			name    string
			decoder []string
			model   string
			body    map[string]any
		}{
			{"native duration above an hour", native, "kling-v3", map[string]any{"model_name": "kling-v3", "prompt": "a cat", "duration": 1e12}},
			{"native fractional duration", native, "kling-v3", map[string]any{"model_name": "kling-v3", "prompt": "a cat", "duration": "5.5"}},
			{"metadata duration behind valid seconds", openaiVideo, "kling-v3", map[string]any{"model": "kling-v3", "prompt": "a cat", "seconds": "5", "metadata": map[string]any{"duration": 3601}}},
		} {
			t.Run(tc.name, func(t *testing.T) {
				_, err := plugin.Engine.CallPath(t.Context(), tc.decoder[0], tc.decoder[1:], map[string]any{"model": tc.model, "body": map[string]any{"kind": "json", "value": tc.body}})
				if err == nil {
					_, _, _, taskErr := submit(t, tc.decoder, tc.model, tc.body)
					require.NotNil(t, taskErr)
					assert.Equal(t, http.StatusBadRequest, taskErr.StatusCode)
					err = taskErr.Error
				}
				assert.ErrorContains(t, err, "duration must be a positive integer of at most 3600")
			})
		}

		adaptor, c, info, taskErr := submit(t, openaiVideo, "kling-v3", map[string]any{"model": "kling-v3", "prompt": "a cat", "seconds": "5", "metadata": map[string]any{"duration": "10"}})
		require.Nil(t, taskErr)
		assert.Equal(t, "10", sentBody(t, adaptor, c, info)["duration"])
		facts, err := adaptor.ExtractUsageFactsValidated(c, info)
		require.NoError(t, err)
		assert.InDelta(t, 6.0, facts["units"], 1e-9, "kling-v3 std costs 0.6 units per second")

		adaptor, c, info, taskErr = submit(t, openaiVideo, "kling-v2-6", map[string]any{"model": "kling-v2-6", "prompt": "a cat", "seconds": "7"})
		require.Nil(t, taskErr)
		assert.Equal(t, "7", sentBody(t, adaptor, c, info)["duration"], "Kling checks the model's durations")
		facts, err = adaptor.ExtractUsageFactsValidated(c, info)
		require.NoError(t, err)
		assert.InDelta(t, 2.1, facts["units"], 1e-9)
	})

	// A native request reaches Kling as the client sent it, for Kling to check:
	// no model alias, no default aspect ratio, cfg_scale, mode or duration. The
	// reservation follows Kling's units for the mode and audio at Kling's
	// defaults, and the dearest units the plugin knows for a mode or audio the
	// model's table lacks.
	t.Run("native bodies and their units", func(t *testing.T) {
		for _, tc := range []struct {
			name      string
			model     string
			body      map[string]any
			wantUnits float64
		}{
			{
				name: "defaults", model: "kling-v2-5-turbo",
				body:      map[string]any{"model_name": "kling-v2-5-turbo", "prompt": "a cat"},
				wantUnits: 1.5,
			},
			{
				name: "2.6 pro with audio", model: "kling-v2-6",
				body:      map[string]any{"model_name": "kling-v2-6", "prompt": "a cat", "mode": "pro", "sound": "on", "duration": "10", "aspect_ratio": "9:16"},
				wantUnits: 10,
			},
			{
				name: "2.6 with a reference voice", model: "kling-v2-6",
				body:      map[string]any{"model_name": "kling-v2-6", "image": "https://cdn.example/a.png", "mode": "pro", "sound": "on", "voice_list": []any{map[string]any{"voice_id": "v1"}}},
				wantUnits: 6,
			},
			{
				name: "v3 in 4k", model: "kling-v3",
				body:      map[string]any{"model_name": "kling-v3", "prompt": "a cat", "mode": "4k", "duration": 15},
				wantUnits: 45,
			},
			{
				name: "a duration the model does not list", model: "kling-v2-6",
				body:      map[string]any{"model_name": "kling-v2-6", "prompt": "a cat", "duration": "8"},
				wantUnits: 2.4,
			},
			{
				name: "audio on a model without an audio price", model: "kling-v2-5-turbo",
				body:      map[string]any{"model_name": "kling-v2-5-turbo", "prompt": "a cat", "sound": "on"},
				wantUnits: 4.5,
			},
			{
				name: "audio in a mode the model's audio table lacks", model: "kling-v2-6",
				body:      map[string]any{"model_name": "kling-v2-6", "prompt": "a cat", "sound": "on"},
				wantUnits: 5,
			},
			{
				name: "a mode the model does not list", model: "kling-v2-6",
				body:      map[string]any{"model_name": "kling-v2-6", "prompt": "a cat", "mode": "4k"},
				wantUnits: 2.5,
			},
			{
				name: "a model the plugin does not list", model: "kling-v9",
				body:      map[string]any{"model_name": "kling-v9", "prompt": "a cat"},
				wantUnits: 4.5,
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				adaptor, c, info, taskErr := submit(t, native, tc.model, tc.body)
				require.Nil(t, taskErr)
				assert.Equal(t, decodePluginValue(t, tc.body), sentBody(t, adaptor, c, info))
				facts, err := adaptor.ExtractUsageFactsValidated(c, info)
				require.NoError(t, err)
				assert.InDelta(t, tc.wantUnits, facts["units"], 1e-9)
			})
		}

		for _, tc := range []struct {
			name    string
			body    map[string]any
			wantErr string
		}{
			{"model is not model_name", map[string]any{"model": "kling-v3", "prompt": "a cat"}, "model_name is required"},
			{"callbacks carry Kling's task ids", map[string]any{"model_name": "kling-v3", "prompt": "a cat", "callback_url": "https://client.example/hook"}, "callback_url is not supported"},
			{"external ids are not looked up", map[string]any{"model_name": "kling-v3", "prompt": "a cat", "external_task_id": "mine-1"}, "external_task_id is not supported"},
		} {
			t.Run(tc.name, func(t *testing.T) {
				_, err := plugin.Engine.CallPath(t.Context(), "native", []string{"decodeSubmit"}, map[string]any{"body": map[string]any{"kind": "json", "value": tc.body}})
				assert.ErrorContains(t, err, tc.wantErr)
			})
		}
	})

	// A /v1/videos client cannot pass a body off as a native one.
	t.Run("a vendorBody field is not a native body", func(t *testing.T) {
		adaptor, c, info, taskErr := submit(t, openaiVideo, "kling-v2-6", map[string]any{"model": "kling-v2-6", "prompt": "a cat",
			"vendorBody": map[string]any{"prompt": "x", "callback_url": "https://client.example/hook"}})
		require.Nil(t, taskErr)
		assert.Equal(t, map[string]any{"model_name": "kling-v2-6", "prompt": "a cat", "mode": "std", "duration": "5"}, sentBody(t, adaptor, c, info))
	})

	t.Run("native replies keep Kling's envelope", func(t *testing.T) {
		processing := map[string]any{"code": float64(0), "message": "SUCCEED", "request_id": "req-1", "data": map[string]any{"task_id": "task_public", "task_status": "processing"}}
		failed, err := plugin.Engine.CallPath(t.Context(), "native", []string{"taskStatus"}, map[string]any{},
			map[string]any{"task_id": "task_public", "status": "FAILURE", "fail_reason": "task timed out", "data": processing})
		require.NoError(t, err)
		assert.Equal(t, map[string]any{
			"code": float64(0), "message": "SUCCEED", "request_id": "req-1",
			"data": map[string]any{"task_id": "task_public", "task_status": "failed", "task_status_msg": "task timed out"},
		}, alibabaObject(t, failed), "a task the gateway failed does not read as running")

		rendered, err := plugin.Engine.CallPath(t.Context(), "native", []string{"error"}, map[string]any{},
			map[string]any{"code": "invalid_request", "message": "duration must be one of 5, 10", "httpStatus": 400, "requestId": "req-2"})
		require.NoError(t, err)
		assert.Equal(t, map[string]any{"code": float64(1201), "message": "duration must be one of 5, 10", "request_id": "req-2"}, alibabaObject(t, rendered))
	})
}
