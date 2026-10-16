package huawei

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
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

// TestGetRequestURLByRelayFormat pins the client-format routing. Claude
// requests keep the Anthropic protocol and reach the dedicated endpoint;
// Gemini and OpenAI Responses requests have no MaaS endpoint of their own and
// are collapsed onto the OpenAI-compatible chat endpoint.
func TestGetRequestURLByRelayFormat(t *testing.T) {
	a := &Adaptor{}
	tests := []struct {
		name   string
		format relaytypes.RelayFormat
		mode   int
		want   string
	}{
		{
			name:   "claude stays native",
			format: relaytypes.RelayFormatClaude,
			mode:   relayconstant.RelayModeUnknown,
			want:   "https://api.modelarts-maas.com/anthropic/v1/messages",
		},
		{
			name:   "gemini downgrades to chat completions",
			format: relaytypes.RelayFormatGemini,
			mode:   relayconstant.RelayModeGemini,
			want:   "https://api.modelarts-maas.com/openai/v1/chat/completions",
		},
		{
			name:   "openai responses downgrades to chat completions",
			format: relaytypes.RelayFormatOpenAIResponses,
			mode:   relayconstant.RelayModeResponses,
			want:   "https://api.modelarts-maas.com/openai/v1/chat/completions",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{
				RelayFormat: tt.format,
				RelayMode:   tt.mode,
				ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://api.modelarts-maas.com"},
			}
			got, err := a.GetRequestURL(info)
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestSetupRequestHeaderAuthScheme(t *testing.T) {
	gin.SetMode(gin.TestMode)
	a := &Adaptor{}

	t.Run("claude uses x-api-key", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
		info := &relaycommon.RelayInfo{
			RelayFormat: relaytypes.RelayFormatClaude,
			ChannelMeta: &relaycommon.ChannelMeta{ApiKey: "hw-key"},
		}

		header := http.Header{}
		require.NoError(t, a.SetupRequestHeader(c, &header, info))
		assert.Equal(t, "hw-key", header.Get("x-api-key"))
		assert.Empty(t, header.Get("Authorization"))
		assert.Equal(t, "2023-06-01", header.Get("anthropic-version"))
		// The client sent no Content-Type at all; the outbound header must
		// still be application/json rather than the propagated empty value.
		assert.Equal(t, "application/json", header.Get("Content-Type"))
	})

	t.Run("chat keeps bearer auth", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
		info := &relaycommon.RelayInfo{
			RelayFormat: relaytypes.RelayFormatOpenAI,
			ChannelMeta: &relaycommon.ChannelMeta{ApiKey: "hw-key"},
		}

		header := http.Header{}
		require.NoError(t, a.SetupRequestHeader(c, &header, info))
		assert.Equal(t, "Bearer hw-key", header.Get("Authorization"))
		assert.Empty(t, header.Get("x-api-key"))
		assert.Equal(t, "application/json", header.Get("Content-Type"))
	})

	t.Run("multipart image edit is retyped as json", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", nil)
		c.Request.Header.Set("Content-Type", "multipart/form-data; boundary=----x")
		info := &relaycommon.RelayInfo{
			RelayFormat: relaytypes.RelayFormatOpenAI,
			RelayMode:   relayconstant.RelayModeImagesEdits,
			ChannelMeta: &relaycommon.ChannelMeta{ApiKey: "hw-key"},
		}

		header := http.Header{}
		require.NoError(t, a.SetupRequestHeader(c, &header, info))
		// The multipart body is converted to JSON before the upstream call.
		assert.Equal(t, "application/json", header.Get("Content-Type"))
	})
}

func TestConvertGeminiRequestDowngradesToChatCompletions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/glm-5.2:generateContent", nil)

	info := &relaycommon.RelayInfo{
		RelayFormat: relaytypes.RelayFormatGemini,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://api.modelarts-maas.com",
			UpstreamModelName: "glm-5.2",
		},
	}
	request := &dto.GeminiChatRequest{
		Contents: []dto.GeminiChatContent{
			{Role: "user", Parts: []dto.GeminiPart{{Text: "hello"}}},
		},
	}

	converted, err := (&Adaptor{}).ConvertGeminiRequest(c, info, request)
	require.NoError(t, err)

	body, err := common.Marshal(converted)
	require.NoError(t, err)
	assert.Contains(t, string(body), `"model":"glm-5.2"`)
	assert.Contains(t, string(body), `"role":"user"`)
	assert.Contains(t, string(body), `hello`)
	assert.NotContains(t, string(body), `"contents"`)
}

