package controller

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetAllMidjourneySuggestions(c *gin.Context) {
	limit, _ := strconv.Atoi(c.Query("limit"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)

	items, err := model.GetAllMidjourneySuggestions(model.MidjourneySuggestionParams{
		Field:          strings.TrimSpace(c.Query("field")),
		Keyword:        c.Query("keyword"),
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		ChannelID:      c.Query("channel_id"),
		MjID:           c.Query("mj_id"),
		Limit:          limit,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}

func GetUserMidjourneySuggestions(c *gin.Context) {
	limit, _ := strconv.Atoi(c.Query("limit"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)

	items, err := model.GetUserMidjourneySuggestions(c.GetInt("id"), model.MidjourneySuggestionParams{
		Field:          strings.TrimSpace(c.Query("field")),
		Keyword:        c.Query("keyword"),
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		MjID:           c.Query("mj_id"),
		Limit:          limit,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}
