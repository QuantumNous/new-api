package ali

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
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
	require.Empty(t, aliReq.Parameters.Size)
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

func TestConvertToAliRequestHappyhorseI2VBuildsMediaFromImage(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:    "happyhorse-1.1-i2v",
		Prompt:   "animate the first frame",
		Image:    "https://example.com/first.png",
		Size:     "720p",
		Duration: 10,
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, "happyhorse-1.1-i2v", aliReq.Model)
	require.Equal(t, "720P", aliReq.Parameters.Resolution)
	require.Empty(t, aliReq.Parameters.Size)
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

func TestConvertToAliRequestHappyhorseUpgrades480PTo720P(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "happyhorse-1.0-i2v",
		Prompt: "animate the first frame",
		Image:  "https://example.com/first.png",
		Size:   "480P",
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, "720P", aliReq.Parameters.Resolution, "happyhorse should upgrade 480P to 720P")
	require.Empty(t, aliReq.Parameters.Size)
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

func TestConvertToAliRequestHappyhorseR2VBuildsMultipleReferenceImages(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "happyhorse-1.1-r2v",
		Prompt: "animate with multiple reference frames",
		Images: []string{
			"https://example.com/ref1.png",
			"https://example.com/ref2.png",
			"https://example.com/ref3.png",
		},
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Equal(t, "happyhorse-1.1-r2v", aliReq.Model)
	require.Len(t, aliReq.Input.Media, 3)
	for _, media := range aliReq.Input.Media {
		require.Equal(t, "reference_image", media.Type)
	}
	require.Empty(t, aliReq.Input.ImgURL)
}

func TestConvertToAliRequestHappyhorseR2VExtractsImageURLFromContent(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "happyhorse-1.0-r2v",
		Prompt: "animate with content images",
		Content: []map[string]interface{}{
			{
				"type": "text",
				"text": "prompt from content",
			},
			{
				"type": "image_url",
				"image_url": map[string]interface{}{
					"url": "https://example.com/content-ref1.png",
				},
			},
			{
				"type": "image_url",
				"image_url": map[string]interface{}{
					"url": "https://example.com/content-ref2.png",
				},
			},
		},
		Images: []string{"https://example.com/images-ref.png"},
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Len(t, aliReq.Input.Media, 3)
	urls := make([]string, len(aliReq.Input.Media))
	for i, media := range aliReq.Input.Media {
		require.Equal(t, "reference_image", media.Type)
		urls[i] = media.URL
	}
	require.Contains(t, urls, "https://example.com/content-ref1.png")
	require.Contains(t, urls, "https://example.com/content-ref2.png")
	require.Contains(t, urls, "https://example.com/images-ref.png")
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

// TestConvertToAliRequestHappyhorseI2VNoImgURL verifies that happyhorse-1.1-i2v
// does NOT send img_url (the root cause of the user's issue).
func TestConvertToAliRequestHappyhorseI2VNoImgURL(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "happyhorse-1.1-i2v",
		Prompt: "一只小猫在草地上奔跑",
		Image:  "https://example.com/cat.png",
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)

	require.NoError(t, err)
	require.Empty(t, aliReq.Input.ImgURL, "happyhorse must not send img_url")
	require.Len(t, aliReq.Input.Media, 1)
	require.Equal(t, "first_frame", aliReq.Input.Media[0].Type)
	require.Equal(t, "https://example.com/cat.png", aliReq.Input.Media[0].URL)

	body, err := common.Marshal(aliReq)
	require.NoError(t, err)
	require.Contains(t, string(body), `"media"`)
	require.NotContains(t, string(body), `"img_url"`, "img_url must not appear in marshaled JSON")
}

// TestConvertToAliRequestHappyhorseI2VResolutionEnforcement verifies that
// happyhorse accepts 720P/1080P (uppercase) and rejects 480P.
func TestConvertToAliRequestHappyhorseI2VResolutionEnforcement(t *testing.T) {
	adaptor := &TaskAdaptor{}

	// 480P should be upgraded to 720P
	req480 := relaycommon.TaskSubmitReq{
		Model:  "happyhorse-1.1-i2v",
		Prompt: "test",
		Image:  "https://example.com/frame.png",
		Size:   "480P",
	}
	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req480)
	require.NoError(t, err)
	require.Equal(t, "720P", aliReq.Parameters.Resolution)

	// 720P should be kept
	req720 := relaycommon.TaskSubmitReq{
		Model:  "happyhorse-1.0-i2v",
		Prompt: "test",
		Image:  "https://example.com/frame.png",
		Size:   "720P",
	}
	aliReq, err = adaptor.convertToAliRequest(testRelayInfo(), req720)
	require.NoError(t, err)
	require.Equal(t, "720P", aliReq.Parameters.Resolution)

	// 1080P should be kept
	req1080 := relaycommon.TaskSubmitReq{
		Model:  "happyhorse-1.1-i2v",
		Prompt: "test",
		Image:  "https://example.com/frame.png",
		Size:   "1080P",
	}
	aliReq, err = adaptor.convertToAliRequest(testRelayInfo(), req1080)
	require.NoError(t, err)
	require.Equal(t, "1080P", aliReq.Parameters.Resolution)

	// Default should be 720P for happyhorse
	reqDefault := relaycommon.TaskSubmitReq{
		Model:  "happyhorse-1.1-i2v",
		Prompt: "test",
		Image:  "https://example.com/frame.png",
	}
	aliReq, err = adaptor.convertToAliRequest(testRelayInfo(), reqDefault)
	require.NoError(t, err)
	require.Equal(t, "720P", aliReq.Parameters.Resolution)
}

