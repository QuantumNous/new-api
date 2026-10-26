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
		model:     "kling-v2-master",
		requestBody: map[string]any{
			"model": "kling-v2-master",
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
			"model":    "kling-v2-master",
			"prompt":   "camera orbit",
			"image":    "https://cdn.example/frame.png",
			"duration": float64(10),
			"metadata": map[string]any{"mode": "pro"},
		},
		wantUsageKeys:  []string{"units"},
		wantVendorName: "kling",
	})

	// Kling bills the duration it sends, and metadata.duration (the whole body
	// on native routes) overrides the top-level one, so the plugin bounds that
	// value before the host reserves quota.
	t.Run("bills the sent duration and rejects out-of-range durations before billing", func(t *testing.T) {
		source, err := builtinplugins.Source("kling")
		require.NoError(t, err)
		plugin, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: "kling"})
		require.NoError(t, err)
		submit := func(t *testing.T, decoder []string, body map[string]any) (*taskplugin.TaskAdaptor, *gin.Context, *relaycommon.RelayInfo, *dto.TaskError) {
			t.Helper()
			value, err := plugin.Engine.CallPath(t.Context(), decoder[0], decoder[1:], map[string]any{"model": "kling-v1", "body": map[string]any{"kind": "json", "value": body}})
			require.NoError(t, err)
			info := &relaycommon.RelayInfo{
				ChannelMeta:     &relaycommon.ChannelMeta{ChannelBaseUrl: "https://api-singapore.klingai.com", ApiKey: "ak|sk", UpstreamModelName: "kling-v1"},
				OriginModelName: "kling-v1",
				TaskRelayInfo:   &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
			}
			adaptor := taskplugin.New(plugin)
			adaptor.Init(info)
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
			c.Set("task_request", alibabaObject(t, value)["requestBody"])
			return adaptor, c, info, adaptor.ValidateRequestAndSetAction(c, info)
		}
		native := []string{"native", "decodeSubmit"}
		openaiVideo := []string{"protocols", "openai_video", "decodeRequest"}

		for _, tc := range []struct {
			name    string
			decoder []string
			body    map[string]any
		}{
			{"native duration above 3600", native, map[string]any{"model_name": "kling-v1", "prompt": "a cat", "duration": 1e12}},
			{"native fractional duration", native, map[string]any{"model_name": "kling-v1", "prompt": "a cat", "duration": "5.5"}},
			{"metadata duration above 3600 behind valid seconds", openaiVideo, map[string]any{"model": "kling-v1", "prompt": "a cat", "seconds": "5", "metadata": map[string]any{"duration": 3601}}},
		} {
			t.Run(tc.name, func(t *testing.T) {
				_, _, _, taskErr := submit(t, tc.decoder, tc.body)
				require.NotNil(t, taskErr)
				assert.Equal(t, http.StatusBadRequest, taskErr.StatusCode)
				assert.ErrorContains(t, taskErr.Error, "at most 3600")
			})
		}

		adaptor, c, info, taskErr := submit(t, openaiVideo, map[string]any{"model": "kling-v1", "prompt": "a cat", "seconds": "5", "metadata": map[string]any{"duration": "10"}})
		require.Nil(t, taskErr)
		reader, err := adaptor.BuildRequestBody(c, info)
		require.NoError(t, err)
		encoded, err := io.ReadAll(reader)
		require.NoError(t, err)
		var sent map[string]any
		require.NoError(t, common.Unmarshal(encoded, &sent))
		assert.Equal(t, "10", sent["duration"])
		facts, err := adaptor.ExtractUsageFactsValidated(c, info)
		require.NoError(t, err)
		assert.Equal(t, 2.0, facts["units"], "kling-v1 std costs 0.2 credits per second")
	})
}
