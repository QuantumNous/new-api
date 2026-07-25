package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestFetchCodexChannelModelsRejectsMultiKey(t *testing.T) {
	channel := &model.Channel{Type: constant.ChannelTypeCodex}
	channel.ChannelInfo.IsMultiKey = true

	models, err := FetchCodexChannelModels(channel)

	require.ErrorContains(t, err, "does not support multi-key")
	require.Nil(t, models)
}

func TestFetchCodexChannelModelsAddsCompactVariantsExceptAutoReview(t *testing.T) {
	allowPrivateCodexModelFetch(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"models":[{"slug":"gpt-5.6-sol"},{"slug":"gpt-5.6-sol-openai-compact"},{"slug":"codex-auto-review"}]}`))
	}))
	defer server.Close()

	channel := &model.Channel{
		Type: constant.ChannelTypeCodex,
		Key:  `{"access_token":"token","account_id":"account"}`,
	}
	models, err := fetchCodexChannelModels(
		context.Background(),
		channel,
		server.URL,
		server.Client(),
		"0.144.6",
	)

	require.NoError(t, err)
	require.Equal(t, []string{
		"gpt-5.6-sol",
		"gpt-5.6-sol-openai-compact",
		"codex-auto-review",
	}, models)
}

func TestFetchCodexChannelModelsReturnsExpiredCredentialError(t *testing.T) {
	allowPrivateCodexModelFetch(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	channel := &model.Channel{
		Type: constant.ChannelTypeCodex,
		Key:  `{"access_token":"expired","account_id":"account"}`,
	}
	models, err := fetchCodexChannelModels(
		context.Background(),
		channel,
		server.URL,
		server.Client(),
		"0.144.6",
	)

	require.ErrorContains(t, err, "credential expired")
	require.Nil(t, models)
}

func TestFetchCodexChannelModelsSupportsSavedChannel(t *testing.T) {
	allowPrivateCodexModelFetch(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"models":[{"slug":"gpt-5.6-sol"}]}`))
	}))
	defer server.Close()
	previousHTTPClient := httpClient
	httpClient = server.Client()
	t.Cleanup(func() { httpClient = previousHTTPClient })

	latestCodexClientVersion.Lock()
	previousVersion := latestCodexClientVersion.version
	previousExpiresAt := latestCodexClientVersion.expiresAt
	previousLastError := latestCodexClientVersion.lastError
	previousRetryAt := latestCodexClientVersion.retryAt
	latestCodexClientVersion.version = "0.144.6"
	latestCodexClientVersion.expiresAt = time.Now().Add(time.Hour)
	latestCodexClientVersion.lastError = ""
	latestCodexClientVersion.retryAt = time.Time{}
	latestCodexClientVersion.Unlock()
	t.Cleanup(func() {
		latestCodexClientVersion.Lock()
		defer latestCodexClientVersion.Unlock()
		latestCodexClientVersion.version = previousVersion
		latestCodexClientVersion.expiresAt = previousExpiresAt
		latestCodexClientVersion.lastError = previousLastError
		latestCodexClientVersion.retryAt = previousRetryAt
	})

	baseURL := server.URL
	channel := &model.Channel{
		Id:      1,
		Type:    constant.ChannelTypeCodex,
		Key:     `{"access_token":"token","account_id":"account"}`,
		BaseURL: &baseURL,
	}

	models, err := FetchCodexChannelModels(channel)

	require.NoError(t, err)
	require.Equal(t, []string{
		"gpt-5.6-sol",
		"gpt-5.6-sol-openai-compact",
	}, models)
}
