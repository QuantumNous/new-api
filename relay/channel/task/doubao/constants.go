package doubao

import "github.com/QuantumNous/new-api/setting/ratio_setting"

var ModelList = []string{
	"doubao-seedance-1-0-pro-250528",
	"doubao-seedance-1-0-lite-t2v",
	"doubao-seedance-1-0-lite-i2v",
	"doubao-seedance-1-5-pro-251215",
	"doubao-seedance-2-0-260128",
	"doubao-seedance-2-0-fast-260128",
	"doubao-seedance-2-5-260628",
}

var ChannelName = "doubao-video"

// GetVideoBillingRatio 返回指定模型在给定输出分辨率/是否含视频输入下，相对基准价的计费倍率。
// 第二个返回值表示该模型是否配置了价格表；倍率为 1.0 时调用方可忽略该 OtherRatio。
func GetVideoBillingRatio(modelName, resolution string, hasVideo bool) (float64, bool) {
	return ratio_setting.GetVideoBillingRatio(modelName, resolution, hasVideo)
}

// GetVideoInputRatio is kept for callers compiled against the former helper name.
func GetVideoInputRatio(modelName, resolution string, hasVideo bool) (float64, bool) {
	return GetVideoBillingRatio(modelName, resolution, hasVideo)
}
