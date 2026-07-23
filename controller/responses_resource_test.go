package controller

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRelayResponsesResourceProxiesRetrieveInputItemsAndDelete(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	service.InitHttpClient()
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
	})

	var (
		requestsMu sync.Mutex
		requests   []string
	)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "Bearer upstream-secret", r.Header.Get("Authorization"))
		requestsMu.Lock()
		requests = append(requests, r.Method+" "+r.URL.RequestURI())
		requestsMu.Unlock()

		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/v1/responses/resp_retrieve":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"id":"resp_retrieve","status":"completed"}`))
		case r.Method == http.MethodGet && r.URL.Path == "/v1/responses/resp_items/input_items":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"object":"list","data":[]}`))
		case r.Method == http.MethodDelete && r.URL.Path == "/v1/responses/resp_delete":
			w.WriteHeader(http.StatusNoContent)
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()

	baseURL := upstream.URL
	upstreamChannel := &model.Channel{
		Type:    constant.ChannelTypeOpenAI,
		Key:     "upstream-secret",
		Status:  common.ChannelStatusEnabled,
		Name:    "responses-resource-test",
		BaseURL: &baseURL,
	}
	require.NoError(t, db.Create(upstreamChannel).Error)

	recordRoute := func(responseID string) {
		t.Helper()
		context := &gin.Context{}
		common.SetContextKey(context, constant.ContextKeyUserId, 301)
		common.SetContextKey(context, constant.ContextKeyChannelId, upstreamChannel.Id)
		common.SetContextKey(context, constant.ContextKeyOriginalModel, "gpt-test")
		require.NoError(t, service.RecordResponsesResourceRoute(
			context,
			responseID,
			0,
			upstream.URL+"/v1/responses?api-version=preview",
		))
	}
	recordRoute("resp_retrieve")
	recordRoute("resp_items")
	recordRoute("resp_delete")

	invoke := func(method string, path string, responseID string) *httptest.ResponseRecorder {
		t.Helper()
		recorder := httptest.NewRecorder()
		context, _ := gin.CreateTestContext(recorder)
		context.Request = httptest.NewRequest(method, path, nil)
		context.Params = gin.Params{{Key: "response_id", Value: responseID}}
		common.SetContextKey(context, constant.ContextKeyUserId, 301)
		common.SetContextKey(context, constant.ContextKeyTokenId, 401)
		RelayResponsesResource(context)
		return recorder
	}

	retrieve := invoke(http.MethodGet, "/v1/responses/resp_retrieve?stream=true&starting_after=7", "resp_retrieve")
	require.Equal(t, http.StatusOK, retrieve.Code)
	assert.JSONEq(t, `{"id":"resp_retrieve","status":"completed"}`, retrieve.Body.String())

	inputItems := invoke(http.MethodGet, "/v1/responses/resp_items/input_items?after=item_1&limit=20", "resp_items")
	require.Equal(t, http.StatusOK, inputItems.Code)
	assert.JSONEq(t, `{"object":"list","data":[]}`, inputItems.Body.String())

	deleted := invoke(http.MethodDelete, "/v1/responses/resp_delete", "resp_delete")
	require.Equal(t, http.StatusNoContent, deleted.Code)
	lookupContext := &gin.Context{}
	common.SetContextKey(lookupContext, constant.ContextKeyUserId, 301)
	_, found, err := service.GetResponsesResourceRoute(lookupContext, "resp_delete")
	require.NoError(t, err)
	assert.False(t, found)

	requestsMu.Lock()
	defer requestsMu.Unlock()
	assert.Equal(t, []string{
		"GET /v1/responses/resp_retrieve?api-version=preview&starting_after=7&stream=true",
		"GET /v1/responses/resp_items/input_items?after=item_1&api-version=preview&limit=20",
		"DELETE /v1/responses/resp_delete?api-version=preview",
	}, requests)
}

func TestRelayResponsesResourceRejectsInvalidOrUnavailableRoutes(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
	})

	invoke := func(responseID string) *httptest.ResponseRecorder {
		t.Helper()
		recorder := httptest.NewRecorder()
		context, _ := gin.CreateTestContext(recorder)
		context.Request = httptest.NewRequest(http.MethodGet, "/v1/responses/"+responseID, nil)
		context.Params = gin.Params{{Key: "response_id", Value: responseID}}
		common.SetContextKey(context, constant.ContextKeyUserId, 302)
		RelayResponsesResource(context)
		return recorder
	}

	assert.Equal(t, http.StatusBadRequest, invoke("").Code)
	assert.Equal(t, http.StatusNotFound, invoke("resp_missing").Code)

	recordRoute := func(responseID string, channelID int, multiKeyIndex int) {
		t.Helper()
		context := &gin.Context{}
		common.SetContextKey(context, constant.ContextKeyUserId, 302)
		common.SetContextKey(context, constant.ContextKeyChannelId, channelID)
		common.SetContextKey(context, constant.ContextKeyChannelIsMultiKey, multiKeyIndex >= 0)
		common.SetContextKey(context, constant.ContextKeyChannelMultiKeyIndex, multiKeyIndex)
		require.NoError(t, service.RecordResponsesResourceRoute(
			context,
			responseID,
			0,
			"https://example.com/v1/responses",
		))
	}

	recordRoute("resp_unavailable", 999999, -1)
	assert.Equal(t, http.StatusBadGateway, invoke("resp_unavailable").Code)

	baseURL := "https://example.com"
	channel := &model.Channel{
		Type:    constant.ChannelTypeOpenAI,
		Key:     "only-key",
		Status:  common.ChannelStatusEnabled,
		Name:    "responses-resource-multi-key-test",
		BaseURL: &baseURL,
	}
	require.NoError(t, db.Create(channel).Error)
	recordRoute("resp_bad_key_index", channel.Id, 2)
	assert.Equal(t, http.StatusBadGateway, invoke("resp_bad_key_index").Code)
}
