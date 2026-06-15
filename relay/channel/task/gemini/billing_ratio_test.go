package gemini

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestVeoResolutionRatioEquivalence 锁死 3.2 外置：VeoResolutionRatio 改显式映射后，
// 对已知模型/未知 3.1 变体/非 3.1 模型的倍率与外置前 strings.Contains 逻辑逐条一致。
func TestVeoResolutionRatioEquivalence(t *testing.T) {
	cases := []struct {
		name       string
		modelName  string
		resolution string
		want       float64
	}{
		// 非 4K：任意模型恒为 1.0
		{"720p any model", "veo-3.1-fast-generate-preview", "720p", 1.0},
		{"1080p any model", "veo-3.0-generate-001", "1080p", 1.0},
		{"empty resolution", "veo-3.1-generate-preview", "", 1.0},
		// 4K 已知模型精确命中
		{"4k veo-3.1-fast-generate-preview", "veo-3.1-fast-generate-preview", "4k", 2.333333},
		{"4k veo-3.1-generate-preview", "veo-3.1-generate-preview", "4k", 1.5},
		{"4k veo-3.0-generate-001 no 4k", "veo-3.0-generate-001", "4k", 1.0},
		{"4k veo-3.0-fast-generate-001 no 4k", "veo-3.0-fast-generate-001", "4k", 1.0},
		// 4K 未知 3.1 变体走模糊回退（与外置前一致）
		{"4k unknown 3.1-fast-generate variant", "veo-3.1-fast-generate-2099", "4k", 2.333333},
		{"4k unknown 3.1-generate variant", "veo-3.1-generate-2099", "4k", 1.5},
		{"4k bare 3.1 contains", "veo-3.1-experimental", "4k", 1.5},
		// 4K 完全未知模型回退 1.0
		{"4k unknown non-3.1", "veo-2.0-generate", "4k", 1.0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := VeoResolutionRatio(tc.modelName, tc.resolution)
			require.InDelta(t, tc.want, got, 1e-9)
		})
	}
}

// veoResolutionRatioLegacy 复刻外置前的纯 strings.Contains 实现，作为黄金参照，
// 对全部 GetModelList 模型 + 边界模型断言新旧实现完全等价。
func veoResolutionRatioLegacy(modelName, resolution string) float64 {
	if resolution != "4k" {
		return 1.0
	}
	if contains(modelName, "3.1-fast-generate") {
		return 2.333333
	}
	if contains(modelName, "3.1-generate") || contains(modelName, "3.1") {
		return 1.5
	}
	return 1.0
}

func contains(s, sub string) bool {
	return len(sub) == 0 || (len(s) >= len(sub) && indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func TestVeoResolutionRatioMatchesLegacy(t *testing.T) {
	models := []string{
		"veo-3.0-generate-001",
		"veo-3.0-fast-generate-001",
		"veo-3.1-generate-preview",
		"veo-3.1-fast-generate-preview",
		"veo-3.1-experimental",
		"veo-3.1-fast-generate-2099",
		"veo-2.0-generate",
	}
	resolutions := []string{"720p", "1080p", "4k", ""}
	for _, m := range models {
		for _, r := range resolutions {
			require.InDelta(t, veoResolutionRatioLegacy(m, r), VeoResolutionRatio(m, r), 1e-9,
				"model=%s res=%s 新旧实现必须等价", m, r)
		}
	}
}
