// Package tei adapts Hugging Face Text Embeddings Inference's native rerank API.
package tei

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// Adaptor converts unified rerank requests and TEI responses. Each relay attempt
// owns its candidate documents and top_n limit; callers must not share an instance.
type Adaptor struct {
	openai.Adaptor
	documents       []string
	topN            *int
	returnDocuments bool
	converted       bool
}

var _ channel.Adaptor = (*Adaptor)(nil)

// rerankRequest is TEI's native request body. TEI scores every text; the adaptor
// applies the public top_n limit after receiving all scores.
type rerankRequest struct {
	Query      string   `json:"query"`
	Texts      []string `json:"texts"`
	ReturnText bool     `json:"return_text"`
	Truncate   bool     `json:"truncate"`
	RawScores  bool     `json:"raw_scores"`
}

// Init initializes the embedded adaptor and clears state from any prior attempt.
func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.Adaptor.Init(info)
	a.documents = nil
	a.topN = nil
	a.returnDocuments = false
	a.converted = false
}

// GetRequestURL validates the configured HTTP(S) base URL and appends /rerank
// unless already present. Other relay modes are rejected.
func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.RelayMode != relayconstant.RelayModeRerank {
		return "", errors.New("TEI channels only support rerank requests")
	}
	base, err := url.Parse(strings.TrimSpace(info.ChannelBaseUrl))
	if err != nil || base == nil || (base.Scheme != "http" && base.Scheme != "https") || base.Host == "" || base.User != nil || base.RawQuery != "" || base.Fragment != "" {
		return "", errors.New("TEI requires an HTTP(S) base URL without credentials, query or fragment")
	}
	base.Path = strings.TrimRight(base.Path, "/")
	if !strings.HasSuffix(base.Path, "/rerank") {
		base.Path += "/rerank"
	}
	base.RawPath = ""
	return base.String(), nil
}

// SetupRequestHeader selects JSON transport and adds the channel's bearer key
// when configured. Empty keys and EMPTY never become upstream credentials.
func (a *Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, header)
	header.Set("Content-Type", "application/json")
	header.Set("Accept", "application/json")
	header.Del("Authorization")
	// EMPTY follows the console convention for self-hosted, unauthenticated
	// inference servers. It is never sent upstream as a bearer credential.
	if info.ApiKey != "" && info.ApiKey != "EMPTY" {
		header.Set("Authorization", "Bearer "+info.ApiKey)
	}
	return nil
}

// invalidRequest creates a non-retryable HTTP 400 error without candidate text.
func invalidRequest(message string, args ...any) error {
	return types.NewErrorWithStatusCode(fmt.Errorf(message, args...), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
}

// ConvertRerankRequest validates supported inputs and maps documents to TEI texts.
// It retains original indices and response options for local result processing.
func (a *Adaptor) ConvertRerankRequest(_ *gin.Context, mode int, request dto.RerankRequest) (any, error) {
	a.converted = false
	if mode != relayconstant.RelayModeRerank {
		return nil, invalidRequest("TEI channels only support rerank requests")
	}
	if strings.TrimSpace(request.Query) == "" || len(request.Documents) == 0 {
		return nil, invalidRequest("query and documents must not be empty")
	}
	if request.TopN != nil && *request.TopN < 0 {
		return nil, invalidRequest("top_n must be non-negative")
	}
	if request.MaxChunkPerDoc != nil || request.OverLapTokens != nil {
		return nil, invalidRequest("TEI does not support max_chunk_per_doc or overlap_tokens")
	}
	documents := make([]string, len(request.Documents))
	for i, value := range request.Documents {
		text, ok := value.(string)
		if !ok {
			return nil, invalidRequest("TEI documents[%d] must be a string", i)
		}
		documents[i] = text
	}
	a.documents = documents
	a.topN = request.TopN
	a.returnDocuments = request.GetReturnDocuments()
	a.converted = true
	// TEI has no top_n parameter. Score all documents, then trim locally. Never
	// silently truncate an over-length query/document pair in the upstream.
	return rerankRequest{Query: request.Query, Texts: documents, ReturnText: a.returnDocuments, Truncate: false, RawScores: false}, nil
}

// DoRequest rejects body pass-through and candidate changes made by parameter
// overrides before invoking TEI, preserving the original document-index mapping.
func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, body io.Reader) (any, error) {
	if !a.converted {
		return nil, invalidRequest("TEI rerank requires request conversion; disable request body pass-through")
	}
	if len(info.ParamOverride) > 0 {
		// Overrides have already run. TEI indices refer to the final texts,
		// while the public response must still identify the original documents.
		// Read a separate cursor so disk-backed bodies keep their size/replay
		// metadata and remain owned by the caller through the HTTP request.
		var reader io.Reader
		if replayable, ok := body.(common.ReplayableBody); ok {
			copy, err := replayable.NewReader()
			if err != nil {
				return nil, invalidRequest("failed to read final TEI request")
			}
			defer copy.Close()
			reader = copy
		} else {
			data, err := io.ReadAll(body)
			if err != nil {
				return nil, invalidRequest("failed to read final TEI request")
			}
			reader = bytes.NewReader(data)
			body = bytes.NewReader(data)
		}
		// Match the exact TEI field name; JSON struct decoding would also
		// accept "Texts", which TEI does not recognize as "texts".
		var fields map[string]common.RawMessage
		var texts []string
		if err := common.DecodeJson(reader, &fields); err != nil {
			return nil, invalidRequest("invalid final TEI request")
		}
		if err := common.Unmarshal(fields["texts"], &texts); err != nil || !slices.Equal(texts, a.documents) {
			return nil, invalidRequest("TEI parameter overrides must preserve texts content, count and order")
		}
	}
	return channel.DoApiRequest(a, c, info, body)
}