// TestConvertToAliRequestHappyhorseI2VExtractsFromMetadataContent verifies that
// happyhorse-1.1-i2v extracts image from metadata.content[].image_url (BuildingAI format).
func TestConvertToAliRequestHappyhorseI2VExtractsFromMetadataContent(t *testing.T) {
	adaptor := &TaskAdaptor{}

	req := relaycommon.TaskSubmitReq{
		Model:  "happyhorse-1.1-i2v",
		Prompt: "generate video from reference image",
		Metadata: map[string]interface{}{
			"content": []interface{}{
				map[string]interface{}{
					"type": "image_url",
					"image_url": map[string]interface{}{
						"url": "https://example.com/buildingai-ref.png",
					},
				},
			},
		},
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)
	require.NoError(t, err)
	require.NotNil(t, aliReq.Input.Media)
	require.Len(t, aliReq.Input.Media, 1)
	require.Equal(t, "first_frame", aliReq.Input.Media[0].Type)
	require.Equal(t, "https://example.com/buildingai-ref.png", aliReq.Input.Media[0].URL)
	require.Empty(t, aliReq.Input.ImgURL, "img_url should be cleared")
}

// TestConvertToAliRequestHappyhorseR2VExtractsFromMetadataContent verifies that
// happyhorse-1.1-r2v extracts multiple images from metadata.content[].image_url.
func TestConvertToAliRequestHappyhorseR2VExtractsFromMetadataContent(t *testing.T) {
	adaptor := &TaskAdaptor{}

	req := relaycommon.TaskSubmitReq{
		Model:  "happyhorse-1.1-r2v",
		Prompt: "generate video from reference images",
		Metadata: map[string]interface{}{
			"content": []interface{}{
				map[string]interface{}{
					"type": "image_url",
					"image_url": map[string]interface{}{
						"url": "https://example.com/ref1.png",
					},
				},
				map[string]interface{}{
					"type": "image_url",
					"image_url": map[string]interface{}{
						"url": "https://example.com/ref2.png",
					},
				},
			},
		},
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)
	require.NoError(t, err)
	require.NotNil(t, aliReq.Input.Media)
	require.Len(t, aliReq.Input.Media, 2)
	require.Equal(t, "reference_image", aliReq.Input.Media[0].Type)
	require.Equal(t, "https://example.com/ref1.png", aliReq.Input.Media[0].URL)
	require.Equal(t, "reference_image", aliReq.Input.Media[1].Type)
	require.Equal(t, "https://example.com/ref2.png", aliReq.Input.Media[1].URL)
}

// TestConvertToAliRequestHappyhorseI2VMixedSources verifies that
// happyhorse extracts images from both standard fields and metadata.content.
func TestConvertToAliRequestHappyhorseI2VMixedSources(t *testing.T) {
	adaptor := &TaskAdaptor{}

	req := relaycommon.TaskSubmitReq{
		Model:  "happyhorse-1.1-r2v",
		Prompt: "generate video",
		Image:  "https://example.com/img1.png",
		Images: []string{"https://example.com/img2.png"},
		Metadata: map[string]interface{}{
			"content": []interface{}{
				map[string]interface{}{
					"type": "image_url",
					"image_url": map[string]interface{}{
						"url": "https://example.com/img3.png",
					},
				},
			},
		},
	}

	aliReq, err := adaptor.convertToAliRequest(testRelayInfo(), req)
	require.NoError(t, err)
	require.NotNil(t, aliReq.Input.Media)
	require.Len(t, aliReq.Input.Media, 3)
	require.Equal(t, "reference_image", aliReq.Input.Media[0].Type)
	require.Equal(t, "reference_image", aliReq.Input.Media[1].Type)
	require.Equal(t, "reference_image", aliReq.Input.Media[2].Type)

	urls := []string{aliReq.Input.Media[0].URL, aliReq.Input.Media[1].URL, aliReq.Input.Media[2].URL}
	require.Contains(t, urls, "https://example.com/img1.png")
	require.Contains(t, urls, "https://example.com/img2.png")
	require.Contains(t, urls, "https://example.com/img3.png")
}
