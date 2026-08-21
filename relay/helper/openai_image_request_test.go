package helper

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// TestGetAndValidOpenAIImageRequestMultipartStream verifies multipart image
// edit parsing: the stream field is parsed and validated, and the request body
// stays replayable for the upstream request.
func TestGetAndValidOpenAIImageRequestMultipartStream(t *testing.T) {
	gin.SetMode(gin.TestMode)

	newContext := func(t *testing.T, streamValue string, withImage bool) (*gin.Context, string) {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		require.NoError(t, writer.WriteField("model", "gpt-image-1"))
		require.NoError(t, writer.WriteField("prompt", "edit this image"))
		require.NoError(t, writer.WriteField("stream", streamValue))
		if withImage {
			part, err := writer.CreateFormFile("image", "input.png")
			require.NoError(t, err)
			_, err = part.Write([]byte("fake image"))
			require.NoError(t, err)
		}
		require.NoError(t, writer.Close())
		originalBody := body.String()

		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
		c.Request.Header.Set("Content-Type", writer.FormDataContentType())
		return c, originalBody
	}

	t.Run("valid stream value keeps body replayable", func(t *testing.T) {
		c, originalBody := newContext(t, "true", true)

		req, err := GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesEdits)
		require.NoError(t, err)
		require.NotNil(t, req.Stream)
		require.True(t, *req.Stream)
		require.True(t, req.IsStream(c.Request))

		bodyAfterValidation, err := io.ReadAll(c.Request.Body)
		require.NoError(t, err)
		require.Equal(t, originalBody, string(bodyAfterValidation))

		form, err := common.ParseMultipartFormReusable(c)
		require.NoError(t, err)
		require.Equal(t, "true", url.Values(form.Value).Get("stream"))
		require.Len(t, form.File["image"], 1)
	})

	t.Run("invalid stream value is rejected", func(t *testing.T) {
		c, _ := newContext(t, "notabool", false)

		_, err := GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesEdits)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid stream value")
	})
}

// TestGetAndValidOpenAIImageRequestNBounds guards the billing invariant that
// the image generation count can never reach quota calculation with a value
// large enough to overflow int64 into a negative charge.
func TestGetAndValidOpenAIImageRequestNBounds(t *testing.T) {
	gin.SetMode(gin.TestMode)

	newJSONContext := func(t *testing.T, body string) *gin.Context {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", bytes.NewBufferString(body))
		c.Request.Header.Set("Content-Type", "application/json")
		return c
	}

	boundErr := fmt.Sprintf("n must be an integer between 1 and %d", dto.MaxImageN)

	tests := []struct {
		name    string
		body    string
		wantErr string
		wantN   uint
	}{
		{
			name:    "overflowed uint64 n is rejected",
			body:    `{"model":"gpt-image-1","prompt":"a cat","n":18446744073686646784}`,
			wantErr: boundErr,
		},
		{
			name:    "n above max is rejected",
			body:    fmt.Sprintf(`{"model":"gpt-image-1","prompt":"a cat","n":%d}`, dto.MaxImageN+1),
			wantErr: boundErr,
		},
		{
			name:  "n at max is accepted",
			body:  fmt.Sprintf(`{"model":"gpt-image-1","prompt":"a cat","n":%d}`, dto.MaxImageN),
			wantN: dto.MaxImageN,
		},
		{
			name:  "explicit n is accepted",
			body:  `{"model":"gpt-image-1","prompt":"a cat","n":3}`,
			wantN: 3,
		},
		{
			name:  "zero n defaults to 1",
			body:  `{"model":"gpt-image-1","prompt":"a cat","n":0}`,
			wantN: 1,
		},
		{
			name:  "absent n defaults to 1",
			body:  `{"model":"gpt-image-1","prompt":"a cat"}`,
			wantN: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newJSONContext(t, tt.body)
			req, err := GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
			if tt.wantErr != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErr)
				return
			}
			require.NoError(t, err)
			require.NotNil(t, req.N)
			require.Equal(t, tt.wantN, *req.N)
			require.Equal(t, float64(tt.wantN), req.GetTokenCountMeta().BillingRatios["n"])
		})
	}

	t.Run("negative multipart n is rejected", func(t *testing.T) {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		require.NoError(t, writer.WriteField("model", "gpt-image-1"))
		require.NoError(t, writer.WriteField("prompt", "edit this image"))
		require.NoError(t, writer.WriteField("n", "-22904832"))
		require.NoError(t, writer.Close())

		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
		c.Request.Header.Set("Content-Type", writer.FormDataContentType())

		_, err := GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesEdits)
		require.Error(t, err)
		require.Contains(t, err.Error(), boundErr)
	})
}

