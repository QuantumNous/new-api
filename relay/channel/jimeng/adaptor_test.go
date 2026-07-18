package jimeng

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestConvertImageRequestMapsUnifiedImages(t *testing.T) {
	request := dto.ImageRequest{
		Model:  "jimeng_high_aes_general_v21_L",
		Prompt: "put the product in a studio",
		Images: json.RawMessage(`[
			"https://cdn.example.com/reference.png"
		]`),
		ExtraFields: json.RawMessage(`{"width":1024,"height":1024}`),
	}

	converted, err := (&Adaptor{}).ConvertImageRequest(
		gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()),
		&common.RelayInfo{},
		request,
	)
	require.NoError(t, err)

	payload, ok := converted.(imageRequestPayload)
	require.True(t, ok)
	require.Equal(t, []string{"https://cdn.example.com/reference.png"}, payload.ImageUrls)
	require.Equal(t, 1024, payload.Width)
}

func TestConvertImageRequestRejectsUnsupportedBatchCount(t *testing.T) {
	two := uint(2)
	_, err := (&Adaptor{}).ConvertImageRequest(
		gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()),
		&common.RelayInfo{},
		dto.ImageRequest{Model: "jimeng_high_aes_general_v21_L", Prompt: "draw", N: &two},
	)
	require.Error(t, err)
	require.Contains(t, err.Error(), "supports only n=1")
}

func TestDoRequestAppliesAsyncIdempotencyAndCustomHeaderOverrides(t *testing.T) {
	requestHeaders := make(chan http.Header, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestHeaders <- r.Header.Clone()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":10000,"data":{}}`))
	}))
	defer server.Close()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	info := &common.RelayInfo{
		ChannelMeta: &common.ChannelMeta{
			ChannelBaseUrl: server.URL,
			ApiKey:         "access-key|secret-key",
			HeadersOverride: map[string]any{
				"Idempotency-Key": "image-task-stable-id",
				"X-Custom-Header": "custom-value",
			},
		},
	}

	result, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(`{"req_key":"jimeng-test","prompt":"draw"}`))
	require.NoError(t, err)
	response, ok := result.(*http.Response)
	require.True(t, ok)
	defer response.Body.Close()
	_, err = io.Copy(io.Discard, response.Body)
	require.NoError(t, err)

	upstreamHeaders := <-requestHeaders
	require.Equal(t, "image-task-stable-id", upstreamHeaders.Get("Idempotency-Key"))
	require.Equal(t, "custom-value", upstreamHeaders.Get("X-Custom-Header"))
	require.NotEmpty(t, upstreamHeaders.Get("Authorization"))
}

func TestDoResponseUsesImageHandlerForEdits(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	response := &http.Response{
		StatusCode: http.StatusOK,
		Body: io.NopCloser(strings.NewReader(`{
			"code":10000,
			"data":{"image_urls":["https://cdn.example.com/edited.png"]}
		}`)),
	}
	info := &common.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesEdits,
		StartTime: time.Now(),
	}

	usage, apiErr := (&Adaptor{}).DoResponse(c, response, info)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.JSONEq(t, `{"created":`+strconv.FormatInt(info.StartTime.Unix(), 10)+`,"data":[{"url":"https://cdn.example.com/edited.png","b64_json":"","revised_prompt":""}]}`, recorder.Body.String())
}
