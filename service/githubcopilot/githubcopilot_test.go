package githubcopilot

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseChannelKey(t *testing.T) {
	key, err := ParseChannelKey(`{"profile_id":"11111111-1111-4111-8111-111111111111","login":"octocat"}`)
	require.NoError(t, err)
	assert.Equal(t, "11111111-1111-4111-8111-111111111111", key.ProfileID)
	assert.Equal(t, "octocat", key.Login)

	roundTrip, err := MarshalChannelKey(key)
	require.NoError(t, err)
	assert.JSONEq(t, `{"profile_id":"11111111-1111-4111-8111-111111111111","login":"octocat"}`, roundTrip)

	for name, raw := range map[string]string{
		"plain key":       "github-token",
		"missing profile": `{"login":"octocat"}`,
		"invalid uuid":    `{"profile_id":"profile-1"}`,
		"invalid login":   `{"profile_id":"11111111-1111-4111-8111-111111111111","login":"not a login"}`,
	} {
		t.Run(name, func(t *testing.T) {
			_, err := ParseChannelKey(raw)
			require.Error(t, err)
		})
	}
}

func TestParseEndpoint(t *testing.T) {
	endpoint, err := parseEndpoint(endpointWire{
		Type:      "anthropic",
		Transport: "http",
		BaseURL:   "https://api.githubcopilot.com",
		APIKey:    "endpoint-key",
		Headers:   map[string]string{"Editor-Version": "new-api"},
		SessionToken: &struct {
			Token     string `json:"token"`
			Header    string `json:"header"`
			Model     string `json:"model"`
			ExpiresAt string `json:"expiresAt"`
		}{
			Token:     "session-token",
			Header:    "Copilot-Session-Token",
			Model:     "claude-sonnet-4",
			ExpiresAt: "2026-11-07T06:00:00Z",
		},
	}, "claude-sonnet-4")
	require.NoError(t, err)
	assert.Equal(t, "https://api.githubcopilot.com", endpoint.BaseURL)
	assert.Equal(t, "endpoint-key", endpoint.APIKey)
	assert.Equal(t, "new-api", endpoint.Headers["Editor-Version"])
	require.NotNil(t, endpoint.SessionToken)
	assert.Equal(t, "Copilot-Session-Token", endpoint.SessionToken.Header)
	assert.False(t, endpoint.ExpiresAt.IsZero())

	for name, wire := range map[string]endpointWire{
		"insecure url": {
			Type:    "openai",
			BaseURL: "http://api.githubcopilot.com",
		},
		"query in url": {
			Type:    "openai",
			BaseURL: "https://api.githubcopilot.com?proxy=1",
		},
		"invalid expiry": {
			Type:      "openai",
			BaseURL:   "https://api.githubcopilot.com",
			ExpiresAt: "tomorrow",
		},
		"header injection": {
			Type:    "openai",
			BaseURL: "https://api.githubcopilot.com",
			Headers: map[string]string{"X-Test": "safe\r\nInjected: value"},
		},
		"different model token": {
			Type:    "openai",
			BaseURL: "https://api.githubcopilot.com",
			SessionToken: &struct {
				Token     string `json:"token"`
				Header    string `json:"header"`
				Model     string `json:"model"`
				ExpiresAt string `json:"expiresAt"`
			}{Token: "token", Header: "X-Token", Model: "gpt-5"},
		},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := parseEndpoint(wire, "claude-sonnet-4")
			require.Error(t, err)
		})
	}
}

func TestIsolatedEnvironmentUsesCopilotProxyOnly(t *testing.T) {
	t.Setenv("GITHUB_TOKEN", "secret")
	t.Setenv("HTTPS_PROXY", "http://global-proxy.invalid")
	t.Setenv("COPILOT_PROXY", "http://127.0.0.1:7890")

	env := isolatedEnvironment(t.TempDir())
	assert.Contains(t, env, "http_proxy=http://127.0.0.1:7890")
	assert.Contains(t, env, "https_proxy=http://127.0.0.1:7890")
	for _, item := range env {
		assert.NotContains(t, item, "GITHUB_TOKEN=secret")
		assert.NotContains(t, item, "global-proxy.invalid")
	}
}

func TestWriteProfileSettingsEnablesPlaintextStorage(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, writeProfileSettings(dir))

	path := filepath.Join(dir, "settings.json")
	data, err := os.ReadFile(path)
	require.NoError(t, err)
	assert.JSONEq(t, `{"storeTokenPlaintext":true}`, string(data))
	info, err := os.Stat(path)
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0o600), info.Mode().Perm())
}

func TestSelectCatalogModelsPrefersEnabledDefault(t *testing.T) {
	catalog := modelCatalog{Data: []catalogModel{
		{
			ID:            "disabled-default",
			Policy:        &modelPolicy{State: "disabled"},
			Capabilities:  &catalogCapabilities{Type: "chat"},
			IsChatDefault: true,
		},
		{
			ID:           "auto",
			Policy:       &modelPolicy{State: "enabled"},
			Capabilities: &catalogCapabilities{Type: "chat"},
		},
		{
			ID:            "paid-default",
			Policy:        &modelPolicy{State: "enabled"},
			Capabilities:  &catalogCapabilities{Type: "chat"},
			IsChatDefault: true,
			Billing:       &catalogBilling{RestrictedTo: []string{"business"}},
		},
		{
			ID:             "gpt-4.1",
			Name:           "GPT-4.1",
			Policy:         &modelPolicy{State: "enabled"},
			Capabilities:   &catalogCapabilities{Type: "chat"},
			IsChatDefault:  true,
			IsChatFallback: true,
		},
	}}

	models := selectCatalogModels(catalog)
	require.Len(t, models, 1)
	assert.Equal(t, "gpt-4.1", models[0].ID)
	assert.Equal(t, "GPT-4.1", models[0].Name)
}
