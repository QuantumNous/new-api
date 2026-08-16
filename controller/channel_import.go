/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package controller

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	clipboardChannelImportMaxItems       = 20
	clipboardChannelImportMaxKeysPerItem = 200
	clipboardChannelImportMaxKeyLength   = 4096
	clipboardChannelImportMaxExpiry      = int64(365 * 24 * 60 * 60)

	ClipboardChannelImportStatusCreated            = "created"
	ClipboardChannelImportStatusExisting           = "existing"
	ClipboardChannelImportStatusDuplicate          = "duplicate"
	ClipboardChannelImportStatusNeedsConfiguration = "needs_configuration"
	ClipboardChannelImportStatusFailed             = "failed"
)

type ClipboardChannelImportItem struct {
	ItemID  string   `json:"item_id"`
	Name    string   `json:"name,omitempty"`
	BaseURL string   `json:"base_url"`
	Keys    []string `json:"keys"`
}

type ClipboardChannelImportRequest struct {
	BatchID          string                       `json:"batch_id"`
	NamePrefix       string                       `json:"name_prefix"`
	Type             int                          `json:"type"`
	Group            string                       `json:"group"`
	Tag              string                       `json:"tag"`
	Models           []string                     `json:"models"`
	MultiKeyMode     constant.MultiKeyMode        `json:"multi_key_mode"`
	ExpiresInSeconds int64                        `json:"expires_in_seconds"`
	ProbeModels      *bool                        `json:"probe_models"`
	RetryUnverified  bool                         `json:"retry_unverified"`
	Items            []ClipboardChannelImportItem `json:"items"`
}

type ClipboardChannelImportRollbackRequest struct {
	BatchID string `json:"batch_id"`
}

type ClipboardChannelImportResult struct {
	ItemID               string   `json:"item_id"`
	Status               string   `json:"status"`
	ChannelID            int      `json:"channel_id,omitempty"`
	Name                 string   `json:"name,omitempty"`
	BaseURL              string   `json:"base_url,omitempty"`
	KeyCount             int      `json:"key_count"`
	SkippedDuplicateKeys int      `json:"skipped_duplicate_keys,omitempty"`
	Models               []string `json:"models,omitempty"`
	Enabled              bool     `json:"enabled"`
	ExpiresAt            int64    `json:"expires_at,omitempty"`
	Message              string   `json:"message,omitempty"`
	Idempotent           bool     `json:"idempotent,omitempty"`
}

type ClipboardChannelImportSummary struct {
	Created            int `json:"created"`
	Existing           int `json:"existing"`
	Duplicate          int `json:"duplicate"`
	NeedsConfiguration int `json:"needs_configuration"`
	Failed             int `json:"failed"`
}

func normalizeClipboardImportBaseURL(rawURL string) (string, error) {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" || len(trimmed) > 2048 {
		return "", errors.New("base URL is required")
	}

	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Hostname() == "" {
		return "", errors.New("base URL is invalid")
	}
	parsed.Scheme = strings.ToLower(parsed.Scheme)
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", errors.New("base URL must use HTTP or HTTPS")
	}
	if parsed.User != nil {
		return "", errors.New("base URL cannot contain credentials")
	}

	parsed.Host = strings.ToLower(parsed.Host)
	parsed.RawQuery = ""
	parsed.Fragment = ""
	parsed.RawPath = ""
	path := strings.TrimRight(parsed.Path, "/")
	lowerPath := strings.ToLower(path)
	for _, suffix := range []string{
		"/v1/chat/completions",
		"/v1/responses/compact",
		"/v1/responses",
		"/v1/models",
		"/v1/completions",
		"/v1/embeddings",
		"/chat/completions",
		"/models",
	} {
		if strings.HasSuffix(lowerPath, suffix) {
			path = path[:len(path)-len(suffix)]
			break
		}
	}
	if strings.HasSuffix(strings.ToLower(path), "/v1") {
		path = path[:len(path)-len("/v1")]
	}
	parsed.Path = strings.TrimRight(path, "/")

	return strings.TrimRight(parsed.String(), "/"), nil
}

func normalizeClipboardImportKeys(values []string) ([]string, error) {
	seen := make(map[string]struct{})
	keys := make([]string, 0, len(values))
	for _, value := range values {
		for _, line := range strings.Split(value, "\n") {
			key := strings.TrimSpace(line)
			if key == "" {
				continue
			}
			if len(key) > clipboardChannelImportMaxKeyLength {
				return nil, errors.New("API key is too long")
			}
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			keys = append(keys, key)
		}
	}
	if len(keys) == 0 {
		return nil, errors.New("at least one API key is required")
	}
	if len(keys) > clipboardChannelImportMaxKeysPerItem {
		return nil, fmt.Errorf("a channel can import at most %d API keys", clipboardChannelImportMaxKeysPerItem)
	}
	return keys, nil
}

