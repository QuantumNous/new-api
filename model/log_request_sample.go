package model

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const logRequestSampleRedactionVersion = "v1"
const maxLogRequestSampleParamsBytes = 60 * 1024
const maxLogRequestSamplePreviewBytes = 16 * 1024
const redactedValue = "[redacted]"
const droppedValue = "[dropped]"
const truncatedSuffix = "...[truncated]"
const maxDepthValue = "[max_depth_exceeded]"

const logRequestSampleAsyncQueueSize = 1024
const logRequestSampleAsyncWorkers = 2
const logRequestSampleInsertTimeout = 2 * time.Second
const maxLogRequestSampleQueryPageSize = 100

// TODO(product): define a retention or manual deletion policy for request
// samples. They are intentionally not deleted by DeleteOldLog today.
type LogRequestSample struct {
	Id               int     `json:"id"`
	LogId            int     `json:"log_id" gorm:"uniqueIndex;not null"`
	RequestId        string  `json:"request_id" gorm:"type:varchar(64);index;default:''"`
	UserId           int     `json:"user_id" gorm:"index"`
	CreatedAt        int64   `json:"created_at" gorm:"bigint;index"`
	ModelName        string  `json:"model_name" gorm:"index;default:''"`
	TokenId          int     `json:"token_id" gorm:"default:0;index"`
	UserGroup        string  `json:"user_group" gorm:"index;default:''"`
	RequestPath      string  `json:"request_path" gorm:"type:varchar(255);default:''"`
	RequestParams    string  `json:"request_params" gorm:"type:text"`
	RequestBodySize  int64   `json:"request_body_size" gorm:"default:0"`
	SampleRate       float64 `json:"sample_rate" gorm:"default:0"`
	RedactionVersion string  `json:"redaction_version" gorm:"type:varchar(32);default:''"`
}

type LogRequestSampleQuery struct {
	LogId          int
	UserId         int
	TokenId        int
	StartTimestamp int64
	EndTimestamp   int64
	ModelName      string
	UserGroup      string
	RequestPath    string
	RequestId      string
}

var logRequestSampleRandomFloat = func() float64 {
	return rand.Float64()
}

var logRequestSampleAsyncQueue = make(chan func(), logRequestSampleAsyncQueueSize)
var logRequestSampleAsyncOnce sync.Once
var logRequestSampleAsyncRunner = enqueueLogRequestSampleAsync

var credentialLikePattern = regexp.MustCompile(`(?i)\b(sk-[a-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|AKIA[0-9A-Z]{16}|bearer\s+[a-z0-9._~+/=-]{12,}|eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+|(?:api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|secret|password|authorization|bearer)\s*[:=]\s*["']?[^"'\s,}]+)`)
var urlLikePattern = regexp.MustCompile(`https?://[^\s"'<>{}\\]+`)

func enqueueLogRequestSampleAsync(fn func()) {
	logRequestSampleAsyncOnce.Do(startLogRequestSampleAsyncWorkers)
	select {
	case logRequestSampleAsyncQueue <- fn:
	default:
		common.SysError("log request sample async queue full; dropping sample")
	}
}

func startLogRequestSampleAsyncWorkers() {
	for i := 0; i < logRequestSampleAsyncWorkers; i++ {
		gopool.Go(func() {
			for fn := range logRequestSampleAsyncQueue {
				func() {
					defer func() {
						if r := recover(); r != nil {
							common.SysError(fmt.Sprintf("log request sample async worker panic: %v", r))
						}
					}()
					fn()
				}()
			}
		})
	}
}

