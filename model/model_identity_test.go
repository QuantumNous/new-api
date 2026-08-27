package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolveCanonicalModelName(t *testing.T) {
	tests := []struct {
		name          string
		requestedName string
		aliases       map[string]string
		expected      string
		wantErr       bool
		wantErrIs     error
	}{
		{
			name:          "keeps canonical model name",
			requestedName: "claude-fable-5",
			aliases:       map[string]string{},
			expected:      "claude-fable-5",
		},
		{
			name:          "resolves provider prefixed alias",
			requestedName: "anthropic/claude-fable-5",
			aliases: map[string]string{
				"anthropic/claude-fable-5": "claude-fable-5",
			},
			expected: "claude-fable-5",
		},
		{
			name:          "resolves alias chain",
			requestedName: "openrouter/claude-fable-5",
			aliases: map[string]string{
				"openrouter/claude-fable-5": "anthropic/claude-fable-5",
				"anthropic/claude-fable-5":  "claude-fable-5",
			},
			expected: "claude-fable-5",
		},
		{
			name:          "accepts direct self mapping as terminal",
			requestedName: "claude-fable-5",
			aliases: map[string]string{
				"claude-fable-5": "claude-fable-5",
			},
			expected: "claude-fable-5",
		},
		{
			name:          "accepts terminal self mapping after alias chain",
			requestedName: "anthropic/claude-fable-5",
			aliases: map[string]string{
				"anthropic/claude-fable-5": "claude-fable-5",
				"claude-fable-5":           "claude-fable-5",
			},
			expected: "claude-fable-5",
		},
		{
			name:          "returns error for alias cycle",
			requestedName: "model-a",
			aliases: map[string]string{
				"model-a": "model-b",
				"model-b": "model-a",
			},
			wantErr:   true,
			wantErrIs: ErrModelAliasCycle,
		},
		{
			name:          "returns error for empty model name",
			requestedName: "",
			aliases:       map[string]string{},
			wantErr:       true,
			wantErrIs:     ErrModelNameEmpty,
		},
		{
			name:          "returns error for whitespace-only model name",
			requestedName: "   ",
			aliases:       map[string]string{},
			wantErr:       true,
			wantErrIs:     ErrModelNameEmpty,
		},
		{
			name:          "returns error for empty alias target",
			requestedName: "claude-fable-5",
			aliases: map[string]string{
				"claude-fable-5": "",
			},
			wantErr:   true,
			wantErrIs: ErrModelNameEmpty,
		},
		{
			name:          "returns error for whitespace-only alias chain target",
			requestedName: "anthropic/claude-fable-5",
			aliases: map[string]string{
				"anthropic/claude-fable-5": "claude-fable-5",
				"claude-fable-5":           "   ",
			},
			wantErr:   true,
			wantErrIs: ErrModelNameEmpty,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			canonicalName, err := ResolveCanonicalModelName(tt.requestedName, tt.aliases)

			if tt.wantErr {
				require.Error(t, err)
				if tt.wantErrIs != nil {
					require.ErrorIs(t, err, tt.wantErrIs)
				}
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.expected, canonicalName)
		})
	}
}

