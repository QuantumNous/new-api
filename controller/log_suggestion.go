package controller

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetAllLogSuggestions(c *gin.Context) {
	limit, err := parseSuggestionIntQuery(c, "limit")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	logType, err := parseSuggestionIntQuery(c, "type")
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
	limit, err := parseSuggestionIntQuery(c, "limit")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	logType, err := parseSuggestionIntQuery(c, "type")
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
