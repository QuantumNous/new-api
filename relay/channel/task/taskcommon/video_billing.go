package taskcommon

import (
	"fmt"
	"strconv"
	"strings"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
)

func ConvertVideoBillingParams(_ *relaycommon.RelayInfo, req relaycommon.TaskSubmitReq) (*types.VideoBillingParams, error) {
	modelName := strings.ToLower(strings.TrimSpace(req.Model))
	switch {
	case strings.HasPrefix(modelName, "happyhorse-1.0"), strings.HasPrefix(modelName, "happyhorse-1.1"):
		return convertAliHappyHorseVideoBillingParams(req)
	case strings.HasPrefix(modelName, "kling/kling-v3-"):
		return convertAliKlingVideoBillingParams(req)
	default:
		return nil, fmt.Errorf("video billing converter not found for model %s", req.Model)
	}
}

func resolveVideoBillingDuration(req relaycommon.TaskSubmitReq) int {
	if req.Duration > 0 {
		return req.Duration
	}
	if req.Seconds != "" {
		if seconds, err := strconv.Atoi(req.Seconds); err == nil && seconds > 0 {
			return seconds
		}
	}
	return 5
}

func convertAliHappyHorseVideoBillingParams(req relaycommon.TaskSubmitReq) (*types.VideoBillingParams, error) {
	tier := "1080p"
	audioEnabled := true
	if req.Metadata != nil {
		if resolution, ok := req.Metadata["resolution"].(string); ok {
			switch strings.ToUpper(strings.TrimSpace(resolution)) {
			case "720P":
				tier = "720p"
			case "1080P":
				tier = "1080p"
			}
		}
		if audio, ok := req.Metadata["audio"].(bool); ok {
			audioEnabled = audio
		}
	}
	return &types.VideoBillingParams{
		Tier:            tier,
		DurationSeconds: resolveVideoBillingDuration(req),
		AudioEnabled:    audioEnabled,
	}, nil
}

func convertAliKlingVideoBillingParams(req relaycommon.TaskSubmitReq) (*types.VideoBillingParams, error) {
	tier := "1080p"
	audioEnabled := true
	if req.Metadata != nil {
		if mode, ok := req.Metadata["mode"].(string); ok && strings.EqualFold(strings.TrimSpace(mode), "std") {
			tier = "720p"
		}
		if audio, ok := req.Metadata["audio"].(bool); ok {
			audioEnabled = audio
		}
	}
	return &types.VideoBillingParams{
		Tier:            tier,
		DurationSeconds: resolveVideoBillingDuration(req),
		AudioEnabled:    audioEnabled,
	}, nil
}
