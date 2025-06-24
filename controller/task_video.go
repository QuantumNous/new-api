package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/constant"
	"one-api/model"
	"one-api/relay"
	"one-api/relay/channel"
)

func UpdateVideoTaskAll(ctx context.Context, taskChannelM map[int][]string, taskM map[string]*model.Task) error {
	for channelId, taskIds := range taskChannelM {
		if err := updateVideoTaskAll(ctx, channelId, taskIds, taskM); err != nil {
			common.LogError(ctx, fmt.Sprintf("Channel #%d failed to update video async tasks: %s", channelId, err.Error()))
		}
	}
	return nil
}

func updateVideoTaskAll(ctx context.Context, channelId int, taskIds []string, taskM map[string]*model.Task) error {
	common.LogInfo(ctx, fmt.Sprintf("Channel #%d pending video tasks: %d", channelId, len(taskIds)))
	if len(taskIds) == 0 {
		return nil
	}
	cacheGetChannel, err := model.CacheGetChannel(channelId)
	if err != nil {
		errUpdate := model.TaskBulkUpdate(taskIds, map[string]any{
			"fail_reason": fmt.Sprintf("Failed to get channel info, channel ID: %d", channelId),
			"status":      "FAILURE",
			"progress":    "100%",
		})
		if errUpdate != nil {
			common.SysError(fmt.Sprintf("UpdateVideoTask error: %v", errUpdate))
		}
		return fmt.Errorf("CacheGetChannel failed: %w", err)
	}
	adaptor := relay.GetTaskAdaptor(constant.TaskPlatformKling)
	if adaptor == nil {
		return fmt.Errorf("video adaptor not found")
	}
	for _, taskId := range taskIds {
		if err := updateVideoSingleTask(ctx, adaptor, cacheGetChannel, taskId, taskM); err != nil {
			common.LogError(ctx, fmt.Sprintf("Failed to update video task %s: %s", taskId, err.Error()))
		}
	}
	return nil
}

func updateVideoSingleTask(ctx context.Context, adaptor channel.TaskAdaptor, channel *model.Channel, taskId string, taskM map[string]*model.Task) error {
	baseURL := common.ChannelBaseURLs[channel.Type]
	if channel.GetBaseURL() != "" {
		baseURL = channel.GetBaseURL()
	}
	resp, err := adaptor.FetchTask(baseURL, channel.Key, map[string]any{
		"task_id": taskId,
	})
	if err != nil {
		return fmt.Errorf("FetchTask failed for task %s: %w", taskId, err)
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Get Video Task status code: %d", resp.StatusCode)
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("ReadAll failed for task %s: %w", taskId, err)
	}

	var responseItem map[string]interface{}
	err = json.Unmarshal(responseBody, &responseItem)
	if err != nil {
		common.LogError(ctx, fmt.Sprintf("Failed to parse video task response body: %v, body: %s", err, string(responseBody)))
		return fmt.Errorf("Unmarshal failed for task %s: %w", taskId, err)
	}

	code, _ := responseItem["code"].(float64)
	if code != 0 {
		return fmt.Errorf("video task fetch failed for task %s", taskId)
	}

	data, ok := responseItem["data"].(map[string]interface{})
	if !ok {
		common.LogError(ctx, fmt.Sprintf("Video task data format error: %s", string(responseBody)))
		return fmt.Errorf("video task data format error for task %s", taskId)
	}

	task := taskM[taskId]
	if task == nil {
		common.LogError(ctx, fmt.Sprintf("Task %s not found in taskM", taskId))
		return fmt.Errorf("task %s not found", taskId)
	}

	if status, ok := data["task_status"].(string); ok {
		switch status {
		case "submitted", "queued":
			task.Status = model.TaskStatusSubmitted
		case "processing":
			task.Status = model.TaskStatusInProgress
		case "succeed":
			task.Status = model.TaskStatusSuccess
			task.Progress = "100%"
			if url, err := adaptor.ParseResultUrl(responseItem); err == nil {
				task.FailReason = url
			} else {
				common.LogWarn(ctx, fmt.Sprintf("Failed to get url from body for task %s: %s", task.TaskID, err.Error()))
			}
		case "failed":
			task.Status = model.TaskStatusFailure
			task.Progress = "100%"
			if reason, ok := data["fail_reason"].(string); ok {
				task.FailReason = reason
			}
		}
	}

	// If task failed, refund quota
	if task.Status == model.TaskStatusFailure {
		common.LogInfo(ctx, fmt.Sprintf("Task %s failed: %s", task.TaskID, task.FailReason))
		quota := task.Quota
		if quota != 0 {
			if err := model.IncreaseUserQuota(task.UserId, quota, false); err != nil {
				common.LogError(ctx, "Failed to increase user quota: "+err.Error())
			}
			logContent := fmt.Sprintf("Video async task failed %s, refund %s", task.TaskID, common.LogQuota(quota))
			model.RecordLog(task.UserId, model.LogTypeSystem, logContent)
		}
	}

	task.Data = responseBody
	if err := task.Update(); err != nil {
		common.SysError("UpdateVideoTask task error: " + err.Error())
	}

	return nil
}
