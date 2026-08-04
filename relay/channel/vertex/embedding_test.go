package vertex

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestConvertEmbeddingRequestBuildsVertexPredictPayload(t *testing.T) {
	t.Parallel()

	dimensions := 1024
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gemini-embedding-001",
		},
	}
	request := dto.EmbeddingRequest{
		Input:          []any{"hello Vertex"},
		EncodingFormat: "float",
		Dimensions:     &dimensions,
	}

	converted, err := (&Adaptor{}).ConvertEmbeddingRequest(nil, info, request)
	require.NoError(t, err)
	require.Equal(t, &VertexEmbeddingRequest{
		Instances: []VertexEmbeddingInstance{{Content: "hello Vertex"}},
		Parameters: &VertexEmbeddingParameters{
			OutputDimensionality: &dimensions,
		},
	}, converted)
}

func TestConvertEmbeddingRequestRejectsUnsupportedInputs(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		request dto.EmbeddingRequest
	}{
		{
			name:    "multiple inputs",
			request: dto.EmbeddingRequest{Input: []any{"first", "second"}},
		},
		{
			name:    "mixed input array",
			request: dto.EmbeddingRequest{Input: []any{123, "second"}},
		},
		{
			name:    "token id array",
			request: dto.EmbeddingRequest{Input: []any{123}},
		},
		{
			name:    "empty input",
			request: dto.EmbeddingRequest{Input: "   "},
		},
		{
			name:    "base64 encoding",
			request: dto.EmbeddingRequest{Input: "hello", EncodingFormat: "base64"},
		},
		{
			name:    "invalid dimensions",
			request: dto.EmbeddingRequest{Input: "hello", Dimensions: intPointer(0)},
		},
		{
			name:    "dimensions above model limit",
			request: dto.EmbeddingRequest{Input: "hello", Dimensions: intPointer(3073)},
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			info := &relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{
					UpstreamModelName: "gemini-embedding-001",
				},
			}
			converted, err := (&Adaptor{}).ConvertEmbeddingRequest(nil, info, test.request)
			require.Nil(t, converted)
			require.Error(t, err)

			var apiErr *types.NewAPIError
			require.ErrorAs(t, err, &apiErr)
			require.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
			require.Equal(t, types.ErrorCodeInvalidRequest, apiErr.GetErrorCode())
		})
	}
}

func TestGetRequestURLUsesVertexPredictForEmbeddings(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeEmbeddings,
		OriginModelName: "gemini-embedding-001",
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiVersion:        "us-central1",
			ApiKey:            `{"project_id":"airjelly-project"}`,
			UpstreamModelName: "gemini-embedding-001",
		},
	}
	adaptor := &Adaptor{}
	adaptor.Init(info)

	requestURL, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	require.Equal(
		t,
		"https://us-central1-aiplatform.googleapis.com/v1/projects/airjelly-project/locations/us-central1/publishers/google/models/gemini-embedding-001:predict",
		requestURL,
	)
}

func TestVertexEmbeddingHandlerConvertsPredictResponse(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gemini-embedding-001",
		},
	}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body: io.NopCloser(strings.NewReader(
			`{"predictions":[{"embeddings":{"statistics":{"truncated":false,"token_count":6},"values":[0.25,-0.5]}}]}`,
		)),
	}

	usage, apiErr := VertexEmbeddingHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.Equal(t, 6, usage.PromptTokens)
	require.Equal(t, 6, usage.TotalTokens)

	var converted dto.OpenAIEmbeddingResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &converted))
	require.Equal(t, "list", converted.Object)
	require.Equal(t, "gemini-embedding-001", converted.Model)
	require.Equal(t, []float64{0.25, -0.5}, converted.Data[0].Embedding)
	require.Equal(t, 0, converted.Data[0].Index)
	require.Equal(t, 6, converted.PromptTokens)
}

func TestVertexEmbeddingHandlerRejectsEmptyPrediction(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(`{"predictions":[]}`)),
	}

	usage, apiErr := VertexEmbeddingHandler(c, info, resp)
	require.Nil(t, usage)
	require.NotNil(t, apiErr)
	require.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
}

func intPointer(value int) *int {
	return &value
}
