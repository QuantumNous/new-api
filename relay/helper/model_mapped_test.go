package helper

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newModelMappingContext(mapping string) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	if mapping != "" {
		c.Set("model_mapping", mapping)
	}
	return c
}

func TestModelMappedHelper_ClaudeAdvisorToolRawJSON(t *testing.T) {
	rawReq := `{
		"model": "ce/claude-opus-5-5",
		"max_tokens": 1024,
		"tools": [
			{
				"name": "bash",
				"input_schema": {
					"type": "object",
					"properties": {
						"z_second": {"type": "string"},
						"a_first": {"type": "string"}
					}
				}
			},
			{
				"type": "advisor_20260301",
				"name": "advisor",
				"model": "ld/claude-fable-5-2"
			}
		]
	}`

	var req dto.ClaudeRequest
	require.NoError(t, json.Unmarshal([]byte(rawReq), &req))

	c := newModelMappingContext(`{
		"ce/claude-opus-5-5": "claude-opus-4-6",
		"ld/claude-fable-5-2": "claude-sonnet-alias",
		"claude-sonnet-alias": "claude-sonnet-4-6"
	}`)
	info := &relaycommon.RelayInfo{
		OriginModelName: "ce/claude-opus-5-5",
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "ce/claude-opus-5-5"},
	}

	require.NoError(t, ModelMappedHelper(c, info, &req))
	assert.True(t, info.IsModelMapped)
	assert.Equal(t, "claude-opus-4-6", info.UpstreamModelName)
	assert.Equal(t, "claude-opus-4-6", req.Model)

	rawTools, ok := req.Tools.(json.RawMessage)
	require.True(t, ok, "expected Tools to remain json.RawMessage")
	toolsStr := string(rawTools)
	assert.Contains(t, toolsStr, `"model": "claude-sonnet-4-6"`)
	assert.NotContains(t, toolsStr, `ld/claude-fable-5-2`)
	// Verify strict tool schema property ordering is preserved.
	assert.Less(t, strings.Index(toolsStr, `"z_second"`), strings.Index(toolsStr, `"a_first"`))
}

func TestModelMappedHelper_ClaudeSelfMappedTopLevelStillMapsTools(t *testing.T) {
	rawReq := `{
		"model": "claude-opus-4-6",
		"tools": [
			{"type": "advisor_20260301", "name": "advisor", "model": "ld/claude-fable-5-2"}
		]
	}`

	var req dto.ClaudeRequest
	require.NoError(t, json.Unmarshal([]byte(rawReq), &req))

	c := newModelMappingContext(`{
		"claude-opus-4-6": "claude-opus-4-6",
		"ld/claude-fable-5-2": "claude-sonnet-4-6"
	}`)
	info := &relaycommon.RelayInfo{
		OriginModelName: "claude-opus-4-6",
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "claude-opus-4-6"},
	}

	require.NoError(t, ModelMappedHelper(c, info, &req))
	assert.False(t, info.IsModelMapped)
	assert.Equal(t, "claude-opus-4-6", req.Model)

	rawTools, ok := req.Tools.(json.RawMessage)
	require.True(t, ok)
	assert.Contains(t, string(rawTools), `"model": "claude-sonnet-4-6"`)
}

func TestModelMappedHelper_ClaudeAdvisorToolSliceAny(t *testing.T) {
	req := &dto.ClaudeRequest{
		Model: "ce/claude-opus-5-5",
		Tools: []any{
			map[string]any{"name": "bash"},
			map[string]any{"type": "advisor_20260301", "name": "advisor", "model": "ld/claude-fable-5-2"},
			json.RawMessage(`{"type":"advisor_20260301","name":"advisor2","model":"ld/claude-fable-5-2"}`),
		},
	}

	c := newModelMappingContext(`{
		"ce/claude-opus-5-5": "claude-opus-4-6",
		"ld/claude-fable-5-2": "claude-sonnet-4-6"
	}`)
	info := &relaycommon.RelayInfo{
		OriginModelName: "ce/claude-opus-5-5",
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "ce/claude-opus-5-5"},
	}

	require.NoError(t, ModelMappedHelper(c, info, req))
	tools, ok := req.Tools.([]any)
	require.True(t, ok)
	assert.Equal(t, "claude-sonnet-4-6", tools[1].(map[string]any)["model"])
	assert.Contains(t, string(tools[2].(json.RawMessage)), `"model":"claude-sonnet-4-6"`)
}

func TestModelMappedHelper_OpenAIResponsesTools(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Model: "ce/gpt-5",
		Tools: json.RawMessage(`[
			{"type":"web_search"},
			{"type":"image_generation","model":"ce/gpt-image-1"}
		]`),
	}

	c := newModelMappingContext(`{
		"ce/gpt-5": "gpt-5",
		"ce/gpt-image-1": "gpt-image-1"
	}`)
	info := &relaycommon.RelayInfo{
		OriginModelName: "ce/gpt-5",
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "ce/gpt-5"},
	}

	require.NoError(t, ModelMappedHelper(c, info, req))
	assert.Equal(t, "gpt-5", req.Model)
	assert.Contains(t, string(req.Tools), `"model":"gpt-image-1"`)
	assert.NotContains(t, string(req.Tools), `ce/gpt-image-1`)
}

func TestModelMappedHelper_ToolModelCycleError(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Model: "gpt-5",
		Tools: json.RawMessage(`[{"type":"image_generation","model":"a"}]`),
	}

	c := newModelMappingContext(`{"a": "b", "b": "a"}`)
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-5",
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "gpt-5"},
	}

	err := ModelMappedHelper(c, info, req)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "model_mapping_contains_cycle")
}
