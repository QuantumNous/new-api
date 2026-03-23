package model

import (
	"errors"
	"strconv"
	"strings"

	"gorm.io/gorm"
)

type TaskSuggestionParams struct {
	Field          string
	Keyword        string
	StartTimestamp int64
	EndTimestamp   int64
	ChannelID      string
	TaskID         string
	Limit          int
}

func GetAllTaskSuggestions(params TaskSuggestionParams) ([]string, error) {
	return getTaskSuggestions(DB.Model(&Task{}), params, 0, false)
}

func GetUserTaskSuggestions(userID int, params TaskSuggestionParams) ([]string, error) {
	return getTaskSuggestions(DB.Model(&Task{}), params, userID, true)
}

func getTaskSuggestions(tx *gorm.DB, params TaskSuggestionParams, userID int, self bool) ([]string, error) {
	fieldColumn, err := getTaskSuggestionFieldColumn(params.Field, self)
	if err != nil {
		return nil, err
	}
	params.Limit = clampSuggestionLimit(params.Limit)
	params.Keyword = strings.TrimSpace(params.Keyword)
	if params.Keyword == "" {
		return []string{}, nil
	}

	if self {
		tx = tx.Where("user_id = ?", userID)
	}
	if params.StartTimestamp != 0 {
		tx = tx.Where("submit_time >= ?", params.StartTimestamp)
	}
	if params.EndTimestamp != 0 {
		tx = tx.Where("submit_time <= ?", params.EndTimestamp)
	}
	if params.Field != "task_id" && params.TaskID != "" {
		taskPattern := buildContainsLikePattern(params.TaskID)
		tx = tx.Where("task_id LIKE ? ESCAPE '!'", taskPattern)
	}
	if params.Field != "channel_id" && params.ChannelID != "" {
		channelID, convErr := strconv.Atoi(params.ChannelID)
		if convErr == nil && channelID > 0 {
			tx = tx.Where("channel_id = ?", channelID)
		}
	}

	if params.Field == "channel_id" {
		return scanIntSuggestions(tx, fieldColumn, "submit_time", params.Keyword, params.Limit)
	}
	return scanStringSuggestions(tx, fieldColumn, "submit_time", params.Keyword, params.Limit)
}

func getTaskSuggestionFieldColumn(field string, self bool) (string, error) {
	switch field {
	case "task_id":
		return "task_id", nil
	case "channel_id":
		if self {
			return "", errors.New("当前用户不支持该筛选项联想")
		}
		return "channel_id", nil
	default:
		return "", errors.New("不支持的任务筛选项")
	}
}
