package model

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

type ChannelMonitorSuccessSummary struct {
	ActualSuccessCount int64   `json:"actual_success_count"`
	ActualFailureCount int64   `json:"actual_failure_count"`
	ActualSampleCount  int64   `json:"actual_sample_count"`
	ActualSuccessRate  float64 `json:"actual_success_rate"`
	FinalSuccessCount  int64   `json:"final_success_count"`
	FinalFailureCount  int64   `json:"final_failure_count"`
	FinalSampleCount   int64   `json:"final_sample_count"`
	FinalSuccessRate   float64 `json:"final_success_rate"`
}

type ChannelMonitorSuccessMetric struct {
	ChannelId int    `json:"channel_id"`
	ModelName string `json:"model_name"`
	ChannelMonitorSuccessSummary
}

type ChannelMonitorGroupSuccessMetric struct {
	Group string `json:"group"`
	ChannelMonitorSuccessSummary
}

type ChannelMonitorChannelSuccessMetric struct {
	ChannelId int `json:"channel_id"`
	ChannelMonitorSuccessSummary
}

type ChannelMonitorFailureCategory struct {
	ChannelId     int    `json:"channel_id"`
	StatusCode    int    `json:"status_code"`
	ErrorType     string `json:"error_type"`
	ErrorCode     string `json:"error_code"`
	SampleContent string `json:"sample_content"`
	ActualCount   int64  `json:"actual_count"`
	FinalCount    int64  `json:"final_count"`
	LastOccurred  int64  `json:"last_occurred_at"`
}

type ChannelMonitorSuccessDetail struct {
	Summary           ChannelMonitorSuccessSummary         `json:"summary"`
	ChannelItems      []ChannelMonitorChannelSuccessMetric `json:"channel_items"`
	FailureCategories []ChannelMonitorFailureCategory      `json:"failure_categories"`
}

type ChannelMonitorSuccessFilter struct {
	ChannelId int
	ModelName string
	Group     string
}

type channelMonitorSuccessCounts struct {
	actualSuccess int64
	actualFailure int64
	finalSuccess  int64
	finalFailure  int64
}

type channelMonitorSuccessRow struct {
	ChannelId      int
	ModelName      string
	GroupName      string `gorm:"column:group_name"`
	Type           int
	IsRetryAttempt *bool
	Count          int64
}

func channelMonitorLogGroupColumn() string {
	if logGroupCol != "" {
		return logGroupCol
	}
	if common.UsingLogDatabase(common.DatabaseTypePostgreSQL) {
		return `"group"`
	}
	return "`group`"
}

func applyChannelMonitorSuccessFilter(tx *gorm.DB, filter ChannelMonitorSuccessFilter) *gorm.DB {
	if filter.ChannelId > 0 {
		tx = tx.Where("channel_id = ?", filter.ChannelId)
	}
	if filter.ModelName != "" {
		tx = tx.Where("model_name = ?", filter.ModelName)
	}
	if filter.Group != "" {
		tx = tx.Where(channelMonitorLogGroupColumn()+" = ?", filter.Group)
	}
	return tx
}

func getChannelMonitorSuccessRows(ctx context.Context, startTimestamp int64, filter ChannelMonitorSuccessFilter) ([]channelMonitorSuccessRow, error) {
	groupColumn := channelMonitorLogGroupColumn()
	selectColumns := "channel_id, model_name, " + groupColumn + " AS group_name, type, is_retry_attempt, COUNT(*) AS count"
	groupColumns := "channel_id, model_name, " + groupColumn + ", type, is_retry_attempt"
	query := LOG_DB.WithContext(ctx).
		Model(&Log{}).
		Select(selectColumns).
		Where("type IN ?", []int{LogTypeConsume, LogTypeError}).
		Where("channel_id > ?", 0).
		Where("created_at >= ?", startTimestamp)
	query = applyChannelMonitorSuccessFilter(query, filter)

	var rows []channelMonitorSuccessRow
	err := query.Group(groupColumns).Scan(&rows).Error
	return rows, err
}

func (counts *channelMonitorSuccessCounts) add(logType int, isRetryAttempt bool, count int64) {
	if logType == LogTypeConsume {
		counts.actualSuccess += count
		counts.finalSuccess += count
		return
	}
	counts.actualFailure += count
	if !isRetryAttempt {
		counts.finalFailure += count
	}
}

func (counts channelMonitorSuccessCounts) summary() ChannelMonitorSuccessSummary {
	actualSampleCount := counts.actualSuccess + counts.actualFailure
	finalSampleCount := counts.finalSuccess + counts.finalFailure
	summary := ChannelMonitorSuccessSummary{
		ActualSuccessCount: counts.actualSuccess,
		ActualFailureCount: counts.actualFailure,
		ActualSampleCount:  actualSampleCount,
		FinalSuccessCount:  counts.finalSuccess,
		FinalFailureCount:  counts.finalFailure,
		FinalSampleCount:   finalSampleCount,
	}
	if actualSampleCount > 0 {
		summary.ActualSuccessRate = float64(counts.actualSuccess) / float64(actualSampleCount)
	}
	if finalSampleCount > 0 {
		summary.FinalSuccessRate = float64(counts.finalSuccess) / float64(finalSampleCount)
	}
	return summary
}

