package model

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

type CreativeCenterAssetQueryParams struct {
	Type           string
	Keyword        string
	ModelName      string
	Status         string
	Username       string
	StartTimestamp int64
	EndTimestamp   int64
}

type creativeCenterHistoryQuery struct {
	UserIDs []int
}

func GetAllCreativeCenterAssets(queryParams CreativeCenterAssetQueryParams) ([]*dto.CreativeCenterAsset, error) {
	userIDs, err := queryUserIDsByUsername(queryParams.Username)
	if err != nil {
		return nil, err
	}
	if len(userIDs) == 0 && strings.TrimSpace(queryParams.Username) != "" {
		return []*dto.CreativeCenterAsset{}, nil
	}
	return listTaskAssets(creativeCenterHistoryQuery{UserIDs: userIDs}, queryParams)
}

func GetUserCreativeCenterAssets(userId int, queryParams CreativeCenterAssetQueryParams) ([]*dto.CreativeCenterAsset, error) {
	return listTaskAssets(creativeCenterHistoryQuery{UserIDs: []int{userId}}, queryParams)
}

func listTaskAssets(taskQuery creativeCenterHistoryQuery, queryParams CreativeCenterAssetQueryParams) ([]*dto.CreativeCenterAsset, error) {
	tasks, err := listAssetTasks(taskQuery, queryParams)
	if err != nil {
		return nil, err
	}

	assets := make([]*dto.CreativeCenterAsset, 0)
	usernameCache := make(map[int]string)
	for _, task := range tasks {
		if task == nil {
			continue
		}
		username, ok := usernameCache[task.UserId]
		if !ok {
			username, _ = GetUsernameById(task.UserId, false)
			usernameCache[task.UserId] = username
		}
		assets = append(assets, flattenTaskAssets(task, username)...)
	}

	filtered := make([]*dto.CreativeCenterAsset, 0, len(assets))
	for _, asset := range assets {
		if !matchesCreativeCenterAssetFilter(asset, queryParams) {
			continue
		}
		filtered = append(filtered, asset)
	}

	sort.SliceStable(filtered, func(i, j int) bool {
		if filtered[i].UpdatedAt == filtered[j].UpdatedAt {
			if filtered[i].CreatedAt == filtered[j].CreatedAt {
				return filtered[i].AssetID > filtered[j].AssetID
			}
			return filtered[i].CreatedAt > filtered[j].CreatedAt
		}
		return filtered[i].UpdatedAt > filtered[j].UpdatedAt
	})

	return filtered, nil
}

func listAssetTasks(taskQuery creativeCenterHistoryQuery, queryParams CreativeCenterAssetQueryParams) ([]*Task, error) {
	tasks := make([]*Task, 0)
	query := DB.Model(&Task{})
	if len(taskQuery.UserIDs) > 0 {
		query = query.Where("user_id in (?)", taskQuery.UserIDs)
	}
	if queryParams.StartTimestamp > 0 {
		query = query.Where("submit_time >= ?", queryParams.StartTimestamp)
	}
	if queryParams.EndTimestamp > 0 {
		query = query.Where("submit_time <= ?", queryParams.EndTimestamp)
	}
	actions := getTaskActionsForMediaType(queryParams.Type)
	if len(actions) == 0 {
		actions = getTaskActionsForMediaType(TaskMediaTypeAll)
	}
	query = query.Where("action in (?)", actions)
	query = query.Where("status = ?", TaskStatusSuccess)
	err := query.Order("updated_at desc").Find(&tasks).Error
	if err != nil {
		return nil, err
	}
	return tasks, nil
}

