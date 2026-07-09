package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestGetAllUserDrawingLogsIncludesImageGenerationLogs(t *testing.T) {
	truncateTables(t)

	require.NoError(t, DB.Create(&Midjourney{
		Id:         1,
		UserId:     1,
		Action:     "IMAGINE",
		MjId:       "mj_old",
		Prompt:     "old mj prompt",
		SubmitTime: 1000,
		Status:     "SUCCESS",
		Progress:   "100%",
		ChannelId:  9,
	}).Error)

	require.NoError(t, LOG_DB.Create(&Log{
		Id:        10,
		UserId:    1,
		CreatedAt: 2,
		Type:      LogTypeConsume,
		Content:   "大小 1024x1024, 品质 standard, 生成数量 1",
		ModelName: "gemini-3.1-flash-image",
		Quota:     50000,
		UseTime:   3,
		ChannelId: 23,
		RequestId: "req_image",
		Other: common.MapToJsonStr(map[string]interface{}{
			"request_path": "/v1/images/generations",
			"model_price":  0.1,
		}),
	}).Error)

	require.NoError(t, LOG_DB.Create(&Log{
		Id:        11,
		UserId:    1,
		CreatedAt: 3,
		Type:      LogTypeConsume,
		Content:   "chat",
		ModelName: "gpt-4o",
		Other: common.MapToJsonStr(map[string]interface{}{
			"request_path": "/v1/chat/completions",
		}),
	}).Error)

	items := GetAllUserDrawingLogs(1, 0, 10, TaskQueryParams{})
	require.Len(t, items, 2)
	require.Equal(t, "req_image", items[0].MjId)
	require.Equal(t, "IMAGE_GENERATION", items[0].Action)
	require.Equal(t, "SUCCESS", items[0].Status)
	require.Equal(t, "100%", items[0].Progress)
	require.Equal(t, int64(2000), items[0].SubmitTime)
	require.Equal(t, int64(5000), items[0].FinishTime)
	require.Equal(t, "gemini-3.1-flash-image", items[0].PromptEn)
	require.Equal(t, 50000, items[0].Quota)
	require.Equal(t, "mj_old", items[1].MjId)
	require.Equal(t, int64(2), CountAllUserDrawingLogs(1, TaskQueryParams{}))
}

func TestGetAllUserDrawingLogsFiltersImageGenerationByRequestID(t *testing.T) {
	truncateTables(t)

	require.NoError(t, LOG_DB.Create(&Log{
		Id:        20,
		UserId:    1,
		CreatedAt: 2,
		Type:      LogTypeConsume,
		Content:   "大小 2048x2048, 品质 standard, 生成数量 1",
		ModelName: "gpt-image-2",
		RequestId: "req_match",
		Other: common.MapToJsonStr(map[string]interface{}{
			"request_path": "/v1/images/generations",
		}),
	}).Error)
	require.NoError(t, LOG_DB.Create(&Log{
		Id:        21,
		UserId:    1,
		CreatedAt: 3,
		Type:      LogTypeConsume,
		Content:   "大小 4096x4096, 品质 standard, 生成数量 1",
		ModelName: "gpt-image-2",
		RequestId: "req_other",
		Other: common.MapToJsonStr(map[string]interface{}{
			"request_path": "/v1/images/generations",
		}),
	}).Error)

	items := GetAllUserDrawingLogs(1, 0, 10, TaskQueryParams{MjID: "req_match"})
	require.Len(t, items, 1)
	require.Equal(t, "req_match", items[0].MjId)
}
