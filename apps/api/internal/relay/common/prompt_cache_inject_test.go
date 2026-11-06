package common

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newPromptCacheContext(t *testing.T, body string) contract.Context {
	t.Helper()
	request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	ctx, _ := fiberadapter.NewSyntheticContext(request)
	_, err := common.GetBodyStorage(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { common.CleanupBodyStorage(ctx) })
	return ctx
}

// The production AffinityKeyResolver is registered by package channel's init,
// which this test package does not import (channel imports this one). Install
// the contract here so the injection paths see real keys; the genuine raw-body
// prefix derivation is covered by internal/relay/channel's session_affinity
// tests. Same contract: client-declared boundaries win, else a stable ses_-
// prefixed hash of the immutable request prefix.
func init() {
	AffinityKeyResolver = testAffinityKeyResolver
}

func testAffinityKeyResolver(c contract.Context, info *RelayInfo) string {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return ""
	}
	body, err := storage.Bytes()
	if err != nil || len(body) == 0 {
		return ""
	}
	var parsed map[string]any
	if err := common.Unmarshal(body, &parsed); err != nil {
		return ""
	}
	for _, field := range []string{"prompt_cache_key", "session_id"} {
		if value, ok := parsed[field].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	prefix := info.OriginModelName + "\x00" + fmt.Sprintf("%v", parsed["system"])
	sum := sha256.Sum256([]byte(prefix))
	return fmt.Sprintf("ses_%x", sum[:16])
}

// useTestRedis points the package Redis globals at a fresh miniredis server
// for one (sequential) test. The package default is RedisEnabled=true with a
// nil RDB — the real client is only built by InitRedisClient at startup — so
// any test whose path touches the marker store must install one.
func useTestRedis(t *testing.T) *miniredis.Miniredis {
	t.Helper()
	previousRedis, previousRDB := common.RedisEnabled, common.RDB
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	common.RedisEnabled, common.RDB = true, client
	t.Cleanup(func() {
		_ = client.Close()
		common.RedisEnabled, common.RDB = previousRedis, previousRDB
	})
	return server
}

// newPromptCacheRelayInfo builds a RelayInfo with the channel meta the
// injection paths read through the embedded *ChannelMeta (switches and
// ChannelId are promoted fields; a nil meta would panic on access).
func newPromptCacheRelayInfo(model string) *RelayInfo {
	return &RelayInfo{ChannelMeta: &ChannelMeta{ChannelId: 42}, OriginModelName: model}
}

// longSystemPrompt clears the rough token-floor gate (>=1024 estimated tokens).
func longSystemPrompt() string {
	return strings.Repeat("You are a meticulous code reviewer. ", 150)
}

func claudePrefixBody(system string) string {
	return `{"model":"claude-sonnet-4-5","system":[{"type":"text","text":"` + system + `"}],"messages":[{"role":"user","content":"hi"}],"max_tokens":10}`
}

func TestMaybeInjectClaudeCacheControlDisabledByDefault(t *testing.T) {
	ctx := newPromptCacheContext(t, claudePrefixBody(longSystemPrompt()))
	info := newPromptCacheRelayInfo("claude-sonnet-4-5")
	request := &dto.ClaudeRequest{
		Model:  "claude-sonnet-4-5",
		System: []dto.ClaudeMediaMessage{{Type: dto.ContentTypeText, Text: common.GetPointer(longSystemPrompt())}},
	}

	MaybeInjectClaudeCacheControl(ctx, info, request)
	system := request.System.([]dto.ClaudeMediaMessage)
	assert.Empty(t, system[len(system)-1].CacheControl)
}

