package controller

import (
	"crypto/sha256"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	slsSeedancePluginKey = "sls-seedance"
	maxSLSAssetBodyBytes = 1 << 20
)

type slsAssetRequest struct {
	SourceURL  string `json:"source_url"`
	AssetType  string `json:"asset_type"`
	Name       string `json:"name"`
	GroupID    string `json:"group_id"`
	GroupName  string `json:"group_name"`
	BytedToken string `json:"byted_token"`
}

type slsAssetEnvelope struct {
	Success bool           `json:"success"`
	Message string         `json:"message"`
	Data    map[string]any `json:"data"`
}

type slsAssetChannel struct {
	id       int
	baseURL  string
	key      string
	settings dto.ChannelSettings
}

func currentSLSAssetChannel(c *gin.Context) (*slsAssetChannel, error) {
	channelID := common.GetContextKeyInt(c, constant.ContextKeyChannelId)
	channelKey := common.GetContextKeyString(c, constant.ContextKeyChannelKey)
	baseURL := strings.TrimRight(common.GetContextKeyString(c, constant.ContextKeyChannelBaseUrl), "/")
	settings, ok := common.GetContextKeyType[dto.ChannelSettings](c, constant.ContextKeyChannelSetting)
	if channelID <= 0 || channelKey == "" || baseURL == "" || !ok {
		return nil, fmt.Errorf("SLS channel is not available")
	}
	return &slsAssetChannel{id: channelID, baseURL: baseURL, key: channelKey, settings: settings}, nil
}

func getSLSAssetChannelByID(channelID int) (*slsAssetChannel, error) {
	channel, err := model.GetChannelById(channelID, true)
	if err != nil {
		return nil, err
	}
	if channel.Type != constant.ChannelTypeTaskPlugin || channel.GetSetting().TaskPluginKey != slsSeedancePluginKey {
		return nil, fmt.Errorf("SLS channel is unavailable")
	}
	key, _, requestErr := channel.GetNextEnabledKey()
	if requestErr != nil {
		return nil, requestErr
	}
	baseURL := strings.TrimRight(channel.GetBaseURL(), "/")
	if baseURL == "" {
		return nil, fmt.Errorf("SLS channel base URL is empty")
	}
	return &slsAssetChannel{id: channel.Id, baseURL: baseURL, key: key, settings: channel.GetSetting()}, nil
}

func callSLSAssetAPI(c *gin.Context, upstream *slsAssetChannel, method, path string, query url.Values, body []byte) ([]byte, int, error) {
	requestPath := path
	if strings.HasSuffix(upstream.baseURL, "/v1") && strings.HasPrefix(requestPath, "/v1/") {
		requestPath = strings.TrimPrefix(requestPath, "/v1")
	}
	requestURL := upstream.baseURL + requestPath
	if encoded := query.Encode(); encoded != "" {
		requestURL += "?" + encoded
	}
	request, err := http.NewRequestWithContext(c.Request.Context(), method, requestURL, strings.NewReader(string(body)))
	if err != nil {
		return nil, 0, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Authorization", "Bearer "+upstream.key)
	if method != http.MethodGet && method != http.MethodHead && method != http.MethodDelete {
		request.Header.Set("Content-Type", "application/json")
	}
	client, err := service.GetHttpClientWithProxySettings(upstream.settings.Proxy, upstream.settings)
	if err != nil {
		return nil, 0, err
	}
	assetClient := *client
	assetClient.CheckRedirect = func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }
	response, err := assetClient.Do(request)
	if err != nil {
		return nil, 0, err
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, (8<<20)+1))
	if err != nil {
		return nil, 0, err
	}
	if len(responseBody) > 8<<20 {
		return nil, 0, fmt.Errorf("SLS response exceeds the maximum supported size")
	}
	return responseBody, response.StatusCode, nil
}

