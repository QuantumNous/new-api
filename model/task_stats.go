package model

import (
	"strings"

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

type taskStatsAggregateRow struct {
	Running int64 `gorm:"column:running"`
	Success int64 `gorm:"column:success"`
	Failure int64 `gorm:"column:failure"`
}

const (
	taskStatsStatusExpr     = "UPPER(TRIM(COALESCE(status, '')))"
	taskStatsProgressExpr   = "UPPER(TRIM(COALESCE(progress, '')))"
	taskStatsFailReasonExpr = "TRIM(COALESCE(fail_reason, ''))"
	taskStatsFailureCond    = "(" + taskStatsStatusExpr + " IN ('FAILURE','FAILED','ERROR','CANCELED','CANCELLED') OR (" + taskStatsFailReasonExpr + " <> '' AND " + taskStatsStatusExpr + " NOT IN ('SUCCESS','SUCCEEDED','COMPLETED','DONE')) OR " + taskStatsProgressExpr + " IN ('FAILED','FAILURE','ERROR','CANCELED','CANCELLED'))"
	taskStatsSuccessCond    = "(" + taskStatsStatusExpr + " IN ('SUCCESS','SUCCEEDED','COMPLETED','DONE') OR (" + taskStatsFailReasonExpr + " = '' AND " + taskStatsProgressExpr + " IN ('100','100%','SUCCESS','SUCCEEDED','COMPLETED','DONE')))"
	taskStatsRunningCond    = "(" + taskStatsStatusExpr + " IN ('NOT_START','SUBMITTED','QUEUED','IN_PROGRESS','PENDING','PROCESSING','RUNNING') OR (" + taskStatsFailReasonExpr + " = '' AND " + taskStatsStatusExpr + " NOT IN ('SUCCESS','SUCCEEDED','COMPLETED','DONE','FAILURE','FAILED','ERROR','CANCELED','CANCELLED','NOT_START','SUBMITTED','QUEUED','IN_PROGRESS','PENDING','PROCESSING','RUNNING') AND " + taskStatsProgressExpr + " <> '' AND " + taskStatsProgressExpr + " NOT IN ('100','100%','SUCCESS','SUCCEEDED','COMPLETED','DONE','FAILED','FAILURE','ERROR','CANCELED','CANCELLED')))"
)

func buildTaskStatsBaseQuery(queryParams SyncTaskQueryParams) *gorm.DB {
	return applySyncTaskQueryFilters(DB.Model(&Task{}), queryParams)
}

func buildTaskStatsUserBaseQuery(userId int, queryParams SyncTaskQueryParams) *gorm.DB {
	return applySyncTaskQueryFilters(DB.Model(&Task{}).Where("user_id = ?", userId), queryParams)
}

func withTaskStatsMediaType(queryParams SyncTaskQueryParams, mediaType string) SyncTaskQueryParams {
	next := queryParams
	next.MediaType = mediaType
	return next
}

func aggregateTaskStats(query *gorm.DB) dto.TaskStatsBreakdown {
	var row taskStatsAggregateRow
	err := query.Select(
		"SUM(CASE WHEN "+taskStatsRunningCond+" THEN 1 ELSE 0 END) AS running, " +
			"SUM(CASE WHEN "+taskStatsSuccessCond+" THEN 1 ELSE 0 END) AS success, " +
			"SUM(CASE WHEN "+taskStatsFailureCond+" THEN 1 ELSE 0 END) AS failure",
	).Scan(&row).Error
	if err != nil {
		return dto.TaskStatsBreakdown{}
	}
	return dto.TaskStatsBreakdown{
		Running: row.Running,
		Success: row.Success,
		Failure: row.Failure,
	}
}

func buildTaskStatsResponse(baseQuery func(SyncTaskQueryParams) *gorm.DB, queryParams SyncTaskQueryParams) *dto.TaskStatsResponse {
	response := &dto.TaskStatsResponse{}
	response.TotalStats = aggregateTaskStats(baseQuery(withTaskStatsMediaType(queryParams, TaskMediaTypeAll)))
	response.ImageStats = aggregateTaskStats(baseQuery(withTaskStatsMediaType(queryParams, TaskMediaTypeImage)))
	response.VideoStats = aggregateTaskStats(baseQuery(withTaskStatsMediaType(queryParams, TaskMediaTypeVideo)))
	response.RunningCount = response.TotalStats.Running
	return response
}

func TaskGetStats(queryParams SyncTaskQueryParams) *dto.TaskStatsResponse {
	return buildTaskStatsResponse(buildTaskStatsBaseQuery, queryParams)
}

func TaskGetUserStats(userId int, queryParams SyncTaskQueryParams) *dto.TaskStatsResponse {
	return buildTaskStatsResponse(
		func(params SyncTaskQueryParams) *gorm.DB {
			return buildTaskStatsUserBaseQuery(userId, params)
		},
		queryParams,
	)
}
