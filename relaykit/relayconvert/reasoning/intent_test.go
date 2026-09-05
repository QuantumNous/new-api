package reasoning

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMergeExplicitAndSuffix(t *testing.T) {
	t.Parallel()

	budget1024 := 1024
	budget2048 := 2048

	tests := []struct {
		name         string
		explicit     Intent
		suffix       Intent
		wantErr      bool
		wantMode     Mode
		wantEffort   Effort
		wantBudget   *int
		wantThoughts *bool
	}{
		{
			name:       "enabled plus matching effort merges",
			explicit:   Intent{Mode: ModeEnabled, Effort: EffortHigh},
			suffix:     Intent{Mode: ModeEnabled, Effort: EffortHigh, Source: SourceSuffix},
			wantMode:   ModeEnabled,
			wantEffort: EffortHigh,
		},
		{
			name:     "enabled vs disabled conflict",
			explicit: Intent{Mode: ModeEnabled, Effort: EffortHigh},
			suffix:   Intent{Mode: ModeDisabled, Effort: EffortNone, Source: SourceSuffix},
			wantErr:  true,
		},
		{
			name:     "different efforts conflict",
			explicit: Intent{Mode: ModeEnabled, Effort: EffortLow},
			suffix:   Intent{Mode: ModeEnabled, Effort: EffortHigh, Source: SourceSuffix},
			wantErr:  true,
		},
		{
			name:     "different budgets conflict",
			explicit: Intent{BudgetTokens: &budget1024},
			suffix:   Intent{BudgetTokens: &budget2048, Source: SourceSuffix, BudgetSource: SourceSuffix},
			wantErr:  true,
		},
		{
			name:     "effort versus exact suffix budget conflict",
			explicit: Intent{Mode: ModeEnabled, Effort: EffortHigh},
			suffix:   Intent{BudgetTokens: &budget1024, Source: SourceSuffix, BudgetSource: SourceSuffix},
			wantErr:  true,
		},
		{
			name:         "suffix only is adopted",
			suffix:       Intent{Mode: ModeEnabled, Effort: EffortMedium, Source: SourceSuffix},
			wantMode:     ModeEnabled,
			wantEffort:   EffortMedium,
			wantThoughts: nil,
		},
		{
			name:         "explicit include thoughts overlays empty suffix strength",
			explicit:     Intent{IncludeThoughts: boolPtr(false)},
			suffix:       Intent{Mode: ModeEnabled, Effort: EffortLow, Source: SourceSuffix},
			wantMode:     ModeEnabled,
			wantEffort:   EffortLow,
			wantThoughts: boolPtr(false),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := MergeExplicitAndSuffix(tt.explicit, tt.suffix, "claude-opus-4-8")
			if tt.wantErr {
				require.Error(t, err)
				assert.ErrorIs(t, err, ErrEffortConflict)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.wantMode, got.Mode)
			assert.Equal(t, tt.wantEffort, got.Effort)
			if tt.wantBudget != nil {
				require.NotNil(t, got.BudgetTokens)
				assert.Equal(t, *tt.wantBudget, *got.BudgetTokens)
			}
			if tt.wantThoughts != nil {
				require.NotNil(t, got.IncludeThoughts)
				assert.Equal(t, *tt.wantThoughts, *got.IncludeThoughts)
			}
		})
	}
}

func TestIntentStateRoundTrip(t *testing.T) {
	t.Parallel()

	budget := 4096
	include := true
	intent := Intent{
		Mode:            ModeEnabled,
		Effort:          EffortHigh,
		BudgetTokens:    &budget,
		IncludeThoughts: &include,
	}

	state := StateFromIntent(intent)
	require.NotNil(t, state)
	got := IntentFromState(state)
	assert.Equal(t, intent.Mode, got.Mode)
	assert.Equal(t, intent.Effort, got.Effort)
	require.NotNil(t, got.BudgetTokens)
	assert.Equal(t, budget, *got.BudgetTokens)
	require.NotNil(t, got.IncludeThoughts)
	assert.True(t, *got.IncludeThoughts)
	assert.True(t, IntentFromState(nil).IsEmpty())
	assert.Nil(t, StateFromIntent(Intent{}))
}

func boolPtr(v bool) *bool {
	return &v
}

func TestOpenAIPivotRetainsExactStrengthAndBudget(t *testing.T) {
	budget, include := 16384, false
	for _, effort := range []Effort{EffortMax, EffortXHigh} {
		t.Run(string(effort), func(t *testing.T) {
			intent := Intent{Mode: ModeEnabled, Effort: effort, BudgetTokens: &budget, IncludeThoughts: &include}
			chat := &dto.GeneralOpenAIRequest{}
			require.NoError(t, ApplyToOpenAIChat(chat, intent))
			assert.Equal(t, string(effort), chat.ReasoningEffort)
			restored, err := FromOpenAIChat(chat)
			require.NoError(t, err)
			assert.Equal(t, effort, restored.Effort)
			require.NotNil(t, restored.BudgetTokens)
			assert.Equal(t, budget, *restored.BudgetTokens)
			require.NotNil(t, restored.IncludeThoughts)
			assert.False(t, *restored.IncludeThoughts)

			responses := &dto.OpenAIResponsesRequest{}
			require.NoError(t, ApplyToOpenAIResponses(responses, restored))
			require.NotNil(t, responses.Reasoning)
			assert.Equal(t, string(effort), responses.Reasoning.Effort)
			restored, err = FromOpenAIResponses(responses)
			require.NoError(t, err)
			assert.Equal(t, effort, restored.Effort)
			require.NotNil(t, restored.BudgetTokens)
			assert.Equal(t, budget, *restored.BudgetTokens)
			require.NotNil(t, restored.IncludeThoughts)
			assert.False(t, *restored.IncludeThoughts)
		})
	}
}

func TestOpenAIPivotDoesNotTreatMaxAndXHighAsEquivalent(t *testing.T) {
	intent := Intent{Mode: ModeEnabled, Effort: EffortMax}
	chat := &dto.GeneralOpenAIRequest{}
	require.NoError(t, ApplyToOpenAIChat(chat, intent))
	chat.ReasoningEffort = "xhigh"
	_, err := FromOpenAIChat(chat)
	require.ErrorIs(t, err, ErrEffortConflict)

	responses := &dto.OpenAIResponsesRequest{}
	require.NoError(t, ApplyToOpenAIResponses(responses, intent))
	responses.Reasoning.Effort = "xhigh"
	_, err = FromOpenAIResponses(responses)
	require.ErrorIs(t, err, ErrEffortConflict)
}
