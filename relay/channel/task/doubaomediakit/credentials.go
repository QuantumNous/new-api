package doubaomediakit

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// credentials contains the two independent Bearer tokens used by this
// composite channel. It deliberately stays internal so neither key can leak
// through task data or public API responses.
type credentials struct {
	ArkAPIKey      string `json:"ark_api_key"`
	MediaKitAPIKey string `json:"mediakit_api_key"`
}

func parseCredentials(raw string) (credentials, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return credentials{}, fmt.Errorf("channel key is required")
	}

	var value credentials
	if strings.HasPrefix(raw, "{") {
		if err := common.Unmarshal([]byte(raw), &value); err != nil {
			return credentials{}, fmt.Errorf("invalid JSON channel key: %w", err)
		}
	} else {
		parts := strings.SplitN(raw, "|", 2)
		if len(parts) != 2 {
			return credentials{}, fmt.Errorf("channel key must use ark_api_key|mediakit_api_key or JSON format")
		}
		value.ArkAPIKey = parts[0]
		value.MediaKitAPIKey = parts[1]
	}

	value.ArkAPIKey = strings.TrimSpace(value.ArkAPIKey)
	value.MediaKitAPIKey = strings.TrimSpace(value.MediaKitAPIKey)
	if value.ArkAPIKey == "" || value.MediaKitAPIKey == "" {
		return credentials{}, fmt.Errorf("both Ark and MediaKit API keys are required")
	}
	return value, nil
}
