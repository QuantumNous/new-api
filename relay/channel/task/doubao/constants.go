package doubao

import "strings"

var ModelList = []string{
	"doubao-seedance-1-0-pro-250528",
	"doubao-seedance-1-0-lite-t2v",
	"doubao-seedance-1-0-lite-i2v",
	"doubao-seedance-1-5-pro-251215",
	"doubao-seedance-2-0-260128",
	"doubao-seedance-2-0-fast-260128",
}

var ChannelName = "doubao-video"

// videoPriceKey 价格表的二维键：输出分辨率是否为 1080p、输入是否含视频。
type videoPriceKey struct {
	is1080p  bool
	hasVideo bool
}

// videoPriceTable 各模型在不同 (输出分辨率档, 是否含视频输入) 下的单价（元/百万 token）。
// 其中 {480p/720p, 不含视频}（零值键）为基准价，等于管理员应配置的 ModelRatio；
// 计费时取 实际单价/基准价 作为 OtherRatio，缺省分辨率按 480p/720p 档处理。
var videoPriceTable = map[string]map[videoPriceKey]float64{
	"doubao-seedance-2-0-260128": {
		{is1080p: false, hasVideo: false}: 46.0,
		{is1080p: false, hasVideo: true}:  28.0,
		{is1080p: true, hasVideo: false}:  51.0,
		{is1080p: true, hasVideo: true}:   31.0,
	},
	"doubao-seedance-2-0-fast-260128": {
		{is1080p: false, hasVideo: false}: 37.0,
		{is1080p: false, hasVideo: true}:  22.0,
	},
}

// GetVideoInputRatio 返回指定模型在给定输出分辨率/是否含视频输入下，相对基准价的计费倍率。
// 第二个返回值表示该模型是否配置了价格表；倍率为 1.0 时调用方可忽略该 OtherRatio。
func GetVideoInputRatio(modelName, resolution string, hasVideo bool) (float64, bool) {
	prices, ok := videoPriceTable[modelName]
	base := prices[videoPriceKey{}] // 零值键 = {480p/720p, 不含视频} 基准价
	if !ok || base <= 0 {
		return 0, false
	}
	price, ok := prices[videoPriceKey{is1080p: strings.EqualFold(resolution, "1080p"), hasVideo: hasVideo}]
	if !ok {
		// 未配置的组合（如 fast 无 1080p，上游会自行报错）按基准价计费即可。
		return 1.0, true
	}
	return price / base, true
}
