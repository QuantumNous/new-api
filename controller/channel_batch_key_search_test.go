package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type channelKeySearchTestResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		Items      []model.Channel `json:"items"`
		Total      int             `json:"total"`
		TypeCounts map[int64]int64 `json:"type_counts"`
	} `json:"data"`
}

func postChannelKeySearch(t *testing.T, request BatchChannelKeySearchRequest) channelKeySearchTestResponse {
	t.Helper()

	body, err := common.Marshal(request)
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/search/keys", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	SearchChannelsByKeys(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload channelKeySearchTestResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	return payload
}

func seedChannelKeySearchChannels(t *testing.T) {
	t.Helper()

	defaultGroup := "default,group-a"
	otherGroup := "default,group-b"
	channels := []model.Channel{
		{Id: 1, Type: 1, Key: "sk-match-a", Name: "needle alpha", Status: common.ChannelStatusEnabled, Group: defaultGroup, Models: "gpt-4o,gpt-4o-mini", Priority: common.GetPointer[int64](10)},
		{Id: 2, Type: 2, Key: "sk-match-b", Name: "needle beta", Status: common.ChannelStatusEnabled, Group: defaultGroup, Models: "gpt-4o,claude-3", Priority: common.GetPointer[int64](9)},
		{Id: 3, Type: 1, Key: "sk-disabled", Name: "needle disabled", Status: common.ChannelStatusManuallyDisabled, Group: defaultGroup, Models: "gpt-4o", Priority: common.GetPointer[int64](8)},
		{Id: 4, Type: 1, Key: "sk-other-group", Name: "needle other group", Status: common.ChannelStatusEnabled, Group: otherGroup, Models: "gpt-4o", Priority: common.GetPointer[int64](7)},
		{Id: 5, Type: 1, Key: "sk-not-requested", Name: "needle false positive", Status: common.ChannelStatusEnabled, Group: defaultGroup, Models: "gpt-4o", Priority: common.GetPointer[int64](6)},
	}
	require.NoError(t, model.DB.Create(&channels).Error)
}

func TestSearchChannelsByKeysExactFiltersCountsPaginationAndNoKeyLeak(t *testing.T) {
	setupModelListControllerTestDB(t)
	seedChannelKeySearchChannels(t)

	channelType := json.RawMessage(`"1"`)
	payload := postChannelKeySearch(t, BatchChannelKeySearchRequest{
		Keys:      []string{" sk-match-a ", "sk-match-b", "sk-other-group", "sk-match-a", ""},
		Keyword:   "needle",
		Group:     "group-a",
		Model:     "gpt-4o",
		Status:    "enabled",
		Type:      &channelType,
		SortBy:    "id",
		SortOrder: "asc",
		Page:      1,
		PageSize:  1,
	})

	require.True(t, payload.Success)
	require.Equal(t, 1, payload.Data.Total)
	require.Len(t, payload.Data.Items, 1)
	require.Equal(t, 1, payload.Data.Items[0].Id)
	require.Empty(t, payload.Data.Items[0].Key)
	require.Equal(t, map[int64]int64{1: 1, 2: 1}, payload.Data.TypeCounts)
}

func TestSearchChannelsByKeysComposesDisabledStatus(t *testing.T) {
	setupModelListControllerTestDB(t)
	seedChannelKeySearchChannels(t)

	payload := postChannelKeySearch(t, BatchChannelKeySearchRequest{
		Keys:     []string{"sk-match-a", "sk-disabled"},
		Keyword:  "needle",
		Group:    "group-a",
		Model:    "gpt-4o",
		Status:   "disabled",
		Page:     1,
		PageSize: 20,
	})

	require.True(t, payload.Success)
	require.Equal(t, 1, payload.Data.Total)
	require.Len(t, payload.Data.Items, 1)
	require.Equal(t, 3, payload.Data.Items[0].Id)
	require.Empty(t, payload.Data.Items[0].Key)
	require.Equal(t, map[int64]int64{1: 1}, payload.Data.TypeCounts)
}

func TestSearchChannelsByKeysHandlesMoreThanOneKeyChunk(t *testing.T) {
	setupModelListControllerTestDB(t)

	channel := model.Channel{Id: 1001, Type: 1, Key: "sk-final-chunk", Name: "final chunk", Status: common.ChannelStatusEnabled, Group: "default", Models: "gpt-4o"}
	require.NoError(t, model.DB.Create(&channel).Error)

	// The model chunks exact-key IN queries internally at 200 keys, so 250 keys crosses a chunk boundary.
	keys := make([]string, 0, 250)
	for i := 0; i < 249; i++ {
		keys = append(keys, "sk-missing-"+common.GetRandomString(12))
	}
	keys = append(keys, "sk-final-chunk")

	payload := postChannelKeySearch(t, BatchChannelKeySearchRequest{
		Keys:     keys,
		Page:     1,
		PageSize: 20,
	})

	require.True(t, payload.Success)
	require.Equal(t, 1, payload.Data.Total)
	require.Len(t, payload.Data.Items, 1)
	require.Equal(t, 1001, payload.Data.Items[0].Id)
	require.Empty(t, payload.Data.Items[0].Key)
}

func TestSearchChannelsByKeysRejectsTagModeV1(t *testing.T) {
	setupModelListControllerTestDB(t)

	payload := postChannelKeySearch(t, BatchChannelKeySearchRequest{
		Keys:    []string{"sk-any"},
		TagMode: true,
	})

	require.False(t, payload.Success)
	require.Contains(t, payload.Message, "标签模式")
}
