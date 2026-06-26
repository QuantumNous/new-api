package service

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// EnrichLogsMediaURLs fills missing other.result_url for image/video consume logs (read-time backfill).
func EnrichLogsMediaURLs(logs []*model.Log) {
	for i := range logs {
		EnrichLogMediaURL(logs[i])
	}
}

// EnrichLogMediaURL resolves a preview URL for gpt-image-2 / sora logs that predate result_url persistence.
func EnrichLogMediaURL(log *model.Log) {
	if log == nil || log.Type != model.LogTypeConsume {
		return
	}
	modelName := strings.ToLower(strings.TrimSpace(log.ModelName))
	if !strings.HasPrefix(modelName, "gpt-image-2") && !isLogMediaVideoModel(modelName) {
		return
	}

	otherMap, _ := common.StrToMap(log.Other)
	if otherMap == nil {
		otherMap = map[string]interface{}{}
	}
	changed := false
	if url, ok := otherMap["result_url"].(string); ok && strings.TrimSpace(url) != "" && !IsValidMediaResultURL(url) {
		delete(otherMap, "result_url")
		changed = true
	}
	if url, ok := otherMap["result_url"].(string); !ok || strings.TrimSpace(url) == "" {
		if url := resolveLogMediaURL(log, otherMap); url != "" && IsValidMediaResultURL(url) {
			otherMap["result_url"] = url
			changed = true
		}
	}
	if _, ok := otherMap["task_fail_reason"]; !ok {
		if reason, code := resolveLogImageTaskFailure(otherMap); reason != "" {
			otherMap["task_fail_reason"] = reason
			if code != "" {
				otherMap["task_fail_code"] = code
			}
			changed = true
		}
	}
	if taskID := strings.TrimSpace(fmtTaskID(otherMap["task_id"])); taskID != "" {
		if task, exist, err := model.GetByOnlyTaskId(taskID); err == nil && exist {
			if task.Status == model.TaskStatusFailure {
				RefundImageAsyncTaskQuota(context.Background(), task, task.FailReason)
			}
		}
	}
	if _, ok := otherMap["request_data"]; !ok {
		if rd := resolveLogRequestData(otherMap); len(rd) > 0 {
			otherMap["request_data"] = rd
			changed = true
		}
	}
	if changed {
		log.Other = common.MapToJsonStr(otherMap)
	}
}

func resolveLogRequestData(other map[string]interface{}) map[string]interface{} {
	taskID := strings.TrimSpace(fmtTaskID(other["task_id"]))
	if taskID == "" {
		return nil
	}
	task, exist, err := model.GetByOnlyTaskId(taskID)
	if err != nil || !exist {
		return nil
	}
	if strings.TrimSpace(task.PrivateData.RequestData) != "" {
		var data map[string]interface{}
		if err := common.Unmarshal([]byte(task.PrivateData.RequestData), &data); err == nil && len(data) > 0 {
			return data
		}
	}
	return buildVideoRequestDataFromTaskData(task)
}

func buildVideoRequestDataFromTaskData(task *model.Task) map[string]interface{} {
	if task == nil || len(task.Data) == 0 {
		return nil
	}
	var payload map[string]interface{}
	if err := common.Unmarshal(task.Data, &payload); err != nil {
		return nil
	}
	data := map[string]interface{}{}
	if modelName := strings.TrimSpace(fmtTaskID(payload["model"])); modelName != "" {
		data["model"] = modelName
	}
	if seconds := strings.TrimSpace(fmtTaskID(payload["seconds"])); seconds != "" {
		data["seconds"] = seconds
	}
	if size := strings.TrimSpace(fmtTaskID(payload["size"])); size != "" {
		data["size"] = size
	}
	if len(data) == 0 {
		return nil
	}
	return data
}

func isLogMediaVideoModel(modelName string) bool {
	return modelName == "sora-2" || modelName == "sora-2-pro" || strings.HasPrefix(modelName, "sora-2-")
}

func resolveLogMediaURL(log *model.Log, other map[string]interface{}) string {
	taskID := strings.TrimSpace(fmtTaskID(other["task_id"]))
	if taskID != "" {
		if task, exist, err := model.GetByOnlyTaskId(taskID); err == nil && exist {
			if u := strings.TrimSpace(task.PrivateData.ResultURL); IsValidMediaResultURL(u) {
				return u
			}
		}
	}

	if strings.HasPrefix(strings.ToLower(log.ModelName), "gpt-image-2") && log.UseTime > 0 {
		return findCachedImageURLInDir(imageCacheDir, log.CreatedAt, log.UseTime)
	}
	return ""
}

func findCachedImageURLInDir(dir string, createdAt int64, useTime int) string {
	if createdAt <= 0 || useTime <= 0 || strings.TrimSpace(dir) == "" {
		return ""
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return ""
	}

	windowStart := float64(createdAt) - 5
	windowEnd := float64(createdAt) + float64(useTime) + 60

	var bestURL string
	bestDelta := 1e18
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		dot := strings.Index(name, ".")
		if dot <= 0 {
			continue
		}
		ns, err := strconv.ParseInt(name[:dot], 10, 64)
		if err != nil {
			continue
		}
		ts := float64(ns) / 1e9
		if ts < windowStart || ts > windowEnd {
			continue
		}
		delta := ts - float64(createdAt)
		if delta < 0 {
			delta = -delta
		}
		if delta < bestDelta {
			bestDelta = delta
			bestURL = imageCachePublicBase + name
		}
	}
	return bestURL
}

func fmtTaskID(v interface{}) string {
	switch t := v.(type) {
	case string:
		return t
	default:
		return strings.TrimSpace(fmt.Sprint(v))
	}
}

func resolveLogImageTaskFailure(other map[string]interface{}) (reason string, code string) {
	taskID := strings.TrimSpace(fmtTaskID(other["task_id"]))
	if taskID == "" {
		return "", ""
	}
	task, exist, err := model.GetByOnlyTaskId(taskID)
	if err != nil || !exist || task.Status != model.TaskStatusFailure {
		return "", ""
	}

	stored := strings.TrimSpace(task.FailReason)
	if stored != "" && stored != "upstream task failed" {
		return stored, ""
	}

	upstreamID := strings.TrimSpace(task.GetUpstreamTaskID())
	if upstreamID == "" || task.ChannelId <= 0 {
		if stored != "" {
			return stored, ""
		}
		return "", ""
	}
	channel, chErr := model.GetChannelById(task.ChannelId, true)
	if chErr != nil || channel == nil {
		if stored != "" {
			return stored, ""
		}
		return "", ""
	}
	key, _, apiErr := channel.GetNextEnabledKey()
	if apiErr != nil {
		if stored != "" {
			return stored, ""
		}
		return "", ""
	}

	poll, pollErr := fetchImageTaskStatusOnce(channel.GetBaseURL(), key, upstreamID)
	if pollErr != nil || poll.FailReason == "" {
		if stored != "" {
			return stored, ""
		}
		return "", ""
	}
	return FormatImageTaskFailReason(poll.FailCode, poll.FailReason), poll.FailCode
}