func TestMaybeInjectClaudeCacheControlRespectsUserBreakpoints(t *testing.T) {
	server := useTestRedis(t)
	info := newPromptCacheRelayInfo("claude-sonnet-4-5")
	info.ChannelOtherSettings.AutoPromptCacheControl = true
	body := claudePrefixBody(longSystemPrompt())

	// An earlier unmarked turn seeds the repeat-seen marker for this prefix.
	MaybeInjectClaudeCacheControl(newPromptCacheContext(t, body), info, &dto.ClaudeRequest{
		Model:  "claude-sonnet-4-5",
		System: []dto.ClaudeMediaMessage{{Type: dto.ContentTypeText, Text: common.GetPointer(longSystemPrompt())}},
	})
	require.Contains(t, strings.Join(server.Keys(), "\n"), "cache:prefix:")

	// Once the user marks breakpoints themselves the gateway stays out of it:
	// the request is not rewritten, and the marker an auto-injected turn left
	// for the same prefix is cleared.
	marked := &dto.ClaudeRequest{
		Model: "claude-sonnet-4-5",
		System: []dto.ClaudeMediaMessage{
			{Type: dto.ContentTypeText, Text: common.GetPointer(longSystemPrompt()), CacheControl: json.RawMessage(`{"type":"ephemeral"}`)},
		},
	}
	MaybeInjectClaudeCacheControl(newPromptCacheContext(t, body), info, marked)

	system := marked.System.([]dto.ClaudeMediaMessage)
	assert.Equal(t, json.RawMessage(`{"type":"ephemeral"}`), system[0].CacheControl)
	for _, key := range server.Keys() {
		assert.NotContains(t, key, "cache:prefix:")
	}
}

func TestMaybeInjectClaudeCacheControlRequiresLongPrefix(t *testing.T) {
	ctx := newPromptCacheContext(t, claudePrefixBody("be brief"))
	info := newPromptCacheRelayInfo("claude-sonnet-4-5")
	info.ChannelOtherSettings.AutoPromptCacheControl = true

	request := &dto.ClaudeRequest{
		Model:  "claude-sonnet-4-5",
		System: []dto.ClaudeMediaMessage{{Type: dto.ContentTypeText, Text: common.GetPointer("be brief")}},
	}

	MaybeInjectClaudeCacheControl(ctx, info, request)
	system := request.System.([]dto.ClaudeMediaMessage)
	assert.Empty(t, system[0].CacheControl)
}

func TestMaybeInjectClaudeCacheControlNeedsRedisForRepeatGate(t *testing.T) {
	previousRedis := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = previousRedis })

	ctx := newPromptCacheContext(t, claudePrefixBody(longSystemPrompt()))
	info := newPromptCacheRelayInfo("claude-sonnet-4-5")
	info.ChannelOtherSettings.AutoPromptCacheControl = true

	request := &dto.ClaudeRequest{
		Model:  "claude-sonnet-4-5",
		System: []dto.ClaudeMediaMessage{{Type: dto.ContentTypeText, Text: common.GetPointer(longSystemPrompt())}},
	}

	// Without Redis there is no shared seen-marker, so injection must stay off
	// rather than paying the write surcharge on never-repeated prefixes.
	MaybeInjectClaudeCacheControl(ctx, info, request)
	system := request.System.([]dto.ClaudeMediaMessage)
	assert.Empty(t, system[len(system)-1].CacheControl)
}

func TestMaybeInjectClaudeCacheControlInjectsOnSecondTurn(t *testing.T) {
	server := useTestRedis(t)

	body := claudePrefixBody(longSystemPrompt())
	info := newPromptCacheRelayInfo("claude-sonnet-4-5")
	info.ChannelOtherSettings.AutoPromptCacheControl = true

	newRequest := func() *dto.ClaudeRequest {
		return &dto.ClaudeRequest{
			Model:  "claude-sonnet-4-5",
			System: []dto.ClaudeMediaMessage{{Type: dto.ContentTypeText, Text: common.GetPointer(longSystemPrompt())}},
		}
	}

	// Turn 1 leaves the seen-marker but is not itself worth a cache write.
	firstCtx := newPromptCacheContext(t, body)
	first := newRequest()
	MaybeInjectClaudeCacheControl(firstCtx, info, first)
	system := first.System.([]dto.ClaudeMediaMessage)
	require.Empty(t, system[len(system)-1].CacheControl)

	// Turn 2 proves the prefix repeats: inject one ephemeral breakpoint.
	secondCtx := newPromptCacheContext(t, body)
	second := newRequest()
	MaybeInjectClaudeCacheControl(secondCtx, info, second)
	system = second.System.([]dto.ClaudeMediaMessage)
	require.Equal(t, json.RawMessage(`{"type":"ephemeral"}`), system[len(system)-1].CacheControl)

	// Turn 3 keeps injecting while the marker lives, and the upstream read hit
	// refreshes Anthropic's cache TTL server-side.
	thirdCtx := newPromptCacheContext(t, body)
	third := newRequest()
	MaybeInjectClaudeCacheControl(thirdCtx, info, third)
	system = third.System.([]dto.ClaudeMediaMessage)
	assert.Equal(t, json.RawMessage(`{"type":"ephemeral"}`), system[len(system)-1].CacheControl)

	// The marker is sized like Anthropic's 5m cache window (300s, a real
	// seconds-unit TTL — a bare int would compile as nanoseconds): it survives
	// a 4-minute gap between turns...
	server.FastForward(4 * time.Minute)
	fourth := newRequest()
	MaybeInjectClaudeCacheControl(newPromptCacheContext(t, body), info, fourth)
	system = fourth.System.([]dto.ClaudeMediaMessage)
	assert.Equal(t, json.RawMessage(`{"type":"ephemeral"}`), system[len(system)-1].CacheControl)

	// ...and expires past its window, after which the conversation seeds a
	// fresh marker instead of injecting.
	server.FastForward(6 * time.Minute)
	fifth := newRequest()
	MaybeInjectClaudeCacheControl(newPromptCacheContext(t, body), info, fifth)
	system = fifth.System.([]dto.ClaudeMediaMessage)
	assert.Empty(t, system[len(system)-1].CacheControl)
}

