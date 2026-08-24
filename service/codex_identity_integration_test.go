package service

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCodexServiceEgressZeroOriginalIdentityMatrix(t *testing.T) {
	allowPrivateCodexModelFetch(t)
	const marker = "orig-marker-codex-service"
	withCodexIdentityOptions(t, map[string]string{
		OptionKeyCodexClientUserAgent:       "Mozilla/5.0 " + marker + "-ua",
		OptionKeyCodexClientVersion:         marker + "-version",
		OptionKeyCodexSyncedClientVersion:   "0.145.8",
		OptionKeyCodexEnforceClientIdentity: "true",
	})

	type capture struct {
		name   string
		path   string
		header http.Header
		body   []byte
	}
	var captures []capture
	nextName := ""
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		captures = append(captures, capture{
			name:   nextName,
			path:   r.URL.Path,
			header: r.Header.Clone(),
			body:   body,
		})
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/oauth/token":
			_, _ = w.Write([]byte(`{"access_token":"access-new","refresh_token":"refresh-new","expires_in":3600}`))
		case "/backend-api/codex/models":
			_, _ = w.Write([]byte(`{"models":[{"slug":"gpt-5-codex"}]}`))
		default:
			_, _ = w.Write([]byte(`{"ok":true}`))
		}
	}))
	t.Cleanup(server.Close)

	run := func(name string, call func() error) capture {
		t.Helper()
		nextName = name
		before := len(captures)
		require.NoError(t, call(), name)
		require.Len(t, captures, before+1, name)
		return captures[before]
	}

	rows := []capture{
		run("oauth refresh", func() error {
			_, err := refreshCodexOAuthToken(context.Background(), server.Client(), server.URL+"/oauth/token", codexOAuthClientID, "refresh-token")
			return err
		}),
		run("oauth exchange", func() error {
			_, err := exchangeCodexAuthorizationCode(context.Background(), server.Client(), server.URL+"/oauth/token", codexOAuthClientID, "code", "verifier", codexOAuthRedirectURI)
			return err
		}),
		run("models", func() error {
			status, _, err := FetchCodexModels(context.Background(), server.Client(), server.URL, &CodexOAuthKey{AccessToken: "access-token", AccountID: "account-id"}, "0.143.9")
			require.Equal(t, http.StatusOK, status)
			return err
		}),
		run("usage", func() error {
			status, _, err := FetchCodexWhamUsage(context.Background(), server.Client(), server.URL, "access-token", "account-id")
			require.Equal(t, http.StatusOK, status)
			return err
		}),
		run("reset credit", func() error {
			status, _, err := ConsumeCodexResetCredit(context.Background(), server.Client(), server.URL, "access-token", "account-id", "018f89db-7792-4b5e-a360-7fd9279fd725")
			require.Equal(t, http.StatusOK, status)
			return err
		}),
	}

	for _, row := range rows {
		t.Run(row.name, func(t *testing.T) {
			all := serviceEgressHeaderString(row.header) + "\n" + string(row.body)
			switch row.name {
			case "oauth refresh", "oauth exchange":
				require.Equal(t, "/oauth/token", row.path)
			case "models":
				require.Equal(t, "/backend-api/codex/models", row.path)
			case "usage":
				require.Equal(t, "/backend-api/wham/usage", row.path)
			case "reset credit":
				require.Equal(t, "/backend-api/wham/rate-limit-reset-credits/consume", row.path)
			}
			require.NotContains(t, all, marker)
			require.Equal(t, "codex_cli_rs", row.header.Get("originator"))
			require.Equal(t, "codex-cli/0.145.8", row.header.Get("User-Agent"))
			if strings.HasPrefix(row.name, "oauth ") {
				require.Empty(t, row.header.Get(codexClientVersionHeader))
			} else {
				require.Equal(t, "0.145.8", row.header.Get(codexClientVersionHeader))
			}
		})
	}
}

func serviceEgressHeaderString(header http.Header) string {
	var b bytes.Buffer
	for name, values := range header {
		b.WriteString(name)
		b.WriteByte(':')
		b.WriteString(strings.Join(values, ","))
		b.WriteByte('\n')
	}
	return b.String()
}
