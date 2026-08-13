package yksd

import "strings"

const (
	ChannelName  = "yk-sd"
	createPath   = "/v2/model-center/tasks"
	queryPathFmt = "/v2/model-center/tasks/"
	assetUpload  = "/asset/seedance2/assetUpload"
	assetDetail  = "/asset/seedance2/assetDetail"
	defaultBase  = "https://zcbservice.aizfw.cn/kyyReactApiServer"

	// defaultDurationSeconds matches upstream docs when client omits duration.
	defaultDurationSeconds = 5

	assetPollIntervalMS = 2000
	assetPollTimeoutMS  = 120000
)

// ModelList is the client-facing model list for yk-sd.
var ModelList = []string{
	"seedance2.0-yk-special",
	"seedance2.0-yk-discount",
	"sd_2.0_special",
	"sd_2.0_discount",
}

func resolveUpstreamModel(modelName string) string {
	compact := strings.ToLower(strings.TrimSpace(modelName))
	compact = strings.ReplaceAll(compact, " ", "")
	switch compact {
	case "seedance2.0-yk-special", "seedance2.0-ykspecial", "sd_2.0_special", "sd-2.0-special":
		return "sd_2.0_special"
	case "seedance2.0-yk-discount", "seedance2.0-ykdiscount", "sd_2.0_discount", "sd-2.0-discount":
		return "sd_2.0_discount"
	default:
		return strings.TrimSpace(modelName)
	}
}

func isYkSdPerSecondModel(modelName string) bool {
	u := resolveUpstreamModel(modelName)
	return u == "sd_2.0_special" || u == "sd_2.0_discount"
}

func allowedResolutions(upstreamModel string) map[string]struct{} {
	switch resolveUpstreamModel(upstreamModel) {
	case "sd_2.0_special":
		return map[string]struct{}{
			"720p": {}, "1080p": {}, "2k": {}, "4k": {},
		}
	case "sd_2.0_discount":
		return map[string]struct{}{
			"480p": {}, "720p": {}, "1080p": {},
		}
	default:
		return nil
	}
}