func TestNormalizeChannelModel(t *testing.T) {
	tests := []struct {
		name             string
		channelType      int
		upstreamModel    string
		expectedModel    string
		expectedUpstream string
		wantErr          bool
	}{
		{
			name:             "strips OpenRouter provider namespace",
			channelType:      constant.ChannelTypeOpenRouter,
			upstreamModel:    "anthropic/claude-fable-5",
			expectedModel:    "claude-fable-5",
			expectedUpstream: "anthropic/claude-fable-5",
		},
		{
			name:             "keeps official model name",
			channelType:      constant.ChannelTypeAnthropic,
			upstreamModel:    "claude-fable-5",
			expectedModel:    "claude-fable-5",
			expectedUpstream: "claude-fable-5",
		},
		{
			name:             "strips OpenRouter Qwen namespace",
			channelType:      constant.ChannelTypeOpenRouter,
			upstreamModel:    "qwen/qwen3.7-max",
			expectedModel:    "qwen3.7-max",
			expectedUpstream: "qwen/qwen3.7-max",
		},
		{
			name:             "strips vendor namespace and preserves snapshot date",
			channelType:      constant.ChannelTypeOpenRouter,
			upstreamModel:    "openai/gpt-4o-2024-08-06",
			expectedModel:    "gpt-4o-2024-08-06",
			expectedUpstream: "openai/gpt-4o-2024-08-06",
		},
		{
			name:             "strips vendor namespace and preserves model version",
			channelType:      constant.ChannelTypeOpenRouter,
			upstreamModel:    "openai/gpt-4o-v2",
			expectedModel:    "gpt-4o-v2",
			expectedUpstream: "openai/gpt-4o-v2",
		},
		{
			name:             "strips gateway namespace and preserves quantization suffix",
			channelType:      constant.ChannelTypeOpenRouter,
			upstreamModel:    "openrouter/llama-3.1-8b-instruct-q4_k_m",
			expectedModel:    "llama-3.1-8b-instruct-q4_k_m",
			expectedUpstream: "openrouter/llama-3.1-8b-instruct-q4_k_m",
		},
		{
			name:             "strips nested gateway and vendor namespaces",
			channelType:      constant.ChannelTypeOpenRouter,
			upstreamModel:    "openrouter/openai/gpt-4o",
			expectedModel:    "gpt-4o",
			expectedUpstream: "openrouter/openai/gpt-4o",
		},
		{
			name:             "trims surrounding whitespace from canonical model",
			channelType:      constant.ChannelTypeOpenAI,
			upstreamModel:    "  gpt-4o  ",
			expectedModel:    "gpt-4o",
			expectedUpstream: "  gpt-4o  ",
		},
		{
			name:             "normalizes Gemini models resource prefix",
			channelType:      constant.ChannelTypeGemini,
			upstreamModel:    "models/gemini-2.5-pro",
			expectedModel:    "gemini-2.5-pro",
			expectedUpstream: "models/gemini-2.5-pro",
		},
		{
			name:             "preserves models prefix outside Gemini channel",
			channelType:      constant.ChannelTypeOpenAI,
			upstreamModel:    "models/gemini-2.5-pro",
			expectedModel:    "models/gemini-2.5-pro",
			expectedUpstream: "models/gemini-2.5-pro",
		},
		{
			name:             "strips AWS vendor prefix only for AWS channel",
			channelType:      constant.ChannelTypeAws,
			upstreamModel:    "anthropic.claude-3-5-sonnet-20241022-v2:0",
			expectedModel:    "claude-3-5-sonnet-20241022-v2:0",
			expectedUpstream: "anthropic.claude-3-5-sonnet-20241022-v2:0",
		},
		{
			name:             "preserves AWS-shaped ID outside AWS channel",
			channelType:      constant.ChannelTypeOpenAI,
			upstreamModel:    "anthropic.claude-3-5-sonnet-20241022-v2:0",
			expectedModel:    "anthropic.claude-3-5-sonnet-20241022-v2:0",
			expectedUpstream: "anthropic.claude-3-5-sonnet-20241022-v2:0",
		},
		{
			name:          "returns error for empty upstream model",
			channelType:   constant.ChannelTypeOpenRouter,
			upstreamModel: "",
			wantErr:       true,
		},
		{
			name:          "returns error for prefix-only upstream model",
			channelType:   constant.ChannelTypeOpenRouter,
			upstreamModel: "openai/",
			wantErr:       true,
		},
		{
			name:          "returns error for nested-prefix-only upstream model",
			channelType:   constant.ChannelTypeOpenRouter,
			upstreamModel: "openrouter/openai/",
			wantErr:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			canonicalModel, upstreamModel, err := NormalizeChannelModel(tt.channelType, tt.upstreamModel)

			if tt.wantErr {
				require.ErrorIs(t, err, ErrModelNameEmpty)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.expectedModel, canonicalModel)
			require.Equal(t, tt.expectedUpstream, upstreamModel)
		})
	}
}

func TestResolveChannelModelTarget(t *testing.T) {
	tests := []struct {
		name         string
		modelName    string
		modelMapping map[string]string
		expected     string
		wantErrIs    error
	}{
		{
			name:      "resolves terminal target through a mapping chain",
			modelName: "public-model",
			modelMapping: map[string]string{
				"public-model":   "provider-alias",
				"provider-alias": "provider/model-v1",
			},
			expected: "provider/model-v1",
		},
		{
			name:      "accepts a direct self mapping as terminal",
			modelName: "public-model",
			modelMapping: map[string]string{
				"public-model": "public-model",
			},
			expected: "public-model",
		},
		{
			name:      "accepts a terminal self mapping after a chain",
			modelName: "public-model",
			modelMapping: map[string]string{
				"public-model":   "provider-model",
				"provider-model": "provider-model",
			},
			expected: "provider-model",
		},
		{
			name:      "rejects a true mapping cycle",
			modelName: "public-model",
			modelMapping: map[string]string{
				"public-model":   "provider-model",
				"provider-model": "public-model",
			},
			wantErrIs: ErrModelMappingCycle,
		},
		{
			name:      "rejects an empty mapping source",
			modelName: "public-model",
			modelMapping: map[string]string{
				"   ": "provider-model",
			},
			wantErrIs: ErrModelMappingSourceEmpty,
		},
		{
			name:      "rejects an empty mapping target",
			modelName: "public-model",
			modelMapping: map[string]string{
				"public-model": "   ",
			},
			wantErrIs: ErrModelMappingTargetEmpty,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			target, err := ResolveChannelModelTarget(tt.modelName, tt.modelMapping)

			if tt.wantErrIs != nil {
				require.ErrorIs(t, err, tt.wantErrIs)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.expected, target)
		})
	}
}

