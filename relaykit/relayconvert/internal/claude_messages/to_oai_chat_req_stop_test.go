package claudemessages

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClaudeMessagesStopSequencesPreservesArray(t *testing.T) {
	maxTokens := uint(16)
	cases := []struct {
		name string
		stop []string
		want any
	}{
		{name: "single element", stop: []string{"</block>"}, want: []string{"</block>"}},
		{name: "multiple elements", stop: []string{"A", "B"}, want: []string{"A", "B"}},
		{name: "empty", stop: nil, want: nil},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			openAIRequest, err := ClaudeMessagesRequestToOpenAIChat(dto.ClaudeRequest{
				Model:         "claude-test",
				MaxTokens:     &maxTokens,
				StopSequences: tc.stop,
			}, &convmeta.Values{})
			require.NoError(t, err)
			require.NotNil(t, openAIRequest)
			assert.Equal(t, tc.want, openAIRequest.Stop)
		})
	}
}
