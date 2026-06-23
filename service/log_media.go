package service

import (
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
	if url, ok := otherMap["result_url"].(string); ok && strings.TrimSpace(url) != "" {
		return
	}

	if url := resolveLogMediaURL(log, otherMap); url != "" {
		otherMap["result_url"] = url
		log.Other = common.MapToJsonStr(otherMap)
	}
}

func isLogMediaVideoModel(modelName string) bool {
	return modelName == "sora-2" || modelName == "sora-2-pro" || strings.HasPrefix(modelName, "sora-2-")
}

func resolveLogMediaURL(log *model.Log, other map[string]interface{}) string {
	taskID := strings.TrimSpace(fmtTaskID(other["task_id"]))
	if taskID != "" {
		if task, exist, err := model.GetByOnlyTaskId(taskID); err == nil && exist {
			if u := strings.TrimSpace(task.GetResultURL()); u != "" {
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
