package doubao

var ModelList = []string{
	"doubao-seedance-1-0-pro-250528",
	"doubao-seedance-1-0-lite-t2v",
	"doubao-seedance-1-0-lite-i2v",
	"doubao-seedance-1-5-pro-251215",
	"doubao-seedance-2-0-260128",
	"doubao-seedance-2-0-fast-260128",
}

var ChannelName = "doubao-video"

// videoInputRatioMap 视频输入折扣比率（含视频单价 / 不含视频单价），来源：火山方舟
// seedance 定价。管理员应将 ModelRatio 设置为「不含视频」的较高费率，系统在检测到视频
// 输入时自动乘以此折扣。裸比值保留分子/分母以便对账：
//   - 28.0/46.0 ≈ 0.6087（seedance-2.0：含视频 28 / 不含视频 46）
//   - 22.0/37.0 ≈ 0.5946（seedance-2.0-fast：含视频 22 / 不含视频 37）
//
// 未命中模型返回 (0, false)，调用方回退到不打折计费，与外置前一致。
var videoInputRatioMap = map[string]float64{
	"doubao-seedance-2-0-260128":      28.0 / 46.0, // ~0.6087
	"doubao-seedance-2-0-fast-260128": 22.0 / 37.0, // ~0.5946
}

// GetVideoInputRatio 返回模型的视频输入折扣比率；未配置时第二返回值为 false，
// 调用方据此回退到不打折（折扣视为 1）。
func GetVideoInputRatio(modelName string) (float64, bool) {
	r, ok := videoInputRatioMap[modelName]
	return r, ok
}
