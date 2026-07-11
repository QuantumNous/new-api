package modelroute

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

type doerFunc func(*http.Request) (*http.Response, error)

func (f doerFunc) Do(r *http.Request) (*http.Response, error) { return f(r) }

func TestJoinBasePath(t *testing.T) {
	assert.Equal(t, "https://api.example.com/v1/chat/completions", joinBasePath("https://api.example.com", "/v1/chat/completions"))
	assert.Equal(t, "https://api.example.com/v1/chat/completions", joinBasePath("https://api.example.com/v1", "/v1/chat/completions"))
}

func TestOpenAICompatibleShadowExecutorSuccess(t *testing.T) {
	clearRouteTables(t)
	pri := int64(1)
	base := "https://shadow.example"
	ch := &model.Channel{
		Id: 101, Type: 1, Status: common.ChannelStatusEnabled, Name: "s",
		Key: "sk-test", Models: "gpt-shadow", Priority: &pri, BaseURL: &base,
	}
	require.NoError(t, model.DB.Create(ch).Error)
	common.MemoryCacheEnabled = false

	old := ShadowHTTPClient
	ShadowHTTPClient = doerFunc(func(r *http.Request) (*http.Response, error) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Contains(t, r.URL.Path, "chat/completions")
		assert.Equal(t, "1", r.Header.Get("X-New-Api-Shadow-Probe"))
		b, _ := io.ReadAll(r.Body)
		assert.Contains(t, string(b), "ping")
		assert.NotContains(t, string(b), "tools")
		return &http.Response{
			StatusCode: 200,
			Body:       io.NopCloser(strings.NewReader(`{"id":"1","choices":[{"message":{"role":"assistant","content":"ok"}}]}`)),
			Header:     make(http.Header),
			Request:    r,
		}, nil
	})
	defer func() { ShadowHTTPClient = old }()

	res := OpenAICompatibleShadowExecutor(context.Background(), &ShadowRequest{
		ChannelID: 101, RequestedModel: "gpt-shadow", EffectiveModel: "gpt-shadow",
		MaxTokens: 8, Messages: []ShadowMessage{{Role: "user", Text: "ping"}},
	})
	assert.True(t, res.TransportOK)
	assert.Equal(t, 200, res.StatusCode)
	assert.Equal(t, ShadowBuildOK, res.BuildResult)
	assert.True(t, res.TTFT > 0)
}

func TestEnsureDefaultShadowWiringSetsExecutor(t *testing.T) {
	GlobalShadowDispatcher = &ShadowDispatcher{Builder: TextShadowBuilder{}}
	EnsureDefaultShadowWiring()
	require.NotNil(t, GlobalShadowDispatcher.Executor)
}

func TestRunEmergencyRecoveryUsesHTTP(t *testing.T) {
	clearRouteTables(t)
	SetRoutingPriorityMode(model.RoutingPriorityModeModel)
	pri := int64(1)
	base := "https://em.example"
	ch := &model.Channel{
		Id: 202, Type: 1, Status: common.ChannelStatusEnabled, Name: "e",
		Key: "sk-e", Models: "gpt-em2", Priority: &pri, BaseURL: &base,
	}
	require.NoError(t, model.DB.Create(ch).Error)
	require.NoError(t, model.UpsertChannelModelPolicy(&model.ChannelModelPolicy{
		ChannelID: 202, RequestedModel: "gpt-em2", ManualPriority: 10, Enabled: true, Source: model.PolicySourceConfigured,
	}))
	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 202, EffectiveModel: "gpt-em2", RouteState: string(model.RouteUnknown),
	}))

	old := ShadowHTTPClient
	ShadowHTTPClient = doerFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: 200,
			Body:       io.NopCloser(strings.NewReader(`{"ok":true}`)),
			Header:     make(http.Header),
			Request:    r,
		}, nil
	})
	defer func() { ShadowHTTPClient = old }()

	cand, ok := RunEmergencyRecoveryForModel(context.Background(), "gpt-em2", nil)
	require.True(t, ok)
	assert.Equal(t, int64(202), cand.ChannelID)
}
