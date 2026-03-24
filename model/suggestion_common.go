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

// scanStringSuggestions is internal-only. Callers must pass validated constant
// column names from get*SuggestionFieldColumn and a fixed timestamp column.
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

// scanIntSuggestions is internal-only. Callers must pass validated constant
// column names from get*SuggestionFieldColumn and a fixed timestamp column.
func scanIntSuggestions(tx *gorm.DB, column string, timeColumn string, keyword string, limit int) ([]string, error) {
	keyword = strings.TrimSpace(keyword)
	if keyword != "" && !isDigitsOnly(keyword) {
		return []string{}, nil
	}

	query := tx.Where(column + " <> 0")
	if keyword != "" {
		query = query.Where(intColumnCastExpression(tx, column)+" LIKE ?", keyword+"%")
	}

	rows := make([]suggestionIntRow, 0, limit)
	err := query.
		Select(column + " AS value").
		Group(column).
		Order("MAX(" + timeColumn + ") DESC").
		Limit(limit).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	result := make([]string, 0, limit)
	for _, row := range rows {
		result = append(result, strconv.Itoa(row.Value))
	}
	return result, nil
}

func isDigitsOnly(value string) bool {
	if value == "" {
		return false
	}
	for _, r := range value {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

// intColumnCastExpression is internal-only and expects a validated numeric
// column name selected from the suggestion field maps.
func intColumnCastExpression(tx *gorm.DB, column string) string {
	switch tx.Dialector.Name() {
	case "mysql":
		return "CAST(" + column + " AS CHAR)"
	default:
		return "CAST(" + column + " AS TEXT)"
	}
}