func decodeSLSAssetRequest(c *gin.Context) (slsAssetRequest, []byte, bool) {
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, maxSLSAssetBodyBytes+1))
	if err != nil || len(body) > maxSLSAssetBodyBytes {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid or oversized request body"})
		return slsAssetRequest{}, nil, false
	}
	var request slsAssetRequest
	if err = common.Unmarshal(body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "request body must be a JSON object"})
		return slsAssetRequest{}, nil, false
	}
	return request, body, true
}

func writeSLSAssetResponse(c *gin.Context, status int, body []byte) {
	c.Data(status, "application/json; charset=utf-8", body)
}

func slsAssetData(body []byte) (slsAssetEnvelope, bool) {
	var envelope slsAssetEnvelope
	if err := common.Unmarshal(body, &envelope); err != nil {
		return slsAssetEnvelope{}, false
	}
	return envelope, true
}

func scopedSLSGroupName(userID int, groupName string) string {
	prefix := fmt.Sprintf("na-u%d-", userID)
	remaining := 200 - utf8.RuneCountInString(prefix)
	if remaining < 0 {
		remaining = 0
	}
	runes := []rune(groupName)
	if len(runes) > remaining {
		runes = runes[:remaining]
	}
	return prefix + string(runes)
}

func userOwnsSLSGroup(userID int, groupID string) bool {
	if groupID == "" {
		return true
	}
	var personGroup model.VolcenginePersonGroup
	if err := model.DB.Where("group_id = ? AND user_id = ?", groupID, userID).First(&personGroup).Error; err == nil {
		return true
	}
	var count int64
	err := model.DB.Model(&model.VolcengineAsset{}).
		Where("user_id = ? AND (logical_group_id = ? OR asset_group_id = ?)", userID, groupID, groupID).
		Count(&count).Error
	return err == nil && count > 0
}

// CreateVolcengineAsset uploads a logical asset through the selected SLS channel.
func CreateVolcengineAsset(c *gin.Context) {
	request, body, ok := decodeSLSAssetRequest(c)
	if !ok {
		return
	}
	displayGroupName := request.GroupName
	if request.SourceURL == "" || request.AssetType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "source_url and asset_type are required"})
		return
	}
	parsedSource, err := url.ParseRequestURI(request.SourceURL)
	if err != nil || (parsedSource.Scheme != "http" && parsedSource.Scheme != "https") || parsedSource.Host == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "source_url must be a public HTTP or HTTPS URL"})
		return
	}
	if request.GroupID != "" && !userOwnsSLSGroup(c.GetInt("id"), request.GroupID) {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "asset group not found"})
		return
	}
	upstream, err := currentSLSAssetChannel(c)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "message": "SLS channel is unavailable"})
		return
	}
	if request.GroupName != "" {
		request.GroupName = scopedSLSGroupName(c.GetInt("id"), request.GroupName)
		body, err = common.Marshal(request)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "failed to encode request"})
			return
		}
	}
	responseBody, status, err := callSLSAssetAPI(c, upstream, http.MethodPost, "/v1/volcengine/assets", nil, body)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "SLS asset request failed"})
		return
	}
	if status < 200 || status >= 300 {
		writeSLSAssetResponse(c, status, responseBody)
		return
	}
	envelope, valid := slsAssetData(responseBody)
	logicalID, _ := envelope.Data["logical_id"].(string)
	if !valid || logicalID == "" {
		writeSLSAssetResponse(c, status, responseBody)
		return
	}
	asset := model.VolcengineAsset{
		LogicalID:       logicalID,
		UserID:          c.GetInt("id"),
		ChannelID:       upstream.id,
		LogicalGroupID:  stringFromSLSValue(envelope.Data["logical_group_id"]),
		GroupName:       displayGroupName,
		AssetGroupID:    stringFromSLSValue(envelope.Data["group_id"]),
		AssetType:       stringFromSLSValue(envelope.Data["asset_type"]),
		Name:            stringFromSLSValue(envelope.Data["name"]),
		Status:          stringFromSLSValue(envelope.Data["status"]),
		UpstreamCreated: time.Now().Unix(),
	}
	if err = model.DB.Create(&asset).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": "asset could not be registered to this user"})
		return
	}
	if request.GroupName != "" {
		envelope.Data["group_name"] = displayGroupName
		responseBody, _ = common.Marshal(envelope)
	}
	writeSLSAssetResponse(c, status, responseBody)
}

