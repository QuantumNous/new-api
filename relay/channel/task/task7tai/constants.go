package task7tai

import "strings"

const (
	ChannelName  = "7tai"
	createPath   = "/video/generations"
	queryPathFmt = "/video/generations/"
)

// ModelList is the client-facing model list for 7tai (炳火 API).
var ModelList = []string{
	"sd2-fast福利",
	"sd2-福利",
	"SD2.0-720p",
	"SD2.0-480p-fast",
	"SD2.0-480p",
}

func resolveUpstreamModel(modelName string) string {
	compact := strings.ToLower(strings.TrimSpace(modelName))
	switch compact {
	case "sd2-fast福利", "sd2fast福利":
		return "sd2-fast福利"
	case "sd2-福利", "sd2福利":
		return "sd2-福利"
	case "sd2.0-720p", "seedance-2.0-720p":
		return "SD2.0-720p"
	case "sd2.0-480p-fast", "seedance-2.0-480p-fast":
		return "SD2.0-480p-fast"
	case "sd2.0-480p", "seedance-2.0-480p":
		return "SD2.0-480p"
	default:
		return strings.TrimSpace(modelName)
	}
}

func isPerSecondModel(modelName string) bool {
	switch strings.ToLower(strings.TrimSpace(modelName)) {
	case "sd2.0-720p", "seedance-2.0-720p",
		"sd2.0-480p-fast", "seedance-2.0-480p-fast",
		"sd2.0-480p", "seedance-2.0-480p":
		return true
	default:
		return false
	}
}
