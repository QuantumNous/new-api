package system_setting

import (
	"github.com/QuantumNous/new-api/setting/config"
)

// ConnectSettings controls BoxAI Connect, the desktop app that points AI coding
// clients (Claude Code, Codex CLI, Gemini CLI, Grok Build, OpenCode, OpenClaw,
// Hermes) at this deployment.
//
// Token issuance policy — access token lifetime, refresh lifetime, broker
// audience — is deliberately not duplicated here. Both desktop products share
// one JWT audience and one signing key, so those stay in DesktopSettings.
type ConnectSettings struct {
	Enabled bool `json:"enabled"`
	// ReleaseManifestURL points at the releases.json the Connect publish
	// pipeline writes to Cloudflare R2. The download page reads it directly, so
	// shipping a release never needs a backend deploy.
	ReleaseManifestURL string `json:"release_manifest_url"`
	// DownloadURL is the manual override used when no manifest is reachable.
	DownloadURL string `json:"download_url"`
	MinVersion  string `json:"min_version"`
	// TokenName is the fallback label for a relay key Connect creates, used only
	// when the app does not send its own device-specific name.
	TokenName string `json:"token_name"`
	// DefaultModel is the model a freshly signed-in install selects. It is
	// resolved against what the account can actually reach, so naming a model
	// this deployment does not serve degrades to the account's first chat model
	// rather than producing a client that fails on its first request.
	DefaultModel string `json:"default_model"`
}

var defaultConnectSettings = ConnectSettings{
	Enabled:            false,
	ReleaseManifestURL: "https://dl.you-box.com/connect/releases.json",
	DownloadURL:        "",
	MinVersion:         "",
	TokenName:          "BoxAI Connect",
	DefaultModel:       "",
}

func init() {
	config.GlobalConfig.Register("connect", &defaultConnectSettings)
}

func GetConnectSettings() *ConnectSettings {
	if defaultConnectSettings.TokenName == "" {
		defaultConnectSettings.TokenName = "BoxAI Connect"
	}
	return &defaultConnectSettings
}
