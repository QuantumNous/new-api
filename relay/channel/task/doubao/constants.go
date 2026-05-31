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

// Resolution 档位的标准化常量。
const (
	resolution480p  = "480p"
	resolution720p  = "720p"
	resolution1080p = "1080p"
)

// pricingKey 由 (模型名, 输出分辨率, 是否包含视频输入) 三元组唯一定位一档实际单价。
type pricingKey struct {
	Model       string
	Resolution  string
	WithVideoIn bool
}

// pricingRatioMap 登记"该档位实际单价 / 该模型基线单价（480p-720p 不含视频档）"的比例。
// 管理员应以每个模型的"基线档"ModelRatio 作为 1.0 基准，
// 当请求命中非基线档（1080p 或包含视频输入）时，本表给出对应倍率。
//
// 豆包 2026-01-28 价格表：
//
// doubao-seedance-2-0-260128（基线 46 元 / 百万 tokens）：
//
//	480p / 720p 不含视频：46   → 1.0
//	480p / 720p 含视频  ：28   → 28/46
//	1080p      不含视频 ：51   → 51/46
//	1080p      含视频   ：31   → 31/46
//
// doubao-seedance-2-0-fast-260128（基线 37 元 / 百万 tokens）：
//
//	480p / 720p 不含视频：37   → 1.0
//	480p / 720p 含视频  ：22   → 22/37
//	1080p                ：暂不支持
var pricingRatioMap = map[pricingKey]float64{
	{Model: "doubao-seedance-2-0-260128", Resolution: resolution480p, WithVideoIn: false}:  1.0,
	{Model: "doubao-seedance-2-0-260128", Resolution: resolution720p, WithVideoIn: false}:  1.0,
	{Model: "doubao-seedance-2-0-260128", Resolution: resolution480p, WithVideoIn: true}:   28.0 / 46.0,
	{Model: "doubao-seedance-2-0-260128", Resolution: resolution720p, WithVideoIn: true}:   28.0 / 46.0,
	{Model: "doubao-seedance-2-0-260128", Resolution: resolution1080p, WithVideoIn: false}: 51.0 / 46.0,
	{Model: "doubao-seedance-2-0-260128", Resolution: resolution1080p, WithVideoIn: true}:  31.0 / 46.0,

	{Model: "doubao-seedance-2-0-fast-260128", Resolution: resolution480p, WithVideoIn: false}: 1.0,
	{Model: "doubao-seedance-2-0-fast-260128", Resolution: resolution720p, WithVideoIn: false}: 1.0,
	{Model: "doubao-seedance-2-0-fast-260128", Resolution: resolution480p, WithVideoIn: true}:  22.0 / 37.0,
	{Model: "doubao-seedance-2-0-fast-260128", Resolution: resolution720p, WithVideoIn: true}:  22.0 / 37.0,
}

// hasPricingConfig 指明哪些模型走二维倍率计算；
// 未登记的模型（如 seedance-1-x 系列）跳过倍率处理，保持原 ModelRatio 全额计费。
var hasPricingConfig = map[string]bool{
	"doubao-seedance-2-0-260128":      true,
	"doubao-seedance-2-0-fast-260128": true,
}

// normalizeResolution 将 "480P"/"1080p" 等大小写变体统一为标准形式。
// 未指定或未知分辨率一律回退为 720p（豆包 seedance 默认输出分辨率）。
func normalizeResolution(r string) string {
	switch strings.ToLower(strings.TrimSpace(r)) {
	case resolution480p:
		return resolution480p
	case resolution1080p:
		return resolution1080p
	case "", resolution720p:
		return resolution720p
	default:
		return resolution720p
	}
}

// ResolveBillingRatios 根据模型、输出分辨率与是否含视频输入，
// 返回相对"基线档（480p/720p 不含视频）"的二维倍率 (resolution / video_input)。
//
//   - supported == false 表示当前组合被上游标注为"暂不支持"，调用方应直接拒绝请求。
//   - 对未登记定价配置的模型返回 (nil, true)，表示"不需要任何折扣，走基础 ModelRatio"。
//
// 拆维语义（保证两维乘积严格等于该档位 totalRatio）：
//
//   - resolution  = pricingRatioMap[(model, res, 不含视频)]      // 横向：分辨率溢价（以"不含视频"档为基准）
//   - video_input = pricingRatioMap[(model, res, 含视频)] / resolution
//     // 纵向：同分辨率下"含视频"相对"不含视频"的折扣
//
// 验证（pro 2.0 为例）：
//
//	480p/720p, 不含视频：res=1.0,      vid=1.0            → 1.0
//	480p/720p, 含视频  ：res=1.0,      vid=28/46          → 28/46 ✓
//	1080p,      不含视频：res=51/46,    vid=1.0            → 51/46 ✓
//	1080p,      含视频  ：res=51/46,    vid=(31/46)/(51/46)=31/51 → 31/46 ✓
func ResolveBillingRatios(modelName, resolution string, withVideoIn bool) (map[string]float64, bool) {
	if !hasPricingConfig[modelName] {
		return nil, true
	}
	res := normalizeResolution(resolution)
	totalRatio, ok := pricingRatioMap[pricingKey{Model: modelName, Resolution: res, WithVideoIn: withVideoIn}]
	if !ok {
		return nil, false
	}

	// 该分辨率下"不含视频"档的绝对倍率（横向基准）。
	baseForRes, hasBase := pricingRatioMap[pricingKey{Model: modelName, Resolution: res, WithVideoIn: false}]
	if !hasBase {
		// 理论上不会发生：有含视频档就必有不含视频档（本体定价表保持这条约束）。
		// 兜底按 totalRatio 单键上报，避免返回错误。
		ratios := map[string]float64{}
		if totalRatio != 1.0 {
			ratios["pricing_tier"] = totalRatio
		}
		return ratios, true
	}

	ratios := map[string]float64{}
	if baseForRes != 1.0 {
		ratios["resolution"] = baseForRes
	}
	if withVideoIn && baseForRes > 0 {
		videoRatio := totalRatio / baseForRes
		if videoRatio != 1.0 {
			ratios["video_input"] = videoRatio
		}
	}
	return ratios, true
}
