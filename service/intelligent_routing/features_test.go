package intelligent_routing

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
)

func TestExtractFeaturesOpenAIRequests(t *testing.T) {
	tests := []struct {
		name    string
		request *dto.GeneralOpenAIRequest
		task    TaskType
		tier    int
		tools   bool
		json    bool
	}{
		{name: "translation", request: requestWithText("Translate this sentence into Chinese"), task: TaskTranslation, tier: 0},
		{name: "summary", request: requestWithText("Summarize this article"), task: TaskSummary, tier: 1},
		{name: "code", request: requestWithText("Write a Go function that parses a request"), task: TaskCode, tier: 2},
		{name: "tool", request: &dto.GeneralOpenAIRequest{Messages: []dto.Message{{Role: "user", Content: "weather"}}, Tools: []dto.ToolCallRequest{{Type: "function"}}}, task: TaskTool, tier: 2, tools: true},
		{name: "schema", request: &dto.GeneralOpenAIRequest{Messages: []dto.Message{{Role: "user", Content: "extract fields"}}, ResponseFormat: &dto.ResponseFormat{Type: "json_schema"}}, task: TaskJSON, tier: 2, json: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ExtractFeatures(Input{Request: tt.request, RelayFormat: types.RelayFormatOpenAI, PromptTokens: 120})
			assert.Equal(t, tt.task, got.Task)
			assert.Equal(t, tt.tier, got.MinimumTier)
			assert.Equal(t, tt.tools, got.HasTools)
			assert.Equal(t, tt.json, got.RequiresJSONSchema)
		})
	}
}

func TestDeriveRequirementsCarriesProtocolConstraints(t *testing.T) {
	features := Features{MinimumTier: 2, PromptTokens: 8000, MaxOutputTokens: 2000, HasTools: true, HasImage: true}
	got := DeriveRequirements(features)
	assert.Equal(t, 2, got.MinimumTier)
	assert.Equal(t, 10000, got.ContextNeeded)
	assert.True(t, got.Capabilities[CapabilityTools])
	assert.True(t, got.Capabilities[CapabilityVision])
}

func requestWithText(text string) *dto.GeneralOpenAIRequest {
	return &dto.GeneralOpenAIRequest{Messages: []dto.Message{{Role: "user", Content: text}}}
}