func maybeRecordLogRequestSample(c *gin.Context, userId int, params RecordConsumeLogParams, log *Log) {
	snapshot := operation_setting.GetLogRequestSamplingRuntimeSnapshot()
	if !snapshot.Enabled() {
		return
	}
	if c == nil || c.Request == nil || log == nil || log.Id <= 0 {
		return
	}
	if LOG_DB == nil {
		return
	}
	if !common.GetContextKeyBool(c, constant.ContextKeyRequestSamplingEligible) {
		return
	}
	if params.Other != nil {
		if violationFee, ok := params.Other["violation_fee"].(bool); ok && violationFee {
			return
		}
	}
	sampleGroup := params.Group
	if sampleGroup == "" {
		sampleGroup = common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
	}
	if sampleGroup == "" {
		sampleGroup = common.GetContextKeyString(c, constant.ContextKeyUserGroup)
	}
	if sampleGroup == "" || !snapshot.GroupEnabled(sampleGroup) {
		return
	}
	requestPath := c.Request.URL.Path
	if !snapshot.IsEligiblePath(requestPath) {
		return
	}
	if isGeminiRequestSamplePath(requestPath) && !isGeminiTextRequestSamplePath(requestPath) {
		return
	}
	if snapshot.SampleRate() <= 0 || logRequestSampleRandomFloat() >= snapshot.SampleRate() {
		return
	}
	if contentType := c.GetHeader("Content-Type"); contentType != "" && !strings.Contains(strings.ToLower(contentType), "application/json") {
		return
	}

	storage, err := common.GetBodyStorage(c)
	if err != nil {
		logger.LogError(c, "failed to get request body storage for sampling: "+err.Error())
		return
	}
	if storage.Size() <= 0 || storage.Size() > snapshot.MaxBodyBytes() {
		_, _ = storage.Seek(0, io.SeekStart)
		return
	}
	body, err := storage.Bytes()
	if err != nil {
		logger.LogError(c, "failed to read request body for sampling: "+err.Error())
		_, _ = storage.Seek(0, io.SeekStart)
		return
	}
	_, _ = storage.Seek(0, io.SeekStart)

	paramsJSON, err := sanitizeLogRequestSampleBody(body, snapshot)
	if err != nil {
		return
	}
	sample := LogRequestSample{
		LogId:            log.Id,
		RequestId:        log.RequestId,
		UserId:           userId,
		CreatedAt:        log.CreatedAt,
		ModelName:        params.ModelName,
		TokenId:          params.TokenId,
		UserGroup:        sampleGroup,
		RequestPath:      requestPath,
		RequestParams:    paramsJSON,
		RequestBodySize:  storage.Size(),
		SampleRate:       snapshot.SampleRate(),
		RedactionVersion: logRequestSampleRedactionVersion,
	}
	logRequestSampleAsyncRunner(func() {
		ctx, cancel := context.WithTimeout(context.Background(), logRequestSampleInsertTimeout)
		defer cancel()
		if err := insertLogRequestSample(ctx, sample); err != nil {
			common.SysError("failed to insert log request sample: " + err.Error())
		}
	})
}

func insertLogRequestSample(ctx context.Context, sample LogRequestSample) error {
	if LOG_DB == nil {
		return nil
	}
	return LOG_DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var log Log
		query := tx.Select("id").Where("id = ?", sample.LogId)
		if !isLogDBSQLite() {
			query = query.Clauses(clause.Locking{Strength: "UPDATE"})
		}
		if err := query.First(&log).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}

		err := tx.Create(&sample).Error
		if err == nil {
			return nil
		}
		if errors.Is(err, gorm.ErrDuplicatedKey) || strings.Contains(strings.ToLower(err.Error()), "duplicate") || strings.Contains(strings.ToLower(err.Error()), "unique") {
			return nil
		}
		return err
	})
}

func isLogDBSQLite() bool {
	return common.LogSqlType == common.DatabaseTypeSQLite || (common.LogSqlType == "" && common.UsingSQLite)
}