func normalizeClipboardImportModels(values []string) ([]string, error) {
	seen := make(map[string]struct{})
	models := make([]string, 0, len(values))
	for _, value := range values {
		for _, part := range strings.Split(value, ",") {
			name := strings.TrimSpace(part)
			if name == "" {
				continue
			}
			if len(name) > 255 {
				return nil, fmt.Errorf("model name is too long: %s", name)
			}
			if _, ok := seen[name]; ok {
				continue
			}
			seen[name] = struct{}{}
			models = append(models, name)
		}
	}
	return models, nil
}

func clipboardChannelImportID(batchID string, itemID string) string {
	digest := sha256.Sum256([]byte(batchID + "\x00" + itemID))
	return fmt.Sprintf("clipboard:%x", digest[:24])
}

func findNewClipboardImportKeys(channelType int, baseURL string, keys []string) ([]string, int, int, error) {
	var existingChannels []model.Channel
	if err := model.DB.Where("type = ?", channelType).Find(&existingChannels).Error; err != nil {
		return nil, 0, 0, err
	}

	existingKeyChannels := make(map[string]int)
	for i := range existingChannels {
		existingBaseURL, err := normalizeClipboardImportBaseURL(existingChannels[i].GetBaseURL())
		if err != nil || existingBaseURL != baseURL {
			continue
		}
		for _, key := range existingChannels[i].GetKeys() {
			existingKeyChannels[strings.TrimSpace(key)] = existingChannels[i].Id
		}
	}

	newKeys := make([]string, 0, len(keys))
	duplicateChannelID := 0
	duplicates := 0
	for _, key := range keys {
		if channelID, ok := existingKeyChannels[key]; ok {
			duplicates++
			if duplicateChannelID == 0 {
				duplicateChannelID = channelID
			}
			continue
		}
		newKeys = append(newKeys, key)
	}
	return newKeys, duplicates, duplicateChannelID, nil
}

func clipboardImportResultFromExisting(itemID string, channel *model.Channel) ClipboardChannelImportResult {
	return ClipboardChannelImportResult{
		ItemID:     itemID,
		Status:     ClipboardChannelImportStatusExisting,
		ChannelID:  channel.Id,
		Name:       channel.Name,
		BaseURL:    channel.GetBaseURL(),
		KeyCount:   len(channel.GetKeys()),
		Models:     channel.GetModels(),
		Enabled:    channel.Status == common.ChannelStatusEnabled,
		ExpiresAt:  channel.ExpiresAt,
		Idempotent: true,
	}
}

func retryUnverifiedClipboardChannel(channel *model.Channel, requestedModels []string, probeModels bool) ClipboardChannelImportResult {
	result := clipboardImportResultFromExisting("", channel)
	result.Status = ClipboardChannelImportStatusNeedsConfiguration
	result.Idempotent = true

	models := append([]string(nil), requestedModels...)
	verified := false
	if probeModels {
		fetchedModels, err := fetchChannelUpstreamModelIDs(channel)
		if err != nil {
			key := ""
			if keys := channel.GetKeys(); len(keys) > 0 {
				key = keys[0]
			}
			result.Message = "Model discovery failed: " + sanitizeFetchModelsError(err, key).Error()
		} else if len(fetchedModels) == 0 {
			result.Message = "Model discovery returned no models"
		} else {
			verified = true
			if len(models) == 0 {
				models = fetchedModels
			}
		}
	} else if len(models) > 0 {
		verified = true
	}
	if !verified {
		return result
	}

	channel.Models = strings.Join(models, ",")
	channel.Status = common.ChannelStatusEnabled
	if err := model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).Updates(map[string]any{
		"models": channel.Models,
		"status": channel.Status,
	}).Error; err != nil {
		result.Status = ClipboardChannelImportStatusFailed
		result.Message = "Could not update imported channel"
		return result
	}
	if err := channel.UpdateAbilities(nil); err != nil {
		result.Status = ClipboardChannelImportStatusFailed
		result.Message = "Could not update channel routing"
		return result
	}
	result.Status = ClipboardChannelImportStatusExisting
	result.Models = models
	result.Enabled = true
	result.Message = "Channel validation succeeded"
	return result
}

