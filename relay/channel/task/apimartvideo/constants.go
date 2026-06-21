package apimartvideo

import (
	"strings"
)

var ModelList = []string{
	"sora",
	"sora-2",
	"sora-2-pro",
}

var ChannelName = "apimart-video"

func IsVideoModel(model string) bool {
	switch strings.TrimSpace(model) {
	case "sora", "sora-2", "sora-2-pro":
		return true
	default:
		return false
	}
}

func IsChannel(baseURL string) bool {
	return strings.Contains(strings.ToLower(baseURL), "apimart.ai")
}

func normalizeModel(model string) string {
	model = strings.TrimSpace(model)
	if model == "sora" {
		return "sora-2"
	}
	return model
}
