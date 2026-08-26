package groksubscription

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

type textRefreshRoundTripper func(*http.Request) (*http.Response, error)

func (f textRefreshRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func textRefreshCredential(t *testing.T, accessToken, refreshToken string, expiresAt int64) string {
	t.Helper()
	key, err := (Credential{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresAt:    expiresAt,
	}).Serialize()
	require.NoError(t, err)
	return key
}

func seedTextRefreshChannel(t *testing.T) (int, string) {
	t.Helper()
	key := textRefreshCredential(t, "old-at", "old-rt", 1000)
	ch := model.Channel{
		Type:   constant.ChannelTypeGrokSubscription,
		Key:    key,
		Models: "grok-4.6",
		Group:  "default",
		Status: 1,
	}
	require.NoError(t, ch.Insert())
	require.NoError(t, model.UpsertGrokChannelState(&model.GrokChannelState{
		ChannelID:  ch.Id,
		AuthStatus: model.GrokAuthStatusActive,
	}))
	return ch.Id, key
}

func TestGrokTextRequestRefreshesOnceAndReplaysBody(t *testing.T) {
	setupMediaPreflightTestDB(t)
	channelID, oldKey := seedTextRefreshChannel(t)
	c := newTestGinContext(t)
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ApiKey: oldKey, ChannelId: channelID},
		RelayMode:   relayconstant.RelayModeResponses,
	}
	const payload = `{"model":"grok-4.6","input":"hello"}`

	var requests []struct {
		authorization string
		requestID     string
		body          string
	}
	var refreshCalls int
	restore := SetGrokTextRequestHooksForTest(GrokTextRequestHooks{
		Now: func(context.Context) int64 { return 2000 },
		HTTPClient: &http.Client{Transport: textRefreshRoundTripper(func(req *http.Request) (*http.Response, error) {
			body, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			requests = append(requests, struct {
				authorization string
				requestID     string
				body          string
			}{req.Header.Get("Authorization"), req.Header.Get("X-Request-Id"), string(body)})
			if req.Header.Get("Authorization") == "Bearer old-at" {
				return jsonResponse(http.StatusUnauthorized, `{"error":"expired"}`), nil
			}
			return jsonResponse(http.StatusOK, `{"id":"ok"}`), nil
		})},
		RefreshHTTPDoer: doerFunc(func(req *http.Request) (*http.Response, error) {
			refreshCalls++
			return jsonResponse(http.StatusOK, `{"access_token":"new-at","refresh_token":"new-rt","token_type":"Bearer","expires_in":3600}`), nil
		}),
	})
	defer restore()

	respAny, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(payload))
	require.NoError(t, err)
	resp, ok := respAny.(*http.Response)
	require.True(t, ok)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Len(t, requests, 2)
	require.Equal(t, 1, refreshCalls)
	require.Equal(t, payload, requests[0].body)
	require.Equal(t, payload, requests[1].body)
	require.Equal(t, "Bearer old-at", requests[0].authorization)
	require.Equal(t, "Bearer new-at", requests[1].authorization)
	require.NotEmpty(t, requests[0].requestID)
	require.NotEmpty(t, requests[1].requestID)
	require.NotEqual(t, requests[0].requestID, requests[1].requestID)
	require.Equal(t, "Bearer new-at", func() string {
		ch, err := model.GetChannelById(channelID, true)
		require.NoError(t, err)
		cred, err := ParseCredential(ch.Key)
		require.NoError(t, err)
		return "Bearer " + cred.AccessToken
	}())
}

func TestGrokTextRequestSecond401StopsAndMarksNeedsReauth(t *testing.T) {
	setupMediaPreflightTestDB(t)
	channelID, oldKey := seedTextRefreshChannel(t)
	c := newTestGinContext(t)
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ApiKey: oldKey, ChannelId: channelID},
		RelayMode:   relayconstant.RelayModeChatCompletions,
	}

	var requestCount, refreshCalls int
	restore := SetGrokTextRequestHooksForTest(GrokTextRequestHooks{
		Now: func(context.Context) int64 { return 2000 },
		HTTPClient: &http.Client{Transport: textRefreshRoundTripper(func(req *http.Request) (*http.Response, error) {
			requestCount++
			return jsonResponse(http.StatusUnauthorized, `{"error":"still expired"}`), nil
		})},
		RefreshHTTPDoer: doerFunc(func(req *http.Request) (*http.Response, error) {
			refreshCalls++
			return jsonResponse(http.StatusOK, `{"access_token":"new-at","refresh_token":"new-rt","token_type":"Bearer","expires_in":3600}`), nil
		}),
	})
	defer restore()

	respAny, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(`{"input":"hello"}`))
	require.NoError(t, err)
	resp, ok := respAny.(*http.Response)
	require.True(t, ok)
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	body, readErr := io.ReadAll(resp.Body)
	require.NoError(t, readErr)
	require.NoError(t, resp.Body.Close())
	require.JSONEq(t, `{"error":{"message":"grok authentication failed","type":"upstream_auth_error","code":"upstream_auth_error"}}`, string(body))
	require.NotContains(t, string(body), "still expired")
	require.Equal(t, 2, requestCount)
	require.Equal(t, 1, refreshCalls)
	state, err := model.GetGrokChannelState(channelID)
	require.NoError(t, err)
	require.Equal(t, model.GrokAuthStatusNeedsReauth, state.AuthStatus)
}