func TestGetAndValidOpenAIImageRequestReplicateCount(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name    string
		body    string
		wantN   uint
		wantErr string
	}{
		{
			name:  "number_of_images controls billing count",
			body:  `{"model":"openai/gpt-image-2","prompt":"a cat","input":{"number_of_images":10}}`,
			wantN: 10,
		},
		{
			name:  "num_outputs controls billing count",
			body:  `{"model":"black-forest-labs/flux-1.1-pro","prompt":"a cat","input":{"num_outputs":4}}`,
			wantN: 4,
		},
		{
			name:  "matching outer and native counts are accepted",
			body:  `{"model":"openai/gpt-image-2","prompt":"a cat","n":3,"input":{"number_of_images":3}}`,
			wantN: 3,
		},
		{
			name:    "conflicting native count fields are rejected",
			body:    `{"model":"openai/gpt-image-2","prompt":"a cat","input":{"number_of_images":2,"num_outputs":3}}`,
			wantErr: "input.num_outputs must match input.number_of_images",
		},
		{
			name:    "outer count mismatch is rejected",
			body:    `{"model":"openai/gpt-image-2","prompt":"a cat","n":2,"input":{"number_of_images":3}}`,
			wantErr: "n must match input.number_of_images",
		},
		{
			name:    "zero native count is rejected",
			body:    `{"model":"openai/gpt-image-2","prompt":"a cat","input":{"number_of_images":0}}`,
			wantErr: "input.number_of_images must be an integer between 1",
		},
		{
			name:    "native count above shared maximum is rejected",
			body:    fmt.Sprintf(`{"model":"openai/gpt-image-2","prompt":"a cat","input":{"number_of_images":%d}}`, dto.MaxImageN+1),
			wantErr: "input.number_of_images must be an integer between 1",
		},
		{
			name:    "native input must be an object",
			body:    `{"model":"openai/gpt-image-2","prompt":"a cat","input":[]}`,
			wantErr: "input must be a JSON object",
		},
		{
			name:  "native input without count defaults billing to one",
			body:  `{"model":"openai/gpt-image-2","prompt":"a cat","input":{"quality":"high"}}`,
			wantN: 1,
		},
		{
			name:    "outer count requires a native count declaration",
			body:    `{"model":"openai/gpt-image-2","prompt":"a cat","n":3,"input":{"quality":"high"}}`,
			wantErr: "n greater than 1 requires input.number_of_images or input.num_outputs",
		},
		{
			name:  "legacy top-level count controls billing",
			body:  `{"model":"custom-replicate-model","prompt":"a cat","number_of_images":5}`,
			wantN: 5,
		},
		{
			name:  "legacy extra_fields count controls billing",
			body:  `{"model":"custom-replicate-model","prompt":"a cat","extra_fields":{"num_outputs":6}}`,
			wantN: 6,
		},
		{
			name:    "legacy top-level count cannot bypass outer n",
			body:    `{"model":"custom-replicate-model","prompt":"a cat","n":1,"num_outputs":6}`,
			wantErr: "n must match num_outputs",
		},
		{
			name:    "legacy extra_fields count is bounded",
			body:    fmt.Sprintf(`{"model":"custom-replicate-model","prompt":"a cat","extra_fields":{"num_outputs":%d}}`, dto.MaxImageN+1),
			wantErr: "extra_fields.num_outputs must be an integer between 1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", bytes.NewBufferString(tt.body))
			c.Request.Header.Set("Content-Type", "application/json")
			common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeReplicate)

			req, err := GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
			if tt.wantErr != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErr)
				return
			}
			require.NoError(t, err)
			require.NotNil(t, req.N)
			require.Equal(t, tt.wantN, *req.N)
			require.Equal(t, float64(tt.wantN), req.GetTokenCountMeta().BillingRatios["n"])
		})
	}
}

func TestGetAndValidOpenAIImageRequestDoesNotApplyReplicateCountsToOtherChannels(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1/images/generations",
		bytes.NewBufferString(`{"model":"gpt-image-1","prompt":"a cat","number_of_images":"provider-specific"}`),
	)
	c.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)

	req, err := GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
	require.NoError(t, err)
	require.NotNil(t, req.N)
	require.Equal(t, uint(1), *req.N)
}
