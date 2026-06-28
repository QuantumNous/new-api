package apimartvideo

import (
	"strings"
)

const (
	ModelKlingV3MotionControl = "kling-v3-motion-control"
	// StdUSDPerSecond is APIMart purchase price for mode=std.
	StdUSDPerSecond = 0.10288
	// ProUSDPerSecond is APIMart purchase price for mode=pro.
	ProUSDPerSecond = 0.13712
)

var ModelList = []string{
	"sora",
	"sora-2",
	"sora-2-pro",
	ModelKlingV3MotionControl,
}

var ChannelName = "apimart-video"

func IsVideoModel(model string) bool {
	switch strings.TrimSpace(model) {
	case "sora", "sora-2", "sora-2-pro", ModelKlingV3MotionControl:
		return true
	default:
		return false
	}
}

func IsMotionControlModel(model string) bool {
	return strings.TrimSpace(model) == ModelKlingV3MotionControl
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

func modeBillingRatio(mode string) float64 {
	if strings.EqualFold(strings.TrimSpace(mode), "pro") {
		return ProUSDPerSecond / StdUSDPerSecond
	}
	return 1
}

func defaultBillableSeconds(orientation string) int {
	if strings.EqualFold(strings.TrimSpace(orientation), "video") {
		return 30
	}
	return 10
}
