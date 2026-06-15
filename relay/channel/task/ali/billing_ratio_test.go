package ali

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestProcessAliOtherRatios 锁死 3.2 外置：aliResolutionRatios 抽为包级 var 后，
// 命中/未命中模型与分辨率的倍率与外置前逐条一致，未命中不写入（回退语义不变）。
func TestProcessAliOtherRatios(t *testing.T) {
	cases := []struct {
		name      string
		model     string
		size      string // 优先用 size 推断分辨率
		res       string // size 为空时用 resolution
		wantKey   string
		wantValue float64
		wantEmpty bool
	}{
		// 命中（用 resolution 直接给定）
		{"wan2.6-i2v 1080P", "wan2.6-i2v", "", "1080P", "resolution-1080P", 1 / 0.6, false},
		{"wan2.6-i2v 720P base", "wan2.6-i2v", "", "720P", "resolution-720P", 1, false},
		{"wan2.5-t2v 1080P", "wan2.5-t2v-preview", "", "1080P", "resolution-1080P", 1 / 0.3, false},
		{"wan2.2-t2v-plus 1080P", "wan2.2-t2v-plus", "", "1080P", "resolution-1080P", 0.7 / 0.14, false},
		{"wan2.2-s2v 720P", "wan2.2-s2v", "", "720P", "resolution-720P", 0.9 / 0.5, false},
		{"wan2.2-kf2v-flash 1080P literal", "wan2.2-kf2v-flash", "", "1080P", "resolution-1080P", 4.8, false},
		// 命中（用 size 推断分辨率）
		{"wan2.6-i2v size->1080P", "wan2.6-i2v", "1920*1080", "", "resolution-1080P", 1 / 0.6, false},
		// 未命中：模型不在表中
		{"unknown model", "wan-unknown", "", "1080P", "", 0, true},
		// 未命中：模型在表中但分辨率不在该模型子表中（如 wan2.2-i2v-flash 无 1080P）
		{"known model missing resolution", "wan2.2-i2v-flash", "", "1080P", "", 0, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := &AliVideoRequest{
				Model:      tc.model,
				Parameters: &AliVideoParameters{Size: tc.size, Resolution: tc.res},
			}
			got, err := ProcessAliOtherRatios(req)
			require.NoError(t, err)
			if tc.wantEmpty {
				require.Empty(t, got, "未命中应不写入任何倍率（回退默认计费）")
				return
			}
			v, ok := got[tc.wantKey]
			require.True(t, ok, "应命中 key %s", tc.wantKey)
			require.InDelta(t, tc.wantValue, v, 1e-9)
		})
	}
}
