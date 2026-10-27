package tei

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTEIRerankHTTPConversion(t *testing.T) {
	service.InitHttpClient()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/prefix/rerank", r.URL.Path)
		assert.Empty(t, r.Header.Get("Authorization"), "employee credentials must not reach an unauthenticated upstream")
		var body map[string]any
		if !assert.NoError(t, common.DecodeJson(r.Body, &body)) {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		assert.Equal(t, "capital?", body["query"])
		assert.Equal(t, []any{"fruit", "Chengdu"}, body["texts"])
		assert.Equal(t, false, body["truncate"])
		assert.Equal(t, false, body["raw_scores"])
		assert.NotContains(t, body, "model")
		assert.NotContains(t, body, "top_n")
		w.Header().Set("x-compute-tokens", "37")
		_, _ = io.WriteString(w, `[{"index":0,"score":0.1},{"index":1,"score":0.9}]`)
	}))
	defer upstream.Close()
	for _, tc := range []struct {
		name       string
		topN       *int
		returnDocs bool
		indices    []int
	}{
		{name: "top result includes original document", topN: new(1), returnDocs: true, indices: []int{1}},
		{name: "all results without document", indices: []int{1, 0}},
		{name: "explicit zero returns empty results but accounts for all work", topN: new(0), indices: []int{}},
		{name: "top_n larger than candidate count", topN: new(3), indices: []int{1, 0}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/rerank", nil)
			c.Request.Header.Set("Authorization", "Bearer employee-key")
			info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: upstream.URL + "/prefix/"}, RelayMode: relayconstant.RelayModeRerank, IsChannelTest: true}
			adaptor := &Adaptor{}
			adaptor.Init(info)
			converted, err := adaptor.ConvertRerankRequest(c, info.RelayMode, dto.RerankRequest{Query: "capital?", Documents: []any{"fruit", "Chengdu"}, TopN: tc.topN, ReturnDocuments: &tc.returnDocs})
			require.NoError(t, err)
			body, err := common.Marshal(converted)
			require.NoError(t, err)
			resp, err := adaptor.DoRequest(c, info, bytes.NewReader(body))
			require.NoError(t, err)
			usage, apiErr := adaptor.DoResponse(c, resp.(*http.Response), info)
			require.Nil(t, apiErr)
			assert.Equal(t, 37, usage.(*dto.Usage).PromptTokens)
			assert.Zero(t, usage.(*dto.Usage).CompletionTokens)
			var result dto.RerankResponse
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
			require.Len(t, result.Results, len(tc.indices))
			assert.Equal(t, "upstream", result.Usage.UsageSource)
			for i, index := range tc.indices {
				assert.Equal(t, index, result.Results[i].Index)
				if tc.returnDocs {
					assert.Equal(t, map[string]any{"text": "Chengdu"}, result.Results[i].Document)
				} else {
					assert.Nil(t, result.Results[i].Document)
				}
			}
		})
	}
}

func TestTEIRerankRejectsInvalidInput(t *testing.T) {
	for _, tc := range []struct {
		name    string
		request dto.RerankRequest
	}{
		{name: "empty query", request: dto.RerankRequest{Documents: []any{"text"}}},
		{name: "empty candidates", request: dto.RerankRequest{Query: "query"}},
		{name: "object candidate", request: dto.RerankRequest{Query: "query", Documents: []any{map[string]any{"text": "text"}}}},
		{name: "negative top_n", request: dto.RerankRequest{Query: "query", Documents: []any{"text"}, TopN: new(-1)}},
		{name: "unsupported chunking even explicit zero", request: dto.RerankRequest{Query: "query", Documents: []any{"text"}, MaxChunkPerDoc: new(0)}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := (&Adaptor{}).ConvertRerankRequest(nil, relayconstant.RelayModeRerank, tc.request)
			var apiErr *types.NewAPIError
			require.ErrorAs(t, err, &apiErr)
			assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
		})
	}
	_, err := (&Adaptor{}).DoRequest(nil, nil, nil)
	require.ErrorContains(t, err, "pass-through")
}

