package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestFlexibleUnixTimestamp_UnmarshalValid(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		payload  string
		expected FlexibleUnixTimestamp
	}{
		{
			name:     "integer",
			payload:  `{"created_at":1730000000}`,
			expected: 1730000000,
		},
		{
			name:     "quoted_integer",
			payload:  `{"created_at":"1730000001"}`,
			expected: 1730000001,
		},
		{
			name:     "float_scientific_notation",
			payload:  `{"created_at":1.730000002e+09}`,
			expected: 1730000002,
		},
		{
			name:     "quoted_float_scientific_notation",
			payload:  `{"created_at":"1.730000003e+09"}`,
			expected: 1730000003,
		},
		{
			name:     "null",
			payload:  `{"created_at":null}`,
			expected: 0,
		},
		{
			name:     "empty_quoted_value",
			payload:  `{"created_at":""}`,
			expected: 0,
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var resp OpenAIResponsesResponse
			err := common.Unmarshal([]byte(tc.payload), &resp)
			require.NoError(t, err)
			require.Equal(t, tc.expected, resp.CreatedAt)
		})
	}
}

func TestFlexibleUnixTimestamp_UnmarshalInvalid(t *testing.T) {
	t.Parallel()

	var resp OpenAIResponsesResponse
	err := common.Unmarshal([]byte(`{"created_at":"not-a-timestamp"}`), &resp)
	require.Error(t, err)
}
