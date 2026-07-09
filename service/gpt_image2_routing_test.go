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

func TestGptImage2PackyProfileAllowsPackyAndOfficial(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	c.Set(contextKeyGptImage2Profile, string(GptImage2ProfilePacky))

	packy := &model.Channel{OtherSettings: `{"gpt_image2_tier":"packy"}`}
	officialMapping := `{"gpt-image-2":"gpt-image-2-official"}`
	official := &model.Channel{ModelMapping: &officialMapping}
	standard := &model.Channel{}

	filter := GptImage2ChannelPickFilter(c, "gpt-image-2")
	require.True(t, filter(packy))
	require.True(t, filter(official))
	require.False(t, filter(standard))
}

func TestGptImage2EditsPackyProfileExcludesOfficial(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", nil)
	c.Set(contextKeyGptImage2Profile, string(GptImage2ProfilePacky))

	packy := &model.Channel{OtherSettings: `{"gpt_image2_tier":"packy"}`}
	officialMapping := `{"gpt-image-2":"gpt-image-2-official"}`
	official := &model.Channel{ModelMapping: &officialMapping}
	standard := &model.Channel{}

	filter := GptImage2ChannelPickFilter(c, "gpt-image-2")
	require.True(t, filter(packy))
	require.False(t, filter(official))
	require.False(t, filter(standard))
}

func TestGptImage2AsyncPathExcludesPacky(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations/async", nil)
	c.Set(contextKeyGptImage2Profile, string(GptImage2ProfileStandard))

	packy := &model.Channel{OtherSettings: `{"gpt_image2_tier":"packy"}`}
	standard := &model.Channel{}

	filter := GptImage2ChannelPickFilter(c, "gpt-image-2")
	require.False(t, filter(packy))
	require.True(t, filter(standard))
}

func TestGptImage2StandardOfficialFallbackRetry(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	c.Set(contextKeyGptImage2Profile, string(GptImage2ProfileStandard))

	officialMapping := `{"gpt-image-2":"gpt-image-2-official"}`
	official := &model.Channel{Id: 59, ModelMapping: &officialMapping}
	standard := &model.Channel{Id: 33}

	filter := GptImage2ChannelPickFilter(c, "gpt-image-2")
	require.True(t, filter(standard))
	require.True(t, filter(official))
}

func TestGptImage2RaceHedgeAllowsOfficialForStandard(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	c.Set(contextKeyGptImage2Profile, string(GptImage2ProfileStandard))
	SetGptImage2RaceHedgePick(c, true)

	officialMapping := `{"gpt-image-2":"gpt-image-2-official"}`
	official := &model.Channel{Id: 59, ModelMapping: &officialMapping}
	filter := GptImage2ChannelPickFilter(c, "gpt-image-2")
	require.True(t, filter(official))
}

func TestNormalizeGptImage2ModelName(t *testing.T) {
	t.Parallel()
	require.Equal(t, "gpt-image-2", NormalizeGptImage2ModelName("gpt-image-2-official"))
	require.Equal(t, "gpt-image-2", NormalizeGptImage2ModelName("gpt-image-2"))
}