func TestGrokTextRequestNon401DoesNotRefresh(t *testing.T) {
	setupMediaPreflightTestDB(t)
	channelID, oldKey := seedTextRefreshChannel(t)
	c := newTestGinContext(t)
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ApiKey: oldKey, ChannelId: channelID},
		RelayMode:   relayconstant.RelayModeResponses,
	}
	var requestCount, refreshCalls int
	restore := SetGrokTextRequestHooksForTest(GrokTextRequestHooks{
		HTTPClient: &http.Client{Transport: textRefreshRoundTripper(func(req *http.Request) (*http.Response, error) {
			requestCount++
			return jsonResponse(http.StatusForbidden, `{"error":"denied"}`), nil
		})},
		RefreshHTTPDoer: doerFunc(func(req *http.Request) (*http.Response, error) {
			refreshCalls++
			return jsonResponse(http.StatusOK, `{"access_token":"must-not-use","expires_in":3600}`), nil
		}),
	})
	defer restore()

	respAny, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(`{"input":"hello"}`))
	require.NoError(t, err)
	resp, ok := respAny.(*http.Response)
	require.True(t, ok)
	require.Equal(t, http.StatusForbidden, resp.StatusCode)
	require.Equal(t, 1, requestCount)
	require.Equal(t, 0, refreshCalls)
}

func TestGrokTextRequestRefreshFailureReturnsSanitized401(t *testing.T) {
	setupMediaPreflightTestDB(t)
	channelID, oldKey := seedTextRefreshChannel(t)
	c := newTestGinContext(t)
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ApiKey: oldKey, ChannelId: channelID},
		RelayMode:   relayconstant.RelayModeResponses,
	}

	var refreshCalls int
	restore := SetGrokTextRequestHooksForTest(GrokTextRequestHooks{
		Now: func(context.Context) int64 { return 2000 },
		HTTPClient: &http.Client{Transport: textRefreshRoundTripper(func(req *http.Request) (*http.Response, error) {
			return jsonResponse(http.StatusUnauthorized, `{"error":{"message":"upstream expired","type":"upstream_error"}}`), nil
		})},
		RefreshHTTPDoer: doerFunc(func(req *http.Request) (*http.Response, error) {
			refreshCalls++
			return jsonResponse(http.StatusBadRequest, `{"error":"invalid_grant","error_description":"refresh secret must not reach the client"}`), nil
		}),
	})
	defer restore()

	respAny, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(`{"input":"hello"}`))
	require.NoError(t, err)
	resp, ok := respAny.(*http.Response)
	require.True(t, ok)
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	body, readErr := io.ReadAll(resp.Body)
	require.NoError(t, readErr)
	require.NoError(t, resp.Body.Close())
	require.JSONEq(t, `{"error":{"message":"grok authentication failed","type":"upstream_auth_error","code":"upstream_auth_error"}}`, string(body))
	require.NotContains(t, string(body), "invalid_grant")
	require.NotContains(t, string(body), "refresh secret")
	require.Equal(t, 1, refreshCalls)
	state, stateErr := model.GetGrokChannelState(channelID)
	require.NoError(t, stateErr)
	require.Equal(t, model.GrokAuthStatusNeedsReauth, state.AuthStatus)
}

func TestGrokTextRequestTransientRefreshFailureReturnsSanitized401WithoutNeedsReauth(t *testing.T) {
	setupMediaPreflightTestDB(t)
	channelID, oldKey := seedTextRefreshChannel(t)
	c := newTestGinContext(t)
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ApiKey: oldKey, ChannelId: channelID},
		RelayMode:   relayconstant.RelayModeResponses,
	}

	restore := SetGrokTextRequestHooksForTest(GrokTextRequestHooks{
		Now: func(context.Context) int64 { return 2000 },
		HTTPClient: &http.Client{Transport: textRefreshRoundTripper(func(req *http.Request) (*http.Response, error) {
			return jsonResponse(http.StatusUnauthorized, `{"error":"expired"}`), nil
		})},
		RefreshHTTPDoer: doerFunc(func(req *http.Request) (*http.Response, error) {
			return nil, errors.New("temporary token endpoint outage")
		}),
	})
	defer restore()

	respAny, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(`{"input":"hello"}`))
	require.NoError(t, err)
	resp, ok := respAny.(*http.Response)
	require.True(t, ok)
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	body, readErr := io.ReadAll(resp.Body)
	require.NoError(t, readErr)
	require.NoError(t, resp.Body.Close())
	require.JSONEq(t, `{"error":{"message":"grok authentication failed","type":"upstream_auth_error","code":"upstream_auth_error"}}`, string(body))
	state, stateErr := model.GetGrokChannelState(channelID)
	require.NoError(t, stateErr)
	require.Equal(t, model.GrokAuthStatusActive, state.AuthStatus)
}

func TestGrokTextModeIsExplicitAndExcludesImagesAndUnsupportedModes(t *testing.T) {
	tests := []struct {
		name string
		info *relaycommon.RelayInfo
		want bool
	}{
		{name: "responses", info: &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeResponses}, want: true},
		{name: "chat", info: &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeChatCompletions}, want: true},
		{name: "compact", info: &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeResponsesCompact}, want: true},
		{name: "claude format fallback", info: &relaycommon.RelayInfo{RelayFormat: types.RelayFormatClaude}, want: true},
		{name: "images", info: &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesGenerations}, want: false},
		{name: "audio with claude format", info: &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeAudioSpeech, RelayFormat: types.RelayFormatClaude}, want: false},
		{name: "unsupported", info: &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeEmbeddings}, want: false},
		{name: "nil", info: nil, want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, isGrokTextMode(tt.info))
		})
	}
}
