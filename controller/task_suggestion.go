package controller

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetAllTaskSuggestions(c *gin.Context) {
	limit, err := parseSuggestionIntQuery(c, "limit")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	startTimestamp, err := parseSuggestionInt64Query(c, "start_timestamp")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	endTimestamp, err := parseSuggestionInt64Query(c, "end_timestamp")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

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
	limit, err := parseSuggestionIntQuery(c, "limit")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	startTimestamp, err := parseSuggestionInt64Query(c, "start_timestamp")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	endTimestamp, err := parseSuggestionInt64Query(c, "end_timestamp")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

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
