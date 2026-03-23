package model

import (
	"errors"
	"strconv"
	"strings"

	"gorm.io/gorm"
)

type MidjourneySuggestionParams struct {
	Field          string
	Keyword        string
	StartTimestamp int64
	EndTimestamp   int64
	ChannelID      string
	MjID           string
	Limit          int
}

func GetAllMidjourneySuggestions(params MidjourneySuggestionParams) ([]string, error) {
	return getMidjourneySuggestions(DB.Model(&Midjourney{}), params, 0, false)
}

func GetUserMidjourneySuggestions(userID int, params MidjourneySuggestionParams) ([]string, error) {
	return getMidjourneySuggestions(DB.Model(&Midjourney{}), params, userID, true)
}

func getMidjourneySuggestions(tx *gorm.DB, params MidjourneySuggestionParams, userID int, self bool) ([]string, error) {
	fieldColumn, err := getMidjourneySuggestionFieldColumn(params.Field, self)
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
	if params.Field != "mj_id" && params.MjID != "" {
		mjPattern := buildContainsLikePattern(params.MjID)
		tx = tx.Where("mj_id LIKE ? ESCAPE '!'", mjPattern)
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

func getMidjourneySuggestionFieldColumn(field string, self bool) (string, error) {
	switch field {
	case "mj_id":
		return "mj_id", nil
	case "channel_id":
		if self {
			return "", errors.New("当前用户不支持该筛选项联想")
		}
		return "channel_id", nil
	default:
		return "", errors.New("不支持的绘图任务筛选项")
	}
}
