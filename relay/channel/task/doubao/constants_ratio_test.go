package doubao

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestGetVideoInputRatio 锁死 videoInputRatioMap 命中/未命中回退语义不变。
func TestGetVideoInputRatio(t *testing.T) {
	t.Run("seedance-2.0 命中", func(t *testing.T) {
		r, ok := GetVideoInputRatio("doubao-seedance-2-0-260128")
		require.True(t, ok)
		require.InDelta(t, 28.0/46.0, r, 1e-9)
	})
	t.Run("seedance-2.0-fast 命中", func(t *testing.T) {
		r, ok := GetVideoInputRatio("doubao-seedance-2-0-fast-260128")
		require.True(t, ok)
		require.InDelta(t, 22.0/37.0, r, 1e-9)
	})
	t.Run("未配置模型回退 false", func(t *testing.T) {
		r, ok := GetVideoInputRatio("doubao-seedance-1-0-pro-250528")
		require.False(t, ok)
		require.Zero(t, r)
	})
}
