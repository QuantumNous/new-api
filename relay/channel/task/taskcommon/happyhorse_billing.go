package taskcommon

import (
	"strings"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
)

func convertAliHappyHorseVideoBillingParams(req relaycommon.TaskSubmitReq) (*types.VideoBillingParams, error) {
	tier := resolveHappyHorseBillingTier(req)
	audioEnabled := true
	if audio, ok := resolveMetadataBool(req.Metadata, "audio"); ok {
		audioEnabled = audio
	}
	return &types.VideoBillingParams{
		Tier:            tier,
		DurationSeconds: resolveVideoBillingDuration(req),
		AudioEnabled:    audioEnabled,
	}, nil
}

func resolveHappyHorseBillingTier(req relaycommon.TaskSubmitReq) string {
	if resolution, ok := resolveMetadataString(req.Metadata, "resolution"); ok {
		if tier, ok := normalizeHappyHorseTier(resolution); ok {
			return tier
		}
	}
	if tier, ok := normalizeHappyHorseTier(req.Size); ok {
		return tier
	}
	return "1080p"
}

func normalizeHappyHorseTier(value string) (string, bool) {
	switch strings.ToUpper(strings.TrimSpace(value)) {
	case "480P", "832*480", "480*832", "624*624":
		return "480p", true
	case "720P", "1280*720", "720*1280", "960*960", "1088*832", "832*1088":
		return "720p", true
	case "1080P", "1920*1080", "1080*1920", "1440*1440", "1632*1248", "1248*1632":
		return "1080p", true
	case "2K":
		return "2k", true
	case "4K":
		return "4k", true
	default:
		return "", false
	}
}
