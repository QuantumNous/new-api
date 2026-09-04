package dto

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClaudeResponseIsRefusal(t *testing.T) {
	stopReason := func(reason string) *string { return &reason }

	tests := []struct {
		name     string
		response *ClaudeResponse
		want     bool
	}{
		{name: "nil response", response: nil, want: false},
		{
			name:     "top-level refusal",
			response: &ClaudeResponse{StopReason: "refusal"},
			want:     true,
		},
		{
			name:     "delta refusal",
			response: &ClaudeResponse{Delta: &ClaudeMediaMessage{StopReason: stopReason("refusal")}},
			want:     true,
		},
		{
			name:     "end_turn",
			response: &ClaudeResponse{StopReason: "end_turn"},
			want:     false,
		},
		{
			name:     "no stop reason",
			response: &ClaudeResponse{Type: "content_block_delta"},
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, tt.response.IsRefusal())
		})
	}
}

// A refusal response must round-trip stop_details so a rebuilt Claude response
// still tells the client why the request was declined.
func TestClaudeResponseRoundTripsStopDetails(t *testing.T) {
	raw := `{"id":"msg_1","type":"message","role":"assistant","content":[],` +
		`"stop_reason":"refusal","stop_details":{"type":"refusal","category":"cyber",` +
		`"explanation":"declined"},"usage":{"input_tokens":412,"output_tokens":0}}`

	var response ClaudeResponse
	require.NoError(t, json.Unmarshal([]byte(raw), &response))
	assert.True(t, response.IsRefusal())

	encoded, err := json.Marshal(&response)
	require.NoError(t, err)

	var decoded map[string]any
	require.NoError(t, json.Unmarshal(encoded, &decoded))
	assert.Equal(t, map[string]any{
		"type":        "refusal",
		"category":    "cyber",
		"explanation": "declined",
	}, decoded["stop_details"])
}

func TestClaudeUsageBillableIterations(t *testing.T) {
	tests := []struct {
		name       string
		usage      *ClaudeUsage
		wantModels []string
	}{
		{name: "nil usage", usage: nil},
		{name: "no breakdown", usage: &ClaudeUsage{InputTokens: 412}},
		{
			name: "skips the attempt that produced no output",
			usage: &ClaudeUsage{Iterations: []ClaudeUsageIteration{
				{Type: "message", Model: "claude-opus-5", InputTokens: 535, OutputTokens: 0},
				{Type: "fallback_message", Model: "claude-opus-4-8", InputTokens: 412, OutputTokens: 264},
			}},
			wantModels: []string{"claude-opus-4-8"},
		},
		{
			name: "keeps an attempt that refused mid-output",
			usage: &ClaudeUsage{Iterations: []ClaudeUsageIteration{
				{Type: "message", Model: "claude-opus-5", InputTokens: 535, OutputTokens: 50},
				{Type: "fallback_message", Model: "claude-opus-4-8", InputTokens: 412, OutputTokens: 264},
			}},
			wantModels: []string{"claude-opus-5", "claude-opus-4-8"},
		},
		{
			name: "every attempt refused before output",
			usage: &ClaudeUsage{Iterations: []ClaudeUsageIteration{
				{Type: "message", Model: "claude-opus-5", InputTokens: 535, OutputTokens: 0},
				{Type: "fallback_message", Model: "claude-opus-4-8", InputTokens: 412, OutputTokens: 0},
			}},
			wantModels: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			billable := tt.usage.BillableIterations()
			models := make([]string, 0, len(billable))
			for _, iteration := range billable {
				models = append(models, iteration.Model)
			}
			if tt.wantModels == nil {
				assert.Nil(t, billable)
				return
			}
			assert.Equal(t, tt.wantModels, models)
		})
	}
}

// The billing snapshot is handed across relay hops, so mutating a clone must not
// reach back into the usage it was built from.
func TestCloneClaudeUsageDeepCopiesIterations(t *testing.T) {
	usage := &ClaudeUsage{
		InputTokens: 412,
		Iterations: []ClaudeUsageIteration{{
			Model:                    "claude-opus-4-8",
			InputTokens:              412,
			OutputTokens:             264,
			CacheCreationInputTokens: 40,
			CacheCreation:            &ClaudeCacheCreationUsage{Ephemeral5mInputTokens: 40},
		}},
	}

	clone := cloneClaudeUsage(usage)
	require.Len(t, clone.Iterations, 1)
	clone.Iterations[0].OutputTokens = 1
	clone.Iterations[0].CacheCreation.Ephemeral5mInputTokens = 1

	assert.Equal(t, 264, usage.Iterations[0].OutputTokens)
	assert.Equal(t, 40, usage.Iterations[0].CacheCreation.Ephemeral5mInputTokens)
}

// A fallback response can report every billable count inside the breakdown, so
// an all-zero top level must still produce a billing snapshot.
func TestHasClaudeUsageTokensAcceptsIterationOnlyUsage(t *testing.T) {
	usage := &ClaudeUsage{Iterations: []ClaudeUsageIteration{
		{Model: "claude-opus-4-8", InputTokens: 412, OutputTokens: 264},
	}}

	assert.True(t, HasClaudeUsageTokens(usage))
	require.NotNil(t, NewClaudeMessagesBillingUsage(usage))
	assert.False(t, HasClaudeUsageTokens(&ClaudeUsage{}))
}
