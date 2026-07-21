package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ImageTaskBillingLogOutbox is written in the same main-database transaction
// that makes an image task terminal. It is deliberately independent from the
// log database: a temporary log-database outage must not lose an already
// committed charge/refund record.
type ImageTaskBillingLogOutbox struct {
	ID               int64  `json:"id" gorm:"primaryKey"`
	TaskID           string `json:"task_id" gorm:"type:varchar(191);uniqueIndex"`
	RequestID        string `json:"request_id" gorm:"type:varchar(64);uniqueIndex"`
	UserID           int    `json:"user_id" gorm:"index"`
	Username         string `json:"username" gorm:"type:varchar(191)"`
	LogType          int    `json:"log_type" gorm:"index"`
	Content          string `json:"content" gorm:"type:text"`
	ChannelID        int    `json:"channel_id"`
	PromptTokens     int    `json:"prompt_tokens"`
	CompletionTokens int    `json:"completion_tokens"`
	ModelName        string `json:"model_name" gorm:"type:varchar(191)"`
	Quota            int    `json:"quota"`
	UseTime          int    `json:"use_time"`
	TokenID          int    `json:"token_id"`
	TokenName        string `json:"token_name" gorm:"type:varchar(191)"`
	Group            string `json:"group" gorm:"type:varchar(191)"`
	NodeName         string `json:"node_name" gorm:"type:varchar(191)"`
	Other            string `json:"other" gorm:"type:text"`
	Status           string `json:"status" gorm:"type:varchar(20);index:idx_image_task_billing_outbox_due,priority:1"`
	Attempts         int    `json:"attempts"`
	NextAttemptAt    int64  `json:"next_attempt_at" gorm:"index:idx_image_task_billing_outbox_due,priority:2"`
	LeaseToken       string `json:"-" gorm:"type:varchar(64)"`
	LeaseUntil       int64  `json:"lease_until" gorm:"index"`
	LastError        string `json:"last_error" gorm:"type:text"`
	CreatedAt        int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt        int64  `json:"updated_at" gorm:"bigint"`
	DeliveredAt      int64  `json:"delivered_at" gorm:"bigint"`
}

const (
	imageTaskBillingLogPending    = "pending"
	imageTaskBillingLogDelivering = "delivering"
	imageTaskBillingLogDelivered  = "delivered"
	imageTaskBillingLogLease      = 5 * 60
)

// ImageTaskBillingLogReceipt is stored in the log database and makes the
// delivery side idempotent even if a worker crashes after inserting Log but
// before acknowledging the main-database outbox row.
type ImageTaskBillingLogReceipt struct {
	TaskID    string `json:"task_id" gorm:"primaryKey;type:varchar(191)"`
	RequestID string `json:"request_id" gorm:"type:varchar(64);index"`
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
}

type imageTaskLogImage struct {
	URL           string `json:"url"`
	RevisedPrompt string `json:"revised_prompt,omitempty"`
}

type imageTaskLogResult struct {
	PublicBase string              `json:"public_base,omitempty"`
	Images     []imageTaskLogImage `json:"images"`
	Count      int                 `json:"count"`
}

type imageTaskLogTiming struct {
	SubmittedAt int64 `json:"submitted_at"`
	CompletedAt int64 `json:"completed_at"`
	TotalMS     int64 `json:"total_ms"`
}

type imageTaskLogInfo struct {
	Version int                  `json:"version"`
	Kind    string               `json:"kind"`
	Status  TaskStatus           `json:"status"`
	Request *imageTaskLogRequest `json:"request,omitempty"`
	Result  *imageTaskLogResult  `json:"result,omitempty"`
	Timing  imageTaskLogTiming   `json:"timing"`
}

type imageTaskLogRequest struct {
	Operation         string `json:"operation"`
	Prompt            string `json:"prompt,omitempty"`
	Size              string `json:"size,omitempty"`
	Quality           string `json:"quality,omitempty"`
	N                 int    `json:"n,omitempty"`
	OutputFormat      string `json:"output_format,omitempty"`
	AspectRatio       string `json:"aspect_ratio,omitempty"`
	Resolution        string `json:"resolution,omitempty"`
	Style             string `json:"style,omitempty"`
	InputImageCount   int    `json:"input_image_count"`
	HasMask           bool   `json:"has_mask"`
	WebhookConfigured bool   `json:"webhook_configured"`
}

func imageTaskBillingLogRequestID(taskID string) string {
	// Keep the namespace separate from ordinary request IDs while hashing long
	// provider task IDs instead of truncating them into a collision.
	return NormalizeBillingAdjustmentRequestID("img-billing-" + strings.TrimSpace(taskID))
}