func ListLogRequestSamples(query LogRequestSampleQuery, startIdx int, num int) ([]*LogRequestSample, int64, error) {
	if LOG_DB == nil {
		return nil, 0, nil
	}
	if startIdx < 0 {
		startIdx = 0
	}
	if num <= 0 || num > maxLogRequestSampleQueryPageSize {
		num = maxLogRequestSampleQueryPageSize
	}
	tx := LOG_DB.Model(&LogRequestSample{})
	if query.LogId != 0 {
		tx = tx.Where("log_id = ?", query.LogId)
	}
	if query.UserId != 0 {
		tx = tx.Where("user_id = ?", query.UserId)
	}
	if query.TokenId != 0 {
		tx = tx.Where("token_id = ?", query.TokenId)
	}
	if query.StartTimestamp != 0 {
		tx = tx.Where("created_at >= ?", query.StartTimestamp)
	}
	if query.EndTimestamp != 0 {
		tx = tx.Where("created_at <= ?", query.EndTimestamp)
	}
	if query.ModelName != "" {
		tx = tx.Where("model_name = ?", query.ModelName)
	}
	if query.UserGroup != "" {
		tx = tx.Where("user_group = ?", query.UserGroup)
	}
	if query.RequestPath != "" {
		tx = tx.Where("request_path = ?", query.RequestPath)
	}
	if query.RequestId != "" {
		tx = tx.Where("request_id = ?", query.RequestId)
	}

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var samples []*LogRequestSample
	err := tx.Order("created_at desc, id desc").Limit(num).Offset(startIdx).Find(&samples).Error
	if err != nil {
		return nil, 0, err
	}
	return samples, total, nil
}

func sanitizeLogRequestSampleBody(body []byte, snapshot operation_setting.LogRequestSamplingRuntimeSnapshot) (string, error) {
	var value interface{}
	if err := common.Unmarshal(body, &value); err != nil {
		return "", err
	}
	sanitized, err := sanitizeLogRequestSampleValue(value, "", 0, snapshot)
	if err != nil {
		return "", err
	}
	out, err := common.Marshal(sanitized)
	if err != nil {
		return "", err
	}
	return capLogRequestSampleParams(out)
}

func capLogRequestSampleParams(out []byte) (string, error) {
	if len(out) <= maxLogRequestSampleParamsBytes {
		return string(out), nil
	}
	preview := string(out)
	if len(preview) > maxLogRequestSamplePreviewBytes {
		preview = preview[:maxLogRequestSamplePreviewBytes] + truncatedSuffix
	}
	capped, err := common.Marshal(map[string]interface{}{
		"_truncated":       true,
		"_sanitized_bytes": len(out),
		"_preview":         preview,
	})
	if err != nil {
		return "", err
	}
	return string(capped), nil
}

func sanitizeLogRequestSampleValue(value interface{}, fieldName string, depth int, snapshot operation_setting.LogRequestSamplingRuntimeSnapshot) (interface{}, error) {
	if depth > snapshot.MaxJSONDepth() {
		return maxDepthValue, nil
	}
	if isSensitiveSampleField(fieldName) {
		return redactedValue, nil
	}
	if !snapshot.AllowTextContentStorage() && isTextContentSampleField(fieldName) {
		return redactedValue, nil
	}
	switch typed := value.(type) {
	case map[string]interface{}:
		out := make(map[string]interface{}, len(typed))
		parentSensitiveName := sensitiveNameValueObjectName(typed)
		for key, child := range typed {
			if isInlineBinaryPayloadField(fieldName, typed, key) {
				out[key] = droppedValue
				continue
			}
			childFieldName := joinLogRequestSampleFieldPath(fieldName, key)
			if parentSensitiveName != "" && isNameValuePayloadField(key) {
				childFieldName = parentSensitiveName
			}
			cleaned, err := sanitizeLogRequestSampleValue(child, childFieldName, depth+1, snapshot)
			if err != nil {
				return nil, err
			}
			out[key] = cleaned
		}
		return out, nil
	case []interface{}:
		out := make([]interface{}, 0, len(typed))
		for _, child := range typed {
			cleaned, err := sanitizeLogRequestSampleValue(child, fieldName, depth+1, snapshot)
			if err != nil {
				return nil, err
			}
			out = append(out, cleaned)
		}
		return out, nil
	case string:
		return sanitizeLogRequestSampleString(fieldName, typed, snapshot), nil
	default:
		return value, nil
	}
}

func sanitizeLogRequestSampleString(fieldName string, value string, snapshot operation_setting.LogRequestSamplingRuntimeSnapshot) string {
	if snapshot.DropBinaryPayloads() && shouldDropLogRequestSampleString(fieldName, value) {
		return droppedValue
	}
	if isURLSampleField(fieldName) && urlLikePattern.MatchString(value) {
		return redactedValue
	}
	value = urlLikePattern.ReplaceAllString(value, redactedValue)
	value = credentialLikePattern.ReplaceAllString(value, redactedValue)
	if len(value) > snapshot.MaxStringBytes() {
		return truncateLogRequestSampleString(value, snapshot.MaxStringBytes()) + truncatedSuffix
	}
	return value
}