func listCreativeCenterAssets(historyQuery creativeCenterHistoryQuery, queryParams CreativeCenterAssetQueryParams) ([]*dto.CreativeCenterAsset, error) {
	histories, err := listCreativeCenterHistories(historyQuery)
	if err != nil {
		return nil, err
	}

	assets := make([]*dto.CreativeCenterAsset, 0)
	for _, history := range histories {
		username, _ := GetUsernameById(history.UserId, false)
		assets = append(assets, flattenCreativeCenterHistoryAssets(history, username)...)
	}

	filtered := make([]*dto.CreativeCenterAsset, 0, len(assets))
	for _, asset := range assets {
		if !matchesCreativeCenterAssetFilter(asset, queryParams) {
			continue
		}
		filtered = append(filtered, asset)
	}

	sort.SliceStable(filtered, func(i, j int) bool {
		if filtered[i].UpdatedAt == filtered[j].UpdatedAt {
			if filtered[i].CreatedAt == filtered[j].CreatedAt {
				return filtered[i].AssetID > filtered[j].AssetID
			}
			return filtered[i].CreatedAt > filtered[j].CreatedAt
		}
		return filtered[i].UpdatedAt > filtered[j].UpdatedAt
	})

	return filtered, nil
}

type taskAssetItem struct {
	mediaURL     string
	thumbnailURL string
}

func flattenTaskAssets(task *Task, username string) []*dto.CreativeCenterAsset {
	if task == nil {
		return nil
	}

	assetType := detectTaskMediaType(task.Action)
	if assetType == "" {
		return nil
	}

	createdAt := normalizeAssetTimestamp(firstPositiveInt64(task.SubmitTime, task.CreatedAt, task.StartTime, task.FinishTime))
	updatedAt := normalizeAssetTimestamp(firstPositiveInt64(task.FinishTime, task.UpdatedAt, task.StartTime, task.SubmitTime, task.CreatedAt))
	modelName := fallbackString(task.Properties.OriginModelName, task.Properties.UpstreamModelName)
	prompt := strings.TrimSpace(task.Properties.Input)

	items := extractTaskAssetItems(task, assetType)
	assets := make([]*dto.CreativeCenterAsset, 0, len(items))
	for index, item := range items {
		if strings.TrimSpace(item.mediaURL) == "" {
			continue
		}
		status := normalizeTaskAssetStatus(task.Status, item.mediaURL)
		if !isCompletedAssetStatus(status) {
			continue
		}
		assets = append(assets, &dto.CreativeCenterAsset{
			AssetID:      fmt.Sprintf("task:%s:%s:%d", assetType, task.TaskID, index),
			HistoryID:    0,
			TaskID:       task.TaskID,
			UserID:       task.UserId,
			Username:     username,
			AssetType:    assetType,
			MediaURL:     item.mediaURL,
			ThumbnailURL: fallbackString(item.thumbnailURL, item.mediaURL),
			Prompt:       prompt,
			ModelName:    modelName,
			Group:        task.Group,
			SessionID:    "",
			SessionName:  "",
			RecordID:     task.TaskID,
			Status:       status,
			CreatedAt:    createdAt,
			UpdatedAt:    updatedAt,
		})
	}

	return assets
}

func extractTaskAssetItems(task *Task, assetType string) []taskAssetItem {
	switch assetType {
	case TaskMediaTypeImage:
		imageURLs := collectTaskAssetURLs(task, assetType, false)
		items := make([]taskAssetItem, 0, len(imageURLs))
		for _, imageURL := range imageURLs {
			items = append(items, taskAssetItem{
				mediaURL:     imageURL,
				thumbnailURL: imageURL,
			})
		}
		return items
	case TaskMediaTypeVideo:
		videoURLs := collectTaskAssetURLs(task, assetType, false)
		thumbnailURLs := collectTaskAssetURLs(task, assetType, true)
		items := make([]taskAssetItem, 0, len(videoURLs))
		for index, videoURL := range videoURLs {
			thumbnailURL := ""
			if index < len(thumbnailURLs) {
				thumbnailURL = thumbnailURLs[index]
			}
			items = append(items, taskAssetItem{
				mediaURL:     videoURL,
				thumbnailURL: thumbnailURL,
			})
		}
		return items
	default:
		return nil
	}
}

