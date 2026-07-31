package ali

import (
	"io"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testRelayInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}
}

func TestValidateRequestAfterModelMappingHappyHorseUsesOfficialJSON(t *testing.T) {
	ctx := newHappyHorseContext(`{
		"model":"public-video-model",
		"input":{"prompt":"run"},
		"parameters":{"duration":5}
	}`, "application/json")
	info := testRelayInfo()
	info.UpstreamModelName = "happyhorse-1.1-t2v"

	taskErr := (&TaskAdaptor{}).ValidateRequestAfterModelMapping(ctx, info)
	require.Nil(t, taskErr)
	require.Equal(t, constant.TaskActionTextGenerate, info.Action)
	req, err := GetHappyHorseRequest(ctx)
	require.NoError(t, err)
	require.Equal(t, "happyhorse-1.1-t2v", req.Model)
}

func TestValidateRequestAfterModelMappingLegacyAliKeepsFlatFormat(t *testing.T) {
	ctx := newHappyHorseContext(`{"model":"wan2.6-i2v","prompt":"run","duration":5}`, "application/json")
	info := testRelayInfo()
	info.UpstreamModelName = "wan2.6-i2v"

	taskErr := (&TaskAdaptor{}).ValidateRequestAfterModelMapping(ctx, info)
	require.Nil(t, taskErr)
	req, err := relaycommon.GetTaskRequest(ctx)
	require.NoError(t, err)
	require.Equal(t, "wan2.6-i2v", req.Model)
}

func TestBuildRequestBodyHappyHorseForwardsOfficialShapeWithMappedModel(t *testing.T) {
	ctx := newHappyHorseContext(`{
		"model":"public-video-model",
		"input":{"media":[{"type":"first_frame","url":"https://example.com/frame.png"}]},
		"parameters":{"seed":0,"watermark":false}
	}`, "application/json")
	info := testRelayInfo()
	info.UpstreamModelName = "happyhorse-1.1-i2v"
	adaptor := &TaskAdaptor{}
	require.Nil(t, adaptor.ValidateRequestAfterModelMapping(ctx, info))

	body, err := adaptor.BuildRequestBody(ctx, info)
	require.NoError(t, err)
	data, err := io.ReadAll(body)
	require.NoError(t, err)
	require.Contains(t, string(data), `"model":"happyhorse-1.1-i2v"`)
	require.Contains(t, string(data), `"input":{"media"`)
	require.Contains(t, string(data), `"seed":0`)
	require.Contains(t, string(data), `"watermark":false`)
	require.NotContains(t, string(data), `"image"`)
}

func TestValidateTaskPriceDataHappyHorseRequiresFixedPrice(t *testing.T) {
	adaptor := &TaskAdaptor{}
	info := testRelayInfo()
	info.OriginModelName = "public-video-model"
	info.UpstreamModelName = "happyhorse-1.1-r2v"

	info.PriceData.UsePrice = false
	require.NotNil(t, adaptor.ValidateTaskPriceData(info))
	info.PriceData.UsePrice = true
	require.Nil(t, adaptor.ValidateTaskPriceData(info))

	info.UpstreamModelName = "wan2.6-i2v"
	info.PriceData.UsePrice = false
	require.Nil(t, adaptor.ValidateTaskPriceData(info))
}

func TestConvertToAliRequestDefaultsNonPositiveDuration(t *testing.T) {
	tests := []struct {
		name string
		req  relaycommon.TaskSubmitReq
	}{
		{name: "duration omitted", req: relaycommon.TaskSubmitReq{Model: "wan2.6-i2v"}},
		{name: "seconds zero", req: relaycommon.TaskSubmitReq{Model: "wan2.6-i2v", Seconds: "0"}},
		{name: "seconds negative", req: relaycommon.TaskSubmitReq{Model: "wan2.6-i2v", Seconds: "-1"}},
	}

	adaptor := &TaskAdaptor{}
	info := testRelayInfo()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := adaptor.convertToAliRequest(info, tt.req)
			require.NoError(t, err)
			assert.Equal(t, 5, got.Parameters.Duration)
		})
	}
}

func TestConvertToAliRequestPreservesPositiveDuration(t *testing.T) {
	adaptor := &TaskAdaptor{}
	got, err := adaptor.convertToAliRequest(testRelayInfo(), relaycommon.TaskSubmitReq{
		Model:    "wan2.6-i2v",
		Duration: 10,
	})
	require.NoError(t, err)
	assert.Equal(t, 10, got.Parameters.Duration)
}

