package service

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

func BuildUserTaskDtos(tasks []*model.Task) []*dto.UserTaskDto {
	result := make([]*dto.UserTaskDto, 0, len(tasks))
	for _, task := range tasks {
		result = append(result, BuildUserTaskDto(task))
	}
	return result
}

func BuildUserTaskDto(task *model.Task) *dto.UserTaskDto {
	if task == nil {
		return nil
	}
	secrets := taskUserVisibleSecrets(task)
	failReason := ""
	if task.FailReason != "" {
		failReason = common.SanitizeUserVisibleError(task.FailReason, 0, "task_failed", secrets...)
	}
	return &dto.UserTaskDto{
		ID:         task.ID,
		CreatedAt:  task.CreatedAt,
		UpdatedAt:  task.UpdatedAt,
		TaskID:     task.TaskID,
		Platform:   string(task.Platform),
		UserId:     task.UserId,
		Group:      task.Group,
		Quota:      task.Quota,
		Action:     task.Action,
		Status:     string(task.Status),
		FailReason: failReason,
		ResultURL:  userTaskResultURL(task),
		SubmitTime: task.SubmitTime,
		StartTime:  task.StartTime,
		FinishTime: task.FinishTime,
		Progress:   task.Progress,
		Properties: dto.UserTaskProps{
			OriginModelName: task.Properties.OriginModelName,
		},
		Data: sanitizeUserVisibleRawJSON(task.Data, secrets...),
	}
}

func BuildUserMidjourneyDtos(tasks []*model.Midjourney) []*dto.UserMidjourneyDto {
	result := make([]*dto.UserMidjourneyDto, 0, len(tasks))
	for _, task := range tasks {
		result = append(result, BuildUserMidjourneyDto(task))
	}
	return result
}

func BuildUserMidjourneyDto(task *model.Midjourney) *dto.UserMidjourneyDto {
	if task == nil {
		return nil
	}
	secrets := midjourneyTaskSecrets(task)
	description := ""
	if task.Description != "" {
		description = common.SanitizeUserVisibleError(task.Description, 0, "midjourney_error", secrets...)
	}
	failReason := ""
	if task.FailReason != "" {
		failReason = common.SanitizeUserVisibleError(task.FailReason, 0, "midjourney_error", secrets...)
	}
	return &dto.UserMidjourneyDto{
		Id:          task.Id,
		Code:        task.Code,
		UserId:      task.UserId,
		Action:      task.Action,
		MjId:        task.MjId,
		Prompt:      task.Prompt,
		PromptEn:    task.PromptEn,
		Description: description,
		State:       task.State,
		SubmitTime:  task.SubmitTime,
		StartTime:   task.StartTime,
		FinishTime:  task.FinishTime,
		ImageUrl:    task.ImageUrl,
		VideoUrl:    task.VideoUrl,
		VideoUrls:   task.VideoUrls,
		Status:      task.Status,
		Progress:    task.Progress,
		FailReason:  failReason,
		Quota:       task.Quota,
		Buttons:     sanitizeUserVisibleJSONString(task.Buttons, secrets...),
		Properties:  sanitizeUserVisibleJSONString(task.Properties, secrets...),
	}
}

func taskUserVisibleSecrets(task *model.Task) []string {
	if task == nil {
		return nil
	}
	secrets := make([]string, 0, 2)
	if task.PrivateData.Key != "" {
		secrets = append(secrets, task.PrivateData.Key)
	}
	if task.ChannelId != 0 {
		if channel, err := model.CacheGetChannel(task.ChannelId); err == nil && channel != nil && channel.Key != "" {
			secrets = append(secrets, channel.Key)
		}
	}
	return secrets
}

func SanitizeTaskUserError(task *model.Task, message string, statusCode int, errorCode any, secrets ...string) string {
	if strings.TrimSpace(message) == "" {
		return ""
	}
	allSecrets := append(taskUserVisibleSecrets(task), secrets...)
	return common.SanitizeUserVisibleError(message, statusCode, errorCode, allSecrets...)
}

func midjourneyTaskSecrets(task *model.Midjourney) []string {
	if task == nil || task.ChannelId == 0 {
		return nil
	}
	channel, err := model.CacheGetChannel(task.ChannelId)
	if err != nil || channel == nil || channel.Key == "" {
		return nil
	}
	return []string{channel.Key}
}

func userTaskResultURL(task *model.Task) string {
	if task == nil {
		return ""
	}
	if task.PrivateData.ResultURL != "" {
		return task.PrivateData.ResultURL
	}
	if strings.HasPrefix(task.FailReason, "http://") || strings.HasPrefix(task.FailReason, "https://") {
		return task.FailReason
	}
	return ""
}

