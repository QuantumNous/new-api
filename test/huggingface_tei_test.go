package test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"one-api/dto"
	"one-api/relay/channel/huggingface"
	relaycommon "one-api/relay/common"
	relayconstant "one-api/relay/constant"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestHuggingFaceRerankRequest(t *testing.T) {
	// 测试重排序请求转换
	rerankRequest := dto.RerankRequest{
		Query: "What is the capital of France?",
		Documents: []any{
			"Paris is the capital of France.",
			"London is the capital of England.",
			"Berlin is the capital of Germany.",
		},
		Model: "BAAI/bge-reranker-v2-m3",
		TopN:  2,
	}

	adaptor := &huggingface.Adaptor{}
	converted, err := adaptor.ConvertRerankRequest(nil, 0, rerankRequest)
	
	assert.NoError(t, err)
	assert.NotNil(t, converted)
	
	hfRequest, ok := converted.(*huggingface.HuggingFaceTEIRerankRequest)
	assert.True(t, ok)
	assert.Equal(t, "What is the capital of France?", hfRequest.Query)
	assert.Len(t, hfRequest.Texts, 3)
	assert.Equal(t, "Paris is the capital of France.", hfRequest.Texts[0])
	assert.True(t, hfRequest.Truncate)
	assert.False(t, hfRequest.RawScores)
}

func TestHuggingFaceEmbeddingRequest(t *testing.T) {
	// 测试嵌入请求转换
	embeddingRequest := dto.EmbeddingRequest{
		Input: []any{
			"Hello world",
			"How are you?",
		},
		Model: "sentence-transformers/all-MiniLM-L6-v2",
	}

	adaptor := &huggingface.Adaptor{}
	converted, err := adaptor.ConvertEmbeddingRequest(nil, nil, embeddingRequest)
	
	assert.NoError(t, err)
	assert.NotNil(t, converted)
	
	hfRequest, ok := converted.(*huggingface.HuggingFaceEmbeddingRequest)
	assert.True(t, ok)
	assert.Len(t, hfRequest.Inputs, 2)
	assert.Equal(t, "Hello world", hfRequest.Inputs[0])
	assert.Equal(t, "How are you?", hfRequest.Inputs[1])
	assert.True(t, hfRequest.Truncate)
	assert.True(t, hfRequest.Normalize)
}

func TestHuggingFaceAdaptorGetRequestURL(t *testing.T) {
	adaptor := &huggingface.Adaptor{}
	
	// 测试重排序URL
	info := &relaycommon.RelayInfo{
		BaseUrl:   "http://localhost:8080",
		RelayMode: relayconstant.RelayModeRerank,
	}
	url, err := adaptor.GetRequestURL(info)
	assert.NoError(t, err)
	assert.Equal(t, "http://localhost:8080/rerank", url)
	
	// 测试嵌入URL
	info.RelayMode = relayconstant.RelayModeEmbeddings
	url, err = adaptor.GetRequestURL(info)
	assert.NoError(t, err)
	assert.Equal(t, "http://localhost:8080/embed", url)
	
	// 测试不支持的模式
	info.RelayMode = 999
	_, err = adaptor.GetRequestURL(info)
	assert.Error(t, err)
}

func TestHuggingFaceAdaptorModelList(t *testing.T) {
	adaptor := &huggingface.Adaptor{}
	models := adaptor.GetModelList()
	
	assert.NotEmpty(t, models)
	assert.Contains(t, models, "BAAI/bge-reranker-v2-m3")
	assert.Contains(t, models, "jinaai/jina-reranker-v2-base-multilingual")
}

func TestHuggingFaceAdaptorChannelName(t *testing.T) {
	adaptor := &huggingface.Adaptor{}
	name := adaptor.GetChannelName()
	
	assert.Equal(t, "huggingface", name)
}

func TestHuggingFaceRerankDocumentFormats(t *testing.T) {
	// 测试不同格式的文档
	testCases := []struct {
		name      string
		documents []any
		expected  []string
	}{
		{
			name:      "string documents",
			documents: []any{"doc1", "doc2", "doc3"},
			expected:  []string{"doc1", "doc2", "doc3"},
		},
		{
			name: "map documents with text field",
			documents: []any{
				map[string]interface{}{"text": "doc1"},
				map[string]interface{}{"text": "doc2"},
			},
			expected: []string{"doc1", "doc2"},
		},
		{
			name: "map documents with content field",
			documents: []any{
				map[string]interface{}{"content": "doc1"},
				map[string]interface{}{"content": "doc2"},
			},
			expected: []string{"doc1", "doc2"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			rerankRequest := dto.RerankRequest{
				Query:     "test query",
				Documents: tc.documents,
				Model:     "test-model",
			}

			adaptor := &huggingface.Adaptor{}
			converted, err := adaptor.ConvertRerankRequest(nil, 0, rerankRequest)
			
			assert.NoError(t, err)
			hfRequest := converted.(*huggingface.HuggingFaceTEIRerankRequest)
			assert.Equal(t, tc.expected, hfRequest.Texts)
		})
	}
}

