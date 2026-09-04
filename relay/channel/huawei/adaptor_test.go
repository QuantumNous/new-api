package huawei

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	relaytypes "github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newHTTPResp(body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader([]byte(body))),
	}
}

func newTestContext(t *testing.T) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	return c, w
}

func TestGetRequestURL(t *testing.T) {
	a := &Adaptor{}
	tests := []struct {
		mode int
		want string
	}{
		{relayconstant.RelayModeChatCompletions, "https://api.modelarts-maas.com/openai/v1/chat/completions"},
		{relayconstant.RelayModeCompletions, "https://api.modelarts-maas.com/openai/v1/completions"},
		{relayconstant.RelayModeEmbeddings, "https://api.modelarts-maas.com/v1/embeddings"},
		{relayconstant.RelayModeRerank, "https://api.modelarts-maas.com/v1/rerank"},
		{relayconstant.RelayModeImagesGenerations, "https://api.modelarts-maas.com/v1/images/generations"},
		{relayconstant.RelayModeImagesEdits, "https://api.modelarts-maas.com/v1/images/generations"},
	}
	for _, tt := range tests {
		info := &relaycommon.RelayInfo{
			ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://api.modelarts-maas.com"},
			RelayMode:   tt.mode,
		}
		got, err := a.GetRequestURL(info)
		require.NoError(t, err)
		assert.Equal(t, tt.want, got)
	}

	unsupported := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://api.modelarts-maas.com"},
		RelayMode:   relayconstant.RelayModeResponses,
	}
	_, err := a.GetRequestURL(unsupported)
	require.Error(t, err)
}

func TestConvertGenerationRequest(t *testing.T) {
	t.Run("maps openai fields and seed from extra", func(t *testing.T) {
		var req dto.ImageRequest
		require.NoError(t, common.Unmarshal([]byte(`{"model":"qwen-image","prompt":"a cat","size":"1024x1024","response_format":"b64_json","seed":44,"watermark":false}`), &req))

		got, err := convertGenerationRequest(req)
		require.NoError(t, err)
		assert.Equal(t, "qwen-image", got.Model)
		assert.Equal(t, "a cat", got.Prompt)
		assert.Equal(t, "1024x1024", got.Size)
		assert.Equal(t, "b64_json", got.ResponseFormat)
		assert.NotNil(t, got.Seed)
		assert.Equal(t, 44, *got.Seed)
		assert.NotNil(t, got.Watermark)
		assert.False(t, *got.Watermark)
	})

	t.Run("omits response_format unless b64_json", func(t *testing.T) {
		var req dto.ImageRequest
		require.NoError(t, common.Unmarshal([]byte(`{"model":"qwen-image","prompt":"a cat","response_format":"png"}`), &req))

		got, err := convertGenerationRequest(req)
		require.NoError(t, err)
		assert.Empty(t, got.ResponseFormat)
	})

	t.Run("rejects n greater than 1", func(t *testing.T) {
		var req dto.ImageRequest
		require.NoError(t, common.Unmarshal([]byte(`{"model":"qwen-image","prompt":"a cat","n":2}`), &req))

		_, err := convertGenerationRequest(req)
		require.Error(t, err)
		var apiErr *relaytypes.NewAPIError
		require.ErrorAs(t, err, &apiErr)
		assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	})

	t.Run("rejects n above MaxImageN", func(t *testing.T) {
		req := dto.ImageRequest{
			Model:  "qwen-image",
			Prompt: "a cat",
			N:      common.GetPointer(uint(dto.MaxImageN + 1)),
		}
		_, err := convertGenerationRequest(req)
		require.Error(t, err)
	})

	t.Run("rejects response_format url", func(t *testing.T) {
		var req dto.ImageRequest
		require.NoError(t, common.Unmarshal([]byte(`{"model":"qwen-image","prompt":"a cat","response_format":"url"}`), &req))

		_, err := convertGenerationRequest(req)
		require.Error(t, err)
		var apiErr *relaytypes.NewAPIError
		require.ErrorAs(t, err, &apiErr)
		assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	})

	t.Run("rejects streaming", func(t *testing.T) {
		req := dto.ImageRequest{
			Model:  "qwen-image",
			Prompt: "a cat",
			Stream: common.GetPointer(true),
		}
		_, err := convertGenerationRequest(req)
		require.Error(t, err)
	})
}

func TestConvertEditRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)

	newJSONContext := func() *gin.Context {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", nil)
		c.Request.Header.Set("Content-Type", "application/json")
		return c
	}

	t.Run("single image string", func(t *testing.T) {
		c := newJSONContext()
		var req dto.ImageRequest
		require.NoError(t, common.Unmarshal([]byte(`{"model":"qwen-image-edit-2509","prompt":"make it blue","image":"data:image/jpg;base64,/9j/QVBJ"}`), &req))

		got, err := convertEditRequest(c, req)
		require.NoError(t, err)
		assert.Equal(t, "data:image/jpg;base64,/9j/QVBJ", got.Image)
	})

	t.Run("image array is comma joined", func(t *testing.T) {
		c := newJSONContext()
		var req dto.ImageRequest
		require.NoError(t, common.Unmarshal([]byte(`{"model":"qwen-image-edit-2509","prompt":"blend","image":["data:image/jpg;base64,QUFB","data:image/png;base64,QkJC"]}`), &req))

		got, err := convertEditRequest(c, req)
		require.NoError(t, err)
		assert.Equal(t, "data:image/jpg;base64,QUFB,data:image/png;base64,QkJC", got.Image)
	})

	t.Run("rejects edit without an image", func(t *testing.T) {
		c := newJSONContext()
		var req dto.ImageRequest
		require.NoError(t, common.Unmarshal([]byte(`{"model":"qwen-image-edit-2509","prompt":"make it blue"}`), &req))

		_, err := convertEditRequest(c, req)
		require.Error(t, err)
	})

	t.Run("rejects response_format url", func(t *testing.T) {
		c := newJSONContext()
		var req dto.ImageRequest
		require.NoError(t, common.Unmarshal([]byte(`{"model":"qwen-image-edit-2509","prompt":"make it blue","image":"data:image/jpg;base64,QUFB","response_format":"url"}`), &req))

		_, err := convertEditRequest(c, req)
		require.Error(t, err)
		var apiErr *relaytypes.NewAPIError
		require.ErrorAs(t, err, &apiErr)
		assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	})

	t.Run("rejects more than two images", func(t *testing.T) {
		c := newJSONContext()
		var req dto.ImageRequest
		require.NoError(t, common.Unmarshal([]byte(`{"model":"qwen-image-edit-2509","prompt":"blend","image":["data:image/jpg;base64,QUFB","data:image/png;base64,QkJC","data:image/png;base64,Q0ND"]}`), &req))

		_, err := convertEditRequest(c, req)
		require.Error(t, err)
	})

	t.Run("rejects raw base64 without data uri prefix", func(t *testing.T) {
		c := newJSONContext()
		var req dto.ImageRequest
		require.NoError(t, common.Unmarshal([]byte(`{"model":"qwen-image-edit-2509","prompt":"make it blue","image":["QUFB"]}`), &req))

		_, err := convertEditRequest(c, req)
		require.Error(t, err)
	})

	t.Run("rejects n greater than 1", func(t *testing.T) {
		c := newJSONContext()
		var req dto.ImageRequest
		require.NoError(t, common.Unmarshal([]byte(`{"model":"qwen-image-edit-2509","prompt":"make it blue","image":"data:image/jpg;base64,QUFB","n":2}`), &req))

		_, err := convertEditRequest(c, req)
		require.Error(t, err)
	})

	t.Run("multipart image becomes a data url", func(t *testing.T) {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		require.NoError(t, writer.WriteField("model", "qwen-image-edit-2509"))
		require.NoError(t, writer.WriteField("prompt", "make it blue"))
		part, err := writer.CreateFormFile("image", "input.png")
		require.NoError(t, err)
		_, err = part.Write([]byte("fake image"))
		require.NoError(t, err)
		require.NoError(t, writer.Close())

		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
		c.Request.Header.Set("Content-Type", writer.FormDataContentType())
		require.NoError(t, c.Request.ParseMultipartForm(32<<20))

		req := dto.ImageRequest{Model: "qwen-image-edit-2509", Prompt: "make it blue"}
		got, err := convertEditRequest(c, req)
		require.NoError(t, err)
		want := fmt.Sprintf("data:%s;base64,%s", http.DetectContentType([]byte("fake image")), base64.StdEncoding.EncodeToString([]byte("fake image")))
		assert.Equal(t, want, got.Image)
	})
}

func TestHuaweiImageHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("strips data uri prefix and sets n ratio", func(t *testing.T) {
		c, w := newTestContext(t)
		info := &relaycommon.RelayInfo{StartTime: time.Now()}

		usage, apiErr := huaweiImageHandler(c, info, newHTTPResp(`{"model":"qwen-image","created":123,"data":[{"url":null,"b64_json":"data:image/jpg;base64,/9j/QVBJ"}],"usage":{"prompt_tokens":10,"completion_tokens":100,"total_tokens":110}}`))
		require.Nil(t, apiErr)

		var out dto.ImageResponse
		require.NoError(t, common.Unmarshal(w.Body.Bytes(), &out))
		require.Len(t, out.Data, 1)
		assert.Empty(t, out.Data[0].Url)
		assert.Equal(t, "/9j/QVBJ", out.Data[0].B64Json)

		ratios := info.PriceData.OtherRatios()
		require.NotNil(t, ratios)
		assert.Equal(t, 1.0, ratios["n"])

		require.NotNil(t, usage)
		assert.Equal(t, 10, usage.PromptTokens)
		assert.Equal(t, 100, usage.CompletionTokens)
		assert.Equal(t, 110, usage.TotalTokens)
	})

	t.Run("keeps raw b64_json without prefix", func(t *testing.T) {
		c, w := newTestContext(t)
		info := &relaycommon.RelayInfo{StartTime: time.Now()}

		_, apiErr := huaweiImageHandler(c, info, newHTTPResp(`{"model":"qwen-image","data":[{"b64_json":"/9j/RAW"}]}`))
		require.Nil(t, apiErr)

		var out dto.ImageResponse
		require.NoError(t, common.Unmarshal(w.Body.Bytes(), &out))
		require.Len(t, out.Data, 1)
		assert.Empty(t, out.Data[0].Url)
		assert.Equal(t, "/9j/RAW", out.Data[0].B64Json)
	})

	t.Run("does not set n ratio above MaxImageN", func(t *testing.T) {
		c, _ := newTestContext(t)
		info := &relaycommon.RelayInfo{StartTime: time.Now()}

		items := make([]string, dto.MaxImageN+1)
		for i := range items {
			items[i] = `{"b64_json":"/9j/RAW"}`
		}
		body := `{"data":[` + strings.Join(items, ",") + `]}`
		_, apiErr := huaweiImageHandler(c, info, newHTTPResp(body))
		require.Nil(t, apiErr)

		ratios := info.PriceData.OtherRatios()
		if ratios != nil {
			assert.NotContains(t, ratios, "n")
		}
	})

	t.Run("surfaces upstream error with upstream status", func(t *testing.T) {
		c, _ := newTestContext(t)

		resp := newHTTPResp(`{"error":{"message":"model not found"}}`)
		resp.StatusCode = http.StatusTooManyRequests
		_, apiErr := huaweiImageHandler(c, &relaycommon.RelayInfo{}, resp)
		require.NotNil(t, apiErr)
		assert.Equal(t, http.StatusTooManyRequests, apiErr.StatusCode)
	})
}

func TestHuaweiRerankHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("flattens document.text and maps usage", func(t *testing.T) {
		c, w := newTestContext(t)
		info := &relaycommon.RelayInfo{
			RerankerInfo: &relaycommon.RerankerInfo{
				ReturnDocuments: true,
				Documents:       []any{"doc one", "doc two"},
			},
		}

		_, apiErr := huaweiRerankHandler(c, info, newHTTPResp(`{"id":"x","model":"bge-reranker-v2-m3","results":[{"index":0,"document":{"text":"doc one"},"relevance_score":0.9}],"usage":{"total_tokens":99}}`))
		require.Nil(t, apiErr)

		var out dto.RerankResponse
		require.NoError(t, common.Unmarshal(w.Body.Bytes(), &out))
		require.Len(t, out.Results, 1)
		assert.Equal(t, 0, out.Results[0].Index)
		assert.Equal(t, 0.9, out.Results[0].RelevanceScore)
		assert.Equal(t, "doc one", out.Results[0].Document)
		assert.Equal(t, 99, out.Usage.TotalTokens)
		assert.Equal(t, 99, out.Usage.PromptTokens)
	})

	t.Run("omits document when return_documents is false", func(t *testing.T) {
		c, w := newTestContext(t)
		info := &relaycommon.RelayInfo{
			RerankerInfo: &relaycommon.RerankerInfo{ReturnDocuments: false},
		}

		_, apiErr := huaweiRerankHandler(c, info, newHTTPResp(`{"results":[{"index":0,"document":{"text":"doc one"},"relevance_score":0.9}],"usage":{"total_tokens":1}}`))
		require.Nil(t, apiErr)

		var out dto.RerankResponse
		require.NoError(t, common.Unmarshal(w.Body.Bytes(), &out))
		require.Len(t, out.Results, 1)
		assert.Nil(t, out.Results[0].Document)
	})

	t.Run("falls back to original document", func(t *testing.T) {
		c, w := newTestContext(t)
		info := &relaycommon.RelayInfo{
			RerankerInfo: &relaycommon.RerankerInfo{
				ReturnDocuments: true,
				Documents:       []any{"original doc"},
			},
		}

		_, apiErr := huaweiRerankHandler(c, info, newHTTPResp(`{"results":[{"index":0,"document":{},"relevance_score":0.5}],"usage":{"total_tokens":1}}`))
		require.Nil(t, apiErr)

		var out dto.RerankResponse
		require.NoError(t, common.Unmarshal(w.Body.Bytes(), &out))
		assert.Equal(t, "original doc", out.Results[0].Document)
	})
}
