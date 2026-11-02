package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/internal/common"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	relayconstant "github.com/QuantumNous/new-api/internal/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func openAIChatInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeChatCompletions,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-4o",
		},
	}
}

func TestResponseCacheEligible(t *testing.T) {
	previous := common.ResponseCacheEnabled
	common.ResponseCacheEnabled = true
	t.Cleanup(func() { common.ResponseCacheEnabled = previous })

	zero := 0.0
	hot := 0.7
	stream := true

	tests := []struct {
		name string
		info *relaycommon.RelayInfo
		req  *dto.GeneralOpenAIRequest
		want bool
	}{
		{
			name: "deterministic non-stream eligible",
			info: openAIChatInfo(),
			req:  &dto.GeneralOpenAIRequest{Temperature: &zero},
			want: true,
		},
		{
			name: "absent temperature treated as deterministic",
			info: openAIChatInfo(),
			req:  &dto.GeneralOpenAIRequest{},
			want: true,
		},
		{
			name: "temperature above zero ineligible",
			info: openAIChatInfo(),
			req:  &dto.GeneralOpenAIRequest{Temperature: &hot},
			want: false,
		},
		{
			name: "streaming ineligible",
			info: openAIChatInfo(),
			req:  &dto.GeneralOpenAIRequest{Stream: &stream},
			want: false,
		},
		{
			name: "non chat-completions mode ineligible",
			info: &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeEmbeddings, RelayFormat: types.RelayFormatOpenAI},
			req:  &dto.GeneralOpenAIRequest{},
			want: false,
		},
		{
			name: "claude relay format ineligible",
			info: &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeChatCompletions, RelayFormat: types.RelayFormatClaude},
			req:  &dto.GeneralOpenAIRequest{},
			want: false,
		},
		{
			name: "tool-call request ineligible",
			info: openAIChatInfo(),
			req: &dto.GeneralOpenAIRequest{
				Tools: []dto.ToolCallRequest{{ID: "call_1", Type: "function", Function: dto.FunctionRequest{Name: "get_weather"}}},
			},
			want: false,
		},
		{
			name: "web-search request ineligible",
			info: openAIChatInfo(),
			req:  &dto.GeneralOpenAIRequest{WebSearchOptions: &dto.WebSearchOptions{SearchContextSize: "medium"}},
			want: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, responseCacheEligible(tc.info, tc.req))
		})
	}
}

func TestResponseCacheEligibleRequiresSwitch(t *testing.T) {
	previous := common.ResponseCacheEnabled
	common.ResponseCacheEnabled = false
	t.Cleanup(func() { common.ResponseCacheEnabled = previous })

	assert.False(t, responseCacheEligible(openAIChatInfo(), &dto.GeneralOpenAIRequest{}),
		"the cache must stay inert while the option switch is off")
}

func TestResponseCacheBuildKeyStripsVolatileFields(t *testing.T) {
	info := openAIChatInfo()
	zero := 0.0
	off := false

	base := &dto.GeneralOpenAIRequest{
		Model:       "gpt-4o",
		Temperature: &zero,
		Messages:    []dto.Message{{Role: "user", Content: "hi"}},
	}
	withVolatile := &dto.GeneralOpenAIRequest{
		Model:            "gpt-4o",
		Temperature:      &zero,
		Messages:         []dto.Message{{Role: "user", Content: "hi"}},
		User:             []byte(`"user-42"`),
		LogitBias:        []byte(`{"50256":-100}`),
		SafetyIdentifier: []byte(`"sid"`),
		Stream:           &off,
	}

	keyBase, err := responseCacheBuildKey(info, base)
	require.NoError(t, err)
	keyVolatile, err := responseCacheBuildKey(info, withVolatile)
	require.NoError(t, err)

	assert.Equal(t, keyBase, keyVolatile,
		"volatile per-caller fields must not change the cache key")

	// A content-bearing difference must still change the key.
	different := &dto.GeneralOpenAIRequest{
		Model:       "gpt-4o",
		Temperature: &zero,
		Messages:    []dto.Message{{Role: "user", Content: "different"}},
	}
	keyDifferent, err := responseCacheBuildKey(info, different)
	require.NoError(t, err)
	assert.NotEqual(t, keyBase, keyDifferent)

	// The key must include the upstream model: same body, different model.
	otherModel := openAIChatInfo()
	otherModel.ChannelMeta.UpstreamModelName = "gpt-4o-mini"
	keyOtherModel, err := responseCacheBuildKey(otherModel, base)
	require.NoError(t, err)
	assert.NotEqual(t, keyBase, keyOtherModel)
}
