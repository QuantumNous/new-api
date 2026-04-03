package model

import (
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"gorm.io/gorm"
)

const (
	TaskMediaTypeAll   = "all"
	TaskMediaTypeImage = "image"
	TaskMediaTypeVideo = "video"
)

var taskMediaTypeActions = map[string][]string{
	TaskMediaTypeImage: {
		"imageGenerate",
		"imageEdit",
	},
	TaskMediaTypeVideo: {
		"generate",
		"textGenerate",
		"firstTailGenerate",
		"referenceGenerate",
		"remixGenerate",
	},
}

type taskStatsRecord struct {
	Action     string
	Status     TaskStatus
	SubmitTime int64
	Progress   string
	FailReason string
}

type taskStatsBucketMode string

const (
	taskStatsBucketModeDay  taskStatsBucketMode = "day"
	taskStatsBucketModeHour taskStatsBucketMode = "hour"
)

func normalizeTaskStatus(status TaskStatus) TaskStatus {
	normalizedStatus := strings.ToUpper(strings.TrimSpace(string(status)))
	switch normalizedStatus {
	case string(TaskStatusNotStart):
		return TaskStatusNotStart
	case string(TaskStatusSubmitted):
		return TaskStatusSubmitted
	case string(TaskStatusQueued), "PENDING":
		return TaskStatusQueued
	case string(TaskStatusInProgress), "PROCESSING", "RUNNING":
		return TaskStatusInProgress
	case string(TaskStatusSuccess), "SUCCEEDED", "COMPLETED", "DONE":
		return TaskStatusSuccess
	case string(TaskStatusFailure), "FAILED", "ERROR", "CANCELED", "CANCELLED":
		return TaskStatusFailure
	default:
		return status
	}
}

func normalizeTaskMediaType(mediaType string) string {
	switch strings.ToLower(strings.TrimSpace(mediaType)) {
	case TaskMediaTypeImage:
		return TaskMediaTypeImage
	case TaskMediaTypeVideo:
		return TaskMediaTypeVideo
	case TaskMediaTypeAll:
		return TaskMediaTypeAll
	default:
		return ""
	}
}

func getTaskActionsForMediaType(mediaType string) []string {
	normalizedMediaType := normalizeTaskMediaType(mediaType)
	switch normalizedMediaType {
	case TaskMediaTypeImage:
		return append([]string(nil), taskMediaTypeActions[TaskMediaTypeImage]...)
	case TaskMediaTypeVideo:
		return append([]string(nil), taskMediaTypeActions[TaskMediaTypeVideo]...)
	case TaskMediaTypeAll:
		allActions := make([]string, 0, len(taskMediaTypeActions[TaskMediaTypeImage])+len(taskMediaTypeActions[TaskMediaTypeVideo]))
		allActions = append(allActions, taskMediaTypeActions[TaskMediaTypeImage]...)
		allActions = append(allActions, taskMediaTypeActions[TaskMediaTypeVideo]...)
		return allActions
	default:
		return nil
	}
}

func detectTaskMediaType(action string) string {
	trimmedAction := strings.TrimSpace(action)
	for mediaType, actions := range taskMediaTypeActions {
		for _, candidate := range actions {
			if candidate == trimmedAction {
				return mediaType
			}
		}
	}
	return ""
}

func isRunningTaskStatus(status TaskStatus) bool {
	status = normalizeTaskStatus(status)
	switch status {
	case TaskStatusNotStart, TaskStatusSubmitted, TaskStatusQueued, TaskStatusInProgress:
		return true
	default:
		return false
	}
}

func resolveTaskStatsBreakdown(status TaskStatus, progress string, failReason string) string {
	normalizedStatus := normalizeTaskStatus(status)
	normalizedProgress := strings.TrimSpace(progress)
	normalizedFailReason := strings.TrimSpace(failReason)

	switch {
	case normalizedStatus == TaskStatusFailure:
		return "failure"
	case normalizedStatus == TaskStatusSuccess:
		return "success"
	case isRunningTaskStatus(normalizedStatus):
		return "running"
	case normalizedFailReason != "":
		return "failure"
	}

	if normalizedProgress == "" {
		return ""
	}

	switch strings.ToUpper(normalizedProgress) {
	case "100", "100%", "SUCCESS", "SUCCEEDED", "COMPLETED", "DONE":
		return "success"
	case "FAILED", "FAILURE", "ERROR", "CANCELED", "CANCELLED":
		return "failure"
	}

	if strings.HasSuffix(normalizedProgress, "%") {
		trimmedProgress := strings.TrimSuffix(normalizedProgress, "%")
		if trimmedProgress != "100" {
			return "running"
		}
		return "success"
	}

	return "running"
}

func applySyncTaskQueryFilters(query *gorm.DB, queryParams SyncTaskQueryParams) *gorm.DB {
	if queryParams.ChannelID != "" {
		query = query.Where("channel_id = ?", queryParams.ChannelID)
	}
	if queryParams.Platform != "" {
		query = query.Where("platform = ?", queryParams.Platform)
	}
	if queryParams.UserID != "" {
		query = query.Where("user_id = ?", queryParams.UserID)
	}
	if len(queryParams.UserIDs) != 0 {
		query = query.Where("user_id in (?)", queryParams.UserIDs)
	}
	if queryParams.TaskID != "" {
		query = query.Where("task_id = ?", queryParams.TaskID)
	}
	if queryParams.Action != "" {
		query = query.Where("action = ?", queryParams.Action)
	}
	if queryParams.Status != "" {
		query = query.Where("status = ?", queryParams.Status)
	}
	if queryParams.StartTimestamp != 0 {
		query = query.Where("submit_time >= ?", queryParams.StartTimestamp)
	}
	if queryParams.EndTimestamp != 0 {
		query = query.Where("submit_time <= ?", queryParams.EndTimestamp)
	}
	if actions := getTaskActionsForMediaType(queryParams.MediaType); len(actions) > 0 {
		query = query.Where("action in (?)", actions)
	}
	return query
}

