package controller

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func setupLogRequestSampleControllerTestDB(t *testing.T) {
	t.Helper()
	db := openTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.LogRequestSample{}))
}

func TestGetLogRequestSamplesReturnsFilteredPage(t *testing.T) {
	setupLogRequestSampleControllerTestDB(t)
	require.NoError(t, model.LOG_DB.Create(&[]model.LogRequestSample{
		{LogId: 1, UserId: 100, CreatedAt: 100, ModelName: "gpt-4o", TokenId: 9, UserGroup: "plg", RequestPath: "/v1/chat/completions", RequestId: "req-a", RequestParams: `{"a":1}`},
		{LogId: 2, UserId: 100, CreatedAt: 200, ModelName: "gpt-4o", TokenId: 9, UserGroup: "plg", RequestPath: "/v1/chat/completions", RequestId: "req-b", RequestParams: `{"b":2}`},
		{LogId: 3, UserId: 200, CreatedAt: 300, ModelName: "claude-3-5-sonnet", TokenId: 10, UserGroup: "default", RequestPath: "/v1/messages", RequestId: "req-c", RequestParams: `{"c":3}`},
	}).Error)

	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/log/request_samples?user_id=100&model_name=gpt-4o&group=plg&p=1&page_size=1", nil, 1)
	GetLogRequestSamples(ctx)

	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, response.Message)

	var page struct {
		Total int                      `json:"total"`
		Items []model.LogRequestSample `json:"items"`
	}
	require.NoError(t, common.Unmarshal(response.Data, &page))
	require.Equal(t, 2, page.Total)
	require.Len(t, page.Items, 1)
	require.Equal(t, 2, page.Items[0].LogId)
	require.Equal(t, `{"b":2}`, page.Items[0].RequestParams)
}
