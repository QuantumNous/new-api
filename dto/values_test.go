package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestUnixTimestampUnmarshalJSON(t *testing.T) {
	testCases := []struct {
		name     string
		input    string
		expected int64
	}{
		{
			name:     "integer number",
			input:    `1768488160`,
			expected: 1768488160,
		},
		{
			name:     "scientific number",
			input:    `1.76848816E9`,
			expected: 1768488160,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var ts UnixTimestamp
			err := common.UnmarshalJsonStr(tc.input, &ts)
			require.NoError(t, err)
			require.Equal(t, tc.expected, ts.Int64())
		})
	}
}

func TestUnixTimestampUnmarshalJSONRejectsString(t *testing.T) {
	var ts UnixTimestamp
	err := common.UnmarshalJsonStr(`"1768488160"`, &ts)
	require.Error(t, err)
}

func TestResponsesStreamResponseCreatedAtScientificNotation(t *testing.T) {
	payload := `{"response":{"id":"resp_1","created_at":1.76848816E9}}`

	var resp ResponsesStreamResponse
	err := common.UnmarshalJsonStr(payload, &resp)
	require.NoError(t, err)
	require.NotNil(t, resp.Response)
	require.Equal(t, int64(1768488160), resp.Response.CreatedAt.Int64())
}

func TestResponsesCompactionResponseCreatedAtScientificNotation(t *testing.T) {
	payload := `{"id":"resp_1","object":"response","created_at":1.76848816E9}`

	var resp OpenAIResponsesCompactionResponse
	err := common.UnmarshalJsonStr(payload, &resp)
	require.NoError(t, err)
	require.Equal(t, int64(1768488160), resp.CreatedAt.Int64())
}