func stringFromSLSValue(value any) string {
	if text, ok := value.(string); ok {
		return text
	}
	return ""
}

// ListVolcengineAssets returns only assets owned by the authenticated gateway user.
func ListVolcengineAssets(c *gin.Context) {
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}
	pageSize, err := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if err != nil || pageSize < 1 {
		pageSize = 20
	}
	pageSize = min(pageSize, 100)
	query := model.DB.Model(&model.VolcengineAsset{}).Where("user_id = ?", c.GetInt("id"))
	if groupID := c.Query("group_id"); groupID != "" {
		query = query.Where("logical_group_id = ?", groupID)
	}
	if assetGroupID := c.Query("asset_group_id"); assetGroupID != "" {
		query = query.Where("asset_group_id = ?", assetGroupID)
	}
	var total int64
	if err = query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "failed to list assets"})
		return
	}
	assets := make([]model.VolcengineAsset, 0)
	if err = query.Order("upstream_created DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&assets).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "failed to list assets"})
		return
	}
	items := make([]map[string]any, 0, len(assets))
	for _, asset := range assets {
		items = append(items, map[string]any{
			"logical_id":       asset.LogicalID,
			"logical_group_id": asset.LogicalGroupID,
			"group_name":       asset.GroupName,
			"asset_group_id":   asset.AssetGroupID,
			"name":             asset.Name,
			"asset_type":       asset.AssetType,
			"status":           asset.Status,
			"created_at":       asset.UpstreamCreated,
		})
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"items": items, "total": total, "page": page}})
}

func findOwnedSLSAsset(c *gin.Context) (*model.VolcengineAsset, bool) {
	var asset model.VolcengineAsset
	err := model.DB.Where("logical_id = ? AND user_id = ?", c.Param("logical_id"), c.GetInt("id")).First(&asset).Error
	if err == nil {
		return &asset, true
	}
	if err == gorm.ErrRecordNotFound {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "asset not found"})
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "failed to read asset"})
	}
	return nil, false
}

// GetVolcengineAsset refreshes status from SLS after enforcing local ownership.
func GetVolcengineAsset(c *gin.Context) {
	asset, ok := findOwnedSLSAsset(c)
	if !ok {
		return
	}
	upstream, err := getSLSAssetChannelByID(asset.ChannelID)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "message": "SLS channel is unavailable"})
		return
	}
	path := "/v1/volcengine/assets/" + url.PathEscape(asset.LogicalID)
	responseBody, status, err := callSLSAssetAPI(c, upstream, http.MethodGet, path, nil, nil)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "SLS asset request failed"})
		return
	}
	if status >= 200 && status < 300 {
		if envelope, valid := slsAssetData(responseBody); valid && envelope.Data != nil {
			updates := map[string]any{}
			if value := stringFromSLSValue(envelope.Data["status"]); value != "" {
				updates["status"] = value
			}
			assetGroupID := stringFromSLSValue(envelope.Data["asset_group_id"])
			if assetGroupID == "" {
				assetGroupID = stringFromSLSValue(envelope.Data["group_id"])
			}
			if assetGroupID != "" {
				updates["asset_group_id"] = assetGroupID
			}
			if len(updates) > 0 {
				_ = model.DB.Model(asset).Updates(updates).Error
			}
			if asset.GroupName != "" {
				envelope.Data["group_name"] = asset.GroupName
				responseBody, _ = common.Marshal(envelope)
			}
		}
	}
	writeSLSAssetResponse(c, status, responseBody)
}