func truncateLogRequestSampleString(value string, maxBytes int) string {
	if maxBytes <= 0 {
		return ""
	}
	if len(value) <= maxBytes {
		return value
	}
	end := 0
	for idx, r := range value {
		next := idx + utf8.RuneLen(r)
		if next > maxBytes {
			break
		}
		end = next
	}
	return value[:end]
}

func isSensitiveSampleField(fieldName string) bool {
	name := strings.ToLower(strings.TrimSpace(fieldName))
	if name == "" {
		return false
	}
	name = strings.NewReplacer("-", "_", ".", "_").Replace(name)
	compactName := strings.ReplaceAll(name, "_", "")
	switch name {
	case "api_key", "apikey", "x_api_key", "authorization", "proxy_authorization", "auth", "bearer", "password", "secret", "client_secret", "access_token", "refresh_token", "id_token", "token", "key", "private_key", "cookie", "set_cookie", "session", "session_id", "credential", "credentials":
		return true
	}
	switch compactName {
	case "apikey", "xapikey", "proxyauthorization", "clientsecret", "accesstoken", "refreshtoken", "idtoken", "privatekey", "setcookie", "sessionid", "credential", "credentials":
		return true
	}
	if strings.HasSuffix(compactName, "apikey") ||
		strings.HasSuffix(compactName, "accesskey") ||
		strings.HasSuffix(compactName, "privatekey") ||
		strings.HasSuffix(compactName, "token") ||
		strings.HasSuffix(compactName, "secret") ||
		strings.HasSuffix(compactName, "password") ||
		strings.HasSuffix(compactName, "authorization") ||
		strings.HasSuffix(compactName, "cookie") ||
		strings.HasSuffix(compactName, "session") ||
		strings.HasSuffix(compactName, "credential") ||
		strings.HasSuffix(compactName, "credentials") {
		return true
	}
	return strings.HasSuffix(name, "_api_key") ||
		strings.HasSuffix(name, "_key") ||
		strings.HasSuffix(name, "_token") ||
		strings.HasSuffix(name, "_secret") ||
		strings.HasSuffix(name, "_password") ||
		strings.HasSuffix(name, "_authorization") ||
		strings.HasSuffix(name, "_access_token") ||
		strings.HasSuffix(name, "_refresh_token") ||
		strings.HasSuffix(name, "_id_token") ||
		strings.HasSuffix(name, "_cookie") ||
		strings.HasSuffix(name, "_session") ||
		strings.HasSuffix(name, "_credential") ||
		strings.HasSuffix(name, "_credentials")
}

func isURLSampleField(fieldName string) bool {
	name := strings.ToLower(strings.TrimSpace(fieldName))
	return name == "url" ||
		name == "uri" ||
		name == "href" ||
		strings.HasSuffix(name, "_url") ||
		strings.HasSuffix(name, "_uri")
}

func isTextContentSampleField(fieldName string) bool {
	name := strings.ToLower(strings.TrimSpace(fieldName))
	if name == "" {
		return false
	}
	name = strings.NewReplacer("-", "_", ".", "_").Replace(name)
	compactName := strings.ReplaceAll(name, "_", "")
	switch name {
	case "messages", "message", "content", "contents", "input", "prompt", "prompts", "system", "instruction", "instructions", "text", "texts", "arguments", "argument", "metadata":
		return true
	}
	return strings.HasSuffix(compactName, "message") ||
		strings.HasSuffix(compactName, "messages") ||
		strings.HasSuffix(compactName, "content") ||
		strings.HasSuffix(compactName, "input") ||
		strings.HasSuffix(compactName, "prompt") ||
		strings.HasSuffix(compactName, "prompts") ||
		strings.HasSuffix(compactName, "text") ||
		strings.HasSuffix(compactName, "texts") ||
		strings.HasSuffix(compactName, "system") ||
		strings.HasSuffix(compactName, "instruction") ||
		strings.HasSuffix(compactName, "instructions") ||
		strings.HasSuffix(compactName, "arguments") ||
		strings.HasSuffix(compactName, "argument") ||
		strings.HasSuffix(compactName, "metadata")
}

