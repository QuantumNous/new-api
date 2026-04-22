package service

import (
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/require"
)

func TestApply_Disabled_ShortCircuitsAndReturnsOriginal(t *testing.T) {
	t.Parallel()

	raw := []byte("any bytes, never decoded because disabled")
	constraint := setting.ImageConstraint{Enabled: false}

	result, err := Apply(raw, "image/jpeg", constraint)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.True(t, result.Info.Skipped)
	require.Equal(t, raw, result.Bytes)
	require.Equal(t, "image/jpeg", result.Mime)
}
