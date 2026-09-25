package controller

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/balancescript"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupBalanceScriptTest(t *testing.T) {
	t.Helper()
	originalDB := model.DB
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, database.AutoMigrate(&model.Channel{}, &model.Ability{}))
	model.DB = database
	t.Cleanup(func() {
		model.DB = originalDB
		assert.NoError(t, sqlDB.Close())
	})
}

func newBalanceScriptTestChannel(t *testing.T, baseURL, key, source string) *model.Channel {
	t.Helper()
	channel := &model.Channel{
		Type:    constant.ChannelTypeCustom,
		Status:  common.ChannelStatusEnabled,
		Name:    "balance-script-channel",
		Key:     key,
		BaseURL: &baseURL,
		Group:   "default",
	}
	channel.SetOtherSettings(dto.ChannelOtherSettings{BalanceScript: source})
	require.NoError(t, channel.Insert())
	return channel
}

const echoBalanceScriptTemplate = `
export function buildBalanceRequest(ctx) {
  return {
    method: %q,
    url: ctx.channel.baseUrl + %q,
    headers: {"Authorization": "Bearer " + ctx.channel.apiKey},
    body: JSON.stringify({apiKey: ctx.channel.apiKey}),
  };
}
export function parseBalanceResponse(ctx, response) {
  var data = JSON.parse(response.body);
  return data.remaining;
}
`

func TestFetchScriptedBalanceSuccessInjectsChannelAndParsesResponse(t *testing.T) {
	setupBalanceScriptTest(t)

	var gotMethod, gotAuth, gotBody string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotAuth = r.Header.Get("Authorization")
		buf, err := io.ReadAll(r.Body)
		assert.NoError(t, err)
		gotBody = string(buf)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"remaining": 12.5}`))
	}))
	defer server.Close()

	source := fmt.Sprintf(echoBalanceScriptTemplate, "POST", "/balance")
	channel := newBalanceScriptTestChannel(t, server.URL, "secret-key", source)

	result, err := updateChannelBalance(channel)
	require.NoError(t, err)
	assert.InDelta(t, 12.5, result.Balance, 1e-9)
	assert.Equal(t, http.MethodPost, gotMethod)
	assert.Equal(t, "Bearer secret-key", gotAuth)
	assert.Contains(t, gotBody, "secret-key")

	var reloaded model.Channel
	require.NoError(t, model.DB.First(&reloaded, channel.Id).Error)
	assert.InDelta(t, 12.5, reloaded.Balance, 1e-9)
}

func TestUpdateChannelBalanceNoScriptPathUnaffected(t *testing.T) {
	setupBalanceScriptTest(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/dashboard/billing/subscription":
			_, _ = w.Write([]byte(`{"has_payment_method": true, "hard_limit_usd": 10}`))
		case "/v1/dashboard/billing/usage":
			_, _ = w.Write([]byte(`{"total_usage": 250}`))
		default:
			t.Errorf("unexpected request path %s", r.URL.Path)
		}
	}))
	defer server.Close()
	baseURL := server.URL
	channel := &model.Channel{
		Type:    constant.ChannelTypeCustom,
		Status:  common.ChannelStatusEnabled,
		Name:    "no-script-channel",
		Key:     "sk",
		BaseURL: &baseURL,
		Group:   "default",
	}
	require.NoError(t, channel.Insert())

	result, err := updateChannelBalance(channel)
	require.NoError(t, err)
	assert.Equal(t, 7.5, result.Balance)
}

func TestFetchScriptedBalanceRejectsUnsupportedMethod(t *testing.T) {
	setupBalanceScriptTest(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("host must reject the method before making a request")
	}))
	defer server.Close()

	source := fmt.Sprintf(echoBalanceScriptTemplate, "DELETE", "/balance")
	channel := newBalanceScriptTestChannel(t, server.URL, "sk", source)

	_, err := updateChannelBalance(channel)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "GET or POST")

	var reloaded model.Channel
	require.NoError(t, model.DB.First(&reloaded, channel.Id).Error)
	assert.Equal(t, float64(0), reloaded.Balance)
}

func TestFetchScriptedBalanceRejectsOffOriginURL(t *testing.T) {
	setupBalanceScriptTest(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("host must reject the off-origin URL before making a request")
	}))
	defer server.Close()

	source := `
export function buildBalanceRequest(ctx) {
  return {method: "GET", url: "https://attacker.example.com/steal", headers: {}, body: ""};
}
export function parseBalanceResponse(ctx, response) { return 0; }
`
	channel := newBalanceScriptTestChannel(t, server.URL, "sk", source)

	_, err := updateChannelBalance(channel)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "rejected")
}

func TestFetchScriptedBalanceRejectsEmbeddedCredentialURL(t *testing.T) {
	setupBalanceScriptTest(t)
	source := `