func imageTaskLogDuration(task *Task) (int, int64) {
	if task == nil || task.SubmitTime <= 0 || task.FinishTime <= task.SubmitTime {
		return 0, 0
	}
	durationSeconds := task.FinishTime - task.SubmitTime
	useTime := durationSeconds
	if useTime > math.MaxInt32 {
		useTime = math.MaxInt32
	}
	totalMS := int64(math.MaxInt64)
	if durationSeconds <= math.MaxInt64/1000 {
		totalMS = durationSeconds * 1000
	}
	return int(useTime), totalMS
}

func imageTaskLogRequestSnapshot(tx *gorm.DB, task *Task) (*imageTaskLogRequest, error) {
	if task == nil {
		return nil, nil
	}
	request := &imageTaskLogRequest{Operation: "generation", N: 1}
	if billing := task.PrivateData.BillingContext; billing != nil {
		input, err := billing.ResolveBillingRequestInput()
		if err == nil && input != nil && len(input.Body) > 0 {
			fields := imageTaskLogRequestFields(input.Body)
			request.Prompt = imageTaskLogString(fields["prompt"])
			request.Size = imageTaskLogString(fields["size"])
			request.Quality = imageTaskLogString(fields["quality"])
			request.OutputFormat = imageTaskLogString(fields["output_format"])
			request.AspectRatio = imageTaskLogString(fields["aspect_ratio"])
			request.Resolution = imageTaskLogString(fields["resolution"])
			request.Style = imageTaskLogString(fields["style"])
			if n := imageTaskLogInt(fields["n"]); n > 0 && n <= dto.MaxImageN {
				request.N = n
			}
			request.InputImageCount = imageTaskLogInputCount(fields)
			request.HasMask = imageTaskLogHasValue(fields["mask"])
			if request.InputImageCount > 0 || request.HasMask {
				request.Operation = "edit"
			}
		}
	}
	if tx != nil {
		var webhookCount int64
		if err := tx.Model(&TaskWebhook{}).Where("task_id = ?", task.TaskID).Count(&webhookCount).Error; err != nil {
			return nil, err
		}
		request.WebhookConfigured = webhookCount > 0
	}
	return request, nil
}

func imageTaskLogRequestFields(body []byte) map[string]json.RawMessage {
	fields := map[string]json.RawMessage{}
	if common.Unmarshal(body, &fields) != nil {
		return fields
	}
	rawInput, ok := fields["input"]
	if !ok || common.GetJsonType(rawInput) != "object" {
		return fields
	}
	input := map[string]json.RawMessage{}
	if common.Unmarshal(rawInput, &input) != nil {
		return fields
	}
	for key, value := range input {
		if _, exists := fields[key]; !exists {
			fields[key] = value
		}
	}
	return fields
}

func imageTaskLogString(raw json.RawMessage) string {
	if len(raw) == 0 || common.GetJsonType(raw) == "null" {
		return ""
	}
	var value string
	if common.Unmarshal(raw, &value) != nil {
		return ""
	}
	return value
}

func imageTaskLogInt(raw json.RawMessage) int {
	if len(raw) == 0 || common.GetJsonType(raw) == "null" {
		return 0
	}
	var value int
	if common.Unmarshal(raw, &value) != nil {
		return 0
	}
	return value
}

func imageTaskLogHasValue(raw json.RawMessage) bool {
	if len(raw) == 0 || common.GetJsonType(raw) == "null" {
		return false
	}
	if common.GetJsonType(raw) != "string" {
		return true
	}
	return strings.TrimSpace(imageTaskLogString(raw)) != ""
}

func imageTaskLogInputCount(fields map[string]json.RawMessage) int {
	count := 0
	for _, field := range []string{"images", "image_input", "input_urls", "image"} {
		raw := fields[field]
		if len(raw) == 0 || common.GetJsonType(raw) == "null" {
			continue
		}
		candidate := 1
		if common.GetJsonType(raw) == "array" {
			var values []json.RawMessage
			if common.Unmarshal(raw, &values) != nil {
				continue
			}
			candidate = len(values)
		}
		if candidate > count {
			count = candidate
		}
	}
	return count
}

func imageTaskLogPublicBase() *url.URL {
	rawBase := strings.TrimSpace(common.GetEnvOrDefaultString("CLOUDFLARE_R2_PUBLIC_BASE", ""))
	if rawBase == "" {
		return nil
	}
	parsed, err := url.Parse(rawBase)
	if err != nil ||
		parsed.Host == "" ||
		parsed.User != nil ||
		parsed.RawQuery != "" ||
		parsed.Fragment != "" ||
		(parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil
	}
	return parsed
}