func collectTaskAssetURLs(task *Task, assetType string, thumbnailOnly bool) []string {
	candidates := make([]string, 0)
	if !thumbnailOnly {
		appendUniqueTaskAssetURL(&candidates, taskAssetURLCandidate(task.GetResultURL(), assetType, false))
	}

	if len(task.Data) == 0 {
		return candidates
	}

	var payload any
	if err := common.Unmarshal(task.Data, &payload); err != nil {
		return candidates
	}

	keySet := taskAssetMediaKeys(assetType, thumbnailOnly)
	var walk func(node any)
	walk = func(node any) {
		switch value := node.(type) {
		case map[string]any:
			for key, nested := range value {
				normalizedKey := strings.ToLower(strings.TrimSpace(key))
				if _, ok := keySet[normalizedKey]; ok {
					appendTaskAssetURLsByValue(&candidates, nested, assetType, thumbnailOnly)
				}
				walk(nested)
			}
		case []any:
			for _, item := range value {
				walk(item)
			}
		}
	}
	walk(payload)

	return candidates
}

func taskAssetMediaKeys(assetType string, thumbnailOnly bool) map[string]struct{} {
	if thumbnailOnly {
		return map[string]struct{}{
			"thumbnailurl":  {},
			"thumbnail_url": {},
			"coverurl":      {},
			"cover_url":     {},
			"image_url":     {},
			"imageurl":      {},
		}
	}

	switch assetType {
	case TaskMediaTypeImage:
		return map[string]struct{}{
			"url":           {},
			"presignedurl":  {},
			"presigned_url": {},
			"resulturl":     {},
			"result_url":    {},
			"image_url":     {},
			"imageurl":      {},
			"image_urls":    {},
			"imageurls":     {},
			"images":        {},
			"b64_json":      {},
			"b64json":       {},
		}
	case TaskMediaTypeVideo:
		return map[string]struct{}{
			"url":        {},
			"resulturl":  {},
			"result_url": {},
			"video_url":  {},
			"videourl":   {},
			"video_urls": {},
			"videourls":  {},
		}
	default:
		return map[string]struct{}{}
	}
}

func appendTaskAssetURLsByValue(target *[]string, value any, assetType string, thumbnailOnly bool) {
	switch typedValue := value.(type) {
	case string:
		appendUniqueTaskAssetURL(target, taskAssetURLCandidate(typedValue, assetType, thumbnailOnly))
	case []any:
		for _, item := range typedValue {
			appendTaskAssetURLsByValue(target, item, assetType, thumbnailOnly)
		}
	case map[string]any:
		keys := []string{"url", "presignedUrl", "presigned_url", "resultUrl", "result_url", "image_url", "imageUrl", "video_url", "videoUrl", "thumbnailUrl", "thumbnail_url", "coverUrl", "cover_url"}
		if thumbnailOnly {
			keys = []string{"thumbnailUrl", "thumbnail_url", "coverUrl", "cover_url", "image_url", "imageUrl"}
		}
		for _, key := range keys {
			appendUniqueTaskAssetURL(target, taskAssetURLCandidate(stringValue(typedValue, key), assetType, thumbnailOnly))
		}
		if assetType == TaskMediaTypeImage && !thumbnailOnly {
			if b64 := strings.TrimSpace(stringValue(typedValue, "b64_json", "b64Json")); b64 != "" {
				appendUniqueTaskAssetURL(target, "data:image/png;base64,"+b64)
			}
		}
	}
}

func appendUniqueTaskAssetURL(target *[]string, candidate string) {
	trimmed := strings.TrimSpace(candidate)
	if trimmed == "" {
		return
	}
	for _, existing := range *target {
		if existing == trimmed {
			return
		}
	}
	*target = append(*target, trimmed)
}

