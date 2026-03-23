package model

import (
	"strconv"
	"strings"

	"gorm.io/gorm"
)

const suggestionHardLimit = 20

type suggestionStringRow struct {
	Value string `gorm:"column:value"`
}

type suggestionIntRow struct {
	Value int `gorm:"column:value"`
}

func ensureSuggestionColumnsInitialized() {
	if commonGroupCol == "" || logGroupCol == "" {
		initCol()
	}
}

func clampSuggestionLimit(limit int) int {
	if limit <= 0 || limit > suggestionHardLimit {
		return suggestionHardLimit
	}
	return limit
}

func escapeLikeLiteral(input string) string {
	replacer := strings.NewReplacer(
		"!", "!!",
		"%", "!%",
		"_", "!_",
	)
	return replacer.Replace(strings.TrimSpace(input))
}

func buildContainsLikePattern(keyword string) string {
	trimmed := escapeLikeLiteral(keyword)
	if trimmed == "" {
		return ""
	}
	return "%" + trimmed + "%"
}

func scanStringSuggestions(tx *gorm.DB, column string, timeColumn string, keyword string, limit int) ([]string, error) {
	pattern := buildContainsLikePattern(keyword)
	query := tx.Where(column + " <> ''")
	if pattern != "" {
		query = query.Where(column+" LIKE ? ESCAPE '!'", pattern)
	}

	rows := make([]suggestionStringRow, 0, limit)
	err := query.
		Select(column + " AS value").
		Group(column).
		Order("MAX(" + timeColumn + ") DESC").
		Limit(limit).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	result := make([]string, 0, len(rows))
	for _, row := range rows {
		if row.Value == "" {
			continue
		}
		result = append(result, row.Value)
	}
	return result, nil
}

func scanIntSuggestions(tx *gorm.DB, column string, timeColumn string, keyword string, limit int) ([]string, error) {
	query := tx.Where(column + " <> 0")

	rows := make([]suggestionIntRow, 0, limit)
	err := query.
		Select(column + " AS value").
		Group(column).
		Order("MAX(" + timeColumn + ") DESC").
		Limit(limit * 5).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	result := make([]string, 0, limit)
	for _, row := range rows {
		value := strconv.Itoa(row.Value)
		if keyword != "" && !strings.HasPrefix(value, strings.TrimSpace(keyword)) {
			continue
		}
		result = append(result, value)
		if len(result) >= limit {
			break
		}
	}
	return result, nil
}
