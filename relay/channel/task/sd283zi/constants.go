package sd283zi

import "strings"

const (
	ChannelName  = "83zi"
	createPath   = "/api/generate-video"
	queryPathFmt = "/api/task/"
)

// ModelList is the client-facing model list. sd2fast/sd2 are aliases for upstream fast/2.0.
var ModelList = []string{
	"sd2fast",
	"sd2",
}

func resolveUpstreamModel(modelName string) string {
	compact := strings.ToLower(strings.TrimSpace(modelName))
	switch compact {
	case "sd2fast":
		return "fast"
	case "sd2":
		return "2.0"
	case "fast":
		return "fast"
	case "2.0":
		return "2.0"
	default:
		return strings.TrimSpace(modelName)
	}
}
