package cursor_agent

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// Credential is the channel key payload for the official Cursor SDK harness.
// Accepts either a raw Cursor API key string or JSON:
//
//	{"api_key":"crsr_..."}
type Credential struct {
	APIKey       string `json:"api_key,omitempty"`
	AccessToken  string `json:"access_token,omitempty"`
	RefreshToken string `json:"refresh_token,omitempty"`
}

// ParseCredential normalizes channel.Key into an API key.
func ParseCredential(raw string) (*Credential, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return nil, errors.New("cursor_agent: empty api key")
	}
	// JSON envelope
	if strings.HasPrefix(s, "{") {
		var cred Credential
		if err := common.Unmarshal([]byte(s), &cred); err != nil {
			return nil, errors.New("cursor_agent: invalid credential json")
		}
		cred.APIKey = strings.TrimSpace(cred.APIKey)
		cred.AccessToken = strings.TrimSpace(cred.AccessToken)
		cred.RefreshToken = strings.TrimSpace(cred.RefreshToken)
		if cred.APIKey == "" {
			// also accept {"key":"..."}
			var alt struct {
				Key string `json:"key"`
			}
			_ = common.Unmarshal([]byte(s), &alt)
			cred.APIKey = strings.TrimSpace(alt.Key)
		}
		if cred.APIKey == "" {
			return nil, errors.New("cursor_agent: credential json missing api_key")
		}
		return &cred, nil
	}
	// KEY=value forms
	if strings.Contains(s, "=") && !strings.Contains(s, " ") {
		parts := strings.SplitN(s, "=", 2)
		k := strings.ToUpper(strings.TrimSpace(parts[0]))
		if k == "CURSOR_API_KEY" || k == "API_KEY" || k == "KEY" {
			s = strings.TrimSpace(parts[1])
		}
	}
	s = strings.Trim(s, "\"'")
	if s == "" {
		return nil, errors.New("cursor_agent: empty api key")
	}
	return &Credential{APIKey: s}, nil
}

// MarshalCredential returns the minimal channel credential envelope. Legacy
// OAuth fields remain accepted for backward compatibility, but both model
// execution and dashboard usage resolve from APIKey.
func MarshalCredential(credential *Credential) (string, error) {
	if credential == nil || strings.TrimSpace(credential.APIKey) == "" {
		return "", errors.New("cursor_agent: credential missing api_key")
	}
	normalized := Credential{
		APIKey:       strings.TrimSpace(credential.APIKey),
		AccessToken:  strings.TrimSpace(credential.AccessToken),
		RefreshToken: strings.TrimSpace(credential.RefreshToken),
	}
	data, err := common.Marshal(normalized)
	if err != nil {
		return "", fmt.Errorf("cursor_agent: marshal credential: %w", err)
	}
	return string(data), nil
}

// DefaultSidecarBaseURL is used when the channel has no base_url.
// Override with env CURSOR_AGENT_SIDECAR_BASE_URL.
// Default points at the official @cursor/sdk harness sidecar.
func DefaultSidecarBaseURL() string {
	if v := strings.TrimSpace(os.Getenv("CURSOR_AGENT_SIDECAR_BASE_URL")); v != "" {
		return strings.TrimRight(v, "/")
	}
	return "http://127.0.0.1:3927"
}

// ResolveSidecarBaseURL makes the deployment-owned immutable runtime
// authoritative when configured. Channel base_url remains the fallback for
// local development and legacy installations that run a standalone sidecar.
func ResolveSidecarBaseURL(channelBaseURL string) string {
	if v := strings.TrimSpace(os.Getenv("CURSOR_AGENT_SIDECAR_BASE_URL")); v != "" {
		return strings.TrimRight(v, "/")
	}
	if v := strings.TrimSpace(channelBaseURL); v != "" {
		return strings.TrimRight(v, "/")
	}
	return DefaultSidecarBaseURL()
}

// sdkModelAliases normalizes common legacy/public spellings to the bare SKUs
// returned by Cursor.models.list(). Unknown names pass through so a catalog
// update does not require a new-api release.
var sdkModelAliases = map[string]string{
	"claude-sonnet-4.6":          "claude-sonnet-4-6",
	"claude-4.6-sonnet":          "claude-sonnet-4-6",
	"claude-4-6-sonnet":          "claude-sonnet-4-6",
	"claude-sonnet-4-6-thinking": "claude-sonnet-4-6",
	"claude-sonnet-4.5":          "claude-sonnet-4-5",
	"claude-4.5-sonnet":          "claude-sonnet-4-5",
	"claude-haiku-4.5":           "claude-haiku-4-5",
	"claude-opus-4.8":            "claude-opus-4-8",
	"claude-opus-4.7":            "claude-opus-4-7",
	"claude-opus-4.6":            "claude-opus-4-6",
	"claude-opus-4.5":            "claude-opus-4-5",
}

// NormalizeModel accepts bare Cursor/new-api SKUs and strips a legacy optional
// prefix if present so old channel model lists still work.
func NormalizeModel(model string) string {
	m := strings.TrimSpace(model)
	for _, p := range []string{"cursor-agent/", "cr/", "cursor/", "[cursor] "} {
		lower := strings.ToLower(m)
		if strings.HasPrefix(lower, p) {
			m = strings.TrimSpace(m[len(p):])
			break
		}
	}
	// strip optional bracket form leftover: "[cursor] foo" already handled
	m = strings.TrimSpace(m)
	return m
}

// MapSDKModel keeps the official SDK on its canonical bare catalog SKU.
func MapSDKModel(model string) string {
	m := NormalizeModel(model)
	if mapped, ok := sdkModelAliases[strings.ToLower(m)]; ok {
		return mapped
	}
	return m
}

// MapSDKModelWithEffort carries Grok effort to the SDK sidecar in an internal
// selector. All other models use Cursor's canonical bare SKU and catalog
// defaults. The public response model remains unchanged.
func MapSDKModelWithEffort(model, effort string) (string, error) {
	m := MapSDKModel(model)
	if m == "" {
		return m, nil
	}
	normalizedEffort := normalizeReasoningEffort(effort)
	switch strings.ToLower(m) {
	case "grok-4.5":
		if normalizedEffort == "" {
			normalizedEffort = "medium"
		}
		if normalizedEffort == "xhigh" {
			normalizedEffort = "high"
		}
		if normalizedEffort != "low" && normalizedEffort != "medium" && normalizedEffort != "high" {
			return "", fmt.Errorf("cursor_agent: grok-4.5 does not support reasoning effort %q", effort)
		}
		return "cursor-grok-4.5-" + normalizedEffort, nil
	case "grok-4.6":
		if normalizedEffort == "" {
			normalizedEffort = "medium"
		}
		if normalizedEffort != "low" && normalizedEffort != "medium" && normalizedEffort != "high" && normalizedEffort != "xhigh" {
			return "", fmt.Errorf("cursor_agent: grok-4.6 does not support reasoning effort %q", effort)
		}
		return "cursor-grok-4.6-" + normalizedEffort, nil
	}
	return m, nil
}

func normalizeReasoningEffort(effort string) string {
	switch strings.ToLower(strings.TrimSpace(effort)) {
	case "", "none":
		return ""
	case "minimal":
		return "low"
	case "max":
		return "xhigh"
	default:
		return strings.ToLower(strings.TrimSpace(effort))
	}
}
