package claude

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func TestOutputConfig_BareModelPassthrough(t *testing.T) {
	req := dto.GeneralOpenAIRequest{
		Model:        "claude-opus-4-7",
		Messages:     []dto.Message{{Role: "user", Content: "hi"}},
		OutputConfig: json.RawMessage(`{"task_budget":{"type":"tokens","total":50000}}`),
	}
	cr, err := RequestOpenAI2ClaudeMessage(nil, req)
	require.NoError(t, err)
	var m map[string]any
	require.NoError(t, json.Unmarshal(cr.OutputConfig, &m))
	tb, ok := m["task_budget"].(map[string]any)
	require.True(t, ok, "task_budget should pass through on bare model")
	require.Equal(t, "tokens", tb["type"])
	require.Equal(t, float64(50000), tb["total"])
}

func TestOutputConfig_SuffixMergesEffort(t *testing.T) {
	req := dto.GeneralOpenAIRequest{
		Model:        "claude-opus-4-7-xhigh",
		Messages:     []dto.Message{{Role: "user", Content: "hi"}},
		OutputConfig: json.RawMessage(`{"task_budget":{"type":"tokens","total":50000}}`),
	}
	cr, err := RequestOpenAI2ClaudeMessage(nil, req)
	require.NoError(t, err)
	require.Equal(t, "claude-opus-4-7", cr.Model, "suffix should be stripped")
	var m map[string]any
	require.NoError(t, json.Unmarshal(cr.OutputConfig, &m))
	require.Equal(t, "xhigh", m["effort"], "effort should be set from suffix")
	tb, ok := m["task_budget"].(map[string]any)
	require.True(t, ok, "task_budget should survive suffix merge")
	require.Equal(t, float64(50000), tb["total"])
}

func TestOutputConfig_SuffixNoOutputConfig(t *testing.T) {
	req := dto.GeneralOpenAIRequest{
		Model:    "claude-opus-4-6-high",
		Messages: []dto.Message{{Role: "user", Content: "hi"}},
	}
	cr, err := RequestOpenAI2ClaudeMessage(nil, req)
	require.NoError(t, err)
	var m map[string]any
	require.NoError(t, json.Unmarshal(cr.OutputConfig, &m))
	require.Equal(t, "high", m["effort"])
	require.Len(t, m, 1, "only effort should be present when no user output_config")
}

func TestOutputConfig_ThinkingSuffix47Merge(t *testing.T) {
	req := dto.GeneralOpenAIRequest{
		Model:        "claude-opus-4-7-thinking",
		Messages:     []dto.Message{{Role: "user", Content: "hi"}},
		OutputConfig: json.RawMessage(`{"task_budget":{"type":"tokens","total":30000}}`),
	}
	cr, err := RequestOpenAI2ClaudeMessage(nil, req)
	require.NoError(t, err)
	var m map[string]any
	require.NoError(t, json.Unmarshal(cr.OutputConfig, &m))
	require.Equal(t, "high", m["effort"], "thinking suffix should set effort=high for 4.7")
	_, ok := m["task_budget"]
	require.True(t, ok, "task_budget should survive thinking merge")
}