// GetChannelMonitorSuccessMetrics reports upstream-call success and the final
// user-visible outcome. Retry-attempt errors affect actual calls but are
// excluded from final outcomes.
func GetChannelMonitorSuccessMetrics(ctx context.Context, startTimestamp int64) ([]ChannelMonitorSuccessMetric, []ChannelMonitorGroupSuccessMetric, error) {
	rows, err := getChannelMonitorSuccessRows(ctx, startTimestamp, ChannelMonitorSuccessFilter{})
	if err != nil {
		return nil, nil, err
	}

	type channelKey struct {
		channelId int
		modelName string
	}
	channelCounts := make(map[channelKey]*channelMonitorSuccessCounts)
	groupCounts := make(map[string]*channelMonitorSuccessCounts)
	for _, row := range rows {
		isRetryAttempt := row.IsRetryAttempt != nil && *row.IsRetryAttempt
		if strings.TrimSpace(row.ModelName) != "" {
			key := channelKey{channelId: row.ChannelId, modelName: row.ModelName}
			counts := channelCounts[key]
			if counts == nil {
				counts = &channelMonitorSuccessCounts{}
				channelCounts[key] = counts
			}
			counts.add(row.Type, isRetryAttempt, row.Count)
		}

		group := strings.TrimSpace(row.GroupName)
		if group == "" {
			continue
		}
		counts := groupCounts[group]
		if counts == nil {
			counts = &channelMonitorSuccessCounts{}
			groupCounts[group] = counts
		}
		counts.add(row.Type, isRetryAttempt, row.Count)
	}

	channelMetrics := make([]ChannelMonitorSuccessMetric, 0, len(channelCounts))
	for key, counts := range channelCounts {
		channelMetrics = append(channelMetrics, ChannelMonitorSuccessMetric{
			ChannelId:                    key.channelId,
			ModelName:                    key.modelName,
			ChannelMonitorSuccessSummary: counts.summary(),
		})
	}
	sort.Slice(channelMetrics, func(i int, j int) bool {
		if channelMetrics[i].ModelName == channelMetrics[j].ModelName {
			return channelMetrics[i].ChannelId < channelMetrics[j].ChannelId
		}
		return channelMetrics[i].ModelName < channelMetrics[j].ModelName
	})

	groupMetrics := make([]ChannelMonitorGroupSuccessMetric, 0, len(groupCounts))
	for group, counts := range groupCounts {
		groupMetrics = append(groupMetrics, ChannelMonitorGroupSuccessMetric{
			Group:                        group,
			ChannelMonitorSuccessSummary: counts.summary(),
		})
	}
	sort.Slice(groupMetrics, func(i int, j int) bool {
		return groupMetrics[i].Group < groupMetrics[j].Group
	})
	return channelMetrics, groupMetrics, nil
}

// GetChannelMonitorSuccessDetail returns the selected scope's totals and
// per-channel breakdown. Channel scopes also include categorized failures.
func GetChannelMonitorSuccessDetail(ctx context.Context, startTimestamp int64, filter ChannelMonitorSuccessFilter) (ChannelMonitorSuccessDetail, error) {
	rows, err := getChannelMonitorSuccessRows(ctx, startTimestamp, filter)
	if err != nil {
		return ChannelMonitorSuccessDetail{}, err
	}

	totalCounts := channelMonitorSuccessCounts{}
	channelCounts := make(map[int]*channelMonitorSuccessCounts)
	for _, row := range rows {
		if filter.Group == "" && strings.TrimSpace(row.ModelName) == "" {
			continue
		}
		isRetryAttempt := row.IsRetryAttempt != nil && *row.IsRetryAttempt
		totalCounts.add(row.Type, isRetryAttempt, row.Count)
		counts := channelCounts[row.ChannelId]
		if counts == nil {
			counts = &channelMonitorSuccessCounts{}
			channelCounts[row.ChannelId] = counts
		}
		counts.add(row.Type, isRetryAttempt, row.Count)
	}

	channelItems := make([]ChannelMonitorChannelSuccessMetric, 0, len(channelCounts))
	for channelId, counts := range channelCounts {
		channelItems = append(channelItems, ChannelMonitorChannelSuccessMetric{
			ChannelId:                    channelId,
			ChannelMonitorSuccessSummary: counts.summary(),
		})
	}
	sort.Slice(channelItems, func(i int, j int) bool {
		return channelItems[i].ChannelId < channelItems[j].ChannelId
	})

	failureCategories := make([]ChannelMonitorFailureCategory, 0)
	if filter.ChannelId > 0 {
		failureCategories, err = getChannelMonitorFailureCategories(ctx, startTimestamp, filter)
		if err != nil {
			return ChannelMonitorSuccessDetail{}, err
		}
	}
	return ChannelMonitorSuccessDetail{
		Summary:           totalCounts.summary(),
		ChannelItems:      channelItems,
		FailureCategories: failureCategories,
	}, nil
}

