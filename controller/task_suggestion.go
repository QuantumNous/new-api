package controller

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetAllTaskSuggestions(c *gin.Context) {
	limit, _ := strconv.Atoi(c.Query("limit"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)

	items, err := model.GetAllTaskSuggestions(model.TaskSuggestionParams{
		Field:          strings.TrimSpace(c.Query("field")),
		Keyword:        c.Query("keyword"),
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		ChannelID:      c.Query("channel_id"),
		TaskID:         c.Query("task_id"),
		Limit:          limit,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}

func GetUserTaskSuggestions(c *gin.Context) {
	limit, _ := strconv.Atoi(c.Query("limit"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)

	items, err := model.GetUserTaskSuggestions(c.GetInt("id"), model.TaskSuggestionParams{
		Field:          strings.TrimSpace(c.Query("field")),
		Keyword:        c.Query("keyword"),
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		TaskID:         c.Query("task_id"),
		Limit:          limit,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}