func imageTaskLogURLMatchesPublicBase(candidate, publicBase *url.URL) bool {
	if publicBase == nil {
		return false
	}
	if !strings.EqualFold(candidate.Scheme, publicBase.Scheme) ||
		!strings.EqualFold(candidate.Hostname(), publicBase.Hostname()) ||
		candidate.Port() != publicBase.Port() {
		return false
	}
	basePath := strings.TrimRight(publicBase.EscapedPath(), "/")
	if basePath == "" || basePath == "/" {
		return true
	}
	candidatePath := candidate.EscapedPath()
	return candidatePath == basePath || strings.HasPrefix(candidatePath, basePath+"/")
}

func imageTaskLogResultSnapshot(task *Task, images []dto.ImageData) *imageTaskLogResult {
	if task == nil || task.Status != TaskStatusSuccess {
		return nil
	}
	publicBase := imageTaskLogPublicBase()
	result := &imageTaskLogResult{Images: make([]imageTaskLogImage, 0, len(images))}
	if publicBase != nil {
		result.PublicBase = strings.TrimRight(publicBase.String(), "/")
	}
	seen := make(map[string]struct{}, len(images)+1)
	appendImage := func(rawURL, revisedPrompt string) {
		value := strings.TrimSpace(rawURL)
		parsed, err := url.Parse(value)
		if err != nil ||
			parsed.Host == "" ||
			parsed.User != nil ||
			parsed.RawQuery != "" ||
			parsed.Fragment != "" ||
			(parsed.Scheme != "http" && parsed.Scheme != "https") {
			return
		}
		if !imageTaskLogURLMatchesPublicBase(parsed, publicBase) {
			return
		}
		if _, exists := seen[value]; exists {
			return
		}
		seen[value] = struct{}{}
		result.Images = append(result.Images, imageTaskLogImage{URL: value, RevisedPrompt: revisedPrompt})
	}
	for _, image := range images {
		appendImage(image.Url, image.RevisedPrompt)
	}
	if len(result.Images) == 0 {
		appendImage(task.PrivateData.ResultURL, "")
	}
	result.Count = len(images)
	if result.Count == 0 && len(result.Images) > 0 {
		result.Count = 1
	}
	return result
}

func enqueueImageTaskBillingLogTx(tx *gorm.DB, task *Task, previousQuota int, reason string) error {
	if tx == nil || task == nil || task.TaskID == "" {
		return errors.New("image task billing outbox requires a task")
	}
	if task.Status != TaskStatusSuccess && task.Status != TaskStatusFailure {
		return errors.New("image task billing outbox requires a terminal task")
	}
	if previousQuota < 0 || previousQuota > common.MaxQuota || task.Quota < 0 || task.Quota > common.MaxQuota {
		return fmt.Errorf("image task %s billing outbox quota is out of range", task.TaskID)
	}

	logType := LogTypeConsume
	logQuota := task.Quota
	if task.Status == TaskStatusFailure {
		if previousQuota > 0 {
			logType = LogTypeRefund
			logQuota = previousQuota
		} else {
			logType = LogTypeError
			logQuota = 0
		}
	}
	if reason == "" {
		reason = "async image usage reconciliation"
	}
	requestSnapshot, err := imageTaskLogRequestSnapshot(tx, task)
	if err != nil {
		return fmt.Errorf("snapshot image task request: %w", err)
	}
	useTime, totalMS := imageTaskLogDuration(task)
	var response struct {
		Data  []dto.ImageData `json:"data"`
		Usage *dto.Usage      `json:"usage"`
	}
	if task.Status == TaskStatusSuccess && len(task.Data) > 0 {
		_ = common.Unmarshal(task.Data, &response)
	}
	other := map[string]interface{}{
		"task_id":            task.TaskID,
		"pre_consumed_quota": previousQuota,
		"actual_quota":       task.Quota,
		"task_info": imageTaskLogInfo{
			Version: 1,
			Kind:    "image_generation",
			Status:  task.Status,
			Request: requestSnapshot,
			Result:  imageTaskLogResultSnapshot(task, response.Data),
			Timing: imageTaskLogTiming{
				SubmittedAt: task.SubmitTime,
				CompletedAt: task.FinishTime,
				TotalMS:     totalMS,
			},
		},
	}
	if task.Status == TaskStatusFailure && task.FailReason != "" {
		other["reason"] = task.FailReason
	} else if reason != "" {
		other["reason"] = reason
	}
	if billing := task.PrivateData.BillingContext; billing != nil {
		other["model_price"] = billing.ModelPrice
		if billing.ModelRatio > 0 {
			other["model_ratio"] = billing.ModelRatio
		}
		other["group_ratio"] = billing.GroupRatio
		for key, value := range billing.OtherRatios {
			other[key] = value
		}
		if billing.OriginModelName != "" {
			other["origin_model_name"] = billing.OriginModelName
		}
	}
	if task.PrivateData.BillingSource != "" {
		other["billing_source"] = task.PrivateData.BillingSource
	}
	if task.PrivateData.FinalQuotaClamp != nil {
		other["admin_info"] = map[string]interface{}{
			"quota_saturation": task.PrivateData.FinalQuotaClamp.AuditMap(),
		}
	}

	promptTokens, completionTokens := 0, 0
	if response.Usage != nil {
		promptTokens = response.Usage.PromptTokens
		completionTokens = response.Usage.CompletionTokens
		if response.Usage.PromptTokensDetails.ImageTokens != 0 {
			other["image_input_tokens"] = response.Usage.PromptTokensDetails.ImageTokens
		}
		if response.Usage.CompletionTokenDetails.ImageTokens != 0 {
			other["image_output_tokens"] = response.Usage.CompletionTokenDetails.ImageTokens
		}
		other["input_tokens"] = promptTokens
		other["output_tokens"] = completionTokens
	}
	modelName := task.Properties.OriginModelName
	if task.PrivateData.BillingContext != nil && task.PrivateData.BillingContext.OriginModelName != "" {
		modelName = task.PrivateData.BillingContext.OriginModelName
	}
	otherJSON := common.MapToJsonStr(other)
	now := common.GetTimestamp()
	outbox := &ImageTaskBillingLogOutbox{
		TaskID:           task.TaskID,
		RequestID:        imageTaskBillingLogRequestID(task.TaskID),
		UserID:           task.UserId,
		LogType:          logType,
		Content:          reason,
		ChannelID:        task.ChannelId,
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		ModelName:        modelName,
		Quota:            logQuota,
		UseTime:          useTime,
		TokenID:          task.PrivateData.TokenId,
		Group:            task.Group,
		NodeName:         task.PrivateData.NodeName,
		Other:            otherJSON,
		Status:           imageTaskBillingLogPending,
		NextAttemptAt:    now,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	return tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "task_id"}}, DoNothing: true}).Create(outbox).Error
}

