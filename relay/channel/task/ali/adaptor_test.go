package ali

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func testRelayInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{},
	}
}

func TestConvertToAliRequestWan27I2VBuildsMediaFromImage(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:    "wan2.7-i2v",
		Prompt:   "animate the first frame",
		Image:    "https://example.com/first.png",
		Size:     "720p",
		Duration: 10,
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, "wan2.7-i2v", aliReq.Model)
	require.Equal(t, "720P", aliReq.Parameters.Resolution)
	require.Equal(t, 10, aliReq.Parameters.Duration)
	require.Equal(t, []AliVideoMedia{
		{Type: "first_frame", URL: "https://example.com/first.png"},
	}, aliReq.Input.Media)
	require.Empty(t, aliReq.Input.ImgURL)

	body, err := common.Marshal(aliReq)
	require.NoError(t, err)
	require.Contains(t, string(body), `"media"`)
	require.NotContains(t, string(body), `"img_url"`)
}

func TestConvertToAliRequestWan27I2VBuildsFirstAndLastFrameFromImages(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "wan2.7-i2v",
		Prompt: "interpolate between frames",
		Images: []string{
			"https://example.com/first.png",
			"https://example.com/last.png",
		},
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{
		{Type: "first_frame", URL: "https://example.com/first.png"},
		{Type: "last_frame", URL: "https://example.com/last.png"},
	}, aliReq.Input.Media)
}

func TestConvertToAliRequestWan27I2VPrefersImageBeforeImagesAndInputReference(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:          "wan2.7-i2v",
		Prompt:         "use the direct image",
		Image:          " https://example.com/direct.png ",
		Images:         []string{"https://example.com/images-first.png", " https://example.com/images-last.png "},
		InputReference: "https://example.com/input-reference.png",
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{
		{Type: "first_frame", URL: "https://example.com/direct.png"},
		{Type: "last_frame", URL: "https://example.com/images-last.png"},
	}, aliReq.Input.Media)
}

func TestConvertToAliRequestWan27I2VFallsBackToFirstNonEmptyImage(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "wan2.7-i2v",
		Prompt: "skip blank images",
		Image:  " ",
		Images: []string{
			" ",
			" https://example.com/first.png ",
			" https://example.com/last.png ",
		},
		InputReference: "https://example.com/input-reference.png",
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{
		{Type: "first_frame", URL: "https://example.com/first.png"},
		{Type: "last_frame", URL: "https://example.com/last.png"},
	}, aliReq.Input.Media)
}

func TestConvertToAliRequestWan27I2VKeepsExplicitMetadataMedia(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:          "wan2.7-i2v",
		Prompt:         "continue the clip",
		Image:          "https://example.com/direct.png",
		Images:         []string{"https://example.com/images-first.png", "https://example.com/images-last.png"},
		InputReference: "https://example.com/input-reference.png",
		Metadata: map[string]interface{}{
			"input": map[string]interface{}{
				"media": []interface{}{
					map[string]interface{}{
						"type": "first_clip",
						"url":  "https://example.com/input.mp4",
					},
				},
			},
		},
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{
		{Type: "first_clip", URL: "https://example.com/input.mp4"},
	}, aliReq.Input.Media)
	require.Empty(t, aliReq.Input.ImgURL)

	body, err := common.Marshal(aliReq)
	require.NoError(t, err)
	require.Contains(t, string(body), `"media"`)
	require.NotContains(t, string(body), `"img_url"`)
}

func TestConvertToAliRequestWan27I2VRequiresMedia(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "wan2.7-i2v",
		Prompt: "animate without a frame",
	}

	_, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.Error(t, err)
	require.True(t, strings.Contains(err.Error(), "requires image"))
}

func TestConvertToAliRequestWan25I2VKeepsLegacyImgURL(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "wan2.5-i2v-preview",
		Prompt: "animate the first frame",
		Image:  "https://example.com/first.png",
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, "https://example.com/first.png", aliReq.Input.ImgURL)
	require.Empty(t, aliReq.Input.Media)

	body, err := common.Marshal(aliReq)
	require.NoError(t, err)
	require.Contains(t, string(body), `"img_url"`)
	require.NotContains(t, string(body), `"media"`)
}

