package ykvideo

import "strings"

const (
	ChannelName  = "yk-video"
	createPath   = "/v2/model-center/tasks"
	queryPathFmt = "/v2/model-center/tasks/"
	defaultBase  = "https://zcbservice.aizfw.cn/kyyReactApiServer"
)

// ModelList is the client-facing model list for yk-video (KYY model-center).
var ModelList = []string{
	"seedance2.0-yk-933",
	"seedance2.0-ykst-933",
	"videos_933_c1",
	"videos_stable",
}

func resolveUpstreamModel(modelName string) string {
	compact := strings.ToLower(strings.TrimSpace(modelName))
	switch compact {
	case "seedance2.0-yk-933", "seedance2.0-yk_933", "videos_933_c1", "videos-933-c1":
		return "videos_933_c1"
	case "seedance2.0-ykst-933", "seedance2.0-ykst_933", "videos_stable", "videos-stable":
		return "videos_stable"
	default:
		return strings.TrimSpace(modelName)
	}
}
