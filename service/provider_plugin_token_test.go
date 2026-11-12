package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/jsplugin"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// exchangePluginSource exchanges a static key at the vendor's token
// endpoint; checkPluginSource checks the key lines an administrator types in.
const (
	exchangePluginSource = `
export const meta = {apiVersion: 1, key: "%KEY%", name: "Exchange", version: "1.0.0", author: {name: "Test"},
  relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/chat"}]};
export function exchangeKey(ctx) {
  const response = utils.fetch({url: ctx.baseUrl + "/token", method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({key: ctx.apiKey, region: ctx.config.region || ""})});
  if (response.status === 401) return {error: {status: 401, message: "the vendor rejected the key"}};
  if (response.status !== 200) throw new Error("token endpoint answered " + response.status);
  const result = {token: response.body.token};
  if (response.body.expiresIn > 0) result.expiresAt = utils.unixNow() + response.body.expiresIn;
  return result;
}
`
	checkPluginSource = `
export const meta = {apiVersion: 1, key: "%KEY%", name: "Check", version: "1.0.0", author: {name: "Test"},
  relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/chat"}]};
export function checkKey(ctx, key) {
  if (key.startsWith("good")) return;
  if (key === "localized") return {error: {en: "The key is malformed", "zh-CN": "密钥格式错误"}};
  if (key === "throws") throw new Error("checker crashed");
  return {error: "bad key " + key + " for " + ctx.config.region};
}
`
)

// tokenServer is a vendor token endpoint that counts exchanges.
type tokenServer struct {
	*httptest.Server
	exchanges atomic.Int32
	expiresIn atomic.Int64
	delay     atomic.Int64
}

func newTokenServer(t *testing.T) *tokenServer {
	t.Helper()
	server := &tokenServer{}
	server.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := server.exchanges.Add(1)
		time.Sleep(time.Duration(server.delay.Load()))
		var form map[string]string
		_ = common.DecodeJson(r.Body, &form)
		switch form["key"] {
		case "sk-reject":
			writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid key"})
		case "sk-broken":
			writeJSON(w, http.StatusBadGateway, map[string]any{"error": "unavailable"})
		default:
			writeJSON(w, http.StatusOK, map[string]any{"token": fmt.Sprintf("tok-%d", count), "expiresIn": server.expiresIn.Load()})
		}
	}))
	t.Cleanup(server.Close)
	return server
}

func registerSourcePlugin(t *testing.T, key, source string) *jsplugin.LoadedPlugin {
	t.Helper()
	plugin, err := jsplugin.DefaultRegistry.Register(strings.ReplaceAll(source, "%KEY%", key), jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(key)) })
	return plugin
}

func TestGapsPluginKeyTokenCache(t *testing.T) {
	InitHttpClient()
	server := newTokenServer(t)
	plugin := registerSourcePlugin(t, "gaps-exchange", exchangePluginSource)
	noConfig := json.RawMessage(`{}`)
	token := func(t *testing.T, channelID int, line string, config json.RawMessage) string {
		t.Helper()
		exchanged, err := PluginKeyToken(context.Background(), plugin, channelID, line, config, server.URL, "")
		require.NoError(t, err)
		return string(exchanged)
	}
	// The cache lives for the process, so each case takes its own channel ids,
	// ones no earlier run of the test used.
	base := int(time.Now().UnixNano()%1_000_000_000) * 100
	exchangedDuring := func(run func()) int32 {
		before := server.exchanges.Load()
		run()
		return server.exchanges.Load() - before
	}

	t.Run("sequential calls share one exchange", func(t *testing.T) {
		server.expiresIn.Store(3600)
		var first, second string
		assert.EqualValues(t, 1, exchangedDuring(func() {
			first = token(t, base+1, "sk-a", noConfig)
			second = token(t, base+1, "sk-a", noConfig)
		}))
		assert.Equal(t, first, second)
	})

	t.Run("a token without expiry stays cached", func(t *testing.T) {
		server.expiresIn.Store(0)
		assert.EqualValues(t, 1, exchangedDuring(func() {
			token(t, base+2, "sk-a", noConfig)
			token(t, base+2, "sk-a", noConfig)
		}))
	})

	t.Run("a token expiring within the request margin is exchanged again", func(t *testing.T) {
		server.expiresIn.Store(int64(PluginCredentialRequestMargin/time.Second) / 3)
		var first, second string
		assert.EqualValues(t, 2, exchangedDuring(func() {
			first = token(t, base+3, "sk-a", noConfig)
			second = token(t, base+3, "sk-a", noConfig)
		}))
		assert.NotEqual(t, first, second)
	})

	t.Run("invalidating the used token exchanges again", func(t *testing.T) {
		server.expiresIn.Store(3600)
		first := token(t, base+4, "sk-a", noConfig)
		InvalidatePluginKeyToken(plugin, base+4, "sk-a", noConfig, server.URL, json.RawMessage(`"tok-stale"`))
		assert.Zero(t, exchangedDuring(func() {
			assert.Equal(t, first, token(t, base+4, "sk-a", noConfig), "a token another exchange replaced is not dropped")
		}))
		InvalidatePluginKeyToken(plugin, base+4, "sk-a", noConfig, server.URL, json.RawMessage(first))
		assert.EqualValues(t, 1, exchangedDuring(func() {
			assert.NotEqual(t, first, token(t, base+4, "sk-a", noConfig))
		}))
	})

	t.Run("another channel, key line, config or base URL has its own token", func(t *testing.T) {
		server.expiresIn.Store(3600)
		eu := json.RawMessage(`{"region":"eu"}`)
		var tokens []string
		assert.EqualValues(t, 4, exchangedDuring(func() {
			tokens = append(tokens, token(t, base+5, "sk-a", eu), token(t, base+5, "sk-b", eu),
				token(t, base+5, "sk-a", json.RawMessage(`{"region":"us"}`)), token(t, base+6, "sk-a", eu))
		}))
		assert.Len(t, map[string]bool{tokens[0]: true, tokens[1]: true, tokens[2]: true, tokens[3]: true}, 4)
		assert.Zero(t, exchangedDuring(func() { assert.Equal(t, tokens[0], token(t, base+5, "sk-a", eu)) }))
		otherBaseURL := strings.Replace(server.URL, "127.0.0.1", "localhost", 1)
		assert.EqualValues(t, 1, exchangedDuring(func() {
			exchanged, err := PluginKeyToken(context.Background(), plugin, base+5, "sk-a", eu, otherBaseURL, "")
			require.NoError(t, err)
			assert.NotEqual(t, tokens[0], string(exchanged), "a changed base URL exchanges again")
		}))
	})

	t.Run("concurrent callers share one exchange", func(t *testing.T) {
		server.expiresIn.Store(3600)
		server.delay.Store(int64(100 * time.Millisecond))
		t.Cleanup(func() { server.delay.Store(0) })
		results := make([]string, 16)
		assert.EqualValues(t, 1, exchangedDuring(func() {
			var group sync.WaitGroup
			for index := range results {
				group.Go(func() {
					exchanged, err := PluginKeyToken(context.Background(), plugin, base+7, "sk-a", noConfig, server.URL, "")
					assert.NoError(t, err)
					results[index] = string(exchanged)
				})
			}
			group.Wait()
		}))
		for _, result := range results {
			assert.Equal(t, results[0], result)
		}
	})

	t.Run("a throw is a failed exchange and is not cached", func(t *testing.T) {
		assert.EqualValues(t, 2, exchangedDuring(func() {
			for range 2 {
				_, err := PluginKeyToken(context.Background(), plugin, base+8, "sk-broken", noConfig, server.URL, "")
				require.ErrorIs(t, err, ErrPluginKeyExchangeFailed)
			}
		}))
	})

	t.Run("a returned error keeps its status", func(t *testing.T) {
		_, err := PluginKeyToken(context.Background(), plugin, base+9, "sk-reject", noConfig, server.URL, "")
		var upstreamErr *jsplugin.UpstreamError
		require.ErrorAs(t, err, &upstreamErr)
		assert.Equal(t, http.StatusUnauthorized, upstreamErr.Status)
		assert.Equal(t, "the vendor rejected the key", upstreamErr.Message)
	})
}