func addClipboardImportSummary(summary *ClipboardChannelImportSummary, status string) {
	switch status {
	case ClipboardChannelImportStatusCreated:
		summary.Created++
	case ClipboardChannelImportStatusExisting:
		summary.Existing++
	case ClipboardChannelImportStatusDuplicate:
		summary.Duplicate++
	case ClipboardChannelImportStatusNeedsConfiguration:
		summary.NeedsConfiguration++
	default:
		summary.Failed++
	}
}

func ImportClipboardChannels(c *gin.Context) {
	var request ClipboardChannelImportRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid request"})
		return
	}
	request.BatchID = strings.TrimSpace(request.BatchID)
	if request.BatchID == "" || len(request.BatchID) > 128 || len(request.Items) == 0 || len(request.Items) > clipboardChannelImportMaxItems {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid import batch"})
		return
	}
	if request.Type == 0 {
		request.Type = constant.ChannelTypeOpenAI
	}
	if request.Type <= constant.ChannelTypeUnknown || request.Type >= constant.ChannelTypeDummy {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid channel type"})
		return
	}
	if request.ExpiresInSeconds < 0 || request.ExpiresInSeconds > clipboardChannelImportMaxExpiry {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid expiration"})
		return
	}
	if request.MultiKeyMode == "" {
		request.MultiKeyMode = constant.MultiKeyModeRandom
	}
	if request.MultiKeyMode != constant.MultiKeyModeRandom && request.MultiKeyMode != constant.MultiKeyModePolling {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid multi-key mode"})
		return
	}

	models, err := normalizeClipboardImportModels(request.Models)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	probeModels := request.ProbeModels == nil || *request.ProbeModels
	namePrefix := strings.TrimSpace(request.NamePrefix)
	if namePrefix == "" {
		namePrefix = "Temporary"
	}
	if len(namePrefix) > 80 {
		namePrefix = namePrefix[:80]
	}
	group := strings.TrimSpace(request.Group)
	if group == "" {
		group = "default"
	}
	tag := strings.TrimSpace(request.Tag)
	if tag == "" {
		tag = "clipboard-import"
	}

	results := make([]ClipboardChannelImportResult, 0, len(request.Items))
	summary := ClipboardChannelImportSummary{}
	createdAny := false
	now := common.GetTimestamp()
	for _, item := range request.Items {
		result := ClipboardChannelImportResult{ItemID: strings.TrimSpace(item.ItemID)}
		if result.ItemID == "" || len(result.ItemID) > 128 {
			result.Status = ClipboardChannelImportStatusFailed
			result.Message = "Item ID is required"
			results = append(results, result)
			addClipboardImportSummary(&summary, result.Status)
			continue
		}

		importID := clipboardChannelImportID(request.BatchID, result.ItemID)
		if existing, lookupErr := model.GetChannelByImportID(importID); lookupErr == nil {
			if request.RetryUnverified && existing.Status != common.ChannelStatusEnabled {
				result = retryUnverifiedClipboardChannel(existing, models, probeModels)
				result.ItemID = strings.TrimSpace(item.ItemID)
				if result.Enabled {
					createdAny = true
				}
			} else {
				result = clipboardImportResultFromExisting(result.ItemID, existing)
			}
			results = append(results, result)
			addClipboardImportSummary(&summary, result.Status)
			continue
		} else if !errors.Is(lookupErr, gorm.ErrRecordNotFound) {
			result.Status = ClipboardChannelImportStatusFailed
			result.Message = "Could not check import status"
			results = append(results, result)
			addClipboardImportSummary(&summary, result.Status)
			continue
		}

		baseURL, normalizeErr := normalizeClipboardImportBaseURL(item.BaseURL)
		if normalizeErr != nil {
			result.Status = ClipboardChannelImportStatusFailed
			result.Message = normalizeErr.Error()
			results = append(results, result)
			addClipboardImportSummary(&summary, result.Status)
			continue
		}
		result.BaseURL = baseURL
		keys, normalizeErr := normalizeClipboardImportKeys(item.Keys)
		if normalizeErr != nil {
			result.Status = ClipboardChannelImportStatusFailed
			result.Message = normalizeErr.Error()
			results = append(results, result)
			addClipboardImportSummary(&summary, result.Status)
			continue
		}
		keys, result.SkippedDuplicateKeys, result.ChannelID, normalizeErr = findNewClipboardImportKeys(request.Type, baseURL, keys)
		if normalizeErr != nil {
			result.Status = ClipboardChannelImportStatusFailed
			result.Message = "Could not check duplicate channels"
			results = append(results, result)
			addClipboardImportSummary(&summary, result.Status)
			continue
		}
		if len(keys) == 0 {
			result.Status = ClipboardChannelImportStatusDuplicate
			result.Message = "All API keys already exist"
			results = append(results, result)
			addClipboardImportSummary(&summary, result.Status)
			continue
		}

		parsedBaseURL, _ := url.Parse(baseURL)
		name := strings.TrimSpace(item.Name)
		if name == "" {
			name = fmt.Sprintf("%s · %s", namePrefix, parsedBaseURL.Hostname())
		}
		if len(name) > 255 {
			name = name[:255]
		}
		expiresAt := int64(0)
		if request.ExpiresInSeconds > 0 {
			expiresAt = now + request.ExpiresInSeconds
		}
		remark := "Imported from clipboard"
		channelModels := append([]string(nil), models...)
		channel := &model.Channel{
			Type:          request.Type,
			Name:          name,
			BaseURL:       common.GetPointer(baseURL),
			Key:           strings.Join(keys, "\n"),
			Models:        strings.Join(channelModels, ","),
			Group:         group,
			Tag:           common.GetPointer(tag),
			Remark:        &remark,
			Status:        common.ChannelStatusAutoDisabled,
			CreatedTime:   now,
			ExpiresAt:     expiresAt,
			ImportSource:  model.ChannelImportSourceClipboard,
			ImportID:      &importID,
			ImportBatchID: &request.BatchID,
			ChannelInfo: model.ChannelInfo{
				IsMultiKey:   true,
				MultiKeySize: len(keys),
				MultiKeyMode: request.MultiKeyMode,
			},
		}

		verified := false
		verificationMessage := ""
		if probeModels {
			fetchedModels, fetchErr := fetchChannelUpstreamModelIDs(channel)
			if fetchErr != nil {
				verificationMessage = "Model discovery failed: " + sanitizeFetchModelsError(fetchErr, keys[0]).Error()
			} else if len(fetchedModels) == 0 {
				verificationMessage = "Model discovery returned no models"
			} else {
				verified = true
				if len(channelModels) == 0 {
					channelModels = fetchedModels
					channel.Models = strings.Join(channelModels, ",")
				}
			}
		} else if len(channelModels) > 0 {
			verified = true
		}
		if verified {
			channel.Status = common.ChannelStatusEnabled
		}
		if err := validateChannel(channel, true); err != nil {
			result.Status = ClipboardChannelImportStatusFailed
			result.Message = err.Error()
			results = append(results, result)
			addClipboardImportSummary(&summary, result.Status)
			continue
		}
		if insertErr := channel.Insert(); insertErr != nil {
			if existing, lookupErr := model.GetChannelByImportID(importID); lookupErr == nil {
				result = clipboardImportResultFromExisting(result.ItemID, existing)
				results = append(results, result)
				addClipboardImportSummary(&summary, result.Status)
				continue
			}
			result.Status = ClipboardChannelImportStatusFailed
			result.Message = "Could not create channel"
			results = append(results, result)
			addClipboardImportSummary(&summary, result.Status)
			continue
		}

		createdAny = true
		result.ChannelID = channel.Id
		result.Name = channel.Name
		result.KeyCount = len(keys)
		result.Models = channelModels
		result.Enabled = verified
		result.ExpiresAt = expiresAt
		result.Message = verificationMessage
		if verified {
			result.Status = ClipboardChannelImportStatusCreated
		} else {
			result.Status = ClipboardChannelImportStatusNeedsConfiguration
		}
		results = append(results, result)
		addClipboardImportSummary(&summary, result.Status)
	}

	if createdAny {
		model.InitChannelCache()
	}
	recordManageAudit(c, "channel.clipboard_import", map[string]interface{}{
		"created":             summary.Created,
		"needs_configuration": summary.NeedsConfiguration,
		"duplicate":           summary.Duplicate,
		"failed":              summary.Failed,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"results": results,
			"summary": summary,
		},
	})
}

func RollbackClipboardChannelImport(c *gin.Context) {
	var request ClipboardChannelImportRollbackRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid request"})
		return
	}
	request.BatchID = strings.TrimSpace(request.BatchID)
	if request.BatchID == "" || len(request.BatchID) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid import batch"})
		return
	}

	var channelIDs []int
	if err := model.DB.Model(&model.Channel{}).
		Where("import_source = ? AND import_batch_id = ?", model.ChannelImportSourceClipboard, request.BatchID).
		Pluck("id", &channelIDs).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	deleted, err := model.BatchDeleteChannels(channelIDs)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if deleted > 0 {
		model.InitChannelCache()
	}
	recordManageAudit(c, "channel.clipboard_import_rollback", map[string]interface{}{"count": deleted})
	c.JSON(http.StatusOK, gin.H{"success": true, "data": deleted})
}
