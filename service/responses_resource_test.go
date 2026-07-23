package service

import (
	"fmt"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResponsesResourceRouteLifecycleIsScopedToUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	responseID := fmt.Sprintf("resp_route_%s", t.Name())
	owner := &gin.Context{}
	common.SetContextKey(owner, constant.ContextKeyUserId, 101)
	common.SetContextKey(owner, constant.ContextKeyChannelId, 17)
	common.SetContextKey(owner, constant.ContextKeyChannelIsMultiKey, true)
	common.SetContextKey(owner, constant.ContextKeyChannelMultiKeyIndex, 2)
	common.SetContextKey(owner, constant.ContextKeyOriginalModel, "doubao-seed-test")

	require.NoError(t, RecordResponsesResourceRoute(
		owner,
		responseID,
		0,
		"https://ark.example.com/api/v3/responses?api-version=preview&api_key=secret",
	))

	route, found, err := GetResponsesResourceRoute(owner, responseID)
	require.NoError(t, err)
	require.True(t, found)
	assert.Equal(t, 17, route.ChannelID)
	assert.True(t, route.ChannelIsMultiKey)
	assert.Equal(t, 2, route.ChannelMultiKeyIndex)
	assert.Equal(t, "doubao-seed-test", route.OriginModelName)
	assert.Equal(t, "https://ark.example.com/api/v3/responses?api-version=preview", route.UpstreamResponsesURL)

	otherUser := &gin.Context{}
	common.SetContextKey(otherUser, constant.ContextKeyUserId, 102)
	_, found, err = GetResponsesResourceRoute(otherUser, responseID)
	require.NoError(t, err)
	assert.False(t, found)

	require.NoError(t, DeleteResponsesResourceRoute(owner, responseID))
	_, found, err = GetResponsesResourceRoute(owner, responseID)
	require.NoError(t, err)
	assert.False(t, found)
}

func TestBuildResponsesResourceURLPreservesProviderQueryAndForwardsPagination(t *testing.T) {
	query := url.Values{
		"after":          []string{"item_123"},
		"limit":          []string{"50"},
		"starting_after": []string{"42"},
		"api_key":        []string{"must-not-forward"},
		"sort_key":       []string{"created_at"},
		"cache_token":    []string{"cache_123"},
	}

	got, err := BuildResponsesResourceURL(
		"https://example.com/openai/v1/responses?api-version=preview",
		"resp_123",
		true,
		query,
	)
	require.NoError(t, err)
	assert.Equal(
		t,
		"https://example.com/openai/v1/responses/resp_123/input_items?after=item_123&api-version=preview&cache_token=cache_123&limit=50&sort_key=created_at&starting_after=42",
		got,
	)
}

func TestResponsesResourceURLParseErrorsDoNotExposeSecrets(t *testing.T) {
	const invalidURL = "https://example.com/%zz?api_key=must-not-leak"

	context := &gin.Context{}
	common.SetContextKey(context, constant.ContextKeyUserId, 103)
	err := RecordResponsesResourceRoute(context, "resp_invalid", 0, invalidURL)
	require.Error(t, err)
	assert.NotContains(t, err.Error(), "must-not-leak")
	assert.NotContains(t, err.Error(), invalidURL)

	_, err = BuildResponsesResourceURL(invalidURL, "resp_invalid", false, nil)
	require.Error(t, err)
	assert.NotContains(t, err.Error(), "must-not-leak")
	assert.NotContains(t, err.Error(), invalidURL)
}
