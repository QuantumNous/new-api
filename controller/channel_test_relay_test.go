package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// detectTestRelayFromModel must classify rerank models (including ones whose
// name also matches the "bge-" embedding heuristic) as rerank, not embedding.
// Regression test for https://github.com/QuantumNous/new-api/issues/7177.
func TestDetectTestRelayFromModelRerankNotEmbedding(t *testing.T) {
	tests := []struct {
		name        string
		model       string
		channelType int
		wantPath    string
		wantFormat  types.RelayFormat
	}{
		{
			// The exact case from issue #7177: bge-reranker-v2-m3 was wrongly
			// classified as embedding because "bge-" matched the embedding heuristic.
			name:        "bge-reranker-v2-m3 is rerank not embedding",
			model:       "bge-reranker-v2-m3",
			channelType: constant.ChannelTypeCustom,
			wantPath:    "/v1/rerank",
			wantFormat:  types.RelayFormatRerank,
		},
		{
			name:        "BAAI/bge-reranker-base is rerank",
			model:       "BAAI/bge-reranker-base",
			channelType: constant.ChannelTypeCustom,
			wantPath:    "/v1/rerank",
			wantFormat:  types.RelayFormatRerank,
		},
		{
			name:        "Qwen3-Reranker-8B is rerank",
			model:       "Qwen3-Reranker-8B",
			channelType: constant.ChannelTypeCustom,
			wantPath:    "/v1/rerank",
			wantFormat:  types.RelayFormatRerank,
		},
		{
			name:        "plain embedding model is embedding",
			model:       "text-embedding-3-small",
			channelType: constant.ChannelTypeCustom,
			wantPath:    "/v1/embeddings",
			wantFormat:  types.RelayFormatEmbedding,
		},
		{
			// An actual bge embedding model must remain embedding.
			name:        "BAAI/bge-large-zh is embedding",
			model:       "BAAI/bge-large-zh",
			channelType: constant.ChannelTypeCustom,
			wantPath:    "/v1/embeddings",
			wantFormat:  types.RelayFormatEmbedding,
		},
		{
			name:        "m3e series is embedding",
			model:       "m3e-base",
			channelType: constant.ChannelTypeCustom,
			wantPath:    "/v1/embeddings",
			wantFormat:  types.RelayFormatEmbedding,
		},
		{
			name:        "MokaAI channel falls back to embedding",
			model:       "my-model",
			channelType: constant.ChannelTypeMokaAI,
			wantPath:    "/v1/embeddings",
			wantFormat:  types.RelayFormatEmbedding,
		},
		{
			name:        "seedream on VolcEngine is image generation",
			model:       "seedream-4-0",
			channelType: constant.ChannelTypeVolcEngine,
			wantPath:    "/v1/images/generations",
			wantFormat:  types.RelayFormatOpenAIImage,
		},
		{
			name:        "codex is responses",
			model:       "gpt-5-codex",
			channelType: constant.ChannelTypeCustom,
			wantPath:    "/v1/responses",
			wantFormat:  types.RelayFormatOpenAIResponses,
		},
		{
			name:        "plain chat model is chat completions",
			model:       "gpt-4o-mini",
			channelType: constant.ChannelTypeCustom,
			wantPath:    "/v1/chat/completions",
			wantFormat:  types.RelayFormatOpenAI,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotPath, gotFormat := detectTestRelayFromModel(tt.model, tt.channelType)
			assert.Equal(t, tt.wantPath, gotPath, "request path for model %q", tt.model)
			assert.Equal(t, tt.wantFormat, gotFormat, "relay format for model %q", tt.model)
		})
	}
}

// buildTestRequest must build a RerankRequest for bge rerank models so that the
// request type matches the relay mode chosen by detectTestRelayFromModel.
func TestBuildTestRequestRerankModelType(t *testing.T) {
	channel := &model.Channel{ /* empty */ }

	req := buildTestRequest("bge-reranker-v2-m3", "", channel, false)
	_, ok := req.(*dto.RerankRequest)
	require.True(t, ok, "bge-reranker-v2-m3 should build a RerankRequest, got %T", req)

	reqEmbed := buildTestRequest("BAAI/bge-large-zh", "", channel, false)
	_, okEmbed := reqEmbed.(*dto.EmbeddingRequest)
	require.True(t, okEmbed, "BAAI/bge-large-zh should build an EmbeddingRequest, got %T", reqEmbed)
}
