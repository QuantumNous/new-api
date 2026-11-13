package voyage

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func marshaled(t *testing.T, value any) string {
	t.Helper()
	out, err := common.Marshal(value)
	require.NoError(t, err)
	return string(out)
}

func TestEmbeddingRequestRejections(t *testing.T) {
	document, query, invalid := "document", "query", "search"
	dimension := 256
	for _, tc := range []struct {
		name    string
		request dto.EmbeddingRequest
		wantErr string
	}{
		{"missing model", dto.EmbeddingRequest{Input: []any{"a"}}, "model is required"},
		{"model of another provider", dto.EmbeddingRequest{Model: "text-embedding-3-small", Input: []any{"a"}}, "unknown Voyage model"},
		{"rerank model", dto.EmbeddingRequest{Model: "rerank-3", Input: []any{"a"}}, "not an embedding model"},
		{"unsupported input type", dto.EmbeddingRequest{Model: "voyage-4", Input: []any{"a"}, InputType: &invalid}, "input_type must be"},
		{"images need a multimodal model", dto.EmbeddingRequest{Model: "voyage-4", Input: []any{map[string]any{"type": "image_url"}}}, "must be a string"},
		{"float32 encoding unsupported upstream", dto.EmbeddingRequest{Model: "voyage-4", Input: []any{"a"}, EncodingFormat: "int8"}, "unsupported encoding_format"},
		{"context needs an input type", dto.EmbeddingRequest{Model: "voyage-context-4", Input: []any{"a"}}, "input_type is required"},
		{"context pre-chunked document", dto.EmbeddingRequest{Model: "voyage-context-4", Input: []any{[]any{"a", "b"}}, InputType: &document}, "pass one string per document"},
		{"context pre-chunked query", dto.EmbeddingRequest{Model: "voyage-context-3", Input: []any{[]any{"a"}}, InputType: &query}, "pass one string per document"},
		{"context base64", dto.EmbeddingRequest{Model: "voyage-context-4", Input: []any{"a"}, InputType: &document, EncodingFormat: "base64"}, "not supported for contextualized"},
		{"multimodal mixes URL and base64 images", dto.EmbeddingRequest{Model: "voyage-multimodal-3.5", Dimensions: &dimension, Input: []any{
			map[string]any{"type": "image_url", "image_url": map[string]any{"url": "https://example.com/a.png"}},
			map[string]any{"type": "image_url", "image_url": map[string]any{"url": "data:image/png;base64,AAAA"}},
		}}, "cannot mix"},
		{"multimodal-3 takes no video", dto.EmbeddingRequest{Model: "voyage-multimodal-3", Input: []any{
			map[string]any{"type": "video_url", "video_url": map[string]any{"url": "https://example.com/a.mp4"}},
		}}, "does not accept video"},
		{"multimodal part without type", dto.EmbeddingRequest{Model: "voyage-multimodal-3.5", Input: []any{map[string]any{"text": "a"}}}, "missing the type"},
		{"multimodal unknown part", dto.EmbeddingRequest{Model: "voyage-multimodal-3.5", Input: []any{map[string]any{"type": "audio"}}}, "unsupported content part"},
		{"multimodal empty content", dto.EmbeddingRequest{Model: "voyage-multimodal-3.5", Input: []any{map[string]any{"content": []any{}}}}, "has no content"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := convertEmbeddingRequest(tc.request)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tc.wantErr)
		})
	}
}

