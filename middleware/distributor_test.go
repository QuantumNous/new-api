package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func newImageGenerationContext(body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

func testChannel(name string, baseURL string) *model.Channel {
	return &model.Channel{
		Type:    constant.ChannelTypeOpenAI,
		Name:    name,
		BaseURL: &baseURL,
	}
}

func TestRequestHasImageReferenceFromImageField(t *testing.T) {
	c := newImageGenerationContext(`{"model":"gpt-image-2","prompt":"edit this","image":"https://example.com/a.png"}`)

	if !requestHasImageReference(c) {
		t.Fatal("requestHasImageReference returned false for image field")
	}
}

func TestRequestHasImageReferenceFromReferenceImagesExtraField(t *testing.T) {
	c := newImageGenerationContext(`{"model":"gpt-image-2","prompt":"edit this","referenceImages":["https://example.com/a.png"]}`)

	if !requestHasImageReference(c) {
		t.Fatal("requestHasImageReference returned false for referenceImages field")
	}
}

func TestChannelSupportsRequestSkipsXGAPIForReferenceImages(t *testing.T) {
	c := newImageGenerationContext(`{"model":"gpt-image-2","prompt":"edit this","image":"https://example.com/a.png"}`)
	xgapiChannel := testChannel("xgapi-images", "https://xgapi.top")

	if channelSupportsRequest(c, xgapiChannel, "gpt-image-2", constant.EndpointTypeImageGeneration) {
		t.Fatal("xgapi image generation channel should not handle reference-image requests")
	}
}

func TestChannelSupportsRequestAllowsXGAPIWithoutReferenceImages(t *testing.T) {
	c := newImageGenerationContext(`{"model":"gpt-image-2","prompt":"generate this","size":"1024x1024"}`)
	xgapiChannel := testChannel("xgapi-images", "https://xgapi.top")

	if !channelSupportsRequest(c, xgapiChannel, "gpt-image-2", constant.EndpointTypeImageGeneration) {
		t.Fatal("xgapi image generation channel should handle direct generation requests")
	}
}

func TestChannelSupportsRequestAllowsNonXGAPIReferenceImages(t *testing.T) {
	c := newImageGenerationContext(`{"model":"gpt-image-2","prompt":"edit this","image":"https://example.com/a.png"}`)
	listenHubChannel := testChannel("listenhub-images", "https://api.marswave.ai/openapi")

	if !channelSupportsRequest(c, listenHubChannel, "gpt-image-2", constant.EndpointTypeImageGeneration) {
		t.Fatal("non-xgapi image channel should be eligible for reference-image requests")
	}
}
