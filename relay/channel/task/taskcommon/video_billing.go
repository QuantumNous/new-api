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

func resolveMetadataString(metadata map[string]interface{}, key string) (string, bool) {
	if metadata == nil {
		return "", false
	}
	value, ok := metadata[key]
	if !ok {
		return "", false
	}
	str, ok := value.(string)
	if !ok {
		return "", false
	}
	str = strings.TrimSpace(str)
	return str, str != ""
}

func resolveMetadataBool(metadata map[string]interface{}, key string) (bool, bool) {
	if metadata == nil {
		return false, false
	}
	value, ok := metadata[key]
	if !ok {
		return false, false
	}
	boolean, ok := value.(bool)
	return boolean, ok
}