func TestConvertOpenAIResponsesRequestDowngradesToChatCompletions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	info := &relaycommon.RelayInfo{
		RelayFormat: relaytypes.RelayFormatOpenAIResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://api.modelarts-maas.com",
			UpstreamModelName: "glm-5.2",
		},
	}
	request := dto.OpenAIResponsesRequest{
		Model: "glm-5.2",
		Input: json.RawMessage(`"hello"`),
	}

	converted, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(c, info, request)
	require.NoError(t, err)

	body, err := common.Marshal(converted)
	require.NoError(t, err)
	assert.Contains(t, string(body), `"model":"glm-5.2"`)
	assert.Contains(t, string(body), `"messages"`)
	assert.NotContains(t, string(body), `"input"`)
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

	t.Run("defaults size when the client omits it", func(t *testing.T) {
		var req dto.ImageRequest
		require.NoError(t, common.Unmarshal([]byte(`{"model":"qwen-image","prompt":"a cat"}`), &req))

		got, err := convertGenerationRequest(req)
		require.NoError(t, err)
		assert.Equal(t, defaultGenerationSize, got.Size)
	})

	t.Run("keeps an explicit size", func(t *testing.T) {
		var req dto.ImageRequest
		require.NoError(t, common.Unmarshal([]byte(`{"model":"qwen-image","prompt":"a cat","size":"512x512"}`), &req))

		got, err := convertGenerationRequest(req)
		require.NoError(t, err)
		assert.Equal(t, "512x512", got.Size)
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

	t.Run("does not forward response_format to the edit endpoint", func(t *testing.T) {
		c := newJSONContext()
		var req dto.ImageRequest
		require.NoError(t, common.Unmarshal([]byte(`{"model":"qwen-image-edit-2509","prompt":"make it blue","image":"data:image/jpg;base64,QUFB","response_format":"b64_json"}`), &req))

		got, err := convertEditRequest(c, req)
		require.NoError(t, err)
		assert.Empty(t, got.ResponseFormat)
	})

	t.Run("leaves size empty so MaaS derives it from the input image", func(t *testing.T) {
		c := newJSONContext()
		var req dto.ImageRequest
		require.NoError(t, common.Unmarshal([]byte(`{"model":"qwen-image-edit-2509","prompt":"make it blue","image":"data:image/jpg;base64,QUFB"}`), &req))

		got, err := convertEditRequest(c, req)
		require.NoError(t, err)
		assert.Empty(t, got.Size)
	})

	t.Run("rejects edit without an image", func(t *testing.T) {
		c := newJSONContext()
		var req dto.ImageRequest
		require.NoError(t, common.Unmarshal([]byte(`{"model":"qwen-image-edit-2509","prompt":"make it blue"}`), &req))

		_, err := convertEditRequest(c, req)
		require.Error(t, err)
		var apiErr *relaytypes.NewAPIError
		require.ErrorAs(t, err, &apiErr)
		assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
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
		var apiErr *relaytypes.NewAPIError
		require.ErrorAs(t, err, &apiErr)
		assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	})

	t.Run("rejects raw base64 without data uri prefix", func(t *testing.T) {
		c := newJSONContext()
		var req dto.ImageRequest
		require.NoError(t, common.Unmarshal([]byte(`{"model":"qwen-image-edit-2509","prompt":"make it blue","image":["QUFB"]}`), &req))

		_, err := convertEditRequest(c, req)
		require.Error(t, err)
		var apiErr *relaytypes.NewAPIError
		require.ErrorAs(t, err, &apiErr)
		assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
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

	t.Run("strips data uri prefix and records the returned image count", func(t *testing.T) {
		c, w := newTestContext(t)
		info := &relaycommon.RelayInfo{StartTime: time.Now()}
		// The n ratio is only applied under per-call pricing, so the flag has
		// to be set for the count to surface as a multiplier.
		info.PriceData.UsePrice = true
		estimated := 1
		info.TieredBillingSnapshot = &billingexpr.BillingSnapshot{EstimatedImageCount: &estimated}

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

		require.NotNil(t, info.BillingImageCount)
		assert.Equal(t, 1, *info.BillingImageCount)

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

	t.Run("leaves billing untouched when the count is out of range", func(t *testing.T) {
		c, _ := newTestContext(t)
		info := &relaycommon.RelayInfo{StartTime: time.Now()}
		info.PriceData.UsePrice = true
		estimated := 1
		info.TieredBillingSnapshot = &billingexpr.BillingSnapshot{EstimatedImageCount: &estimated}

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
		// Out-of-range counts must leave the pre-consume estimate in effect.
		assert.Nil(t, info.BillingImageCount)
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
