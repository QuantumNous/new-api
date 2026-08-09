package runninghub

// ModelList 是渠道可服务的模型名（与后端 AI 模型配置的 modelKey 保持一致）。
var ModelList = []string{
	"seedance2.0",
	"seedance2.0-Fast",
	"seedance2.0-Mini",
}

// ChannelName 渠道展示名。
var ChannelName = "runninghub-video"

// ModelSlug 将内部模型名映射为 runninghub 接口路径中的模型 slug。
func ModelSlug(model string) string {
	switch model {
	case "seedance2.0-Fast":
		return "sparkvideo-2.0-fast"
	case "seedance2.0-Mini":
		return "sparkvideo-2.0-mini"
	case "seedance2.0":
		fallthrough
	default:
		return "sparkvideo-2.0"
	}
}
