package claudemessages

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClaudeMessagesRequestToOpenAIChatPreservesStopSequenceArray(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		stop       []string
		wantJSON   string
		wantStop   []string
		wantAbsent bool
	}{
		{
			name:     "single sequence",
			stop:     []string{"STOP"},
			wantJSON: `{"model":"claude-test","stop":["STOP"]}`,
			wantStop: []string{"STOP"},
		},
		{
			name:     "multiple sequences",
			stop:     []string{"A", "B"},
			wantJSON: `{"model":"claude-test","stop":["A","B"]}`,
			wantStop: []string{"A", "B"},
		},
		{
			name:       "no sequences",
			wantJSON:   `{"model":"claude-test"}`,
			wantAbsent: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request, err := ClaudeMessagesRequestToOpenAIChat(dto.ClaudeRequest{
				Model:         "claude-test",
				StopSequences: tt.stop,
			}, nil)
			require.NoError(t, err)

			body, err := kitutil.Marshal(request)
			require.NoError(t, err)
			assert.JSONEq(t, tt.wantJSON, string(body))
			if tt.wantAbsent {
				assert.Nil(t, request.Stop)
				return
			}

			assert.IsType(t, []string{}, request.Stop)
			assert.Equal(t, tt.wantStop, request.Stop)
		})
	}
}