func getChannelMonitorFailureCategories(ctx context.Context, startTimestamp int64, filter ChannelMonitorSuccessFilter) ([]ChannelMonitorFailureCategory, error) {
	type failureRow struct {
		ChannelId      int
		ModelName      string
		Content        string
		Other          string
		IsRetryAttempt *bool
		Count          int64
		LastOccurred   int64 `gorm:"column:last_occurred_at"`
	}
	query := LOG_DB.WithContext(ctx).
		Model(&Log{}).
		Select("channel_id, model_name, content, MAX(other) AS other, is_retry_attempt, COUNT(*) AS count, MAX(created_at) AS last_occurred_at").
		Where("type = ?", LogTypeError).
		Where("channel_id > ?", 0).
		Where("created_at >= ?", startTimestamp)
	query = applyChannelMonitorSuccessFilter(query, filter)

	var rows []failureRow
	err := query.
		Group("channel_id, model_name, content, is_retry_attempt").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	type categoryKey struct {
		channelId  int
		statusCode int
		errorType  string
		errorCode  string
		content    string
	}
	categories := make(map[categoryKey]*ChannelMonitorFailureCategory)
	for _, row := range rows {
		if filter.Group == "" && strings.TrimSpace(row.ModelName) == "" {
			continue
		}
		statusCode, errorType, errorCode := channelMonitorFailureIdentity(row.Content, row.Other)
		sampleContent := channelMonitorFailureSampleContent(row.Content)
		fallbackContent := ""
		if statusCode == 0 && errorType == "" && errorCode == "" {
			fallbackContent = sampleContent
		}
		key := categoryKey{
			channelId:  row.ChannelId,
			statusCode: statusCode,
			errorType:  errorType,
			errorCode:  errorCode,
			content:    fallbackContent,
		}
		category := categories[key]
		if category == nil {
			category = &ChannelMonitorFailureCategory{
				ChannelId:     row.ChannelId,
				StatusCode:    statusCode,
				ErrorType:     errorType,
				ErrorCode:     errorCode,
				SampleContent: sampleContent,
			}
			categories[key] = category
		}
		category.ActualCount += row.Count
		isRetryAttempt := row.IsRetryAttempt != nil && *row.IsRetryAttempt
		if !isRetryAttempt {
			category.FinalCount += row.Count
		}
		if row.LastOccurred >= category.LastOccurred {
			category.LastOccurred = row.LastOccurred
			category.SampleContent = sampleContent
		}
	}

	result := make([]ChannelMonitorFailureCategory, 0, len(categories))
	for _, category := range categories {
		result = append(result, *category)
	}
	sort.Slice(result, func(i int, j int) bool {
		if result[i].ChannelId != result[j].ChannelId {
			return result[i].ChannelId < result[j].ChannelId
		}
		if result[i].ActualCount != result[j].ActualCount {
			return result[i].ActualCount > result[j].ActualCount
		}
		if result[i].StatusCode != result[j].StatusCode {
			return result[i].StatusCode < result[j].StatusCode
		}
		if result[i].ErrorCode != result[j].ErrorCode {
			return result[i].ErrorCode < result[j].ErrorCode
		}
		return result[i].ErrorType < result[j].ErrorType
	})
	return result, nil
}

func channelMonitorFailureIdentity(content string, other string) (int, string, string) {
	otherValues := make(map[string]interface{})
	if strings.TrimSpace(other) != "" {
		_ = common.UnmarshalJsonStr(other, &otherValues)
	}
	statusCode := channelMonitorFailureStatusCode(otherValues["status_code"])
	if statusCode == 0 && strings.HasPrefix(content, "status_code=") {
		rawStatus := strings.TrimPrefix(content, "status_code=")
		if end := strings.IndexAny(rawStatus, ", \t\r\n"); end >= 0 {
			rawStatus = rawStatus[:end]
		}
		statusCode, _ = strconv.Atoi(rawStatus)
	}
	errorType := channelMonitorFailureValue(otherValues["error_type"])
	errorCode := channelMonitorFailureValue(otherValues["error_code"])
	return statusCode, errorType, errorCode
}

func channelMonitorFailureStatusCode(value interface{}) int {
	switch typedValue := value.(type) {
	case int:
		return typedValue
	case int64:
		return int(typedValue)
	case float64:
		return int(typedValue)
	case string:
		statusCode, _ := strconv.Atoi(strings.TrimSpace(typedValue))
		return statusCode
	default:
		return 0
	}
}

func channelMonitorFailureValue(value interface{}) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(value))
}

func channelMonitorFailureSampleContent(content string) string {
	const maxLength = 500
	trimmedContent := strings.TrimSpace(content)
	runes := []rune(trimmedContent)
	if len(runes) <= maxLength {
		return trimmedContent
	}
	return string(runes[:maxLength]) + "..."
}