func TestCanonicalizeChannelModels(t *testing.T) {
	tests := []struct {
		name            string
		models          []string
		existingMapping map[string]string
		expectedModels  []string
		expectedMapping map[string]string
		wantErrIs       error
	}{
		{
			name:   "preserves manual and unrelated mappings",
			models: []string{"anthropic/claude-fable-5", "openai/gpt-4o"},
			existingMapping: map[string]string{
				"anthropic/claude-fable-5": "manual/claude-fable-5",
				"unrelated-model":          "manual/unrelated-model",
			},
			expectedModels: []string{"anthropic/claude-fable-5", "gpt-4o"},
			expectedMapping: map[string]string{
				"anthropic/claude-fable-5": "manual/claude-fable-5",
				"unrelated-model":          "manual/unrelated-model",
				"gpt-4o":                   "openai/gpt-4o",
			},
		},
		{
			name:            "generates canonical to upstream mapping",
			models:          []string{"anthropic/claude-fable-5"},
			expectedModels:  []string{"claude-fable-5"},
			expectedMapping: map[string]string{"claude-fable-5": "anthropic/claude-fable-5"},
		},
		{
			name:            "deduplicates identical canonical upstream pairs",
			models:          []string{"openai/gpt-4o", " openai/gpt-4o "},
			expectedModels:  []string{"gpt-4o"},
			expectedMapping: map[string]string{"gpt-4o": "openai/gpt-4o"},
		},
		{
			name:            "preserves unknown upstream suffixes",
			models:          []string{"openai/gpt-4o-2024-08-06:0-q4_k_m"},
			expectedModels:  []string{"gpt-4o-2024-08-06:0-q4_k_m"},
			expectedMapping: map[string]string{"gpt-4o-2024-08-06:0-q4_k_m": "openai/gpt-4o-2024-08-06:0-q4_k_m"},
		},
		{
			name:      "rejects empty model",
			models:    []string{"   "},
			wantErrIs: ErrModelNameEmpty,
		},
		{
			name:      "rejects canonical collision",
			models:    []string{"openai/gpt-4o", "openrouter/openai/gpt-4o"},
			wantErrIs: ErrCanonicalModelCollision,
		},
		{
			name:            "rejects conflicting existing mapping",
			models:          []string{"openai/gpt-4o"},
			existingMapping: map[string]string{"gpt-4o": "manual/gpt-4o"},
			wantErrIs:       ErrModelMappingConflict,
		},
		{
			name:   "preserves an existing mapping chain with the same terminal target",
			models: []string{"openai/gpt-4o"},
			existingMapping: map[string]string{
				"gpt-4o":         "provider-alias",
				"provider-alias": "openai/gpt-4o",
			},
			expectedModels: []string{"gpt-4o"},
			expectedMapping: map[string]string{
				"gpt-4o":         "provider-alias",
				"provider-alias": "openai/gpt-4o",
			},
		},
		{
			name:   "rejects an existing mapping chain with a conflicting terminal target",
			models: []string{"openai/gpt-4o"},
			existingMapping: map[string]string{
				"gpt-4o":         "provider-alias",
				"provider-alias": "other/gpt-4o",
			},
			wantErrIs: ErrModelMappingConflict,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			models, mapping, err := CanonicalizeChannelModels(
				constant.ChannelTypeOpenRouter,
				tt.models,
				tt.existingMapping,
			)

			if tt.wantErrIs != nil {
				require.ErrorIs(t, err, tt.wantErrIs)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.expectedModels, models)
			assert.Equal(t, tt.expectedMapping, mapping)
		})
	}
}

func TestChannelCanonicalizeModelConfig(t *testing.T) {
	t.Run("canonicalizes models and marshals merged mapping", func(t *testing.T) {
		mappingJSON := `{"manual-model":"vendor/manual-model"}`
		channel := &Channel{
			Type:         constant.ChannelTypeOpenRouter,
			Models:       "manual-model,openai/gpt-4o",
			ModelMapping: &mappingJSON,
		}

		err := channel.CanonicalizeModelConfig()

		require.NoError(t, err)
		assert.Equal(t, "manual-model,gpt-4o", channel.Models)
		require.NotNil(t, channel.ModelMapping)
		var mapping map[string]string
		require.NoError(t, common.UnmarshalJsonStr(*channel.ModelMapping, &mapping))
		assert.Equal(t, map[string]string{
			"manual-model": "vendor/manual-model",
			"gpt-4o":       "openai/gpt-4o",
		}, mapping)
	})

	t.Run("rejects invalid mapping JSON without changing the channel", func(t *testing.T) {
		mappingJSON := "{"
		channel := &Channel{
			Type:         constant.ChannelTypeOpenRouter,
			Models:       "openai/gpt-4o",
			ModelMapping: &mappingJSON,
		}

		err := channel.CanonicalizeModelConfig()

		require.Error(t, err)
		assert.Equal(t, "openai/gpt-4o", channel.Models)
		assert.Equal(t, "{", *channel.ModelMapping)
	})
}