func sanitizeUserVisibleRawJSON(data json.RawMessage, secrets ...string) json.RawMessage {
	if len(data) == 0 {
		return nil
	}
	var value any
	if err := common.Unmarshal(data, &value); err != nil {
		snippet, _ := SafeErrorLogSnippet(string(data), upstreamErrorSummaryMaxRunes, secrets...)
		if snippet == "" {
			return nil
		}
		bytes, marshalErr := common.Marshal(snippet)
		if marshalErr != nil {
			return nil
		}
		return json.RawMessage(bytes)
	}
	value = sanitizeUserVisibleDataValue(value, secrets...)
	bytes, err := common.Marshal(value)
	if err != nil {
		return nil
	}
	return json.RawMessage(bytes)
}

func sanitizeUserVisibleJSONString(text string, secrets ...string) string {
	text = strings.TrimSpace(text)
	if text == "" {
		return ""
	}
	var value any
	if err := common.Unmarshal([]byte(text), &value); err != nil {
		masked := strings.TrimSpace(common.MaskSecretsForLog(text, secrets...))
		if common.ContainsUserVisibleSensitiveTerm(masked) {
			return ""
		}
		return masked
	}
	value = sanitizeUserVisibleDataValue(value, secrets...)
	bytes, err := common.Marshal(value)
	if err != nil {
		return ""
	}
	return string(bytes)
}

func sanitizeUserVisibleDataValue(value any, secrets ...string) any {
	switch typed := value.(type) {
	case map[string]any:
		for key, item := range typed {
			if isUserVisibleInternalDataKey(key) {
				delete(typed, key)
				continue
			}
			typed[key] = sanitizeUserVisibleDataValue(item, secrets...)
		}
		return typed
	case []any:
		for i, item := range typed {
			typed[i] = sanitizeUserVisibleDataValue(item, secrets...)
		}
		return typed
	case string:
		return maskUserVisibleDataString(typed, secrets...)
	default:
		return typed
	}
}

func maskUserVisibleDataString(text string, secrets ...string) string {
	for _, candidate := range userVisibleDataSecretCandidates(secrets...) {
		text = strings.ReplaceAll(text, candidate, "***")
	}
	lower := strings.ToLower(text)
	for _, marker := range []string{
		"authorization",
		"api_key",
		"api-key",
		"x-api-key",
		"x-goog-api-key",
		"bearer ",
		"sk-",
		"access_token",
		"refresh_token",
		"secret",
		"token=",
		"token:",
		"key=",
		"key:",
	} {
		if strings.Contains(lower, marker) {
			return common.MaskSecretsForLog(text, secrets...)
		}
	}
	return text
}

func userVisibleDataSecretCandidates(secrets ...string) []string {
	candidates := make([]string, 0, len(secrets)*3)
	seen := make(map[string]bool)
	for _, secret := range secrets {
		secret = strings.TrimSpace(secret)
		if len(secret) < 4 {
			continue
		}
		for _, candidate := range append([]string{secret}, splitUserVisibleSecret(secret)...) {
			if len(candidate) < 4 || seen[candidate] {
				continue
			}
			seen[candidate] = true
			candidates = append(candidates, candidate)
		}
	}
	return candidates
}

func splitUserVisibleSecret(secret string) []string {
	candidates := make([]string, 0, 3)
	if strings.HasPrefix(strings.ToLower(secret), "bearer ") {
		candidates = append(candidates, strings.TrimSpace(secret[7:]))
	}
	for _, part := range strings.Split(secret, "|") {
		part = strings.TrimSpace(part)
		if len(part) >= 8 {
			candidates = append(candidates, part)
		}
	}
	return candidates
}

func isUserVisibleInternalDataKey(key string) bool {
	normalized := strings.ToLower(strings.TrimSpace(key))
	normalized = strings.ReplaceAll(normalized, "-", "")
	normalized = strings.ReplaceAll(normalized, "_", "")
	normalized = strings.ReplaceAll(normalized, " ", "")
	for _, fragment := range []string{
		"authorization",
		"apikey",
		"accesstoken",
		"refreshtoken",
		"bearertoken",
		"secret",
		"token",
		"key",
		"channel",
		"upstream",
		"relay",
		"retry",
		"headers",
		"discordinstance",
	} {
		if strings.Contains(normalized, fragment) {
			return true
		}
	}
	return false
}