// DoResponse validates TEI's complete score array, sorts and trims results, and
// restores requested documents by index. Usage covers all scored pairs, using
// x-compute-tokens when valid or the marked input estimate, with no output tokens.
func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)
	const maxResponseBytes = 8 << 20
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes+1))
	if err != nil || len(data) > maxResponseBytes {
		return nil, types.NewOpenAIError(errors.New("failed to read TEI rerank response or response exceeds 8 MiB"), types.ErrorCodeReadResponseBodyFailed, http.StatusBadGateway)
	}
	var ranks []struct {
		Index *int     `json:"index"`
		Score *float64 `json:"score"`
	}
	if err := common.Unmarshal(data, &ranks); err != nil || ranks == nil || len(ranks) != len(a.documents) {
		return nil, types.NewOpenAIError(errors.New("invalid or incomplete TEI rerank response"), types.ErrorCodeBadResponseBody, http.StatusBadGateway)
	}
	results := make([]dto.RerankResponseResult, 0, len(ranks))
	seen := make([]bool, len(a.documents))
	for _, rank := range ranks {
		if rank.Index == nil || rank.Score == nil || *rank.Index < 0 || *rank.Index >= len(a.documents) || seen[*rank.Index] || math.IsNaN(*rank.Score) || math.IsInf(*rank.Score, 0) {
			return nil, types.NewOpenAIError(errors.New("invalid TEI rerank index or score"), types.ErrorCodeBadResponseBody, http.StatusBadGateway)
		}
		seen[*rank.Index] = true
		item := dto.RerankResponseResult{Index: *rank.Index, RelevanceScore: *rank.Score}
		if a.returnDocuments {
			item.Document = dto.RerankDocument{Text: a.documents[*rank.Index]}
		}
		results = append(results, item)
	}
	slices.SortStableFunc(results, func(x, y dto.RerankResponseResult) int {
		switch {
		case x.RelevanceScore > y.RelevanceScore:
			return -1
		case x.RelevanceScore < y.RelevanceScore:
			return 1
		default:
			return 0
		}
	})
	if a.topN != nil {
		results = results[:min(*a.topN, len(results))]
	}

	// This is the sum over every query/document pair, including candidates
	// omitted by top_n. Reranking does not generate completion tokens.
	tokens, err := strconv.Atoi(resp.Header.Get("x-compute-tokens"))
	source := "upstream"
	if err != nil || tokens < 0 {
		tokens = info.GetEstimatePromptTokens()
		source = "estimated"
	}
	usage := dto.Usage{PromptTokens: tokens, TotalTokens: tokens, UsageSource: source}
	c.JSON(http.StatusOK, dto.RerankResponse{Results: results, Usage: usage})
	return &usage, nil
}

// GetModelList provides common model aliases, not discovery of the TEI deployment.
func (a *Adaptor) GetModelList() []string {
	return []string{"bge-reranker-v2-m3", "BAAI/bge-reranker-v2-m3"}
}

// GetChannelName identifies this adaptor to the gateway.
func (a *Adaptor) GetChannelName() string { return "TEI" }