func TestHappyHorseModelsAreRegistered(t *testing.T) {
	for _, modelName := range []string{
		"happyhorse-1.1-t2v",
		"happyhorse-1.1-i2v",
		"happyhorse-1.1-r2v",
		"happyhorse-1.0-t2v",
		"happyhorse-1.0-i2v",
		"happyhorse-1.0-r2v",
		"happyhorse-1.0-video-edit",
	} {
		require.Contains(t, ModelList, modelName)
	}
}

func TestConvertToAliRequestHappyHorseT2V(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:    "happyhorse-1.1-t2v",
		Prompt:   "a horse running",
		Size:     "720p",
		Duration: 6,
		Metadata: map[string]interface{}{
			"ratio": "16:9",
		},
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)
	require.NoError(t, err)
	require.Equal(t, "720P", aliReq.Parameters.Resolution)
	require.Empty(t, aliReq.Parameters.Size)
	require.Equal(t, 6, aliReq.Parameters.Duration)
	require.NotNil(t, aliReq.Parameters.Ratio)
	require.Equal(t, "16:9", *aliReq.Parameters.Ratio)
	require.Empty(t, aliReq.Input.Media)

	body, err := common.Marshal(aliReq)
	require.NoError(t, err)
	require.NotContains(t, string(body), `"prompt_extend"`)
	require.NotContains(t, string(body), `"size"`)
}

func TestConvertToAliRequestHappyHorseI2V(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:    "happyhorse-1.1-i2v",
		Prompt:   "animate",
		Image:    "https://example.com/first.png",
		Duration: 5,
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)
	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{{Type: "first_frame", URL: "https://example.com/first.png"}}, aliReq.Input.Media)
	require.Empty(t, aliReq.Input.ImgURL)
}

func TestConvertToAliRequestHappyHorseR2V(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:    "happyhorse-1.0-r2v",
		Prompt:   "use these characters",
		Images:   []string{"https://example.com/a.png", "https://example.com/b.png"},
		Size:     "1080p",
		Duration: 8,
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)
	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{
		{Type: "reference_image", URL: "https://example.com/a.png"},
		{Type: "reference_image", URL: "https://example.com/b.png"},
	}, aliReq.Input.Media)
	require.Equal(t, "1080P", aliReq.Parameters.Resolution)
}

func TestConvertToAliRequestHappyHorseVideoEdit(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:          "happyhorse-1.0-video-edit",
		Prompt:         "change the jacket",
		InputReference: "https://example.com/input.mp4",
		Images:         []string{"https://example.com/jacket.png"},
		Size:           "720p",
		Metadata: map[string]interface{}{
			"audio_setting": "origin",
		},
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)
	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{
		{Type: "video", URL: "https://example.com/input.mp4"},
		{Type: "reference_image", URL: "https://example.com/jacket.png"},
	}, aliReq.Input.Media)
	require.Zero(t, aliReq.Parameters.Duration)
	require.NotNil(t, aliReq.Parameters.AudioSetting)
	require.Equal(t, "origin", *aliReq.Parameters.AudioSetting)

	body, err := common.Marshal(aliReq)
	require.NoError(t, err)
	require.NotContains(t, string(body), `"duration"`)
}

func TestConvertToAliRequestHappyHorseRejectsInvalidInputs(t *testing.T) {
	adaptor := &TaskAdaptor{}
	tests := []struct {
		name string
		req  relaycommon.TaskSubmitReq
	}{
		{
			name: "1.0 480P",
			req: relaycommon.TaskSubmitReq{
				Model: "happyhorse-1.0-t2v", Prompt: "horse", Size: "480p", Duration: 5,
			},
		},
		{
			name: "duration below minimum",
			req: relaycommon.TaskSubmitReq{
				Model: "happyhorse-1.1-t2v", Prompt: "horse", Duration: 2,
			},
		},
		{
			name: "t2v with image",
			req: relaycommon.TaskSubmitReq{
				Model: "happyhorse-1.1-t2v", Prompt: "horse", Image: "https://example.com/a.png", Duration: 5,
			},
		},
		{
			name: "i2v with two images",
			req: relaycommon.TaskSubmitReq{
				Model: "happyhorse-1.1-i2v", Prompt: "horse", Images: []string{"a", "b"}, Duration: 5,
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := adaptor.convertToAliRequest(testRelayInfo(), test.req)
			require.Error(t, err)
		})
	}
}