func joinLogRequestSampleFieldPath(parent string, child string) string {
	parent = strings.TrimSpace(parent)
	child = strings.TrimSpace(child)
	if parent == "" {
		return child
	}
	if child == "" {
		return parent
	}
	return parent + "." + child
}

func sensitiveNameValueObjectName(value map[string]interface{}) string {
	for key, raw := range value {
		normalizedKey := normalizeLogRequestSampleFieldName(key)
		if normalizedKey != "name" && normalizedKey != "key" {
			continue
		}
		name, ok := raw.(string)
		if !ok {
			continue
		}
		if isSensitiveSampleField(name) {
			return name
		}
	}
	return ""
}

func isNameValuePayloadField(fieldName string) bool {
	name := normalizeLogRequestSampleFieldName(fieldName)
	return name == "value" || name == "values" || name == "data"
}

func normalizeLogRequestSampleFieldName(fieldName string) string {
	return strings.ToLower(strings.NewReplacer("-", "_", ".", "_").Replace(strings.TrimSpace(fieldName)))
}

func isInlineBinaryPayloadField(parentFieldName string, parent map[string]interface{}, fieldName string) bool {
	name := strings.ToLower(strings.TrimSpace(fieldName))
	normalizedName := strings.ReplaceAll(strings.ReplaceAll(name, "-", "_"), ".", "_")
	if normalizedName != "data" && normalizedName != "b64_json" && normalizedName != "base64" {
		return false
	}
	parentName := strings.ToLower(strings.NewReplacer("-", "_", ".", "_").Replace(parentFieldName))
	if strings.Contains(parentName, "inline_data") || strings.Contains(parentName, "inlinedata") {
		return true
	}
	for _, key := range []string{"mime_type", "mimeType", "content_type", "contentType", "media_type", "mediaType", "type"} {
		if value, ok := parent[key].(string); ok && isBinaryMimeLikeValue(value) {
			return true
		}
	}
	return false
}

func isBinaryMimeLikeValue(value string) bool {
	value = strings.ToLower(strings.TrimSpace(value))
	return strings.HasPrefix(value, "image/") ||
		strings.HasPrefix(value, "audio/") ||
		strings.HasPrefix(value, "video/") ||
		strings.Contains(value, "octet-stream") ||
		strings.Contains(value, "base64") ||
		strings.Contains(value, "input_image") ||
		strings.Contains(value, "input_audio") ||
		strings.Contains(value, "input_file")
}

func shouldDropLogRequestSampleString(fieldName string, value string) bool {
	lowerField := strings.ToLower(fieldName)
	lowerValue := strings.ToLower(strings.TrimSpace(value))
	if strings.HasPrefix(lowerValue, "data:") {
		return true
	}
	if strings.Contains(lowerField, "image") ||
		strings.Contains(lowerField, "audio") ||
		strings.Contains(lowerField, "video") ||
		strings.Contains(lowerField, "file") ||
		strings.Contains(lowerField, "binary") {
		return true
	}
	if len(value) >= 512 && looksLikeBase64Blob(value) {
		return true
	}
	return false
}

func looksLikeBase64Blob(value string) bool {
	var valid int
	for _, r := range value {
		if unicode.IsSpace(r) {
			continue
		}
		if (r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '+' || r == '/' || r == '=' {
			valid++
			continue
		}
		return false
	}
	return valid >= 512
}

func isGeminiTextRequestSamplePath(path string) bool {
	actionIndex := strings.LastIndex(path, ":")
	if actionIndex < 0 || actionIndex == len(path)-1 {
		return false
	}
	action := path[actionIndex+1:]
	return action == "generateContent" || action == "streamGenerateContent"
}

func isGeminiRequestSamplePath(path string) bool {
	return strings.HasPrefix(path, "/v1beta/models/") || strings.HasPrefix(path, "/v1/models/")
}
