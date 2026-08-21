package dto

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUnixTimestampUnmarshalJSON(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		want      int64
		wantError bool
	}{
		{name: "integer", input: `1768488160`, want: 1768488160},
		{name: "scientific notation", input: `1.76848816E9`, want: 1768488160},
		{name: "max int64", input: `9223372036854775807`, want: 9223372036854775807},
		{name: "first value above int64", input: `9223372036854775808`, wantError: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var timestamp UnixTimestamp
			err := timestamp.UnmarshalJSON([]byte(tt.input))
			if tt.wantError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.want, timestamp.Int64())
		})
	}
}

func TestUnixTimestampMarshalJSONUsesInteger(t *testing.T) {
	data, err := UnixTimestamp(1768488160).MarshalJSON()
	require.NoError(t, err)
	require.Equal(t, `1768488160`, string(data))
}

func TestUnixTimestampRejectsString(t *testing.T) {
	var timestamp UnixTimestamp
	require.Error(t, timestamp.UnmarshalJSON([]byte(`"1768488160"`)))
}
