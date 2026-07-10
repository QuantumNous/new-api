package service

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestClassifyGptImage2ProfileFromJSON(t *testing.T) {
	t.Parallel()
	profile, ok := classifyGptImage2ProfileFromJSON([]byte(`{"model":"gpt-image-2","prompt":"x"}`))
	require.True(t, ok)
	require.Equal(t, GptImage2ProfileStandard, profile)

	profile, ok = classifyGptImage2ProfileFromJSON([]byte(`{"model":"gpt-image-2","prompt":"x","quality":"high"}`))
	require.True(t, ok)
	require.Equal(t, GptImage2ProfilePacky, profile)

	profile, ok = classifyGptImage2ProfileFromJSON([]byte(`{"model":"gpt-image-2","prompt":"x","n":2}`))
	require.True(t, ok)
	require.Equal(t, GptImage2ProfileOfficial, profile)

	profile, ok = classifyGptImage2ProfileFromJSON([]byte(`{"model":"gpt-image-2","prompt":"x","mask_url":"https://x/m.png"}`))
	require.True(t, ok)
	require.Equal(t, GptImage2ProfileOfficial, profile)

	profile, ok = classifyGptImage2ProfileFromJSON([]byte(`{"model":"gpt-image-2","prompt":"x","output_format":"png","background":"opaque"}`))
	require.True(t, ok)
	require.Equal(t, GptImage2ProfilePacky, profile)

	profile, ok = classifyGptImage2ProfileFromJSON([]byte(`{"model":"gpt-image-2","prompt":"x","output_format":"webp"}`))
	require.True(t, ok)
	require.Equal(t, GptImage2ProfileOfficial, profile)

	profile, ok = classifyGptImage2ProfileFromJSON([]byte(`{"model":"gpt-image-2","prompt":"x","background":"transparent"}`))
	require.True(t, ok)
	require.Equal(t, GptImage2ProfileOfficial, profile)

	profile, ok = classifyGptImage2ProfileFromJSON([]byte(`{"model":"gpt-image-2","prompt":"x","image_urls":["https://x/a.png"]}`))
	require.True(t, ok)
	require.Equal(t, GptImage2ProfileOfficial, profile)
}

func TestClassifyGptImage2ProfileFromImageRequest(t *testing.T) {
	t.Parallel()
	n := uint(2)
	req := &dto.ImageRequest{Model: "gpt-image-2", N: &n}
	require.Equal(t, GptImage2ProfileOfficial, ClassifyGptImage2ProfileFromImageRequest(req))
}

func TestClassifyGptImage2MultipartEditsForPacky(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "gpt-image-2"))
	require.NoError(t, writer.WriteField("prompt", "edit this image"))
	require.NoError(t, writer.WriteField("quality", "high"))
	part, err := writer.CreateFormFile("image", "input.png")
	require.NoError(t, err)
	_, err = part.Write([]byte("png"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())

	require.Equal(t, GptImage2ProfilePacky, ClassifyGptImage2Profile(c, "gpt-image-2"))
}

func TestClassifyGptImage2MultipartGenerationsWithImageRequiresOfficial(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "gpt-image-2"))
	require.NoError(t, writer.WriteField("prompt", "use reference"))
	part, err := writer.CreateFormFile("images", "input.png")
	require.NoError(t, err)
	_, err = part.Write([]byte("png"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())

	require.Equal(t, GptImage2ProfileOfficial, ClassifyGptImage2Profile(c, "gpt-image-2"))
}

func TestChannelGptImage2Tier(t *testing.T) {
	t.Parallel()
	officialMapping := `{"gpt-image-2":"gpt-image-2-official"}`
	chOfficial := &model.Channel{ModelMapping: &officialMapping}
	require.Equal(t, GptImage2TierOfficial, ChannelGptImage2Tier(chOfficial))

	chStandard := &model.Channel{}
	require.Equal(t, GptImage2TierStandard, ChannelGptImage2Tier(chStandard))

	packySettings := `{"gpt_image2_tier":"packy"}`
	chPackySettings := &model.Channel{OtherSettings: packySettings}
	require.Equal(t, GptImage2TierPacky, ChannelGptImage2Tier(chPackySettings))

	packyBase := "https://www.packyapi.com"
	chPackyName := &model.Channel{Name: "packyapi-image", BaseURL: &packyBase}
	require.Equal(t, GptImage2TierPacky, ChannelGptImage2Tier(chPackyName))
}

func TestGptImage2ChannelPickFilter(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	c.Set(contextKeyGptImage2Profile, string(GptImage2ProfileOfficial))

	official := &model.Channel{Id: 59}
	standard := &model.Channel{Id: 33}
	filter := GptImage2ChannelPickFilter(c, "gpt-image-2")
	require.NotNil(t, filter)

	officialMapping := `{"gpt-image-2":"gpt-image-2-official"}`
	official.ModelMapping = &officialMapping

	require.True(t, filter(official))
	require.False(t, filter(standard))
}

func TestGptImage2DocumentDrivenChannelCapabilities(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		body string
		want map[int]bool
	}{
		{
			name: "basic generation is price-routed across every documented provider",
			body: `{"model":"gpt-image-2","prompt":"x","n":1}`,
			want: map[int]bool{59: true, 72: true, 73: true, 81: true},
		},
		{
			name: "reference images are supported by both APIMart generation variants",
			body: `{"model":"gpt-image-2","prompt":"x","image_urls":["https://x/a.png"]}`,
			want: map[int]bool{59: true, 72: false, 73: true, 81: true},
		},
		{
			name: "multiple outputs exceed Packy but fit both APIMart variants",
			body: `{"model":"gpt-image-2","prompt":"x","n":4}`,
			want: map[int]bool{59: true, 72: false, 73: true, 81: true},
		},
		{
			name: "official max is four while regular APIMart supports ten",
			body: `{"model":"gpt-image-2","prompt":"x","n":8}`,
			want: map[int]bool{59: false, 72: false, 73: true, 81: true},
		},
		{
			name: "quality is documented by official and Packy only",
			body: `{"model":"gpt-image-2","prompt":"x","quality":"high"}`,
			want: map[int]bool{59: true, 72: true, 73: false, 81: false},
		},
		{
			name: "mask URL is an official APIMart generation capability",
			body: `{"model":"gpt-image-2","prompt":"x","image_urls":["https://x/a.png"],"mask_url":"https://x/m.png"}`,
			want: map[int]bool{59: true, 72: false, 73: false, 81: false},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := gptImage2CapabilityRequestFromJSON("gpt-image-2", []byte(tt.body))
			for id, want := range tt.want {
				require.Equal(t, want, gptImage2ChannelSupportsRequest(&model.Channel{Id: id}, req), "channel %d", id)
			}
		})
	}
}

func TestGptImage2PackyMultipartEditCapabilities(t *testing.T) {
	t.Parallel()
	req := gptImage2CapabilityRequest{EditsPath: true, Multipart: true, HasUploadedImage: true, N: 1, Quality: "high"}
	require.True(t, gptImage2ChannelSupportsRequest(&model.Channel{Id: 72}, req))
	require.False(t, gptImage2ChannelSupportsRequest(&model.Channel{Id: 59}, req))
	require.False(t, gptImage2ChannelSupportsRequest(&model.Channel{Id: 73}, req))
}

func TestNormalizeGptImage2ModelName(t *testing.T) {
	t.Parallel()
	require.Equal(t, "gpt-image-2", NormalizeGptImage2ModelName("gpt-image-2-official"))
	require.Equal(t, "gpt-image-2", NormalizeGptImage2ModelName("gpt-image-2"))
}