func BuildTaskStatsResponse(records []taskStatsRecord, startTimestamp int64, endTimestamp int64) *dto.TaskStatsResponse {
	response := &dto.TaskStatsResponse{
		DailyCounts: make([]dto.TaskDailyCount, 0),
	}

	bucketMode := resolveTaskStatsBucketMode(startTimestamp, endTimestamp)
	dailyTotals := make(map[string]int64)
	for _, record := range records {
		mediaType := detectTaskMediaType(record.Action)
		if mediaType == "" {
			continue
		}
		submitDate := formatTaskStatsBucketKey(time.Unix(record.SubmitTime, 0).In(time.Local), bucketMode)
		dailyTotals[submitDate]++
		breakdown := resolveTaskStatsBreakdown(record.Status, record.Progress, record.FailReason)

		if breakdown == "running" {
			response.RunningCount++
			response.TotalStats.Running++
		}

		target := &response.ImageStats
		if mediaType == TaskMediaTypeVideo {
			target = &response.VideoStats
		}

		switch breakdown {
		case "running":
			target.Running++
		case "success":
			response.TotalStats.Success++
			target.Success++
		case "failure":
			response.TotalStats.Failure++
			target.Failure++
		}
	}

	bucketDates := buildTaskStatsDateBuckets(startTimestamp, endTimestamp, bucketMode)
	if len(bucketDates) == 0 {
		dates := make([]string, 0, len(dailyTotals))
		for date := range dailyTotals {
			dates = append(dates, date)
		}
		sort.Strings(dates)
		for _, date := range dates {
			response.DailyCounts = append(response.DailyCounts, dto.TaskDailyCount{
				Date:  date,
				Total: dailyTotals[date],
			})
		}
		return response
	}

	for _, date := range bucketDates {
		response.DailyCounts = append(response.DailyCounts, dto.TaskDailyCount{
			Date:  date,
			Total: dailyTotals[date],
		})
	}

	return response
}

func resolveTaskStatsBucketMode(startTimestamp int64, endTimestamp int64) taskStatsBucketMode {
	if startTimestamp <= 0 || endTimestamp <= 0 {
		return taskStatsBucketModeDay
	}

	start := time.Unix(startTimestamp, 0).In(time.Local)
	end := time.Unix(endTimestamp, 0).In(time.Local)
	if end.Before(start) {
		start, end = end, start
	}

	now := time.Now().In(time.Local)
	if start.Format("2006-01-02") == now.Format("2006-01-02") &&
		end.Format("2006-01-02") == now.Format("2006-01-02") {
		return taskStatsBucketModeHour
	}

	return taskStatsBucketModeDay
}

func formatTaskStatsBucketKey(t time.Time, mode taskStatsBucketMode) string {
	switch mode {
	case taskStatsBucketModeHour:
		return t.Format("15:00")
	default:
		return t.Format("2006-01-02")
	}
}

func buildTaskStatsDateBuckets(startTimestamp int64, endTimestamp int64, mode taskStatsBucketMode) []string {
	if startTimestamp <= 0 || endTimestamp <= 0 {
		return nil
	}

	start := time.Unix(startTimestamp, 0).In(time.Local)
	end := time.Unix(endTimestamp, 0).In(time.Local)
	if end.Before(start) {
		start, end = end, start
	}

	dates := make([]string, 0)
	switch mode {
	case taskStatsBucketModeHour:
		startHour := start.Truncate(time.Hour)
		endHour := end.Truncate(time.Hour)
		for current := startHour; !current.After(endHour); current = current.Add(time.Hour) {
			dates = append(dates, current.Format("15:00"))
		}
	default:
		startDay := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, start.Location())
		endDay := time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, end.Location())
		for current := startDay; !current.After(endDay); current = current.AddDate(0, 0, 1) {
			dates = append(dates, current.Format("2006-01-02"))
		}
	}
	return dates
}

func TaskGetStatsTasks(queryParams SyncTaskQueryParams) []taskStatsRecord {
	var records []taskStatsRecord
	query := applySyncTaskQueryFilters(DB.Model(&Task{}), queryParams)
	err := query.Select("action", "status", "submit_time", "progress", "fail_reason").Find(&records).Error
	if err != nil {
		return nil
	}
	return records
}

func TaskGetUserStatsTasks(userId int, queryParams SyncTaskQueryParams) []taskStatsRecord {
	var records []taskStatsRecord
	query := applySyncTaskQueryFilters(DB.Model(&Task{}).Where("user_id = ?", userId), queryParams)
	err := query.Select("action", "status", "submit_time", "progress", "fail_reason").Find(&records).Error
	if err != nil {
		return nil
	}
	return records
}

func TaskGetStats(queryParams SyncTaskQueryParams) *dto.TaskStatsResponse {
	return BuildTaskStatsResponse(
		TaskGetStatsTasks(queryParams),
		queryParams.StartTimestamp,
		queryParams.EndTimestamp,
	)
}

func TaskGetUserStats(userId int, queryParams SyncTaskQueryParams) *dto.TaskStatsResponse {
	return BuildTaskStatsResponse(
		TaskGetUserStatsTasks(userId, queryParams),
		queryParams.StartTimestamp,
		queryParams.EndTimestamp,
	)
}