// DeleteVolcengineAsset begins upstream deletion and hides the asset locally.
func DeleteVolcengineAsset(c *gin.Context) {
	asset, ok := findOwnedSLSAsset(c)
	if !ok {
		return
	}
	upstream, err := getSLSAssetChannelByID(asset.ChannelID)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "message": "SLS channel is unavailable"})
		return
	}
	path := "/v1/volcengine/assets/" + url.PathEscape(asset.LogicalID)
	responseBody, status, err := callSLSAssetAPI(c, upstream, http.MethodDelete, path, nil, nil)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "SLS asset request failed"})
		return
	}
	if status >= 200 && status < 300 {
		if err = model.DB.Delete(asset).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "asset was deleted upstream but local ownership could not be updated"})
			return
		}
	}
	writeSLSAssetResponse(c, status, responseBody)
}

// CreateVolcengineAuthSession starts SLS's H5 real-person verification flow.
func CreateVolcengineAuthSession(c *gin.Context) {
	_, body, ok := decodeSLSAssetRequest(c)
	if !ok {
		return
	}
	upstream, err := currentSLSAssetChannel(c)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "message": "SLS channel is unavailable"})
		return
	}
	responseBody, status, err := callSLSAssetAPI(c, upstream, http.MethodPost, "/v1/volcengine/assets/auth-sessions", nil, body)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "SLS auth-session request failed"})
		return
	}
	if status >= 200 && status < 300 {
		if envelope, valid := slsAssetData(responseBody); valid && envelope.Data != nil {
			if token, _ := envelope.Data["byted_token"].(string); token != "" {
				expiresIn, _ := strconv.Atoi(fmt.Sprint(envelope.Data["expires_in"]))
				if expiresIn < 1 {
					expiresIn = 3600
				}
				digest := fmt.Sprintf("%x", sha256.Sum256([]byte(token)))
				session := model.VolcengineAuthSession{TokenHash: digest, UserID: c.GetInt("id"), ChannelID: upstream.id, ExpiresAt: time.Now().Add(time.Duration(expiresIn) * time.Second)}
				var existing model.VolcengineAuthSession
				existingErr := model.DB.Where("token_hash = ?", digest).First(&existing).Error
				if existingErr == nil && existing.UserID != session.UserID {
					c.JSON(http.StatusConflict, gin.H{"success": false, "message": "verification session is already registered"})
					return
				}
				if existingErr == nil {
					err = model.DB.Model(&existing).Updates(map[string]any{"channel_id": session.ChannelID, "expires_at": session.ExpiresAt}).Error
				} else if existingErr == gorm.ErrRecordNotFound {
					err = model.DB.Create(&session).Error
				} else {
					err = existingErr
				}
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "failed to register verification session"})
					return
				}
			}
		}
	}
	writeSLSAssetResponse(c, status, responseBody)
}

// GetVolcenginePersonGroup resolves a completed SLS human-verification session.
func GetVolcenginePersonGroup(c *gin.Context) {
	request, body, ok := decodeSLSAssetRequest(c)
	if !ok {
		return
	}
	if request.BytedToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "byted_token is required"})
		return
	}
	digest := fmt.Sprintf("%x", sha256.Sum256([]byte(request.BytedToken)))
	var session model.VolcengineAuthSession
	if err := model.DB.Where("token_hash = ? AND user_id = ?", digest, c.GetInt("id")).First(&session).Error; err != nil || time.Now().After(session.ExpiresAt) {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "verification session not found or expired"})
		return
	}
	upstream, err := getSLSAssetChannelByID(session.ChannelID)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "message": "SLS channel is unavailable"})
		return
	}
	responseBody, status, err := callSLSAssetAPI(c, upstream, http.MethodPost, "/v1/volcengine/assets/groups/by-byted-token", nil, body)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "SLS group request failed"})
		return
	}
	if status >= 200 && status < 300 {
		if envelope, valid := slsAssetData(responseBody); valid && envelope.Data != nil {
			if groupID, _ := envelope.Data["group_id"].(string); groupID != "" {
				group := model.VolcenginePersonGroup{GroupID: groupID, UserID: c.GetInt("id"), ChannelID: session.ChannelID}
				var existing model.VolcenginePersonGroup
				existingErr := model.DB.Where("group_id = ?", groupID).First(&existing).Error
				if existingErr == nil && existing.UserID != group.UserID {
					c.JSON(http.StatusConflict, gin.H{"success": false, "message": "person group is already registered"})
					return
				}
				if existingErr == gorm.ErrRecordNotFound {
					err = model.DB.Create(&group).Error
				} else {
					err = existingErr
				}
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "failed to register person group"})
					return
				}
			}
		}
	}
	writeSLSAssetResponse(c, status, responseBody)
}

