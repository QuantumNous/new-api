package cursor_agent

import "testing"

func TestParseCredentialRaw(t *testing.T) {
	cred, err := ParseCredential("  crsr_abc123  ")
	if err != nil {
		t.Fatal(err)
	}
	if cred.APIKey != "crsr_abc123" {
		t.Fatalf("got %q", cred.APIKey)
	}
}

func TestParseCredentialJSON(t *testing.T) {
	cred, err := ParseCredential(`{"api_key":"crsr_from_json"}`)
	if err != nil {
		t.Fatal(err)
	}
	if cred.APIKey != "crsr_from_json" {
		t.Fatalf("got %q", cred.APIKey)
	}
}

func TestParseCredentialEnvForm(t *testing.T) {
	cred, err := ParseCredential("CURSOR_API_KEY=crsr_env")
	if err != nil {
		t.Fatal(err)
	}
	if cred.APIKey != "crsr_env" {
		t.Fatalf("got %q", cred.APIKey)
	}
}

func TestNormalizeModel(t *testing.T) {
	cases := map[string]string{
		"composer-2.5":              "composer-2.5",
		"claude-opus-5":             "claude-opus-5",
		"claude-fable-5":            "claude-fable-5",
		"default":                   "default",
		"cursor-agent/composer-2.5": "composer-2.5",
		"cr/composer-2":             "composer-2",
		"CURSOR-AGENT/default":      "default",
	}
	for in, want := range cases {
		if got := NormalizeModel(in); got != want {
			t.Fatalf("NormalizeModel(%q)=%q want %q", in, got, want)
		}
	}
}

func TestDefaultSidecarBaseURLPointsOfficialSDKHarness(t *testing.T) {
	t.Setenv("CURSOR_AGENT_SIDECAR_BASE_URL", "")
	got := DefaultSidecarBaseURL()
	if got != "http://127.0.0.1:3927" {
		t.Fatalf("DefaultSidecarBaseURL=%q", got)
	}
}

func TestParseCredentialPreservesOptionalOAuthTokens(t *testing.T) {
	credential, err := ParseCredential(`{"api_key":"cursor-user-key","access_token":"access","refresh_token":"refresh"}`)
	if err != nil {
		t.Fatal(err)
	}
	if credential.APIKey != "cursor-user-key" || credential.AccessToken != "access" || credential.RefreshToken != "refresh" {
		t.Fatalf("credential=%+v", credential)
	}
}

func TestMarshalCredentialKeepsSDKAndDashboardCredentials(t *testing.T) {
	raw, err := MarshalCredential(&Credential{APIKey: " cursor-user-key ", AccessToken: " access ", RefreshToken: " refresh "})
	if err != nil {
		t.Fatal(err)
	}
	credential, err := ParseCredential(raw)
	if err != nil {
		t.Fatal(err)
	}
	if credential.APIKey != "cursor-user-key" || credential.AccessToken != "access" || credential.RefreshToken != "refresh" {
		t.Fatalf("credential=%+v", credential)
	}
}

func TestResolveSidecarBaseURLPrefersDeploymentRuntime(t *testing.T) {
	t.Setenv("CURSOR_AGENT_SIDECAR_BASE_URL", "http://cursor-sdk-runtime:3927/")
	if got := ResolveSidecarBaseURL("http://legacy-sidecar:3927"); got != "http://cursor-sdk-runtime:3927" {
		t.Fatalf("ResolveSidecarBaseURL=%q", got)
	}
}

func TestResolveSidecarBaseURLFallsBackToChannel(t *testing.T) {
	t.Setenv("CURSOR_AGENT_SIDECAR_BASE_URL", "")
	if got := ResolveSidecarBaseURL("http://legacy-sidecar:3927/"); got != "http://legacy-sidecar:3927" {
		t.Fatalf("ResolveSidecarBaseURL=%q", got)
	}
}

func TestMapSDKModelUsesBareCatalogSKUs(t *testing.T) {
	for _, model := range ModelList {
		if got := MapSDKModel(model); got != model {
			t.Fatalf("MapSDKModel(%q)=%q want live catalog SKU unchanged", model, got)
		}
	}

	cases := map[string]string{
		"claude-opus-5":        "claude-opus-5",
		"claude-fable-5":       "claude-fable-5",
		"claude-sonnet-5":      "claude-sonnet-5",
		"claude-opus-4.8":      "claude-opus-4-8",
		"claude-sonnet-4.6":    "claude-sonnet-4-6",
		"claude-haiku-4.5":     "claude-haiku-4-5",
		"cursor-agent/gpt-5.4": "gpt-5.4",
		"gpt-5.6-sol":          "gpt-5.6-sol",
		"glm-5.2":              "glm-5.2",
		"unknown-future-model": "unknown-future-model",
	}
	for in, want := range cases {
		if got := MapSDKModel(in); got != want {
			t.Fatalf("MapSDKModel(%q)=%q want %q", in, got, want)
		}
	}
}
