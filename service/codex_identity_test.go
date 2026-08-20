package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func withCodexIdentityOptions(t *testing.T, options map[string]string) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	previous := common.OptionMap
	common.OptionMap = map[string]string{}
	for key, value := range options {
		common.OptionMap[key] = value
	}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previous
		common.OptionMapRWMutex.Unlock()
	})
}

func TestCodexVersionPrecedenceAndFloor(t *testing.T) {
	for _, tt := range []struct {
		name    string
		raw     string
		want    string
		wantOK  bool
		options map[string]string
	}{
		{name: "floor passes", raw: "0.144.0", want: "0.144.0", wantOK: true},
		{name: "newer stable passes", raw: "0.145.2", want: "0.145.2", wantOK: true},
		{name: "leading v and spaces normalize", raw: " v0.144.6 ", want: "0.144.6", wantOK: true},
		{name: "below floor rejected", raw: "0.143.9", wantOK: false},
		{name: "prerelease rejected", raw: "0.144.1-beta.1", wantOK: false},
		{name: "control character rejected", raw: "0.144.\n1", wantOK: false},
		{name: "oversized rejected", raw: "0.144.1" + strings.Repeat("1", 65), wantOK: false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := NormalizeCodexClientVersion(tt.raw)
			require.Equal(t, tt.wantOK, ok)
			require.Equal(t, tt.want, got)
		})
	}

	withCodexIdentityOptions(t, map[string]string{
		"CodexClientVersion":       "0.146.0",
		"CodexSyncedClientVersion": "0.145.0",
	})
	require.Equal(t, "0.146.0", ResolveCodexClientIdentity().Version)

	withCodexIdentityOptions(t, map[string]string{
		"CodexClientVersion":       "0.143.9",
		"CodexSyncedClientVersion": "0.145.0",
	})
	require.Equal(t, "0.145.0", ResolveCodexClientIdentity().Version)

	withCodexIdentityOptions(t, map[string]string{
		"CodexClientVersion":       "0.144.9-rc.1",
		"CodexSyncedClientVersion": "0.143.9",
	})
	require.Equal(t, "0.144.0", ResolveCodexClientIdentity().Version)
}

func TestCodexUserAgentVersionIsRebuilt(t *testing.T) {
	withCodexIdentityOptions(t, map[string]string{
		"CodexClientVersion":         "0.145.3",
		"CodexClientUserAgent":       "codex-cli/0.100.1 linux-arm64",
		"CodexEnforceClientIdentity": "true",
	})
	identity := ResolveCodexClientIdentity()
	require.Equal(t, "0.145.3", identity.Version)
	require.Equal(t, "codex-cli/0.145.3 linux-arm64", identity.UserAgent)
	require.Equal(t, "codex_cli_rs", identity.Originator)

	withCodexIdentityOptions(t, map[string]string{
		"CodexClientVersion":   "0.145.3",
		"CodexClientUserAgent": "Mozilla/5.0 attacker",
	})
	identity = ResolveCodexClientIdentity()
	require.Equal(t, "codex-cli/0.145.3", identity.UserAgent)
	require.Equal(t, "codex_cli_rs", identity.Originator)
}

func TestApplyCodexInferenceIdentitySnapshotDoesNotRereadKillSwitch(t *testing.T) {
	withCodexIdentityOptions(t, map[string]string{
		"CodexEnforceClientIdentity": "false",
	})
	header := http.Header{}
	identity := CodexClientIdentity{
		UserAgent:  "codex-cli/0.145.0 test-suite",
		Originator: "codex_cli_rs",
		Version:    "0.145.0",
	}

	ApplyCodexInferenceIdentitySnapshot(header, identity)

	require.Equal(t, identity.UserAgent, header.Get("User-Agent"))
	require.Equal(t, identity.Originator, header.Get("originator"))
	require.Equal(t, identity.Version, header.Get(codexClientVersionHeader))
}

func TestCredentialIdentityOmitsVersion(t *testing.T) {
	withCodexIdentityOptions(t, map[string]string{
		"CodexClientVersion":   "0.145.4",
		"CodexClientUserAgent": "codex-cli/0.100.1 test-suite",
	})

	var refreshHeaders http.Header
	refreshServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		refreshHeaders = r.Header.Clone()
		_, _ = w.Write([]byte(`{"access_token":"access","refresh_token":"refresh","expires_in":3600}`))
	}))
	t.Cleanup(refreshServer.Close)
	_, err := refreshCodexOAuthToken(context.Background(), refreshServer.Client(), refreshServer.URL, codexOAuthClientID, "refresh")
	require.NoError(t, err)

	require.Equal(t, "codex-cli/0.145.4 test-suite", refreshHeaders.Get("User-Agent"))
	require.Equal(t, "codex_cli_rs", refreshHeaders.Get("originator"))
	require.Empty(t, refreshHeaders.Get("OpenAI-Client-Version"))

	var exchangeHeaders http.Header
	exchangeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		exchangeHeaders = r.Header.Clone()
		_, _ = w.Write([]byte(`{"access_token":"access","refresh_token":"refresh","expires_in":3600}`))
	}))
	t.Cleanup(exchangeServer.Close)
	_, err = exchangeCodexAuthorizationCode(context.Background(), exchangeServer.Client(), exchangeServer.URL, codexOAuthClientID, "code", "verifier", codexOAuthRedirectURI)
	require.NoError(t, err)

	require.Equal(t, "codex-cli/0.145.4 test-suite", exchangeHeaders.Get("User-Agent"))
	require.Equal(t, "codex_cli_rs", exchangeHeaders.Get("originator"))
	require.Empty(t, exchangeHeaders.Get("OpenAI-Client-Version"))
}

