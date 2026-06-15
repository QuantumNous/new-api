package sora

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestSoraSizeRatioConstants 锁死 3.2：1.666667 size 倍率与默认 seconds/size 具名化后
// 取值与外置前一致，且 soraLargeSizes 命中/未命中倍率与原 if size == ... 判定等价。
func TestSoraSizeRatioConstants(t *testing.T) {
	require.Equal(t, 4, soraDefaultSeconds)
	require.Equal(t, "720x1280", soraDefaultSize)
	require.InDelta(t, 1.0, soraSizeRatioBase, 1e-9)
	require.InDelta(t, 1.666667, soraSizeRatioLarge, 1e-9)
}

// sizeRatioLegacy 复刻外置前的 size 倍率判定，作为黄金参照。
func sizeRatioLegacy(size string) float64 {
	r := 1.0
	if size == "1792x1024" || size == "1024x1792" {
		r = 1.666667
	}
	return r
}

// sizeRatioNew 复刻外置后 EstimateBilling 中的 size 倍率判定（基于 soraLargeSizes）。
func sizeRatioNew(size string) float64 {
	r := soraSizeRatioBase
	if soraLargeSizes[size] {
		r = soraSizeRatioLarge
	}
	return r
}

func TestSoraSizeRatioMatchesLegacy(t *testing.T) {
	sizes := []string{
		"1792x1024", "1024x1792", // 命中大尺寸
		"720x1280", "1280x720", "", "9999x9999", // 未命中回退基准
	}
	for _, s := range sizes {
		require.InDelta(t, sizeRatioLegacy(s), sizeRatioNew(s), 1e-9, "size=%s 新旧倍率必须等价", s)
	}
}
