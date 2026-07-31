package dto

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUnixTimestampUnmarshalJSON(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  int64
	}{
		{name: "integer", input: `1768488160`, want: 1768488160},
		{name: "scientific notation", input: `1.76848816E9`, want: 1768488160},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var timestamp UnixTimestamp
			require.NoError(t, timestamp.UnmarshalJSON([]byte(tt.input)))
			require.Equal(t, tt.want, timestamp.Int64())
		})
	}
}

func TestUnixTimestampRejectsString(t *testing.T) {
	var timestamp UnixTimestamp
	require.Error(t, timestamp.UnmarshalJSON([]byte(`"1768488160"`)))
}
