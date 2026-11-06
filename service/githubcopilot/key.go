package githubcopilot

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/google/uuid"
)

var githubLoginPattern = regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9-]{0,98}[A-Za-z0-9])?$`)

type ChannelKey struct {
	ProfileID string `json:"profile_id"`
	Login     string `json:"login,omitempty"`
}

func canonicalProfileID(raw string) (string, error) {
	parsed, err := uuid.Parse(strings.TrimSpace(raw))
	if err != nil {
		return "", fmt.Errorf("Copilot profile_id must be a valid UUID")
	}
	return parsed.String(), nil
}

func ParseChannelKey(raw string) (ChannelKey, error) {
	trimmed := strings.TrimSpace(raw)
	if !strings.HasPrefix(trimmed, "{") {
		return ChannelKey{}, fmt.Errorf("GitHub Copilot key must be a JSON object created by Connect GitHub Copilot")
	}
	var payload map[string]any
	if err := common.UnmarshalJsonStr(trimmed, &payload); err != nil {
		return ChannelKey{}, fmt.Errorf("GitHub Copilot key must be a valid JSON object")
	}
	profileValue, ok := payload["profile_id"].(string)
	if !ok || strings.TrimSpace(profileValue) == "" {
		return ChannelKey{}, fmt.Errorf("GitHub Copilot key JSON must include profile_id")
	}
	profileID, err := canonicalProfileID(profileValue)
	if err != nil {
		return ChannelKey{}, err
	}
	login := ""
	if value, exists := payload["login"]; exists && value != nil {
		loginValue, ok := value.(string)
		if !ok {
			return ChannelKey{}, fmt.Errorf("GitHub Copilot key login must be a string")
		}
		login = strings.TrimSpace(loginValue)
		if login != "" && !githubLoginPattern.MatchString(login) {
			return ChannelKey{}, fmt.Errorf("GitHub Copilot key login is invalid")
		}
	}
	return ChannelKey{ProfileID: profileID, Login: login}, nil
}

func MarshalChannelKey(key ChannelKey) (string, error) {
	data, err := common.Marshal(key)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
