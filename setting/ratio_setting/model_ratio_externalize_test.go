package ratio_setting

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/require"
)

// loadSnapshot 读取 testdata 下改前 dump 的 compact 快照（== common.Marshal 形态），
// 解析为 map 用于逐条比对。
func loadSnapshot(t *testing.T, name string) map[string]float64 {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("testdata", name+".snapshot.json"))
	require.NoError(t, err, "读取快照 %s", name)
	m := make(map[string]float64)
	require.NoError(t, common.Unmarshal(data, &m), "解析快照 %s", name)
	return m
}

// TestDefaultTablesEquivalentToSnapshot 锁死 embed JSON 解析回的默认表 == 固化快照
// （条目数 + 全键值）。快照即「采纳时的权威默认」：model_ratio/completion/cache/
// create_cache 源自 top（tln-special-1）线上定价（任务 06-15-default-pricing-from-top）；
// model_price/audio/image 维持 D1 剪枝前内容。任一漂移即失败。
func TestDefaultTablesEquivalentToSnapshot(t *testing.T) {
	cases := []struct {
		name string
		got  map[string]float64
	}{
		{"default_model_ratio", defaultModelRatio},
		{"default_model_price", defaultModelPrice},
		{"default_audio_ratio", defaultAudioRatio},
		{"default_audio_completion_ratio", defaultAudioCompletionRatio},
		{"default_completion_ratio", defaultCompletionRatio},
		{"default_image_ratio", defaultImageRatio},
		{"default_cache_ratio", defaultCacheRatio},
		{"default_create_cache_ratio", defaultCreateCacheRatio},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			want := loadSnapshot(t, tc.name)
			require.Equal(t, len(want), len(tc.got), "条目数必须与外置前一致")
			// 逐键值精确相等（float64 字面量经 JSON round-trip 后值不变）。
			require.Equal(t, want, tc.got, "外置前后逐条等价")
		})
	}
}

// TestDefaultModelRatio2JSONStringStable 锁死 DefaultModelRatio2JSONString()（被
// controller/pricing.go ResetModelRatio 调用）输出 == 固化快照字符串。
// Go map 经 common.Marshal 按键排序输出，确定性，可逐字节比较。
func TestDefaultModelRatio2JSONStringStable(t *testing.T) {
	want, err := os.ReadFile(filepath.Join("testdata", "default_model_ratio.snapshot.json"))
	require.NoError(t, err)
	require.Equal(t, string(want), DefaultModelRatio2JSONString(),
		"DefaultModelRatio2JSONString 输出必须与快照字节级一致（快照=top 现役集）")
}

// TestGetDefaultModelRatioMapMatchesSnapshot 确认 GetDefaultModelRatioMap()（被
// hasCustomModelRatio() 当判定基准）等于固化快照——即 top 现役默认集。
func TestGetDefaultModelRatioMapMatchesSnapshot(t *testing.T) {
	m := GetDefaultModelRatioMap()
	require.NotEmpty(t, m)
	want := loadSnapshot(t, "default_model_ratio")
	require.Equal(t, want, m, "GetDefaultModelRatioMap 必须等于快照（top 现役集）")

	pm := GetDefaultModelPriceMap()
	wantPrice := loadSnapshot(t, "default_model_price")
	require.Equal(t, wantPrice, pm)
}

// TestResetModelRatioRoundTrip 模拟 controller/pricing.go ResetModelRatio 的核心
// 行为：DefaultModelRatio2JSONString -> UpdateModelRatioByJSONString -> 运行期表恢复
// 为默认表。验证外置未破坏重置语义。
func TestResetModelRatioRoundTrip(t *testing.T) {
	InitRatioSettings()
	defaultStr := DefaultModelRatio2JSONString()
	require.NoError(t, UpdateModelRatioByJSONString(defaultStr))

	got := GetModelRatioCopy()
	want := loadSnapshot(t, "default_model_ratio")
	for k, v := range want {
		require.Equal(t, v, got[k], "重置后运行期倍率必须等于默认值: %s", k)
	}
}
