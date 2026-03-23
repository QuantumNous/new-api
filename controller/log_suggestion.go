package controller

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetAllLogSuggestions(c *gin.Context) {
	limit, _ := strconv.Atoi(c.Query("limit"))
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)

	items, err := model.GetAllLogSuggestions(model.LogSuggestionParams{
		Field:          strings.TrimSpace(c.Query("field")),
		Keyword:        c.Query("keyword"),
		LogType:        logType,
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		Username:       c.Query("username"),
		TokenName:      c.Query("token_name"),
		ModelName:      c.Query("model_name"),
		Channel:        c.Query("channel"),
		Group:          c.Query("group"),
		RequestID:      c.Query("request_id"),
		Limit:          limit,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}

func GetUserLogSuggestions(c *gin.Context) {
	limit, _ := strconv.Atoi(c.Query("limit"))
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)

	items, err := model.GetUserLogSuggestions(c.GetInt("id"), model.LogSuggestionParams{
		Field:          strings.TrimSpace(c.Query("field")),
		Keyword:        c.Query("keyword"),
		LogType:        logType,
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		TokenName:      c.Query("token_name"),
		ModelName:      c.Query("model_name"),
		Group:          c.Query("group"),
		RequestID:      c.Query("request_id"),
		Limit:          limit,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}