// TestHuggingFaceRerankHandler 测试重排序响应处理
func TestHuggingFaceRerankHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// 模拟TEI重排序响应
	mockResponse := `[
		{"index": 0, "score": 0.95},
		{"index": 2, "score": 0.12},
		{"index": 1, "score": 0.08}
	]`

	// 创建模拟HTTP响应
	recorder := httptest.NewRecorder()
	recorder.Header().Set("Content-Type", "application/json")
	recorder.WriteString(mockResponse)
	recorder.Code = http.StatusOK

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     recorder.Header(),
		Body:       io.NopCloser(strings.NewReader(mockResponse)),
	}

	// 创建RelayInfo
	info := &relaycommon.RelayInfo{
		PromptTokens: 10,
		RelayMode:    relayconstant.RelayModeRerank,
		RerankerInfo: &relaycommon.RerankerInfo{
			ReturnDocuments: true,
			Documents: []any{
				"Paris is the capital of France.",
				"London is the capital of England.",
				"Berlin is the capital of Germany.",
			},
		},
	}

	// 创建Gin上下文
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	// 调用处理函数
	adaptor := &huggingface.Adaptor{}
	usage, openaiErr := adaptor.DoResponse(c, resp, info)

	assert.Nil(t, openaiErr)
	assert.NotNil(t, usage)

	// 检查响应
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")

	// 解析响应
	var rerankResp dto.RerankResponse
	err := json.Unmarshal(w.Body.Bytes(), &rerankResp)
	assert.NoError(t, err)

	// 验证结果按相关性分数排序
	assert.Len(t, rerankResp.Results, 3)
	assert.Equal(t, 0, rerankResp.Results[0].Index)
	assert.Equal(t, 0.95, rerankResp.Results[0].RelevanceScore)
	assert.Equal(t, "Paris is the capital of France.", rerankResp.Results[0].Document)
}

// TestHuggingFaceEmbeddingHandler 测试嵌入响应处理
func TestHuggingFaceEmbeddingHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// 模拟TEI嵌入响应
	mockResponse := `[
		[0.1, 0.2, 0.3, 0.4],
		[0.5, 0.6, 0.7, 0.8]
	]`

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(mockResponse)),
	}

	info := &relaycommon.RelayInfo{
		PromptTokens:      5,
		UpstreamModelName: "test-model",
		RelayMode:         relayconstant.RelayModeEmbeddings,
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	adaptor := &huggingface.Adaptor{}
	usage, openaiErr := adaptor.DoResponse(c, resp, info)

	assert.Nil(t, openaiErr)
	assert.NotNil(t, usage)
	assert.Equal(t, http.StatusOK, w.Code)

	var embeddingResp dto.OpenAIEmbeddingResponse
	err := json.Unmarshal(w.Body.Bytes(), &embeddingResp)
	assert.NoError(t, err)

	assert.Equal(t, "list", embeddingResp.Object)
	assert.Equal(t, "test-model", embeddingResp.Model)
	assert.Len(t, embeddingResp.Data, 2)
	assert.Equal(t, []float64{0.1, 0.2, 0.3, 0.4}, embeddingResp.Data[0].Embedding)
}

// TestHuggingFaceSetupRequestHeader 测试请求头设置
func TestHuggingFaceSetupRequestHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	adaptor := &huggingface.Adaptor{}

	// 测试带API密钥的情况
	info := &relaycommon.RelayInfo{
		ApiKey:      "test-api-key",
		ChannelType: 50, // HuggingFace channel type
		RelayMode:   relayconstant.RelayModeRerank,
	}

	req := &http.Header{}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	// 设置请求头，模拟真实请求
	c.Request, _ = http.NewRequest("POST", "/rerank", nil)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Request.Header.Set("Accept", "application/json")

	err := adaptor.SetupRequestHeader(c, req, info)
	assert.NoError(t, err)
	assert.Equal(t, "application/json", req.Get("Content-Type"))
	assert.Equal(t, "Bearer test-api-key", req.Get("Authorization"))

	// 测试无API密钥的情况
	info.ApiKey = ""
	req2 := &http.Header{}
	err = adaptor.SetupRequestHeader(c, req2, info)
	assert.NoError(t, err)
	assert.Equal(t, "application/json", req2.Get("Content-Type"))
	assert.Empty(t, req2.Get("Authorization"))
}
