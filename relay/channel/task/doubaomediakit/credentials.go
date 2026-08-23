package doubaomediakit

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// Credentials contains the two independent Bearer tokens used by this
// composite channel. It stays internal to request construction so neither
// key leaks through task data or public API responses.
type Credentials struct {
	ArkAPIKey      string `json:"ark_api_key"`
	MediaKitAPIKey string `json:"mediakit_api_key"`
}

func ParseCredentials(raw string) (Credentials, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return Credentials{}, fmt.Errorf("channel key is required")
	}

	var value Credentials
	if strings.HasPrefix(raw, "{") {
		if err := common.Unmarshal([]byte(raw), &value); err != nil {
			return Credentials{}, fmt.Errorf("invalid JSON channel key: %w", err)
		}
	} else {
		parts := strings.SplitN(raw, "|", 2)
		if len(parts) != 2 {
			return Credentials{}, fmt.Errorf("channel key must include both Ark and MediaKit API keys")
		}
		value.ArkAPIKey = parts[0]
		value.MediaKitAPIKey = parts[1]
	}

	value.ArkAPIKey = strings.TrimSpace(value.ArkAPIKey)
	value.MediaKitAPIKey = strings.TrimSpace(value.MediaKitAPIKey)
	if value.ArkAPIKey == "" || value.MediaKitAPIKey == "" {
		return Credentials{}, fmt.Errorf("both Ark and MediaKit API keys are required")
	}
	return value, nil
}
