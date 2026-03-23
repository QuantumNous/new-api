package model

import (
	"errors"
	"strconv"
	"strings"

	"gorm.io/gorm"
)

type LogSuggestionParams struct {
	Field          string
	Keyword        string
	LogType        int
	StartTimestamp int64
	EndTimestamp   int64
	Username       string
	TokenName      string
	ModelName      string
	Channel        string
	Group          string
	RequestID      string
	Limit          int
}

func GetAllLogSuggestions(params LogSuggestionParams) ([]string, error) {
	return getLogSuggestions(LOG_DB.Model(&Log{}), params, 0, false)
}

func GetUserLogSuggestions(userID int, params LogSuggestionParams) ([]string, error) {
	return getLogSuggestions(LOG_DB.Model(&Log{}), params, userID, true)
}

func getLogSuggestions(tx *gorm.DB, params LogSuggestionParams, userID int, self bool) ([]string, error) {
	fieldColumn, err := getLogSuggestionFieldColumn(params.Field, self)
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
	if params.LogType != LogTypeUnknown {
		tx = tx.Where("type = ?", params.LogType)
	}
	if params.StartTimestamp != 0 {
		tx = tx.Where("created_at >= ?", params.StartTimestamp)
	}
	if params.EndTimestamp != 0 {
		tx = tx.Where("created_at <= ?", params.EndTimestamp)
	}
	if params.Field != "username" && params.Username != "" && !self {
		tx = tx.Where("username = ?", params.Username)
	}
	if params.Field != "token_name" && params.TokenName != "" {
		tx = tx.Where("token_name = ?", params.TokenName)
	}
	if params.Field != "model_name" && params.ModelName != "" {
		modelPattern := buildContainsLikePattern(params.ModelName)
		tx = tx.Where("model_name LIKE ? ESCAPE '!'", modelPattern)
	}
	if params.Field != "group" && params.Group != "" {
		tx = tx.Where(logGroupCol+" = ?", params.Group)
	}
	if params.Field != "request_id" && params.RequestID != "" {
		tx = tx.Where("request_id = ?", params.RequestID)
	}
	if params.Field != "channel" && params.Channel != "" {
		channelID, convErr := strconv.Atoi(params.Channel)
		if convErr == nil && channelID > 0 {
			tx = tx.Where("channel_id = ?", channelID)
		}
	}

	if params.Field == "channel" {
		return scanIntSuggestions(tx, fieldColumn, "created_at", params.Keyword, params.Limit)
	}
	return scanStringSuggestions(tx, fieldColumn, "created_at", params.Keyword, params.Limit)
}

func getLogSuggestionFieldColumn(field string, self bool) (string, error) {
	ensureSuggestionColumnsInitialized()
	switch field {
	case "token_name":
		return "token_name", nil
	case "model_name":
		return "model_name", nil
	case "group":
		return logGroupCol, nil
	case "request_id":
		return "request_id", nil
	case "channel":
		if self {
			return "", errors.New("当前用户不支持该筛选项联想")
		}
		return "channel_id", nil
	case "username":
		if self {
			return "", errors.New("当前用户不支持该筛选项联想")
		}
		return "username", nil
	default:
		return "", errors.New("不支持的日志筛选项")
	}
}
