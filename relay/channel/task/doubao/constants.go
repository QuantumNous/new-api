package doubao

var ModelList = []string{
	// Seedance 2.5 (2026-07-31): up to 30s per segment, native 4K, synchronised
	// audio, up to 50 multimodal reference inputs.
	//
	// ⚠️ Priced by TOKEN RATIO, not per-call — see defaultModelRatio. Every other
	// Seedance model here carries a fixed per-call price in defaultModelPrice,
	// which is safe while clip length is pinned around 5s. 2.5 varies 6x on
	// duration alone (5s → 30s), so a per-call price would lose money on every
	// long generation. settleTaskBillingOnComplete recalculates from
	// taskResult.TotalTokens whenever a model has a ratio and no per-call price.
	"doubao-seedance-2-5-260628",
	"doubao-seedance-1-0-pro-250528",
	"doubao-seedance-1-0-lite-t2v",
	"doubao-seedance-1-0-lite-i2v",
	"doubao-seedance-1-5-pro-251215",
	"doubao-seedance-2-0-260128",
	"doubao-seedance-2-0-fast-260128",
}

var ChannelName = "doubao-video"

// videoInputRatioMap 视频输入折扣比率（含视频单价 / 不含视频单价）。
// 管理员应将 ModelRatio 设置为"不含视频"的较高费率，
// 系统在检测到视频输入时自动乘以此折扣。
var videoInputRatioMap = map[string]float64{
	"doubao-seedance-2-5-260628":      6.51 / 10.85, // 0.60 ($6.51 vs $10.85 per 1M)
	"doubao-seedance-2-0-260128":      28.0 / 46.0,  // ~0.6087
	"doubao-seedance-2-0-fast-260128": 22.0 / 37.0,  // ~0.5946
}

func GetVideoInputRatio(modelName string) (float64, bool) {
	r, ok := videoInputRatioMap[modelName]
	return r, ok
}
