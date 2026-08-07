package controller

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStudioDisplayPtsToQuota(t *testing.T) {
	tests := []struct {
		name       string
		pts        float64
		groupRatio float64
		want       int
	}{
		{name: "zero points", pts: 0, groupRatio: 1, want: 0},
		{name: "invalid group ratio", pts: 1, groupRatio: 0, want: 0},
		{name: "rounds charge upward", pts: 0.000001, groupRatio: 1, want: 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			quota, err := studioDisplayPtsToQuota(tt.pts, tt.groupRatio)
			require.NoError(t, err)
			assert.Equal(t, tt.want, quota)
		})
	}
}

func TestStudioDisplayPtsToQuotaRejectsOverflow(t *testing.T) {
	quota, err := studioDisplayPtsToQuota(math.MaxFloat64, 1)

	require.Error(t, err)
	assert.Zero(t, quota)
	clamp, ok := err.(*common.QuotaClamp)
	require.True(t, ok)
	assert.Equal(t, common.QuotaClampOverflow, clamp.Kind)
}