export function buildBalanceRequest(ctx) {
  return {method: "GET", url: "https://user:pass@" + ctx.channel.baseUrl.replace("https://", "") + "/balance", headers: {}, body: ""};
}
export function parseBalanceResponse(ctx, response) { return 0; }
`
	channel := newBalanceScriptTestChannel(t, "https://example.com", "sk", source)

	_, err := updateChannelBalance(channel)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "embedded credentials")
}

func TestFetchScriptedBalanceRejectsInvalidHookOutput(t *testing.T) {
	setupBalanceScriptTest(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"remaining": "not-a-number"}`))
	}))
	defer server.Close()

	source := fmt.Sprintf(echoBalanceScriptTemplate, "GET", "/balance")
	channel := newBalanceScriptTestChannel(t, server.URL, "sk", source)

	_, err := updateChannelBalance(channel)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "must return a number")
}

func TestFetchScriptedBalanceRejectsMissingHook(t *testing.T) {
	setupBalanceScriptTest(t)
	channel := &model.Channel{
		Type:   constant.ChannelTypeCustom,
		Status: common.ChannelStatusEnabled,
		Name:   "missing-hook-channel",
		Key:    "sk",
		Group:  "default",
	}
	baseURL := "https://example.com"
	channel.BaseURL = &baseURL
	channel.SetOtherSettings(dto.ChannelOtherSettings{BalanceScript: `export function buildBalanceRequest(ctx) { return {}; }`})
	require.NoError(t, channel.Insert())

	_, err := updateChannelBalance(channel)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "parseBalanceResponse")
}

func TestFetchScriptedBalanceRejectsInvalidSyntax(t *testing.T) {
	setupBalanceScriptTest(t)
	channel := &model.Channel{
		Type:   constant.ChannelTypeCustom,
		Status: common.ChannelStatusEnabled,
		Name:   "bad-syntax-channel",
		Key:    "sk",
		Group:  "default",
	}
	baseURL := "https://example.com"
	channel.BaseURL = &baseURL
	channel.SetOtherSettings(dto.ChannelOtherSettings{BalanceScript: `export function buildBalanceRequest(ctx) { return `})
	require.NoError(t, channel.Insert())

	_, err := updateChannelBalance(channel)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "compile")
}

func TestFetchScriptedBalanceOversizeResponseRejected(t *testing.T) {
	setupBalanceScriptTest(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(strings.Repeat("a", balanceScriptMaxResponseBytes+1)))
	}))
	defer server.Close()

	source := fmt.Sprintf(echoBalanceScriptTemplate, "GET", "/balance")
	channel := newBalanceScriptTestChannel(t, server.URL, "sk", source)

	_, err := updateChannelBalance(channel)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "exceeds")
}

func TestFetchScriptedBalanceDoesNotFollowRedirects(t *testing.T) {
	setupBalanceScriptTest(t)
	attackerHit := false
	attacker := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attackerHit = true
		_, _ = w.Write([]byte(`{"remaining": 99}`))
	}))
	defer attacker.Close()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, attacker.URL+"/balance", http.StatusFound)
	}))
	defer server.Close()

	source := fmt.Sprintf(echoBalanceScriptTemplate, "GET", "/balance")
	channel := newBalanceScriptTestChannel(t, server.URL, "sk", source)

	_, err := updateChannelBalance(channel)
	require.Error(t, err)
	assert.False(t, attackerHit, "the balance script client must not follow redirects")
}

func TestFetchScriptedBalanceSecretsNotLeakedInErrors(t *testing.T) {
	setupBalanceScriptTest(t)
	const secretKey = "super-secret-value"
	source := fmt.Sprintf(`
export function buildBalanceRequest(ctx) {
  throw new Error("leaking " + ctx.channel.apiKey);
}
export function parseBalanceResponse(ctx, response) { return 0; }
`)
	channel := newBalanceScriptTestChannel(t, "https://example.com", secretKey, source)

	_, err := updateChannelBalance(channel)
	require.Error(t, err)
	assert.NotContains(t, err.Error(), secretKey)
}

func TestFetchScriptedBalanceOversizeSourceRejectedAtSave(t *testing.T) {
	setupBalanceScriptTest(t)
	oversizeSource := "// " + strings.Repeat("a", 32<<10)
	baseURL := "https://example.com"
	channel := &model.Channel{
		Type:    constant.ChannelTypeCustom,
		Status:  common.ChannelStatusEnabled,
		Name:    "oversize-script-channel",
		Key:     "sk",
		BaseURL: &baseURL,
		Group:   "default",
	}
	channel.SetOtherSettings(dto.ChannelOtherSettings{BalanceScript: oversizeSource})

	err := channel.ValidateSettings()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "exceeds")
}

func TestFetchScriptedBalanceIsolatedAcrossChannelCalls(t *testing.T) {
	setupBalanceScriptTest(t)
	// A shared script must not leak one channel's credential into another
	// call: each fetchScriptedBalance call compiles and discards its own
	// engine, so per-channel state never survives across invocations.
	source := fmt.Sprintf(echoBalanceScriptTemplate, "GET", "/balance")

	var lastAuthHeader string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lastAuthHeader = r.Header.Get("Authorization")
		_, _ = w.Write([]byte(`{"remaining": 1}`))
	}))
	defer server.Close()

	channelA := newBalanceScriptTestChannel(t, server.URL, "key-a", source)
	channelB := newBalanceScriptTestChannel(t, server.URL, "key-b", source)

	_, err := updateChannelBalance(channelA)
	require.NoError(t, err)
	assert.Equal(t, "Bearer key-a", lastAuthHeader)

	_, err = updateChannelBalance(channelB)
	require.NoError(t, err)
	assert.Equal(t, "Bearer key-b", lastAuthHeader)
}

