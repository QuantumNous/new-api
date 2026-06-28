package apimartvideo

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsMotionControlModel(t *testing.T) {
	require.True(t, IsMotionControlModel("kling-v3-motion-control"))
	require.True(t, IsVideoModel("kling-v3-motion-control"))
	require.False(t, IsMotionControlModel("sora-2"))
}

func TestModeBillingRatio(t *testing.T) {
	require.InDelta(t, 1.0, modeBillingRatio("std"), 1e-9)
	require.InDelta(t, ProUSDPerSecond/StdUSDPerSecond, modeBillingRatio("pro"), 1e-9)
}

func TestDefaultBillableSeconds(t *testing.T) {
	require.Equal(t, 10, defaultBillableSeconds("image"))
	require.Equal(t, 30, defaultBillableSeconds("video"))
}
