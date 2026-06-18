package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type queryKeyReportTestResponse struct {
	Success bool                  `json:"success"`
	Message string                `json:"message"`
	Data    *model.QueryKeyReport `json:"data"`
}

func postQueryChannelKeyReport(t *testing.T, request QueryKeyReportRequest) queryKeyReportTestResponse {
	t.Helper()

	body, err := common.Marshal(request)
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/query-key/report", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	QueryChannelKeyReport(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload queryKeyReportTestResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	return payload
}

func TestQueryChannelKeyReportReturnsApiSuccessReport(t *testing.T) {
	setupModelListControllerTestDB(t)

	channel := model.Channel{Id: 2001, Type: 1, Key: "sk-report", Name: "report channel", Status: common.ChannelStatusEnabled, Group: "default", Models: "gpt-4o", UsedQuota: int64(common.QuotaPerUnit) * 2, Balance: 5}
	require.NoError(t, model.DB.Create(&channel).Error)

	payload := postQueryChannelKeyReport(t, QueryKeyReportRequest{Keys: []string{" sk-report ", "sk-missing", "sk-report"}})

	require.True(t, payload.Success)
	require.Empty(t, payload.Message)
	require.NotNil(t, payload.Data)
	require.Equal(t, 3, payload.Data.TotalInput)
	require.Equal(t, 2, payload.Data.UniqueKeys)
	require.Equal(t, 1, payload.Data.DuplicateCount)
	require.Equal(t, 1, payload.Data.FoundCount)
	require.Equal(t, 1, payload.Data.NotFoundCount)
	require.Len(t, payload.Data.Items, 2)
	require.Equal(t, "sk-report", payload.Data.Items[0].Key)
	require.True(t, payload.Data.Items[0].Found)
	require.Len(t, payload.Data.Items[0].Channels, 1)
}

func TestQueryChannelKeyReportRejectsEmptyInput(t *testing.T) {
	setupModelListControllerTestDB(t)

	payload := postQueryChannelKeyReport(t, QueryKeyReportRequest{Keys: []string{"", "   "}})

	require.False(t, payload.Success)
	require.Contains(t, payload.Message, "keys")
	require.Nil(t, payload.Data)
}

func TestQueryChannelKeyReportRejectsMoreThanTenThousandUniqueKeys(t *testing.T) {
	setupModelListControllerTestDB(t)

	keys := make([]string, model.MaxQueryKeyReportKeys+1)
	for i := range keys {
		keys[i] = fmt.Sprintf("sk-%05d", i)
	}
	payload := postQueryChannelKeyReport(t, QueryKeyReportRequest{Keys: keys})

	require.False(t, payload.Success)
	require.Contains(t, payload.Message, "10000")
	require.Nil(t, payload.Data)
}

func TestBuildQueryKeyTestChannelUsesOnlyRequestedChannelKey(t *testing.T) {
	setupModelListControllerTestDB(t)

	channel := model.Channel{
		Id:     2201,
		Type:   1,
		Key:    "sk-a\nsk-b",
		Name:   "multi key channel",
		Status: common.ChannelStatusEnabled,
		Group:  "default",
		Models: "gpt-4o",
		ChannelInfo: model.ChannelInfo{
			IsMultiKey: true,
		},
	}
	require.NoError(t, model.DB.Create(&channel).Error)

	testChannel, err := buildQueryKeyTestChannel(model.QueryKeyReportSourceChannel, channel.Id, "sk-b")
	require.NoError(t, err)
	require.Equal(t, "sk-b", testChannel.Key)
	require.False(t, testChannel.ChannelInfo.IsMultiKey)

	_, err = buildQueryKeyTestChannel(model.QueryKeyReportSourceChannel, channel.Id, "sk-missing")
	require.Error(t, err)
	require.Contains(t, err.Error(), "不属于")
}

func TestBuildQueryKeyTestChannelSupportsPreparation(t *testing.T) {
	setupModelListControllerTestDB(t)

	preparation := model.ChannelPreparation{
		Id:     2301,
		Type:   2,
		Key:    "sk-prep-a\nsk-prep-b",
		Name:   "prep multi",
		Status: model.ChannelPreparationStatusPending,
		Group:  "default",
		Models: "claude-3",
	}
	require.NoError(t, model.DB.Create(&preparation).Error)

	testChannel, err := buildQueryKeyTestChannel(model.QueryKeyReportSourcePreparation, preparation.Id, "sk-prep-a")
	require.NoError(t, err)
	require.Equal(t, preparation.Id, testChannel.Id)
	require.Equal(t, "sk-prep-a", testChannel.Key)
	require.False(t, testChannel.ChannelInfo.IsMultiKey)
}