func TestEmbeddingRequestShapes(t *testing.T) {
	document, query := "document", "query"
	dimension := 512
	for _, tc := range []struct {
		name    string
		request dto.EmbeddingRequest
		want    string
	}{
		{"text omits unset parameters", dto.EmbeddingRequest{Model: "voyage-4", Input: "a"},
			`{"model":"voyage-4","input":["a"]}`},
		{"text with matryoshka size and input type", dto.EmbeddingRequest{Model: "voyage-4", Input: []any{"a", "b"}, InputType: &query, Dimensions: &dimension, EncodingFormat: "float"},
			`{"model":"voyage-4","input":["a","b"],"input_type":"query","output_dimension":512}`},
		{"context document auto-chunks at 32000", dto.EmbeddingRequest{Model: "voyage-context-4", Input: []any{"doc one", "doc two"}, InputType: &document},
			`{"model":"voyage-context-4","inputs":["doc one","doc two"],"input_type":"document","enable_auto_chunking":true,"chunk_size":32000}`},
		{"context query is not chunked", dto.EmbeddingRequest{Model: "voyage-context-3", Input: []any{"q1", "q2"}, InputType: &query, Dimensions: &dimension},
			`{"model":"voyage-context-3","inputs":[["q1"],["q2"]],"input_type":"query","output_dimension":512}`},
		{"multimodal groups parts and keeps URL and base64 apart", dto.EmbeddingRequest{Model: "voyage-multimodal-3.5", InputType: &document, Input: []any{
			"plain text",
			map[string]any{"content": []any{
				map[string]any{"type": "text", "text": "a cat"},
				map[string]any{"type": "image_url", "image_url": "https://example.com/cat.png"},
			}},
			map[string]any{"type": "video_url", "video_url": map[string]any{"url": "https://example.com/cat.mp4"}},
		}}, `{"model":"voyage-multimodal-3.5","inputs":[` +
			`{"content":[{"type":"text","text":"plain text"}]},` +
			`{"content":[{"type":"text","text":"a cat"},{"type":"image_url","image_url":"https://example.com/cat.png"}]},` +
			`{"content":[{"type":"video_url","video_url":"https://example.com/cat.mp4"}]}],"input_type":"document"}`},
		{"multimodal data URL becomes base64", dto.EmbeddingRequest{Model: "voyage-multimodal-3", Input: []any{
			map[string]any{"type": "image_url", "image_url": map[string]any{"url": "data:image/png;base64,AAAA"}},
		}}, `{"model":"voyage-multimodal-3","inputs":[{"content":[{"type":"image_base64","image_base64":"data:image/png;base64,AAAA"}]}]}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			converted, err := convertEmbeddingRequest(tc.request)
			require.NoError(t, err)
			assert.JSONEq(t, tc.want, marshaled(t, converted))
		})
	}
}

func TestRerankRequest(t *testing.T) {
	topN, returnDocuments := 1, true
	_, err := convertRerankRequest(dto.RerankRequest{Model: "voyage-4", Query: "q", Documents: []any{"a"}})
	require.ErrorContains(t, err, "not a rerank model")
	_, err = convertRerankRequest(dto.RerankRequest{Model: "rerank-3", Documents: []any{"a"}})
	require.ErrorContains(t, err, "query is required")
	_, err = convertRerankRequest(dto.RerankRequest{Model: "rerank-3", Query: "q"})
	require.ErrorContains(t, err, "documents is empty")
	_, err = convertRerankRequest(dto.RerankRequest{Model: "rerank-3", Query: "q", Documents: []any{map[string]any{"body": "a"}}})
	require.ErrorContains(t, err, "documents[0]")

	converted, err := convertRerankRequest(dto.RerankRequest{
		Model: "rerank-3", Query: "q", Documents: []any{"a", map[string]any{"text": "b"}}, TopN: &topN, ReturnDocuments: &returnDocuments,
	})
	require.NoError(t, err)
	assert.JSONEq(t, `{"model":"rerank-3","query":"q","documents":["a","b"],"top_k":1,"return_documents":true}`, marshaled(t, converted))
}

func TestRequestURLFollowsModelAndRelayMode(t *testing.T) {
	adaptor := &Adaptor{}
	for _, tc := range []struct {
		model string
		mode  int
		want  string
	}{
		{"voyage-4", constant.RelayModeEmbeddings, "https://api.voyageai.com/v1/embeddings"},
		{"voyage-context-4", constant.RelayModeEmbeddings, "https://api.voyageai.com/v1/contextualizedembeddings"},
		{"voyage-multimodal-3.5", constant.RelayModeEmbeddings, "https://api.voyageai.com/v1/multimodalembeddings"},
		{"rerank-3", constant.RelayModeRerank, "https://api.voyageai.com/v1/rerank"},
	} {
		info := &relaycommon.RelayInfo{RelayMode: tc.mode, ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://api.voyageai.com", UpstreamModelName: tc.model}}
		got, err := adaptor.GetRequestURL(info)
		require.NoError(t, err)
		assert.Equal(t, tc.want, got)
	}
	for _, tc := range []struct {
		model string
		mode  int
	}{
		{"voyage-4", constant.RelayModeRerank},
		{"rerank-3", constant.RelayModeEmbeddings},
		{"voyage-4", constant.RelayModeChatCompletions},
		{"unknown-model", constant.RelayModeEmbeddings},
	} {
		info := &relaycommon.RelayInfo{RelayMode: tc.mode, ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://api.voyageai.com", UpstreamModelName: tc.model}}
		_, err := adaptor.GetRequestURL(info)
		assert.Error(t, err, "%s on relay mode %d", tc.model, tc.mode)
	}
}

func TestResponsesWithoutUsageAreNotBilled(t *testing.T) {
	for _, tc := range []struct {
		name    string
		handler func(*gin.Context, *http.Response) (*dto.Usage, *types.NewAPIError)
		body    string
	}{
		{"embeddings", embeddingHandler, `{"object":"list","data":[{"object":"embedding","embedding":[0.1],"index":0}],"model":"voyage-4"}`},
		{"embeddings with usage lacking total", embeddingHandler, `{"data":[{"embedding":[0.1],"index":0}],"usage":{}}`},
		{"contextualized", contextualizedEmbeddingHandler, `{"data":[{"data":[{"embedding":[0.1],"index":0}],"index":0}]}`},
		{"multimodal without pixels", multimodalEmbeddingHandler, `{"data":[{"embedding":[0.1],"index":0}],"usage":{"text_tokens":3,"total_tokens":3}}`},
		{"rerank", rerankHandler, `{"data":[{"index":0,"relevance_score":0.9}],"model":"rerank-3"}`},
		{"negative usage", rerankHandler, `{"data":[{"index":0,"relevance_score":0.9}],"usage":{"total_tokens":-5}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/embeddings", nil)
			usage, apiErr := tc.handler(c, &http.Response{StatusCode: http.StatusOK, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(tc.body))})
			require.NotNil(t, apiErr)
			assert.Nil(t, usage)
			assert.Empty(t, recorder.Body.String(), "nothing may reach the client when billing cannot proceed")
		})
	}
}