func TestGapsCheckPluginKeys(t *testing.T) {
	plugin := registerSourcePlugin(t, "gaps-check", checkPluginSource)
	unchecked := registerSourcePlugin(t, "gaps-unchecked", strings.ReplaceAll(checkPluginSource, "export function checkKey", "function checkKey"))
	credential := credentialLine(t, jsplugin.Credential{Plugin: "gaps-check", Data: json.RawMessage(`{"access":"a"}`), AccountID: "acct"})
	config := json.RawMessage(`{"region":"eu"}`)
	const single, numbered = "The plugin rejected the key: {{error}}", "The plugin rejected key line {{line}}: {{error}}"

	for _, tc := range []struct {
		name, key, stored, lang string
		plugin                  *jsplugin.LoadedPlugin
		wantKey                 string
		wantParams              map[string]any
	}{
		{name: "a good key", key: "good-1"},
		{name: "an empty key", key: ""},
		{name: "a rejected single line", key: "bad-1", wantKey: single, wantParams: map[string]any{"error": "bad key bad-1 for eu"}},
		{name: "a rejected second line", key: "good-1\nbad-2\n", wantKey: numbered, wantParams: map[string]any{"line": 2, "error": "bad key bad-2 for eu"}},
		{name: "stored lines are not checked again", key: "bad-1\ngood-2", stored: "bad-1\nbad-0"},
		{name: "a stored line next to a new bad one", key: "bad-1\nbad-2", stored: "bad-1", wantKey: numbered, wantParams: map[string]any{"line": 2, "error": "bad key bad-2 for eu"}},
		{name: "credential lines are not checked", key: credential + "\ngood-1", stored: ""},
		{name: "a credential alone", key: credential},
		{name: "localized in the stated language", key: "localized", lang: "zh-CN", wantKey: single, wantParams: map[string]any{"error": "密钥格式错误"}},
		{name: "localized in a language of the same family", key: "localized", lang: "zh-TW", wantKey: single, wantParams: map[string]any{"error": "密钥格式错误"}},
		{name: "localized falls back to English", key: "localized", lang: "fr", wantKey: single, wantParams: map[string]any{"error": "The key is malformed"}},
		{name: "a throw rejects with its message", key: "throws", wantKey: single, wantParams: map[string]any{"error": "checker crashed"}},
		{name: "a plugin without checkKey accepts", key: "bad-1", plugin: unchecked},
	} {
		t.Run(tc.name, func(t *testing.T) {
			checked := plugin
			if tc.plugin != nil {
				checked = tc.plugin
			}
			err := CheckPluginKeys(context.Background(), checked, "https://vendor.example", config, tc.key, tc.stored, tc.lang)
			if tc.wantKey == "" {
				require.NoError(t, err)
				return
			}
			var message *common.Message
			require.ErrorAs(t, err, &message)
			assert.Equal(t, tc.wantKey, message.Key)
			assert.Equal(t, tc.wantParams, message.Params)
		})
	}
}
