package th12345ai

import "strings"

const (
	ChannelName  = "th12345ai"
	createPath   = "/api/tasks"
	queryPathFmt = "/api/tasks/"
)

// ModelList is the client-facing model list for th12345ai (sd.12345ai.net).
// Prefer remapping on the channel: sd2-431→videos_stable, sd2-fast-431→videos_stable_fast.
var ModelList = []string{
	"sd2-431",
	"sd2-fast-431",
	"videos_stable",
	"videos_stable_fast",
}

func resolveUpstreamModel(modelName string) string {
	compact := strings.ToLower(strings.TrimSpace(modelName))
	switch compact {
	case "sd2-431", "videos_stable", "videos-stable", "sd2", "seedance-2.0", "seedance2.0":
		return "videos_stable"
	case "sd2-fast-431", "videos_stable_fast", "videos-stable-fast", "sd2fast", "sd2-fast", "seedance-2.0-fast":
		return "videos_stable_fast"
	default:
		return strings.TrimSpace(modelName)
	}
}