func TestProcessAliOtherRatiosHappyHorse(t *testing.T) {
	ratios, err := ProcessAliOtherRatios(&AliVideoRequest{
		Model:      "happyhorse-1.1-t2v",
		Parameters: &AliVideoParameters{Resolution: "1080P"},
	})
	require.NoError(t, err)
	require.Equal(t, 4.0/3.0, ratios["resolution-1080P"])

	ratios, err = ProcessAliOtherRatios(&AliVideoRequest{
		Model:      "happyhorse-1.0-video-edit",
		Parameters: &AliVideoParameters{Resolution: "720P"},
	})
	require.NoError(t, err)
	require.Equal(t, 1.0, ratios["resolution-720P"])
}

func TestEstimateBillingHappyHorse(t *testing.T) {
	adaptor := &TaskAdaptor{}
	tests := []struct {
		name        string
		req         relaycommon.TaskSubmitReq
		wantSeconds float64
		wantRatio   float64
	}{
		{
			name: "generation uses requested seconds",
			req: relaycommon.TaskSubmitReq{
				Model: "happyhorse-1.1-t2v", Prompt: "horse", Size: "720p", Duration: 6,
			},
			wantSeconds: 6,
			wantRatio:   1,
		},
		{
			name: "video edit reserves maximum effective input plus output",
			req: relaycommon.TaskSubmitReq{
				Model: "happyhorse-1.0-video-edit", Prompt: "edit", Size: "1080p",
				InputReference: "https://example.com/input.mp4",
			},
			wantSeconds: 30,
			wantRatio:   16.0 / 9.0,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			context, _ := gin.CreateTestContext(nil)
			context.Set("task_request", test.req)
			ratios := adaptor.EstimateBilling(context, testRelayInfo())
			require.Equal(t, test.wantSeconds, ratios["seconds"])
			require.Equal(t, test.wantRatio, ratios["resolution-"+strings.ToUpper(test.req.Size)])
		})
	}
}

func TestAdjustBillingOnCompleteHappyHorseUsesActualUsage(t *testing.T) {
	adaptor := &TaskAdaptor{}
	task := &model.Task{
		Status: model.TaskStatusSuccess,
		Properties: model.Properties{
			UpstreamModelName: "happyhorse-1.1-t2v",
		},
		PrivateData: model.TaskPrivateData{
			BillingContext: &model.TaskBillingContext{
				ModelPrice:  0.001,
				GroupRatio:  1,
				OtherRatios: map[string]float64{"seconds": 15, "resolution-1080P": 4.0 / 3.0},
			},
		},
		Data: []byte(`{"output":{"task_status":"SUCCEEDED"},"usage":{"duration":5.5,"output_video_duration":"5.5","SR":720}}`),
	}
	taskResult := &relaycommon.TaskInfo{Status: model.TaskStatusSuccess}

	got := adaptor.AdjustBillingOnComplete(task, taskResult)

	want := common.QuotaFromFloat(0.001 * common.QuotaPerUnit * 5.5)
	require.Equal(t, want, got)
	require.Nil(t, taskResult.QuotaClamp)
}

func TestAdjustBillingOnCompleteHappyHorseVideoEditUsesFractionalTotalDuration(t *testing.T) {
	adaptor := &TaskAdaptor{}
	task := &model.Task{
		Properties: model.Properties{OriginModelName: "happyhorse-1.0-video-edit"},
		PrivateData: model.TaskPrivateData{
			BillingContext: &model.TaskBillingContext{
				ModelPrice: 0.002, GroupRatio: 1,
				OtherRatios: map[string]float64{"seconds": 30, "resolution-1080P": 16.0 / 9.0},
			},
		},
		Data: []byte(`{"output":{"task_status":"SUCCEEDED"},"usage":{"duration":13.24,"input_video_duration":6.62,"output_video_duration":6.62,"SR":720}}`),
	}
	taskResult := &relaycommon.TaskInfo{Status: model.TaskStatusSuccess}

	got := adaptor.AdjustBillingOnComplete(task, taskResult)

	want := common.QuotaFromFloat(0.002 * common.QuotaPerUnit * 13.24)
	require.Equal(t, want, got)
}