func taskAssetURLCandidate(candidate string, assetType string, thumbnailOnly bool) string {
	trimmed := strings.TrimSpace(candidate)
	if trimmed == "" {
		return ""
	}
	if strings.HasPrefix(trimmed, "data:image/") {
		if assetType == TaskMediaTypeVideo && !thumbnailOnly {
			return ""
		}
		return trimmed
	}
	if strings.HasPrefix(trimmed, "data:video/") {
		if assetType == TaskMediaTypeImage || thumbnailOnly {
			return ""
		}
		return trimmed
	}
	if strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") || strings.HasPrefix(trimmed, "/") {
		return trimmed
	}
	return ""
}

func normalizeTaskAssetStatus(status TaskStatus, mediaURL string) string {
	switch normalizeTaskStatus(status) {
	case TaskStatusFailure:
		return "failed"
	case TaskStatusSuccess:
		return "completed"
	case TaskStatusQueued, TaskStatusSubmitted, TaskStatusInProgress:
		if strings.TrimSpace(mediaURL) != "" {
			return "completed"
		}
		return "processing"
	default:
		if strings.TrimSpace(mediaURL) != "" {
			return "completed"
		}
		return "processing"
	}
}

func firstPositiveInt64(values ...int64) int64 {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}

func listCreativeCenterHistories(query creativeCenterHistoryQuery) ([]*CreativeCenterHistory, error) {
	histories := make([]*CreativeCenterHistory, 0)
	tx := DB.Model(&CreativeCenterHistory{}).Where("tab in (?)", []string{"image", "video"})
	if len(query.UserIDs) > 0 {
		tx = tx.Where("user_id in (?)", query.UserIDs)
	}
	err := tx.Order("updated_at desc").Find(&histories).Error
	if err != nil {
		return nil, err
	}
	return histories, nil
}

func queryUserIDsByUsername(username string) ([]int, error) {
	trimmed := strings.TrimSpace(username)
	if trimmed == "" {
		return nil, nil
	}
	userIDs := make([]int, 0)
	err := DB.Model(&User{}).
		Where("username LIKE ?", "%"+trimmed+"%").
		Pluck("id", &userIDs).Error
	if err != nil {
		return nil, err
	}
	return userIDs, nil
}

func flattenCreativeCenterHistoryAssets(history *CreativeCenterHistory, username string) []*dto.CreativeCenterAsset {
	if history == nil {
		return nil
	}

	rootPayload := mapStringAny{}
	if history.Payload != "" {
		_ = common.UnmarshalJsonStr(string(history.Payload), &rootPayload)
	}

	tab := strings.TrimSpace(history.Tab)
	if tab == "" {
		return nil
	}

	sessions := mapSliceValue(rootPayload, "sessions")
	if len(sessions) == 0 {
		return flattenCreativeCenterSessionAssets(history, username, tab, rootPayload, 0)
	}

	assets := make([]*dto.CreativeCenterAsset, 0)
	for index, session := range sessions {
		assets = append(assets, flattenCreativeCenterSessionAssets(history, username, tab, session, index)...)
	}
	return assets
}

