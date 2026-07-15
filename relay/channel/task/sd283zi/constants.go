package sd283zi

import "strings"

const (
	ChannelName  = "83zi"
	createPath   = "/api/generate-video"
	queryPathFmt = "/api/task/"
)

// ModelList is the client-facing model list.
// sd2fast/sd2 -> upstream fast/2.0 (sd2.83zi.com); mingiz-sd2 -> xinghe-2.0 (api.shishikeji.com).
var ModelList = []string{
	"sd2fast",
	"sd2",
	"mingiz-sd2",
}

func resolveUpstreamModel(modelName string) string {
	compact := strings.ToLower(strings.TrimSpace(modelName))
	switch compact {
	case "sd2fast":
		return "fast"
	case "sd2":
		return "2.0"
	case "mingiz-sd2", "mingiz":
		return "xinghe-2.0"
	case "fast":
		return "fast"
	case "2.0":
		return "2.0"
	case "xinghe-2.0":
		return "xinghe-2.0"
	case "xinghe-fast":
		return "xinghe-fast"
	default:
		return strings.TrimSpace(modelName)
	}
}

func isSD2UpstreamModel(modelName string) bool {
	switch strings.ToLower(strings.TrimSpace(modelName)) {
	case "fast", "2.0", "sd2fast", "sd2":
		return true
	default:
		return false
	}
}
