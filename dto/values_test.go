package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Ali task usage durations arrive as int, float, or numeric string; any form must decode without failing the whole response (#6166).
func TestIntValueUnmarshalNumericForms(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want int
	}{
		{"int", `5`, 5},
		{"float", `13.93`, 13},
		{"whole float", `5.0`, 5},
		{"int string", `"5"`, 5},
		{"float string", `"13.93"`, 13},
		{"negative float", `-2.5`, -2},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var v IntValue
			require.NoError(t, common.Unmarshal([]byte(tt.in), &v))
			assert.Equal(t, tt.want, int(v))
		})
	}

	var v IntValue
	require.Error(t, common.Unmarshal([]byte(`"abc"`), &v))
	require.Error(t, common.Unmarshal([]byte(`true`), &v))
}