func flattenCreativeCenterSessionAssets(history *CreativeCenterHistory, username string, tab string, session mapStringAny, sessionIndex int) []*dto.CreativeCenterAsset {
	sessionID := fallbackString(stringValue(session, "id"), fmt.Sprintf("session-%d", sessionIndex))
	sessionName := fallbackString(stringValue(session, "name"), fmt.Sprintf("%s-session-%d", tab, sessionIndex+1))
	sessionPrompt := fallbackString(stringValue(session, "prompt"), history.Prompt)
	sessionModelName := fallbackString(stringValue(session, "model_name", "modelName"), history.ModelName)
	sessionGroup := fallbackString(stringValue(session, "group"), history.Group)
	sessionCreatedAt := fallbackInt64(int64Value(session, "created_at", "createdAt"), history.CreatedAt)
	sessionUpdatedAt := fallbackInt64(int64Value(session, "updated_at", "updatedAt"), history.UpdatedAt)

	sessionPayload := mapValue(session, "payload")
	if len(sessionPayload) == 0 {
		sessionPayload = session
	}

	entries := mapSliceValue(sessionPayload, "entries")
	if len(entries) == 0 {
		legacyEntry := mapStringAny{
			"id":         fmt.Sprintf("record-%d", sessionIndex),
			"prompt":     sessionPrompt,
			"model_name": sessionModelName,
			"group":      sessionGroup,
			"created_at": sessionCreatedAt,
			"updated_at": sessionUpdatedAt,
		}
		switch tab {
		case "image":
			if images := sliceValue(sessionPayload, "images"); len(images) > 0 {
				legacyEntry["images"] = images
				entries = append(entries, legacyEntry)
			}
		case "video":
			if tasks := sliceValue(sessionPayload, "tasks"); len(tasks) > 0 {
				legacyEntry["tasks"] = tasks
				entries = append(entries, legacyEntry)
			}
		}
	}

	assets := make([]*dto.CreativeCenterAsset, 0)
	for entryIndex, entry := range entries {
		recordID := fallbackString(stringValue(entry, "id"), fmt.Sprintf("record-%d", entryIndex))
		prompt := fallbackString(stringValue(entry, "prompt"), sessionPrompt)
		modelName := fallbackString(stringValue(entry, "model_name", "modelName"), sessionModelName)
		group := fallbackString(stringValue(entry, "group"), sessionGroup)
		status := normalizeAssetStatus(fallbackString(stringValue(entry, "status"), "completed"))
		createdAt := normalizeAssetTimestamp(
			fallbackInt64(int64Value(entry, "created_at", "createdAt"), sessionCreatedAt),
		)
		updatedAt := normalizeAssetTimestamp(
			fallbackInt64(int64Value(entry, "updated_at", "updatedAt"), sessionUpdatedAt),
		)

		var items []any
		if tab == "image" {
			items = sliceValue(entry, "images")
		} else {
			items = sliceValue(entry, "tasks")
		}

		for itemIndex, item := range items {
			itemMap := anyToMap(item)
			mediaURL := firstNonEmptyString(anyToString(item), stringValue(itemMap, "url"), stringValue(itemMap, "resultUrl"), stringValue(itemMap, "result_url"))
			if strings.TrimSpace(mediaURL) == "" {
				continue
			}

			itemStatus := normalizeAssetStatus(fallbackString(stringValue(itemMap, "status"), status))
			if mediaURL != "" && !isFailedAssetStatus(itemStatus) {
				itemStatus = "completed"
			}
			if !isCompletedAssetStatus(itemStatus) {
				continue
			}
			assetType := tab
			thumbnailURL := mediaURL
			if assetType == "video" {
				thumbnailURL = firstNonEmptyString(stringValue(itemMap, "thumbnailUrl"), stringValue(itemMap, "thumbnail_url"), mediaURL)
			}

			assets = append(assets, &dto.CreativeCenterAsset{
				AssetID:      fmt.Sprintf("cc:%s:%d:%s:%s:%d", tab, history.ID, sessionID, recordID, itemIndex),
				HistoryID:    history.ID,
				UserID:       history.UserId,
				Username:     username,
				AssetType:    assetType,
				MediaURL:     mediaURL,
				ThumbnailURL: thumbnailURL,
				Prompt:       prompt,
				ModelName:    modelName,
				Group:        group,
				SessionID:    sessionID,
				SessionName:  sessionName,
				RecordID:     recordID,
				Status:       itemStatus,
				CreatedAt:    createdAt,
				UpdatedAt:    updatedAt,
			})
		}
	}

	return assets
}