func HasDueImageTaskBillingLogOutbox(now int64) bool {
	if now <= 0 {
		now = common.GetTimestamp()
	}
	var id int64
	err := DB.Model(&ImageTaskBillingLogOutbox{}).
		Where("status <> ? AND next_attempt_at <= ? AND (lease_until = 0 OR lease_until < ?)", imageTaskBillingLogDelivered, now, now).
		Limit(1).Pluck("id", &id).Error
	return err == nil && id != 0
}

func claimImageTaskBillingLogOutbox(taskID string, now int64) (*ImageTaskBillingLogOutbox, bool, error) {
	if now <= 0 {
		now = common.GetTimestamp()
	}
	var outbox ImageTaskBillingLogOutbox
	if err := DB.Where("task_id = ?", taskID).First(&outbox).Error; err != nil {
		return nil, false, err
	}
	if outbox.Status == imageTaskBillingLogDelivered {
		return &outbox, false, nil
	}
	leaseUntil := now + imageTaskBillingLogLease
	leaseToken := common.GetUUID()
	result := DB.Model(&ImageTaskBillingLogOutbox{}).
		Where("id = ? AND status <> ? AND next_attempt_at <= ? AND (lease_until = 0 OR lease_until < ?)", outbox.ID, imageTaskBillingLogDelivered, now, now).
		Updates(map[string]any{
			"status":      imageTaskBillingLogDelivering,
			"lease_token": leaseToken,
			"lease_until": leaseUntil,
			"updated_at":  now,
		})
	if result.Error != nil {
		return nil, false, result.Error
	}
	if result.RowsAffected != 1 {
		return &outbox, false, nil
	}
	outbox.Status = imageTaskBillingLogDelivering
	outbox.LeaseToken = leaseToken
	outbox.LeaseUntil = leaseUntil
	return &outbox, true, nil
}