func TestModelsHeaderUsesValidCallerOrCanonicalFallback(t *testing.T) {
	allowPrivateCodexModelFetch(t)
	withCodexIdentityOptions(t, map[string]string{
		"CodexClientVersion": "0.145.5",
	})

	var headers []http.Header
	var queries []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		headers = append(headers, r.Header.Clone())
		queries = append(queries, r.URL.Query().Get("client_version"))
		_, _ = w.Write([]byte(`{"models":[{"slug":"gpt-5-codex"}]}`))
	}))
	t.Cleanup(server.Close)

	for _, callerVersion := range []string{"0.146.0", "0.143.9"} {
		status, _, err := FetchCodexModels(
			context.Background(),
			server.Client(),
			server.URL,
			&CodexOAuthKey{AccessToken: "access-token", AccountID: "account-id"},
			callerVersion,
		)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, status)
	}

	require.Equal(t, []string{"0.146.0", "0.143.9"}, queries)
	require.Equal(t, "codex-cli/0.146.0", headers[0].Get("User-Agent"))
	require.Equal(t, "codex_cli_rs", headers[0].Get("originator"))
	require.Equal(t, "0.146.0", headers[0].Get("OpenAI-Client-Version"))
	require.Equal(t, "codex-cli/0.145.5", headers[1].Get("User-Agent"))
	require.Equal(t, "codex_cli_rs", headers[1].Get("originator"))
	require.Equal(t, "0.145.5", headers[1].Get("OpenAI-Client-Version"))
}

func TestModelsIdentityKillSwitchRestoresLegacyCallerVersionHeader(t *testing.T) {
	allowPrivateCodexModelFetch(t)
	withCodexIdentityOptions(t, map[string]string{
		"CodexClientVersion":         "0.145.5",
		"CodexEnforceClientIdentity": "false",
	})

	var upstream http.Header
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstream = r.Header.Clone()
		require.Equal(t, "0.143.9", r.URL.Query().Get("client_version"))
		_, _ = w.Write([]byte(`{"models":[{"slug":"gpt-5-codex"}]}`))
	}))
	t.Cleanup(server.Close)

	status, _, err := FetchCodexModels(
		context.Background(),
		server.Client(),
		server.URL,
		&CodexOAuthKey{AccessToken: "access-token", AccountID: "account-id"},
		"0.143.9",
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, status)
	require.Equal(t, "codex-cli/0.143.9", upstream.Get("User-Agent"))
	require.Empty(t, upstream.Get("originator"))
	require.Empty(t, upstream.Get("OpenAI-Client-Version"))
}

func TestUsageResetAndProbeUseCanonicalIdentity(t *testing.T) {
	withCodexIdentityOptions(t, map[string]string{
		"CodexClientVersion":   "0.145.6",
		"CodexClientUserAgent": "codex-cli/0.100.1 usage-suite",
	})

	var usageHeaders http.Header
	usageServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		usageHeaders = r.Header.Clone()
		_, _ = w.Write([]byte(`{"usage":0}`))
	}))
	t.Cleanup(usageServer.Close)
	status, _, err := FetchCodexWhamUsage(context.Background(), usageServer.Client(), usageServer.URL, "tok", "acct")
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, status)

	require.Equal(t, "codex-cli/0.145.6 usage-suite", usageHeaders.Get("User-Agent"))
	require.Equal(t, "codex_cli_rs", usageHeaders.Get("originator"))
	require.Equal(t, "0.145.6", usageHeaders.Get("OpenAI-Client-Version"))

	var resetHeaders http.Header
	resetServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resetHeaders = r.Header.Clone()
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(resetServer.Close)
	status, _, err = ConsumeCodexResetCredit(context.Background(), resetServer.Client(), resetServer.URL, "tok", "acct", "018f89db-7792-7b5e-a360-7fd9279fd725")
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, status)

	require.Equal(t, "codex-cli/0.145.6 usage-suite", resetHeaders.Get("User-Agent"))
	require.Equal(t, "codex_cli_rs", resetHeaders.Get("originator"))
	require.Equal(t, "0.145.6", resetHeaders.Get("OpenAI-Client-Version"))
}