func matchesCreativeCenterAssetFilter(asset *dto.CreativeCenterAsset, queryParams CreativeCenterAssetQueryParams) bool {
	if asset == nil {
		return false
	}
	queryType := strings.ToLower(strings.TrimSpace(queryParams.Type))
	if queryType != "" && queryType != "all" && strings.ToLower(asset.AssetType) != queryType {
		return false
	}

	queryStatus := strings.ToLower(strings.TrimSpace(queryParams.Status))
	if queryStatus != "" && queryStatus != "all" && strings.ToLower(asset.Status) != queryStatus {
		return false
	}

	queryModel := strings.ToLower(strings.TrimSpace(queryParams.ModelName))
	if queryModel != "" && !strings.Contains(strings.ToLower(asset.ModelName), queryModel) {
		return false
	}

	queryKeyword := strings.ToLower(strings.TrimSpace(queryParams.Keyword))
	if queryKeyword != "" {
		haystack := strings.ToLower(strings.Join([]string{
			asset.Prompt,
			asset.ModelName,
			asset.Group,
			asset.TaskID,
			asset.SessionName,
			asset.Username,
			asset.RecordID,
		}, " "))
		if !strings.Contains(haystack, queryKeyword) {
			return false
		}
	}

	if queryParams.StartTimestamp > 0 && asset.CreatedAt < queryParams.StartTimestamp {
		return false
	}
	if queryParams.EndTimestamp > 0 && asset.CreatedAt > queryParams.EndTimestamp {
		return false
	}

	return true
}

func normalizeAssetStatus(status string) string {
	normalized := strings.TrimSpace(strings.ToLower(status))
	if normalized == "" {
		return "completed"
	}
	switch normalized {
	case "success":
		return "completed"
	case "in_progress":
		return "processing"
	default:
		return normalized
	}
}

func isCompletedAssetStatus(status string) bool {
	return normalizeAssetStatus(status) == "completed"
}

func isFailedAssetStatus(status string) bool {
	return normalizeAssetStatus(status) == "failed"
}

func normalizeAssetTimestamp(timestamp int64) int64 {
	if timestamp <= 0 {
		return 0
	}
	// Creative Center payload timestamps are often persisted in milliseconds.
	if timestamp > 9999999999 {
		return timestamp / 1000
	}
	return timestamp
}

type mapStringAny map[string]any

func mapValue(m mapStringAny, keys ...string) mapStringAny {
	for _, key := range keys {
		if value, ok := m[key]; ok {
			return anyToMap(value)
		}
	}
	return mapStringAny{}
}

func mapSliceValue(m mapStringAny, keys ...string) []mapStringAny {
	values := sliceValue(m, keys...)
	items := make([]mapStringAny, 0, len(values))
	for _, value := range values {
		item := anyToMap(value)
		if len(item) == 0 {
			continue
		}
		items = append(items, item)
	}
	return items
}

func sliceValue(m mapStringAny, keys ...string) []any {
	for _, key := range keys {
		if value, ok := m[key]; ok {
			if items, ok := value.([]any); ok {
				return items
			}
		}
	}
	return nil
}

func stringValue(m mapStringAny, keys ...string) string {
	for _, key := range keys {
		if value, ok := m[key]; ok {
			return anyToString(value)
		}
	}
	return ""
}

func int64Value(m mapStringAny, keys ...string) int64 {
	for _, key := range keys {
		if value, ok := m[key]; ok {
			switch typed := value.(type) {
			case float64:
				return int64(typed)
			case float32:
				return int64(typed)
			case int64:
				return typed
			case int32:
				return int64(typed)
			case int:
				return int64(typed)
			case string:
				parsed, err := strconv.ParseInt(strings.TrimSpace(typed), 10, 64)
				if err == nil {
					return parsed
				}
			}
		}
	}
	return 0
}

func anyToMap(value any) mapStringAny {
	switch typed := value.(type) {
	case mapStringAny:
		return typed
	case map[string]any:
		return mapStringAny(typed)
	default:
		return mapStringAny{}
	}
}

func anyToString(value any) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	default:
		return ""
	}
}

func fallbackString(value string, fallback string) string {
	if strings.TrimSpace(value) != "" {
		return value
	}
	return fallback
}

func fallbackInt64(value int64, fallback int64) int64 {
	if value > 0 {
		return value
	}
	return fallback
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}