func TestCachePrefixSeenGateSemantics(t *testing.T) {
	// An empty affinity key can never be proven repeated. The Redis-backed
	// marker path itself is exercised by
	// TestMaybeInjectClaudeCacheControlInjectsOnSecondTurn with miniredis.
	assert.False(t, CachePrefixSeenBefore("", 1))
}

func TestMaybeInjectOpenAIPromptCacheKeyInjectsDerivedKey(t *testing.T) {
	body := `{"model":"gpt-4o","messages":[{"role":"system","content":"be brief"},{"role":"user","content":"hello"}]}`
	ctx := newPromptCacheContext(t, body)
	info := newPromptCacheRelayInfo("gpt-4o")
	info.ChannelOtherSettings.AutoPromptCacheKey = true

	request := &dto.GeneralOpenAIRequest{Model: "gpt-4o"}
	MaybeInjectOpenAIPromptCacheKey(ctx, info, request)

	require.NotEmpty(t, request.PromptCacheKey)
	assert.True(t, strings.HasPrefix(request.PromptCacheKey, "ses_"))

	// The injected key must be stable across calls of one request so retries
	// keep the same OpenAI cache routing boundary.
	second := &dto.GeneralOpenAIRequest{Model: "gpt-4o"}
	MaybeInjectOpenAIPromptCacheKey(ctx, info, second)
	assert.Equal(t, request.PromptCacheKey, second.PromptCacheKey)
}

func TestMaybeInjectOpenAIPromptCacheKeyKeepsClientBoundary(t *testing.T) {
	body := `{"model":"gpt-4o","session_id":"client-cache-1","messages":[{"role":"user","content":"hello"}]}`
	ctx := newPromptCacheContext(t, body)
	info := newPromptCacheRelayInfo("gpt-4o")
	info.ChannelOtherSettings.AutoPromptCacheKey = true

	request := &dto.GeneralOpenAIRequest{Model: "gpt-4o", PromptCacheKey: "client-owned-key"}
	MaybeInjectOpenAIPromptCacheKey(ctx, info, request)
	assert.Equal(t, "client-owned-key", request.PromptCacheKey)

	// With no client prompt_cache_key but an explicit session_id, the client's
	// declared cache boundary is reused instead of a hash.
	boundary := &dto.GeneralOpenAIRequest{Model: "gpt-4o"}
	MaybeInjectOpenAIPromptCacheKey(ctx, info, boundary)
	assert.Equal(t, "client-cache-1", boundary.PromptCacheKey)
}

func TestMaybeInjectOpenAIPromptCacheKeyDisabledByDefault(t *testing.T) {
	body := `{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`
	ctx := newPromptCacheContext(t, body)
	info := newPromptCacheRelayInfo("gpt-4o")

	request := &dto.GeneralOpenAIRequest{Model: "gpt-4o"}
	MaybeInjectOpenAIPromptCacheKey(ctx, info, request)
	assert.Empty(t, request.PromptCacheKey)
}

