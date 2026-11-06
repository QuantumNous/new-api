package channel

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/internal/common"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newAffinityContext(t *testing.T, body string) contract.Context {
	t.Helper()
	request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	ctx, _ := fiberadapter.NewSyntheticContext(request)
	_, err := common.GetBodyStorage(ctx)
	require.NoError(t, err)
	return ctx
}

func TestResolveSessionAffinityKeyPrefersPromptCacheKey(t *testing.T) {
	t.Parallel()
	ctx := newAffinityContext(t, `{
		"model":"gpt-4",
		"prompt_cache_key":"client-cache-1",
		"messages":[{"role":"user","content":"hello"}]
	}`)
	defer common.CleanupBodyStorage(ctx)

	info := &relaycommon.RelayInfo{OriginModelName: "gpt-4"}
	assert.Equal(t, "client-cache-1", ResolveSessionAffinityKey(ctx, info))
}

func TestResolveSessionAffinityKeyHashesStablePrefix(t *testing.T) {
	t.Parallel()
	first := newAffinityContext(t, `{
		"model":"gpt-4",
		"messages":[
			{"role":"system","content":"be brief"},
			{"role":"user","content":"hello"},
			{"role":"assistant","content":"hi"},
			{"role":"user","content":"later turn"}
		],
		"tools":[{"type":"function","function":{"name":"lookup"}}]
	}`)
	defer common.CleanupBodyStorage(first)
	second := newAffinityContext(t, `{
		"model":"gpt-4",
		"messages":[
			{"role":"system","content":"be brief"},
			{"role":"user","content":"hello"},
			{"role":"assistant","content":"different later reply"},
			{"role":"user","content":"another later turn"}
		],
		"tools":[{"type":"function","function":{"name":"lookup"}}]
	}`)
	defer common.CleanupBodyStorage(second)

	info := &relaycommon.RelayInfo{OriginModelName: "gpt-4"}
	a := ResolveSessionAffinityKey(first, info)
	b := ResolveSessionAffinityKey(second, info)
	require.True(t, strings.HasPrefix(a, "ses_"))
	assert.Equal(t, a, b)
}

func TestProcessHeaderOverrideInjectsSessionAffinity(t *testing.T) {
	t.Parallel()
	ctx := newAffinityContext(t, `{
		"model":"gpt-4",
		"session_id":"sess-explicit",
		"messages":[{"role":"user","content":"hello"}]
	}`)
	defer common.CleanupBodyStorage(ctx)

	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-4",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelSetting: dto.ChannelSettings{SessionAffinityEnabled: true},
		},
	}
	headers, err := processHeaderOverride(info, ctx)
	require.NoError(t, err)
	assert.Equal(t, "sess-explicit", headers["x-session-id"])
}

func TestProcessHeaderOverrideSkipsAffinityOnChannelTest(t *testing.T) {
	t.Parallel()
	ctx := newAffinityContext(t, `{"model":"gpt-4","session_id":"sess-explicit"}`)
	defer common.CleanupBodyStorage(ctx)

	info := &relaycommon.RelayInfo{
		IsChannelTest:   true,
		OriginModelName: "gpt-4",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelSetting: dto.ChannelSettings{SessionAffinityEnabled: true},
		},
	}
	headers, err := processHeaderOverride(info, ctx)
	require.NoError(t, err)
	assert.Empty(t, headers["x-session-id"])
}