func TestConvertToAliRequestWan27I2VBuildsMediaFromImage(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model: "wan2.7-i2v", Prompt: "animate", Image: "https://example.com/first.png", Size: "720p", Duration: 10,
	}
	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)
	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{{Type: "first_frame", URL: "https://example.com/first.png"}}, aliReq.Input.Media)
	require.Empty(t, aliReq.Input.ImgURL)
	body, err := common.Marshal(aliReq)
	require.NoError(t, err)
	require.Contains(t, string(body), `"media"`)
	require.NotContains(t, string(body), `"img_url"`)
}

func TestConvertToAliRequestWan27I2VBuildsFirstAndLastFrameFromImages(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{Model: "wan2.7-i2v", Images: []string{
		"https://example.com/first.png", "https://example.com/last.png",
	}}
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
		Model: "wan2.7-i2v", Image: " https://example.com/direct.png ",
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

func TestConvertToAliRequestWan27I2VUsesSingleImagesEntryAsLastFrameAfterImage(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "wan2.7-i2v",
		Image:  "https://example.com/first.png",
		Images: []string{"https://example.com/last.png"},
	}
	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)
	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{
		{Type: "first_frame", URL: "https://example.com/first.png"},
		{Type: "last_frame", URL: "https://example.com/last.png"},
	}, aliReq.Input.Media)
}

func TestConvertToAliRequestWan27I2VPreservesDuplicateFrameURLs(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model: "wan2.7-i2v",
		Images: []string{
			"https://example.com/repeated.png",
			"https://example.com/repeated.png",
		},
	}
	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)
	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{
		{Type: "first_frame", URL: "https://example.com/repeated.png"},
		{Type: "last_frame", URL: "https://example.com/repeated.png"},
	}, aliReq.Input.Media)
}

func TestConvertToAliRequestWan27I2VUsesInputReferenceAsSecondImage(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:          "wan2.7-i2v",
		Image:          "https://example.com/first.png",
		InputReference: "https://example.com/last.png",
	}
	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)
	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{
		{Type: "first_frame", URL: "https://example.com/first.png"},
		{Type: "last_frame", URL: "https://example.com/last.png"},
	}, aliReq.Input.Media)
}

func TestConvertToAliRequestWan27I2VFallsBackToFirstNonEmptyImage(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model: "wan2.7-i2v", Image: " ",
		Images:         []string{" ", " https://example.com/first.png ", " https://example.com/last.png "},
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
		Model: "wan2.7-i2v", Image: "https://example.com/direct.png",
		Metadata: map[string]interface{}{"input": map[string]interface{}{"media": []interface{}{
			map[string]interface{}{"type": "first_clip", "url": "https://example.com/input.mp4"},
		}}},
	}
	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)
	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{{Type: "first_clip", URL: "https://example.com/input.mp4"}}, aliReq.Input.Media)
	require.Empty(t, aliReq.Input.ImgURL)
	body, err := common.Marshal(aliReq)
	require.NoError(t, err)
	require.Contains(t, string(body), `"media"`)
	require.NotContains(t, string(body), `"img_url"`)
}

func TestConvertToAliRequestWan27I2VFiltersInvalidMetadataMediaAndFallsBack(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model: "wan2.7-i2v", Image: "https://example.com/direct.png",
		Metadata: map[string]interface{}{"input": map[string]interface{}{"media": []interface{}{
			map[string]interface{}{"type": " ", "url": "https://example.com/missing-type.png"},
			map[string]interface{}{"type": "first_frame", "url": " "},
		}}},
	}
	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)
	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{{Type: "first_frame", URL: "https://example.com/direct.png"}}, aliReq.Input.Media)
}

func TestConvertToAliRequestWan27I2VTrimsValidMetadataMedia(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model: "wan2.7-i2v",
		Metadata: map[string]interface{}{"input": map[string]interface{}{"media": []interface{}{
			map[string]interface{}{"type": " first_clip ", "url": " https://example.com/input.mp4 "},
		}}},
	}
	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)
	require.NoError(t, err)
	require.Equal(t, []AliVideoMedia{{Type: "first_clip", URL: "https://example.com/input.mp4"}}, aliReq.Input.Media)
}

func TestConvertToAliRequestWan27I2VRequiresMedia(t *testing.T) {
	_, err := (&TaskAdaptor{}).convertToAliRequest(testRelayInfo(), relaycommon.TaskSubmitReq{Model: "wan2.7-i2v"})
	require.Error(t, err)
	require.True(t, strings.Contains(err.Error(), "requires image"))
}

func TestConvertToAliRequestWan25I2VKeepsLegacyImgURL(t *testing.T) {
	aliReq, err := (&TaskAdaptor{}).convertToAliRequest(testRelayInfo(), relaycommon.TaskSubmitReq{
		Model: "wan2.5-i2v-preview", Image: "https://example.com/first.png",
	})
	require.NoError(t, err)
	require.Equal(t, "https://example.com/first.png", aliReq.Input.ImgURL)
	require.Empty(t, aliReq.Input.Media)
}