func markImageTaskBillingLogOutboxRetry(outbox *ImageTaskBillingLogOutbox, err error) error {
	if outbox == nil || outbox.ID == 0 || outbox.LeaseToken == "" {
		return errors.New("claimed image task billing outbox is required")
	}
	attempts := outbox.Attempts + 1
	delay := 15 * time.Second * time.Duration(1<<minInt(attempts, 6))
	message := "billing log delivery failed"
	if err != nil {
		message = common.MaskSensitiveInfo(err.Error())
	}
	if len(message) > 2000 {
		message = message[:2000]
	}
	now := common.GetTimestamp()
	result := DB.Model(&ImageTaskBillingLogOutbox{}).
		Where("id = ? AND status = ? AND lease_token = ?", outbox.ID, imageTaskBillingLogDelivering, outbox.LeaseToken).
		Updates(map[string]any{
			"status":          imageTaskBillingLogPending,
			"attempts":        attempts,
			"next_attempt_at": now + int64(delay/time.Second),
			"lease_token":     "",
			"lease_until":     0,
			"last_error":      message,
			"updated_at":      now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func markImageTaskBillingLogOutboxDelivered(outbox *ImageTaskBillingLogOutbox) error {
	if outbox == nil || outbox.ID == 0 || outbox.LeaseToken == "" {
		return errors.New("claimed image task billing outbox is required")
	}
	now := common.GetTimestamp()
	result := DB.Model(&ImageTaskBillingLogOutbox{}).
		Where("id = ? AND status = ? AND lease_token = ?", outbox.ID, imageTaskBillingLogDelivering, outbox.LeaseToken).
		Updates(map[string]any{
			"status":       imageTaskBillingLogDelivered,
			"lease_token":  "",
			"lease_until":  0,
			"delivered_at": now,
			"updated_at":   now,
			"content":      "",
			"other":        "",
			"last_error":   "",
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func deliverImageTaskBillingLog(outbox *ImageTaskBillingLogOutbox) (bool, error) {
	if outbox == nil {
		return false, errors.New("image task billing outbox is required")
	}
	if LOG_DB == nil {
		return false, errors.New("log database is unavailable")
	}
	if outbox.LogType == LogTypeConsume && !common.LogConsumeEnabled {
		return true, nil
	}
	username, _ := GetUsernameById(outbox.UserID, false)
	tokenName := outbox.TokenName
	if tokenName == "" && outbox.TokenID > 0 {
		if token, err := GetTokenById(outbox.TokenID); err == nil {
			tokenName = token.Name
		}
	}
	if common.UsingLogDatabase(common.DatabaseTypeClickHouse) {
		var existing Log
		if err := LOG_DB.Where("request_id = ?", outbox.RequestID).First(&existing).Error; err == nil {
			return true, nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return false, err
		}
		log := &Log{
			UserId:           outbox.UserID,
			Username:         username,
			CreatedAt:        outbox.CreatedAt,
			Type:             outbox.LogType,
			Content:          outbox.Content,
			PromptTokens:     outbox.PromptTokens,
			CompletionTokens: outbox.CompletionTokens,
			TokenName:        tokenName,
			ModelName:        outbox.ModelName,
			Quota:            outbox.Quota,
			UseTime:          outbox.UseTime,
			ChannelId:        outbox.ChannelID,
			TokenId:          outbox.TokenID,
			Group:            outbox.Group,
			Other:            outbox.Other,
			RequestId:        outbox.RequestID,
		}
		if err := LOG_DB.Create(log).Error; err != nil {
			return false, err
		}
		if outbox.LogType == LogTypeConsume && common.DataExportEnabled {
			LogQuotaData(QuotaDataLogParams{
				UserID: outbox.UserID, Username: username, ModelName: outbox.ModelName,
				Quota: outbox.Quota, CreatedAt: outbox.CreatedAt,
				TokenUsed: outbox.PromptTokens + outbox.CompletionTokens,
				UseGroup:  outbox.Group, TokenID: outbox.TokenID, ChannelID: outbox.ChannelID,
				NodeName: outbox.NodeName,
			})
		}
		return true, nil
	}
	created := false
	write := func(tx *gorm.DB) error {
		var receipt ImageTaskBillingLogReceipt
		err := tx.Where("task_id = ?", outbox.TaskID).First(&receipt).Error
		if err == nil {
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		// The receipt and log are committed together in SQL log databases. The
		// request-id lookup is a compatibility guard for deployments upgraded
		// before the receipt table existed.
		var existing Log
		if err := tx.Where("request_id = ?", outbox.RequestID).First(&existing).Error; err == nil {
			return tx.Create(&ImageTaskBillingLogReceipt{TaskID: outbox.TaskID, RequestID: outbox.RequestID, CreatedAt: common.GetTimestamp()}).Error
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		log := &Log{
			UserId:           outbox.UserID,
			Username:         username,
			CreatedAt:        outbox.CreatedAt,
			Type:             outbox.LogType,
			Content:          outbox.Content,
			PromptTokens:     outbox.PromptTokens,
			CompletionTokens: outbox.CompletionTokens,
			TokenName:        tokenName,
			ModelName:        outbox.ModelName,
			Quota:            outbox.Quota,
			UseTime:          outbox.UseTime,
			ChannelId:        outbox.ChannelID,
			TokenId:          outbox.TokenID,
			Group:            outbox.Group,
			Other:            outbox.Other,
			RequestId:        outbox.RequestID,
		}
		if err := tx.Create(log).Error; err != nil {
			return err
		}
		created = true
		return tx.Create(&ImageTaskBillingLogReceipt{TaskID: outbox.TaskID, RequestID: outbox.RequestID, CreatedAt: common.GetTimestamp()}).Error
	}
	var err error
	err = LOG_DB.Transaction(write)
	if err != nil {
		return false, err
	}
	if created && outbox.LogType == LogTypeConsume && common.DataExportEnabled {
		LogQuotaData(QuotaDataLogParams{
			UserID:    outbox.UserID,
			Username:  username,
			ModelName: outbox.ModelName,
			Quota:     outbox.Quota,
			CreatedAt: outbox.CreatedAt,
			TokenUsed: outbox.PromptTokens + outbox.CompletionTokens,
			UseGroup:  outbox.Group,
			TokenID:   outbox.TokenID,
			ChannelID: outbox.ChannelID,
			NodeName:  outbox.NodeName,
		})
	}
	return true, nil
}

// DeliverImageTaskBillingLogOutbox attempts one task's durable billing log.
// A delivery error leaves the row pending for the system task retry loop.
func DeliverImageTaskBillingLogOutbox(taskID string) error {
	outbox, claimed, err := claimImageTaskBillingLogOutbox(taskID, common.GetTimestamp())
	if err != nil || !claimed {
		return err
	}
	if _, err := deliverImageTaskBillingLog(outbox); err != nil {
		_ = markImageTaskBillingLogOutboxRetry(outbox, err)
		return err
	}
	return markImageTaskBillingLogOutboxDelivered(outbox)
}

// DrainDueImageTaskBillingLogOutbox is intentionally best-effort per row: one
// unavailable log database must not prevent other completed image tasks from
// being delivered.
func DrainDueImageTaskBillingLogOutbox(limit int) (delivered int, retried int, firstErr error) {
	if limit <= 0 {
		limit = 100
	}
	now := common.GetTimestamp()
	var rows []ImageTaskBillingLogOutbox
	if err := DB.Where("status <> ? AND next_attempt_at <= ? AND (lease_until = 0 OR lease_until < ?)", imageTaskBillingLogDelivered, now, now).
		Order("id asc").Limit(limit).Find(&rows).Error; err != nil {
		return 0, 0, err
	}
	for i := range rows {
		if err := DeliverImageTaskBillingLogOutbox(rows[i].TaskID); err != nil {
			retried++
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		delivered++
	}
	return delivered, retried, firstErr
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// CompensatePermanentImageTaskFinalization refunds the active reservation and
// atomically moves an unapplied finalization to FAILURE. It refuses tasks
// whose durable billing phase already committed: those must remain
// FINALIZING for reconciliation rather than risking a double refund.
func CompensatePermanentImageTaskFinalization(taskID string, reason string) (*ImageTaskFinalizationResult, error) {
	if strings.TrimSpace(taskID) == "" {
		return nil, errors.New("image task id is required")
	}
	if len(reason) > 2000 {
		reason = reason[:2000]
	}

	var identity Task
	if err := DB.Select("user_id", "status", "private_data").
		Where("task_id = ? AND platform = ?", taskID, constant.TaskPlatformOpenAIImage).
		First(&identity).Error; err != nil {
		return nil, err
	}
	lockedUserID := identity.UserId
	lockedTokenID := identity.PrivateData.TokenId
	if identity.Status == TaskStatusFinalizing && !identity.PrivateData.BillingDBApplied {
		var reservationIdentity ImageBillingReservation
		if err := DB.Select("user_id", "token_id").Where("task_id = ?", taskID).First(&reservationIdentity).Error; err != nil {
			return nil, fmt.Errorf("load active image billing reservation: %w", err)
		}
		if reservationIdentity.UserID != identity.UserId {
			return nil, fmt.Errorf("image task %s billing reservation user mismatch", taskID)
		}
		lockedUserID = reservationIdentity.UserID
		lockedTokenID = reservationIdentity.TokenID
	}
	lockedTokenKey := ""
	if lockedTokenID > 0 {
		var token Token
		tokenQuery := DB.Unscoped().Select(commonKeyCol).Where("id = ?", lockedTokenID).First(&token)
		if tokenQuery.Error != nil && !errors.Is(tokenQuery.Error, gorm.ErrRecordNotFound) {
			return nil, tokenQuery.Error
		}
		if tokenQuery.Error == nil {
			lockedTokenKey = token.Key
		}
	}

	var result ImageTaskFinalizationResult
	var walletRefunded, tokenRefunded int
	var cacheOutboxes []*BillingAdjustmentOutbox
	var refundedReservation *ImageBillingReservation
	compensate := func() error {
		err := DB.Transaction(func(tx *gorm.DB) error {
			var task Task
			if err := lockForUpdate(tx).Where("task_id = ? AND platform = ?", taskID, constant.TaskPlatformOpenAIImage).First(&task).Error; err != nil {
				return err
			}
			if task.Status == TaskStatusSuccess || task.Status == TaskStatusFailure {
				if err := scheduleImageInputCleanupTx(tx, task.TaskID, common.GetTimestamp()); err != nil {
					return err
				}
				result.Task = &task
				result.PreviousQuota = task.Quota
				result.ActualQuota = task.Quota
				return nil
			}
			if task.Status != TaskStatusFinalizing {
				return fmt.Errorf("image task %s is not finalizing", taskID)
			}
			if task.PrivateData.BillingDBApplied {
				return fmt.Errorf("image task %s billing database phase is already applied", taskID)
			}
			var reservation ImageBillingReservation
			if err := lockForUpdate(tx).Where("task_id = ?", taskID).First(&reservation).Error; err != nil {
				return fmt.Errorf("load active image billing reservation: %w", err)
			}
			if reservation.Status != ImageBillingReservationActive {
				return fmt.Errorf("image task %s has no active billing reservation", taskID)
			}
			if reservation.UserID != task.UserId {
				return fmt.Errorf("image task %s billing reservation user mismatch", taskID)
			}
			if reservation.UserID != lockedUserID || reservation.TokenID != lockedTokenID {
				return fmt.Errorf("image task %s billing reservation cache identity changed", taskID)
			}
			if reservation.WalletReserved < 0 || reservation.WalletReserved > common.MaxQuota ||
				reservation.TokenReserved < 0 || reservation.TokenReserved > common.MaxQuota {
				return fmt.Errorf("image task %s billing reservation quota is out of range", taskID)
			}
			if err := normalizeImageReservationQuotaModeTx(tx, &reservation); err != nil {
				return fmt.Errorf("normalize image task %s billing reservation: %w", taskID, err)
			}
			if reservation.TokenReserved > 0 && lockedTokenKey == "" {
				return fmt.Errorf("image task %s billing token cache identity is unavailable", taskID)
			}
			if lockedTokenID > 0 {
				var token Token
				tokenQuery := tx.Unscoped().Select(commonKeyCol).Where("id = ?", lockedTokenID).First(&token)
				if tokenQuery.Error != nil && !errors.Is(tokenQuery.Error, gorm.ErrRecordNotFound) {
					return tokenQuery.Error
				}
				if tokenQuery.Error == nil && token.Key != lockedTokenKey {
					return fmt.Errorf("image task %s billing token cache identity changed", taskID)
				}
			}
			if err := rollbackPreparedImageTaskCache(
				taskID,
				lockedUserID,
				lockedTokenKey,
				reservation.WalletLegacyDebit,
				reservation.TokenLegacyDebit,
			); err != nil {
				return fmt.Errorf("rollback permanent image task cache: %w", err)
			}
			previousQuota := task.Quota
			if previousQuota < 0 || previousQuota > common.MaxQuota {
				return fmt.Errorf("image task %s pre-consumed quota is out of range", taskID)
			}
			if reservation.SubscriptionReserved > 0 {
				if reservation.RequestID == "" || refundSubscriptionPreConsumeTx(tx, reservation.RequestID) != nil {
					return errors.New("refund image subscription reservation failed")
				}
			}
			if reservation.WalletReserved > 0 {
				if err := refundImageTaskWalletQuotaBalanceTx(
					tx,
					reservation.UserID,
					reservation.WalletReserved,
					reservation.WalletLegacyDebit,
					reservation.QuotaModeVersion,
				); err != nil {
					return errors.New("refund image wallet reservation failed")
				}
				walletRefunded = reservation.WalletReserved
			}
			if reservation.TokenReserved > 0 {
				if err := refundImageTaskTokenQuotaBalanceTx(
					tx,
					reservation.TokenID,
					reservation.TokenReserved,
					reservation.TokenLegacyDebit,
					reservation.QuotaModeVersion,
				); err != nil {
					return errors.New("refund image token reservation failed")
				}
				tokenRefunded = reservation.TokenReserved
			}
			cacheReconciliationPending := reservation.CacheReconciledAt == 0
			if walletRefunded > 0 && !cacheReconciliationPending {
				outbox, err := EnqueueBillingAdjustmentTx(tx, BillingAdjustmentSpec{
					RequestID: "image-compensation:" + taskID,
					Phase:     BillingAdjustmentPhaseImageCompensation,
					Leg:       BillingAdjustmentLegWallet,
					UserID:    reservation.UserID,
					Delta:     int64(walletRefunded),
				}, true)
				if err != nil {
					return err
				}
				cacheOutboxes = append(cacheOutboxes, outbox)
			}
			if tokenRefunded > 0 && !cacheReconciliationPending {
				outbox, err := EnqueueBillingAdjustmentTx(tx, BillingAdjustmentSpec{
					RequestID: "image-compensation:" + taskID,
					Phase:     BillingAdjustmentPhaseImageCompensation,
					Leg:       BillingAdjustmentLegToken,
					UserID:    reservation.UserID,
					TokenID:   reservation.TokenID,
					Delta:     int64(tokenRefunded),
				}, true)
				if err != nil {
					return err
				}
				cacheOutboxes = append(cacheOutboxes, outbox)
			}
			now := common.GetTimestamp()
			if err := tx.Model(&ImageBillingReservation{}).Where("id = ? AND status = ?", reservation.ID, ImageBillingReservationActive).
				Updates(map[string]any{
					"status":                ImageBillingReservationRefunded,
					"wallet_reserved":       0,
					"wallet_legacy_debit":   reservation.WalletLegacyDebit,
					"token_reserved":        0,
					"token_legacy_debit":    reservation.TokenLegacyDebit,
					"quota_mode_version":    imageBillingReservationQuotaModeVersion,
					"subscription_reserved": 0,
					"failure_reason":        reason,
					"updated_at":            now,
				}).Error; err != nil {
				return err
			}
			if cacheReconciliationPending {
				reservation.Status = ImageBillingReservationRefunded
				reservation.WalletReserved = 0
				reservation.TokenReserved = 0
				reservation.SubscriptionReserved = 0
				reservation.QuotaModeVersion = imageBillingReservationQuotaModeVersion
				reservation.FailureReason = reason
				reservation.UpdatedAt = now
				refunded := reservation
				refundedReservation = &refunded
			}
			task.Status = TaskStatusFailure
			task.Quota = 0
			task.Progress = "100%"
			task.FinishTime = now
			task.UpdatedAt = now
			task.FailReason = reason
			task.Data = nil
			task.CheckpointData = nil
			task.PrivateData.ResultURL = ""
			task.PrivateData.BillingFinalStatus = ""
			task.PrivateData.BillingActualQuota = 0
			task.PrivateData.BillingDBApplied = false
			task.FinalizeAttempts = 0
			task.FinalizeNextRetryAt = 0
			task.FinalizeError = ""
			if err := deleteImageTaskArtifactTx(tx, task.TaskID); err != nil {
				return err
			}
			if err := scheduleImageInputCleanupTx(tx, task.TaskID, now); err != nil {
				return err
			}
			if err := enqueueImageTaskBillingLogTx(tx, &task, previousQuota, reason); err != nil {
				return err
			}
			if task.PrivateData.BillingContext != nil {
				task.PrivateData.BillingContext.ClearBillingRequestInput()
			}
			update := tx.Model(&Task{}).Where("id = ? AND status = ?", task.ID, TaskStatusFinalizing).
				Select("status", "quota", "progress", "finish_time", "updated_at", "fail_reason", "data", "checkpoint_data", "private_data", "finalize_attempts", "finalize_next_retry_at", "finalize_error").Updates(&task)
			if update.Error != nil {
				return update.Error
			}
			if update.RowsAffected != 1 {
				return errors.New("image task permanent compensation lost its state lock")
			}
			result.Task = &task
			result.PreviousQuota = previousQuota
			result.ActualQuota = 0
			result.Delta = -previousQuota
			result.Applied = true
			return nil
		})
		if err != nil {
			return err
		}
		if refundedReservation != nil {
			if err := reconcileRefundedImageBillingReservationCache(refundedReservation, lockedTokenKey); err != nil {
				common.SysLog(fmt.Sprintf("image compensation reservation cache reconciliation queued: task_id=%s err=%v", taskID, err))
			}
		}
		for _, outbox := range cacheOutboxes {
			if err := applyBillingAdjustmentCache(outbox, lockedTokenKey); err != nil {
				common.SysLog(fmt.Sprintf("image compensation cache reconciliation queued: task_id=%s outbox_id=%d err=%v", taskID, outbox.Id, err))
				continue
			}
			if err := markBillingAdjustmentCacheReconciled(outbox); err != nil {
				common.SysLog(fmt.Sprintf("image compensation cache reconciliation ack queued: task_id=%s outbox_id=%d err=%v", taskID, outbox.Id, err))
			}
		}
		return nil
	}
	err := withImageTaskQuotaCacheLocks(lockedUserID, lockedTokenKey, compensate)
	if err != nil {
		return nil, err
	}
	return &result, nil
}
