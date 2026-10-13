package fingerprint

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"sort"
	"strings"

	"smart-router/api"
)

type Document struct {
	Provider  string            `json:"provider"`
	Revision  string            `json:"revision"`
	Healthy   bool              `json:"healthy"`
	Models    []string          `json:"models"`
	Protocols []api.Protocol    `json:"protocols"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

func Compute(document Document) (string, error) {
	if document.Provider == "" {
		return "", errors.New("provider is required")
	}
	for key := range document.Metadata {
		normalized := strings.ToLower(key)
		for _, forbidden := range []string{"token", "cookie", "jwt", "key", "secret", "prompt"} {
			if strings.Contains(normalized, forbidden) {
				return "", errors.New("sensitive metadata keys are forbidden")
			}
		}
	}
	document.Models = append([]string(nil), document.Models...)
	document.Protocols = append([]api.Protocol(nil), document.Protocols...)
	sort.Strings(document.Models)
	sort.Slice(document.Protocols, func(left, right int) bool {
		return document.Protocols[left] < document.Protocols[right]
	})
	payload, err := json.Marshal(document)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:]), nil
}