func TestBalanceScriptHTTPFailurePreservesSnapshot(t *testing.T) {
	setupBalanceScriptTest(t)
	for _, status := range []int{302, 401, 500} {
		t.Run(fmt.Sprint(status), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(status)
				_, _ = w.Write([]byte(`{"remaining": 0}`))
			}))
			defer server.Close()
			channel := newBalanceScriptTestChannel(t, server.URL, "fake-key", fmt.Sprintf(echoBalanceScriptTemplate, "GET", "/balance"))
			require.NoError(t, model.DB.Model(channel).Updates(map[string]any{"balance": 23.5, "balance_updated_time": 123}).Error)
			_, err := updateChannelBalance(channel)
			require.Error(t, err)
			var saved model.Channel
			require.NoError(t, model.DB.First(&saved, channel.Id).Error)
			assert.Equal(t, 23.5, saved.Balance)
			assert.EqualValues(t, 123, saved.BalanceUpdatedTime)
		})
	}
}

func TestBalanceScriptSaveRejectsWhitespacePaddingAndRedactsCompileErrors(t *testing.T) {
	valid := fmt.Sprintf(echoBalanceScriptTemplate, "GET", "/balance")
	for _, source := range []string{strings.Repeat(" ", balancescript.MaxSourceBytes+1), valid + strings.Repeat(" ", balancescript.MaxSourceBytes)} {
		channel := &model.Channel{}
		channel.SetOtherSettings(dto.ChannelOtherSettings{BalanceScript: source})
		require.Error(t, channel.ValidateSettings())
	}
	_, err := balancescript.Compile(`throw new Error("sensitive-fixture");` + valid)
	require.Error(t, err)
	assert.NotContains(t, err.Error(), "sensitive-fixture")
}

func TestBalanceScriptRejectsSchemeDowngradeBeforeNetwork(t *testing.T) {
	hits := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { hits++ }))
	defer server.Close()
	_, err := doBalanceScriptRequest(&model.Channel{}, strings.Replace(server.URL, "http:", "https:", 1), balanceScriptRequest{Method: "GET", URL: server.URL})
	require.Error(t, err)
	assert.Zero(t, hits)
}

func TestUpdateChannelBalanceMultiKeyChannelUsesBuiltInPath(t *testing.T) {
	setupBalanceScriptTest(t)
	// A multi-key channel's Key holds a composite, newline-delimited blob of
	// every key. A configured balance_script must never receive that blob:
	// the dispatcher must fall back to the built-in path instead.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("balance_script must not run for a multi-key channel")
	}))
	defer server.Close()

	baseURL := server.URL
	source := fmt.Sprintf(echoBalanceScriptTemplate, "GET", "/balance")
	channel := &model.Channel{
		Type:        constant.ChannelTypeCustom,
		Status:      common.ChannelStatusEnabled,
		Name:        "multi-key-channel",
		Key:         "key-a\nkey-b",
		BaseURL:     &baseURL,
		Group:       "default",
		ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2},
	}
	channel.SetOtherSettings(dto.ChannelOtherSettings{BalanceScript: source})
	require.NoError(t, channel.Insert())

	// The built-in path for constant.ChannelTypeCustom expects the OpenAI
	// subscription/usage shape; it errs on this server, but importantly
	// without ever invoking the script.
	_, err := updateChannelBalance(channel)
	require.Error(t, err)
}

func TestBalanceScriptValidateEnforcesRawByteLimitOnMultibyteSource(t *testing.T) {
	// A multibyte character can encode to more UTF-8 bytes than its rune
	// count, so a source that looks short in rune terms can still exceed the
	// byte budget. len(string) in Go already counts bytes, but this pins
	// that behavior against multibyte input specifically.
	multibyteChar := "余" // 3 bytes in UTF-8
	overRuneCount := balancescript.MaxSourceBytes/len(multibyteChar) + 1
	oversizeMultibyteSource := strings.Repeat(multibyteChar, overRuneCount)
	require.Less(t, overRuneCount, balancescript.MaxSourceBytes, "sanity: rune count must stay below the byte limit")
	require.Greater(t, len(oversizeMultibyteSource), balancescript.MaxSourceBytes)

	err := balancescript.Validate(oversizeMultibyteSource)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "exceeds")

	// A source whose byte length sits exactly at the limit remains valid
	// once padded to a compiling script (trimmed length must still compile).
	valid := fmt.Sprintf(echoBalanceScriptTemplate, "GET", "/balance")
	require.LessOrEqual(t, len(valid), balancescript.MaxSourceBytes)
	require.NoError(t, balancescript.Validate(valid))
}
