package controller

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// imageAutoJSONContext builds a gin context whose body has already been read
// into the shared BodyStorage (the production state when the relay reaches
// prepareImageAutoRequest). It also leaves a fresh c.Request.Body in place to
// cover the path where GetBodyStorage must read the request directly.
func imageAutoJSONContext(t *testing.T, body string, cacheStorage bool) *gin.Context {
	t.Helper()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	if cacheStorage {
		storage, err := common.CreateBodyStorage([]byte(body))
		require.NoError(t, err)
		c.Set(common.KeyBodyStorage, storage)
	}
	return c
}

// TestCountJSONImageReferencesCoversKnownShapes proves the JSON reference
// counter handles the field shapes the relay actually forwards (OpenAI image /
// images, Aliyun input.images, gpt-image nested image_url, data: URL, inline
// base64) and never counts prompt text.
func TestCountJSONImageReferencesCoversKnownShapes(t *testing.T) {
	longB64 := base64.StdEncoding.EncodeToString(make([]byte, 256))
	require.Greater(t, len(longB64), 128)

	cases := []struct {
		name    string
		payload string
		want    int
	}{
		{name: "single image url", payload: `{"model":"image-auto","prompt":"edit this","image":"https://example.com/a.png"}`, want: 1},
		{name: "images url array", payload: `{"prompt":"edit","images":["https://example.com/a.png","https://example.com/b.png"]}`, want: 2},
		{name: "images url array single", payload: `{"images":["https://example.com/a.png"]}`, want: 1},
		{name: "openai nested image_url", payload: `{"images":[{"image_url":"https://example.com/a.png"},{"image_url":"https://example.com/b.png"}]}`, want: 2},
		{name: "aliyun input images", payload: `{"input":{"images":["https://example.com/a.png"]},"prompt":"x"}`, want: 1},
		{name: "data url", payload: `{"image":"data:image/png;base64,iVBORw0KGgoAAAANS"}`, want: 1},
		{name: "inline base64", payload: `{"image":"` + longB64 + `"}`, want: 1},
		{name: "no references", payload: `{"model":"image-auto","prompt":"just words"}`, want: 0},
		{name: "prompt with url is not a reference", payload: `{"prompt":"copy https://example.com/a.png"}`, want: 0},
		{name: "unparseable yields zero", payload: `{"image":`, want: 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := imageAutoJSONContext(t, tc.payload, true)
			count, err := countImageAutoReferenceImages(c)
			require.NoError(t, err)
			require.Equal(t, tc.want, count)
		})
	}
}

// TestCountJSONImageReferencesReadsUncachedBody proves the JSON path also works
// when the shared storage was not yet populated, falling back to the request
// body via GetBodyStorage.
func TestCountJSONImageReferencesReadsUncachedBody(t *testing.T) {
	c := imageAutoJSONContext(t, `{"model":"image-auto","prompt":"edit","image":"https://example.com/a.png"}`, false)
	count, err := countImageAutoReferenceImages(c)
	require.NoError(t, err)
	require.Equal(t, 1, count)
}

// TestCountJSONImageReferencesRewindsBody proves the JSON path leaves the shared
// body storage seeked back to the start so downstream relay still sees the full
// request.
func TestCountJSONImageReferencesRewindsBody(t *testing.T) {
	payload := `{"model":"image-auto","prompt":"edit","image":"https://example.com/a.png"}`
	c := imageAutoJSONContext(t, payload, true)

	_, err := countImageAutoReferenceImages(c)
	require.NoError(t, err)

	storage, err := common.GetBodyStorage(c)
	require.NoError(t, err)
	restored, err := storage.Bytes()
	require.NoError(t, err)
	require.JSONEq(t, payload, string(restored))
}