// ListVideoGenerations exposes the owner's durable SLS Seedance task history.
func ListVideoGenerations(c *gin.Context) {
	page, err := strconv.Atoi(c.DefaultQuery("page_num", "1"))
	if err != nil || page < 1 {
		page = 1
	}
	pageSize, err := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if err != nil || pageSize < 1 {
		pageSize = 20
	}
	pageSize = min(pageSize, 100)
	status := strings.ToUpper(strings.TrimSpace(c.Query("status")))
	if status != "" && status != "SUBMITTED" && status != "QUEUED" && status != "IN_PROGRESS" && status != "SUCCESS" && status != "FAILURE" {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid task status"}})
		return
	}
	order := "DESC"
	if strings.EqualFold(c.Query("order"), "asc") {
		order = "ASC"
	}
	query := model.DB.Model(&model.Task{}).
		Where("user_id = ? AND platform = ?", c.GetInt("id"), slsSeedancePluginKey)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	var total int64
	if err = query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": "failed to list video tasks"}})
		return
	}
	tasks := make([]model.Task, 0)
	if err = query.Order("id " + order).Offset((page - 1) * pageSize).Limit(pageSize).Find(&tasks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": "failed to list video tasks"}})
		return
	}
	items := make([]map[string]any, 0, len(tasks))
	for _, task := range tasks {
		payload := map[string]any{}
		_ = common.Unmarshal(task.Data, &payload)
		if nested, ok := payload["data"].(map[string]any); ok && len(nested) > 0 {
			payload = nested
		}
		totalTokens := payload["total_tokens"]
		if totalTokens == nil {
			totalTokens = int64(0)
		}
		item := map[string]any{
			"id":               task.ID,
			"created_at":       task.CreatedAt,
			"updated_at":       task.UpdatedAt,
			"task_id":          task.TaskID,
			"upstream_task_id": task.GetUpstreamTaskID(),
			"platform":         string(task.Platform),
			"user_id":          task.UserId,
			"group":            task.Group,
			"quota":            task.Quota,
			"total_tokens":     totalTokens,
			"action":           task.Action,
			"status":           task.Status,
			"fail_reason":      task.FailReason,
			"result_url":       task.GetResultURL(),
			"last_frame_url":   payload["last_frame_url"],
			"submit_time":      task.SubmitTime,
			"start_time":       task.StartTime,
			"finish_time":      task.FinishTime,
			"progress":         task.Progress,
			"properties":       task.Properties,
			"duration":         payload["duration"],
			"resolution":       payload["resolution"],
			"ratio":            payload["ratio"],
			"model":            task.Properties.OriginModelName,
			"description":      payload["description"],
			"video_created_at": payload["video_created_at"],
			"video_updated_at": payload["video_updated_at"],
		}
		items = append(items, item)
	}
	c.JSON(http.StatusOK, gin.H{"object": "list", "data": items, "total": total, "page_num": page, "page_size": pageSize})
}
