package gpustackplus

// ChannelName 与任务渠道同名（同一渠道类型的两条链路：视频走任务子系统，图片走同步 relay）。
const ChannelName = "gpustackplus"

// ModelList 生图默认模型（自建增强引擎 LightX2V 系）。实际以渠道模型映射为准。
var ModelList = []string{
	"z-image",
}
