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

	require.NoError(t, DB.Create(&ImageGeneration{
		Id:        10,
		UserId:    1,
		CreatedAt: 2,
		Status:    ImageGenerationStatusSuccess,
		Prompt:    "a red cube",
		ModelName: "gemini-3.1-flash-image",
		Quota:     50000,
		ChannelId: 23,
		RequestId: "req_image",
		FilePath:  "20260710/user-1/req_image-0.png",
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
	require.Equal(t, int64(2000), items[0].FinishTime)
	require.Equal(t, "/api/image-generations/10/content", items[0].ImageUrl)
	require.Equal(t, "a red cube", items[0].Prompt)
	require.Equal(t, "gemini-3.1-flash-image", items[0].PromptEn)
	require.Equal(t, 50000, items[0].Quota)
	require.Equal(t, "mj_old", items[1].MjId)
	require.Equal(t, int64(2), CountAllUserDrawingLogs(1, TaskQueryParams{}))
}

func TestGetAllUserDrawingLogsFiltersImageGenerationByRequestID(t *testing.T) {
	truncateTables(t)

	require.NoError(t, DB.Create(&ImageGeneration{
		Id:        20,
		UserId:    1,
		CreatedAt: 2,
		Status:    ImageGenerationStatusSuccess,
		Prompt:    "match",
		ModelName: "gpt-image-2",
		RequestId: "req_match",
	}).Error)
	require.NoError(t, DB.Create(&ImageGeneration{
		Id:        21,
		UserId:    1,
		CreatedAt: 3,
		Status:    ImageGenerationStatusSuccess,
		Prompt:    "other",
		ModelName: "gpt-image-2",
		RequestId: "req_other",
	}).Error)

	items := GetAllUserDrawingLogs(1, 0, 10, TaskQueryParams{MjID: "req_match"})
	require.Len(t, items, 1)
	require.Equal(t, "req_match", items[0].MjId)
}

func TestGetAllUserDrawingLogsShowsExpiredImageGeneration(t *testing.T) {
	truncateTables(t)

	require.NoError(t, DB.Create(&ImageGeneration{
		Id:        30,
		UserId:    1,
		CreatedAt: 2,
		Status:    ImageGenerationStatusExpired,
		Prompt:    "expired",
		ModelName: "gpt-image-2",
		RequestId: "req_expired",
		FilePath:  "",
	}).Error)

	items := GetAllUserDrawingLogs(1, 0, 10, TaskQueryParams{})
	require.Len(t, items, 1)
	require.Equal(t, "EXPIRED", items[0].Status)
	require.Equal(t, "", items[0].ImageUrl)
	require.Equal(t, "图片已过期", items[0].FailReason)
}