func TestUsageNormalization(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/rerank", nil)
	usage, apiErr := rerankHandler(c, &http.Response{StatusCode: http.StatusOK, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(
		`{"object":"list","data":[{"relevance_score":0.86,"index":1,"document":"Paris"}],"model":"rerank-3","usage":{"total_tokens":7}}`))})
	require.Nil(t, apiErr)
	assert.Equal(t, 7, usage.PromptTokens)
	var body struct {
		Results json.RawMessage `json:"results"`
		Usage   dto.Usage       `json:"usage"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &body))
	assert.JSONEq(t, `[{"document":{"text":"Paris"},"index":1,"relevance_score":0.86}]`, string(body.Results))
	assert.Equal(t, 7, body.Usage.TotalTokens)

	// A usage of zero is what Voyage reports for a single-token input with an
	// input type; only an absent usage is refused.
	zero, err := textUsage(&usageResponse{TotalTokens: common.GetPointer(int64(0))})
	require.NoError(t, err)
	assert.Equal(t, 0, zero.PromptTokens)

	// 2_240 image pixels and 1_120 video pixels are 6 image tokens of 560 pixels.
	multimodal, err := multimodalUsage(&usageResponse{TextTokens: common.GetPointer(int64(10)), ImagePixels: common.GetPointer(int64(2240)), VideoPixels: common.GetPointer(int64(1120))})
	require.NoError(t, err)
	assert.Equal(t, 16, multimodal.PromptTokens)
	assert.Equal(t, 6, multimodal.PromptTokensDetails.ImageTokens)
	assert.Equal(t, 10, multimodal.PromptTokensDetails.TextTokens)

	huge := int64(1) << 62
	saturated, err := multimodalUsage(&usageResponse{TextTokens: &huge, ImagePixels: &huge, VideoPixels: &huge})
	require.NoError(t, err)
	assert.Equal(t, 1<<31-1, saturated.PromptTokens)
}