func TestTEIRerankRejectsMalformedResponseAndMarksEstimatedUsage(t *testing.T) {
	for _, tc := range []struct {
		name   string
		body   string
		header string
		bad    bool
	}{
		{name: "null", body: `null`, bad: true},
		{name: "missing candidate", body: `[{"index":0,"score":0.1}]`, bad: true},
		{name: "duplicate index", body: `[{"index":0,"score":0.1},{"index":0,"score":0.2}]`, bad: true},
		{name: "index out of bounds", body: `[{"index":0,"score":0.1},{"index":2,"score":0.2}]`, bad: true},
		{name: "missing score", body: `[{"index":0},{"index":1,"score":0.2}]`, bad: true},
		{name: "nonfinite score", body: `[{"index":0,"score":1e999},{"index":1,"score":0.2}]`, bad: true},
		{name: "missing usage", body: `[{"index":0,"score":0.1},{"index":1,"score":0.2}]`},
		{name: "invalid usage", body: `[{"index":0,"score":0.1},{"index":1,"score":0.2}]`, header: "-1"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			info := &relaycommon.RelayInfo{}
			info.SetEstimatePromptTokens(23)
			adaptor := &Adaptor{documents: []string{"a", "b"}}
			resp := &http.Response{Body: io.NopCloser(strings.NewReader(tc.body)), Header: http.Header{}}
			resp.Header.Set("x-compute-tokens", tc.header)
			usage, apiErr := adaptor.DoResponse(c, resp, info)
			if tc.bad {
				require.NotNil(t, apiErr)
				assert.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
				return
			}
			require.Nil(t, apiErr)
			assert.Equal(t, "estimated", usage.(*dto.Usage).UsageSource)
			assert.Equal(t, 23, usage.(*dto.Usage).TotalTokens)
		})
	}
}

func TestTEIRerankURLAndUpstreamAuthentication(t *testing.T) {
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}, RelayMode: relayconstant.RelayModeRerank}
	adaptor := &Adaptor{}
	for _, base := range []string{"https://inference.example/prefix", "https://inference.example/prefix/rerank/"} {
		info.ChannelBaseUrl = base
		got, err := adaptor.GetRequestURL(info)
		require.NoError(t, err)
		assert.Equal(t, "https://inference.example/prefix/rerank", got)
	}
	info.ChannelBaseUrl = "https://inference.example?token=secret"
	_, err := adaptor.GetRequestURL(info)
	require.Error(t, err)
	info.RelayMode = relayconstant.RelayModeChatCompletions
	_, err = adaptor.GetRequestURL(info)
	require.Error(t, err)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/rerank", nil)
	info.ApiKey = "upstream-key"
	header := http.Header{}
	require.NoError(t, adaptor.SetupRequestHeader(c, &header, info))
	assert.Equal(t, "Bearer upstream-key", header.Get("Authorization"))
	info.ApiKey = "EMPTY"
	require.NoError(t, adaptor.SetupRequestHeader(c, &header, info))
	assert.Empty(t, header.Get("Authorization"))
}

// Run explicitly against a TEI sequence-classification deployment. The default
// unit suite remains independent of models, GPU hardware and external services.
func TestTEIRerankLive(t *testing.T) {
	base := os.Getenv("TEI_RERANK_BASE_URL")
	if base == "" {
		t.Skip("set TEI_RERANK_BASE_URL to exercise a real TEI reranker")
	}
	service.InitHttpClient()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/rerank", nil)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: base, ApiKey: os.Getenv("TEI_RERANK_API_KEY")}, RelayMode: relayconstant.RelayModeRerank, IsChannelTest: true}
	adaptor := &Adaptor{}
	adaptor.Init(info)
	request := dto.RerankRequest{Model: "bge-reranker-v2-m3", Query: "What is the capital of France?", Documents: []any{"An apple is a fruit.", "Paris is the capital of France."}, TopN: new(1), ReturnDocuments: new(true)}
	converted, err := adaptor.ConvertRerankRequest(c, info.RelayMode, request)
	require.NoError(t, err)
	body, err := common.Marshal(converted)
	require.NoError(t, err)
	raw, err := adaptor.DoRequest(c, info, bytes.NewReader(body))
	require.NoError(t, err)
	resp := raw.(*http.Response)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	usage, apiErr := adaptor.DoResponse(c, resp, info)
	require.Nil(t, apiErr)
	var result dto.RerankResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
	require.Len(t, result.Results, 1)
	assert.Equal(t, 1, result.Results[0].Index)
	assert.Equal(t, map[string]any{"text": request.Documents[1]}, result.Results[0].Document)
	assert.Equal(t, "upstream", usage.(*dto.Usage).UsageSource)
	assert.Positive(t, usage.(*dto.Usage).TotalTokens)
	assert.Zero(t, usage.(*dto.Usage).CompletionTokens)
	t.Logf("native TEI response -> results=%d, first_index=%d, total_tokens=%d, usage_source=%s", len(result.Results), result.Results[0].Index, result.Usage.TotalTokens, result.Usage.UsageSource)
}