func TestMaybeInjectOpenAIChatCacheKeyIgnoresOtherFormats(t *testing.T) {
	body := `{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`
	ctx := newPromptCacheContext(t, body)
	info := newPromptCacheRelayInfo("gpt-4o")
	info.ChannelOtherSettings.AutoPromptCacheKey = true

	claudeRequest := &dto.ClaudeRequest{Model: "claude-sonnet-4-5"}
	MaybeInjectOpenAIChatCacheKey(ctx, info, claudeRequest)
	assert.Empty(t, claudeRequest.CacheControl)
}

func TestResolveAffinityKeyMemoizesPerRequest(t *testing.T) {
	body := `{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`
	ctx := newPromptCacheContext(t, body)
	info := newPromptCacheRelayInfo("gpt-4o")

	previous := AffinityKeyResolver
	derivations := 0
	AffinityKeyResolver = func(c contract.Context, info *RelayInfo) string {
		derivations++
		return previous(c, info)
	}
	t.Cleanup(func() { AffinityKeyResolver = previous })

	first := resolveAffinityKey(ctx, info)
	second := resolveAffinityKey(ctx, info)
	require.NotEmpty(t, first)
	assert.Equal(t, first, second)
	assert.Equal(t, 1, derivations)
}

func TestMaybeInjectClaudeCacheControlNormalizesStringSystem(t *testing.T) {
	useTestRedis(t)

	// Anthropic accepts cache_control only on block form; the plain-string
	// system shape must be normalized into a single text block instead of
	// silently skipping the most common request shape.
	body := `{"model":"claude-sonnet-4-5","system":"` + longSystemPrompt() + `","messages":[{"role":"user","content":"hi"}],"max_tokens":10}`
	info := newPromptCacheRelayInfo("claude-sonnet-4-5")
	info.ChannelOtherSettings.AutoPromptCacheControl = true

	newRequest := func() *dto.ClaudeRequest {
		return &dto.ClaudeRequest{Model: "claude-sonnet-4-5", System: longSystemPrompt()}
	}

	// Turn 1 only seeds the repeat-seen marker.
	seed := newRequest()
	assert.Nil(t, MaybeInjectClaudeCacheControl(newPromptCacheContext(t, body), info, seed))
	assert.Equal(t, longSystemPrompt(), seed.System)

	// Turn 2 proves the prefix repeats: the string is rewritten to block form
	// with one ephemeral breakpoint.
	request := newRequest()
	undo := MaybeInjectClaudeCacheControl(newPromptCacheContext(t, body), info, request)
	require.NotNil(t, undo)

	blocks, ok := request.System.([]dto.ClaudeMediaMessage)
	require.True(t, ok, "plain-string system must be normalized to block form")
	require.Len(t, blocks, 1)
	assert.Equal(t, longSystemPrompt(), *blocks[0].Text)
	assert.Equal(t, json.RawMessage(`{"type":"ephemeral"}`), blocks[0].CacheControl)

	// Undo restores the exact client shape (a string, not a one-block array).
	undo()
	assert.Equal(t, longSystemPrompt(), request.System)
}

func TestMaybeInjectOpenAIPromptCacheKeySkipsUnsafeClientBoundary(t *testing.T) {
	// The client-declared session_id is echoed as prompt_cache_key verbatim;
	// OpenAI caps that field at 64 chars of [A-Za-z0-9_-]. An oversized or
	// oddly-charactered value must be skipped rather than sent upstream,
	// where every request would 400 and blacklist the channel.
	body := `{"model":"gpt-4o","session_id":"` + strings.Repeat("x!^", 100) + `","messages":[{"role":"user","content":"hello"}]}`
	ctx := newPromptCacheContext(t, body)
	info := newPromptCacheRelayInfo("gpt-4o")
	info.ChannelOtherSettings.AutoPromptCacheKey = true

	request := &dto.GeneralOpenAIRequest{Model: "gpt-4o"}
	undo := MaybeInjectOpenAIPromptCacheKey(ctx, info, request)
	assert.Nil(t, undo)
	assert.Empty(t, request.PromptCacheKey)
}
