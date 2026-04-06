package model

import (
	"fmt"
	"math"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type DashboardChannelStat struct {
	ChannelId             int     `json:"channel_id"`
	ChannelName           string  `json:"channel_name"`
	TotalRequests         int64   `json:"total_requests"`
	SuccessRequests       int64   `json:"success_requests"`
	FailedRequests        int64   `json:"failed_requests"`
	TotalQuota            int64   `json:"total_quota"`
	TotalPromptTokens     int64   `json:"total_prompt_tokens"`
	TotalCompletionTokens int64   `json:"total_completion_tokens"`
	AvgResponseTime       float64 `json:"avg_response_time"`
}

type DashboardModelStat struct {
	ModelName             string  `json:"model_name"`
	TotalRequests         int64   `json:"total_requests"`
	TotalQuota            int64   `json:"total_quota"`
	TotalPromptTokens     int64   `json:"total_prompt_tokens"`
	TotalCompletionTokens int64   `json:"total_completion_tokens"`
	AvgTokensPerRequest   float64 `json:"avg_tokens_per_request"`
}

type DashboardOverview struct {
	TotalRequests         int64   `json:"total_requests"`
	SuccessCount          int64   `json:"success_count"`
	FailedCount           int64   `json:"failed_count"`
	SuccessRate           float64 `json:"success_rate"`
	TotalQuota            int64   `json:"total_quota"`
	TotalPromptTokens     int64   `json:"total_prompt_tokens"`
	TotalCompletionTokens int64   `json:"total_completion_tokens"`
	AvgTPM                float64 `json:"avg_tpm"`
	AvgRPM                float64 `json:"avg_rpm"`
	DailyRPD              float64 `json:"daily_rpd"`
}

type DashboardPromptLog struct {
	Id               int    `json:"id"`
	CreatedAt        int64  `json:"created_at"`
	Username         string `json:"username"`
	ModelName        string `json:"model_name"`
	ChannelName      string `json:"channel_name"`
	PromptTokens     int    `json:"prompt_tokens"`
	CompletionTokens int    `json:"completion_tokens"`
	Quota            int    `json:"quota"`
	RequestId        string `json:"request_id"`
	Content          string `json:"content"`
}

type DashboardPromptLogPage struct {
	Items []DashboardPromptLog `json:"items"`
	Total int64                `json:"total"`
	Start int                  `json:"start"`
	Limit int                  `json:"limit"`
}

func NormalizeDashboardTimeRange(startTime int64, endTime int64) (int64, int64) {
	now := time.Now().Unix()
	if endTime <= 0 {
		endTime = now
	}
	if startTime <= 0 {
		startTime = endTime - 7*24*60*60
	}
	if startTime > endTime {
		startTime, endTime = endTime, startTime
	}
	return startTime, endTime
}

func GetDashboardChannelStats(startTime int64, endTime int64, scopeUserId int) ([]DashboardChannelStat, error) {
	startTime, endTime = NormalizeDashboardTimeRange(startTime, endTime)
	stats := make([]DashboardChannelStat, 0)
	err := buildDashboardBaseQuery(startTime, endTime, scopeUserId).
		Select(
			"channel_id, "+
				"COUNT(*) AS total_requests, "+
				"SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS success_requests, "+
				"SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS failed_requests, "+
				"COALESCE(SUM(quota), 0) AS total_quota, "+
				"COALESCE(SUM(prompt_tokens), 0) AS total_prompt_tokens, "+
				"COALESCE(SUM(completion_tokens), 0) AS total_completion_tokens, "+
				"COALESCE(AVG(CASE WHEN use_time > 0 THEN use_time END), 0) AS avg_response_time",
			LogTypeConsume,
			LogTypeError,
		).
		Group("channel_id").
		Order("total_requests DESC, channel_id ASC").
		Scan(&stats).Error
	if err != nil {
		return nil, err
	}
	applyChannelNamesToStats(stats)
	return stats, nil
}

func GetDashboardModelStats(startTime int64, endTime int64, scopeUserId int) ([]DashboardModelStat, error) {
	startTime, endTime = NormalizeDashboardTimeRange(startTime, endTime)
	stats := make([]DashboardModelStat, 0)
	err := buildDashboardBaseQuery(startTime, endTime, scopeUserId).
		Select(
			"model_name, " +
				"COUNT(*) AS total_requests, " +
				"COALESCE(SUM(quota), 0) AS total_quota, " +
				"COALESCE(SUM(prompt_tokens), 0) AS total_prompt_tokens, " +
				"COALESCE(SUM(completion_tokens), 0) AS total_completion_tokens",
		).
		Group("model_name").
		Order("total_requests DESC, model_name ASC").
		Scan(&stats).Error
	if err != nil {
		return nil, err
	}
	for i := range stats {
		if stats[i].TotalRequests > 0 {
			totalTokens := stats[i].TotalPromptTokens + stats[i].TotalCompletionTokens
			stats[i].AvgTokensPerRequest = roundFloat(float64(totalTokens) / float64(stats[i].TotalRequests))
		}
	}
	return stats, nil
}

func GetDashboardOverview(startTime int64, endTime int64, scopeUserId int) (DashboardOverview, error) {
	startTime, endTime = NormalizeDashboardTimeRange(startTime, endTime)
	var overview DashboardOverview
	err := buildDashboardBaseQuery(startTime, endTime, scopeUserId).
		Select(
			"COUNT(*) AS total_requests, "+
				"SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS success_count, "+
				"SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS failed_count, "+
				"COALESCE(SUM(quota), 0) AS total_quota, "+
				"COALESCE(SUM(prompt_tokens), 0) AS total_prompt_tokens, "+
				"COALESCE(SUM(completion_tokens), 0) AS total_completion_tokens",
			LogTypeConsume,
			LogTypeError,
		).
		Scan(&overview).Error
	if err != nil {
		return overview, err
	}

	totalTokens := overview.TotalPromptTokens + overview.TotalCompletionTokens
	windowSeconds := float64(endTime - startTime)
	if windowSeconds <= 0 {
		windowSeconds = 1
	}
	windowMinutes := windowSeconds / 60.0
	windowDays := windowSeconds / 86400.0
	if windowMinutes <= 0 {
		windowMinutes = 1.0 / 60.0
	}
	if windowDays <= 0 {
		windowDays = 1.0 / 86400.0
	}
	if overview.TotalRequests > 0 {
		overview.SuccessRate = roundFloat(float64(overview.SuccessCount) * 100 / float64(overview.TotalRequests))
	}
	overview.AvgTPM = roundFloat(float64(totalTokens) / windowMinutes)
	overview.AvgRPM = roundFloat(float64(overview.TotalRequests) / windowMinutes)
	overview.DailyRPD = roundFloat(float64(overview.TotalRequests) / windowDays)
	return overview, nil
}

func GetDashboardPromptLogs(startTime int64, endTime int64, scopeUserId int, channelId int, modelName string, username string, start int, limit int) (*DashboardPromptLogPage, error) {
	startTime, endTime = NormalizeDashboardTimeRange(startTime, endTime)
	if start < 0 {
		start = 0
	}
	if limit <= 0 {
		limit = common.ItemsPerPage
	}
	query := LOG_DB.Model(&Log{}).Where("type = ?", LogTypeConsume)
	if scopeUserId > 0 {
		query = query.Where("user_id = ?", scopeUserId)
	} else if username != "" {
		query = query.Where("username = ?", username)
	}
	if startTime > 0 {
		query = query.Where("created_at >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("created_at <= ?", endTime)
	}
	if channelId > 0 {
		query = query.Where("channel_id = ?", channelId)
	}
	if modelName != "" {
		modelNamePattern, err := sanitizeLikePattern(modelName)
		if err != nil {
			return nil, err
		}
		query = query.Where("model_name LIKE ? ESCAPE '!'", modelNamePattern)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	var logs []Log
	if err := query.Order("id DESC").Limit(limit).Offset(start).Find(&logs).Error; err != nil {
		return nil, err
	}

	channelMap := getChannelNameMapFromLogs(logs)
	items := make([]DashboardPromptLog, 0, len(logs))
	for _, log := range logs {
		items = append(items, DashboardPromptLog{
			Id:               log.Id,
			CreatedAt:        log.CreatedAt,
			Username:         log.Username,
			ModelName:        log.ModelName,
			ChannelName:      channelMap[log.ChannelId],
			PromptTokens:     log.PromptTokens,
			CompletionTokens: log.CompletionTokens,
			Quota:            log.Quota,
			RequestId:        log.RequestId,
			Content:          ExtractPromptContentFromLog(&log),
		})
	}

	return &DashboardPromptLogPage{
		Items: items,
		Total: total,
		Start: start,
		Limit: limit,
	}, nil
}

func buildDashboardBaseQuery(startTime int64, endTime int64, scopeUserId int) *gorm.DB {
	query := LOG_DB.Table("logs").Where("type IN ?", []int{LogTypeConsume, LogTypeError})
	if scopeUserId > 0 {
		query = query.Where("user_id = ?", scopeUserId)
	}
	if startTime > 0 {
		query = query.Where("created_at >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("created_at <= ?", endTime)
	}
	return query
}

func applyChannelNamesToStats(stats []DashboardChannelStat) {
	channelIds := make([]int, 0, len(stats))
	for _, stat := range stats {
		if stat.ChannelId > 0 {
			channelIds = append(channelIds, stat.ChannelId)
		}
	}
	channelMap := getChannelNameMap(channelIds)
	for i := range stats {
		stats[i].ChannelName = channelMap[stats[i].ChannelId]
		if stats[i].ChannelName == "" && stats[i].ChannelId == 0 {
			stats[i].ChannelName = "未分配渠道"
		}
	}
}

func getChannelNameMapFromLogs(logs []Log) map[int]string {
	channelIds := make([]int, 0, len(logs))
	for _, log := range logs {
		if log.ChannelId > 0 {
			channelIds = append(channelIds, log.ChannelId)
		}
	}
	return getChannelNameMap(channelIds)
}

func getChannelNameMap(channelIds []int) map[int]string {
	channelMap := make(map[int]string)
	if len(channelIds) == 0 {
		return channelMap
	}
	uniqueIds := make(map[int]struct{}, len(channelIds))
	for _, channelId := range channelIds {
		if channelId > 0 {
			uniqueIds[channelId] = struct{}{}
		}
	}
	if len(uniqueIds) == 0 {
		return channelMap
	}

	ids := make([]int, 0, len(uniqueIds))
	for id := range uniqueIds {
		ids = append(ids, id)
	}
	sort.Ints(ids)

	if common.MemoryCacheEnabled {
		for _, channelId := range ids {
			if cacheChannel, err := CacheGetChannel(channelId); err == nil {
				channelMap[channelId] = cacheChannel.Name
			}
		}
	}

	missingIds := make([]int, 0)
	for _, channelId := range ids {
		if channelMap[channelId] == "" {
			missingIds = append(missingIds, channelId)
		}
	}
	if len(missingIds) == 0 {
		return channelMap
	}

	var channels []struct {
		Id   int    `gorm:"column:id"`
		Name string `gorm:"column:name"`
	}
	if err := DB.Table("channels").Select("id, name").Where("id IN ?", missingIds).Find(&channels).Error; err != nil {
		common.SysError(fmt.Sprintf("failed to query channel names: %v", err))
		return channelMap
	}
	for _, channel := range channels {
		channelMap[channel.Id] = channel.Name
	}
	return channelMap
}

func ExtractPromptContentFromLog(log *Log) string {
	if log == nil {
		return ""
	}
	if log.Other != "" {
		otherMap, _ := common.StrToMap(log.Other)
		if otherMap != nil {
			if promptContent, ok := otherMap["prompt_content"].(string); ok && strings.TrimSpace(promptContent) != "" {
				return promptContent
			}
		}
	}
	return log.Content
}

func ExtractPromptContentFromRequest(c *gin.Context) string {
	if c == nil || c.Request == nil {
		return ""
	}
	contentType := c.ContentType()
	if strings.HasPrefix(contentType, "multipart/form-data") {
		return extractPromptContentFromMultipartForm(c)
	}
	if strings.HasPrefix(contentType, "application/x-www-form-urlencoded") {
		return extractPromptContentFromForm(c)
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return ""
	}
	requestBody, err := storage.Bytes()
	if err != nil || len(requestBody) == 0 {
		return ""
	}
	var payload map[string]interface{}
	if err = common.Unmarshal(requestBody, &payload); err != nil {
		return ""
	}
	return truncatePromptContent(buildPromptSummary(payload))
}

func extractPromptContentFromMultipartForm(c *gin.Context) string {
	form, err := common.ParseMultipartFormReusable(c)
	if err != nil || form == nil {
		return ""
	}
	for _, key := range []string{"prompt", "input", "content", "messages"} {
		if values := form.Value[key]; len(values) > 0 {
			return truncatePromptContent(strings.Join(values, "\n"))
		}
	}
	return ""
}

func extractPromptContentFromForm(c *gin.Context) string {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return ""
	}
	requestBody, err := storage.Bytes()
	if err != nil || len(requestBody) == 0 {
		return ""
	}
	values, err := url.ParseQuery(string(requestBody))
	if err != nil {
		return ""
	}
	for _, key := range []string{"prompt", "input", "content", "messages"} {
		if value := strings.TrimSpace(values.Get(key)); value != "" {
			return truncatePromptContent(value)
		}
	}
	return ""
}

func buildPromptSummary(payload map[string]interface{}) string {
	lines := make([]string, 0, 8)
	appendLine := func(text string) {
		text = strings.TrimSpace(text)
		if text == "" {
			return
		}
		lines = append(lines, text)
	}

	for _, key := range []string{"instructions", "system", "prompt", "input"} {
		if value, ok := payload[key]; ok {
			appendLine(flattenPromptValue(value))
		}
	}

	if messages, ok := payload["messages"].([]interface{}); ok {
		for _, message := range messages {
			msgMap, ok := message.(map[string]interface{})
			if !ok {
				appendLine(flattenPromptValue(message))
				continue
			}
			role, _ := msgMap["role"].(string)
			content := flattenPromptValue(msgMap["content"])
			if role != "" && content != "" {
				appendLine(role + ": " + content)
				continue
			}
			appendLine(content)
		}
	}

	if contents, ok := payload["contents"].([]interface{}); ok {
		for _, content := range contents {
			appendLine(flattenPromptValue(content))
		}
	}

	if len(lines) == 0 {
		return ""
	}
	return strings.Join(lines, "\n")
}

func flattenPromptValue(value interface{}) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case []interface{}:
		parts := make([]string, 0, len(v))
		for _, item := range v {
			if text := flattenPromptValue(item); text != "" {
				parts = append(parts, text)
			}
		}
		return strings.Join(parts, "\n")
	case map[string]interface{}:
		if text, ok := v["text"].(string); ok && strings.TrimSpace(text) != "" {
			return strings.TrimSpace(text)
		}
		if inputText, ok := v["input_text"].(string); ok && strings.TrimSpace(inputText) != "" {
			return strings.TrimSpace(inputText)
		}
		if prompt, ok := v["prompt"].(string); ok && strings.TrimSpace(prompt) != "" {
			return strings.TrimSpace(prompt)
		}
		if content, ok := v["content"]; ok {
			return flattenPromptValue(content)
		}
		if parts, ok := v["parts"]; ok {
			return flattenPromptValue(parts)
		}
		if input, ok := v["input"]; ok {
			return flattenPromptValue(input)
		}
		if messages, ok := v["messages"]; ok {
			return flattenPromptValue(messages)
		}
		values := make([]string, 0, len(v))
		for _, nested := range v {
			if text := flattenPromptValue(nested); text != "" {
				values = append(values, text)
			}
		}
		return strings.Join(values, "\n")
	default:
		return ""
	}
}

func truncatePromptContent(content string) string {
	const promptContentLimit = 32768
	content = strings.TrimSpace(content)
	if content == "" {
		return ""
	}
	if len(content) <= promptContentLimit {
		return content
	}
	return content[:promptContentLimit] + "\n...[truncated]"
}

func roundFloat(value float64) float64 {
	return math.Round(value*100) / 100
}
