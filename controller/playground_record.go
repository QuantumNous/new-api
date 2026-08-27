package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	playgroundRecordBodyLimit = 16 << 20
	playgroundJSONMaxDepth    = 32
)

type savePlaygroundRecordRequest struct {
	RecordID          string          `json:"record_id"`
	ConversationID    string          `json:"conversation_id"`
	UserMessage       json.RawMessage `json:"user_message"`
	RequestMessages   json.RawMessage `json:"request_messages"`
	AssistantMessage  json.RawMessage `json:"assistant_message"`
	ReasoningContent  string          `json:"reasoning_content"`
	InputText         string          `json:"input_text"`
	OutputText        string          `json:"output_text"`
	ModelName         string          `json:"model_name"`
	GroupName         string          `json:"group_name"`
	Parameters        json.RawMessage `json:"parameters"`
	Status            string          `json:"status"`
	ErrorCode         string          `json:"error_code"`
	ErrorMessage      string          `json:"error_message"`
	RelayRequestID    string          `json:"relay_request_id"`
	PromptTokens      int             `json:"prompt_tokens"`
	CompletionTokens  int             `json:"completion_tokens"`
	TotalTokens       int             `json:"total_tokens"`
	LatencyMS         int64           `json:"latency_ms"`
	MessagesSnapshot  json.RawMessage `json:"messages_snapshot"`
	ClientCompletedAt int64           `json:"client_completed_at"`
}

type clearPlaygroundRecordRequest struct {
	RecordID          string `json:"record_id"`
	ConversationID    string `json:"conversation_id"`
	ClientCompletedAt int64  `json:"client_completed_at"`
}

func SavePlaygroundRecord(c *gin.Context) {
	var request savePlaygroundRecordRequest
	if err := decodePlaygroundRecordRequest(c, &request); err != nil {
		playgroundRecordBadRequest(c, err)
		return
	}
	if err := validateSavePlaygroundRecordRequest(&request); err != nil {
		playgroundRecordBadRequest(c, err)
		return
	}

	record := &model.PlaygroundRecord{
		UserID:            c.GetInt("id"),
		RecordID:          request.RecordID,
		RecordType:        model.PlaygroundRecordTypeTurn,
		ConversationID:    request.ConversationID,
		UserMessage:       model.PlaygroundLargeText(request.UserMessage),
		RequestMessages:   model.PlaygroundLargeText(request.RequestMessages),
		AssistantMessage:  model.PlaygroundLargeText(request.AssistantMessage),
		ReasoningContent:  model.PlaygroundLargeText(request.ReasoningContent),
		InputText:         model.PlaygroundLargeText(request.InputText),
		OutputText:        model.PlaygroundLargeText(request.OutputText),
		ModelName:         request.ModelName,
		GroupName:         request.GroupName,
		Parameters:        model.PlaygroundLargeText(request.Parameters),
		Status:            request.Status,
		ErrorCode:         request.ErrorCode,
		ErrorMessage:      model.PlaygroundLargeText(request.ErrorMessage),
		RelayRequestID:    request.RelayRequestID,
		PromptTokens:      request.PromptTokens,
		CompletionTokens:  request.CompletionTokens,
		TotalTokens:       request.TotalTokens,
		LatencyMS:         request.LatencyMS,
		MessagesSnapshot:  model.PlaygroundLargeText(request.MessagesSnapshot),
		ClientCompletedAt: request.ClientCompletedAt,
	}
	if err := model.SavePlaygroundRecord(record); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func GetCurrentPlaygroundRecord(c *gin.Context) {
	record, err := model.GetCurrentPlaygroundRecord(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if record == nil {
		common.ApiSuccess(c, nil)
		return
	}

	common.ApiSuccess(c, gin.H{
		"conversation_id": record.ConversationID,
		"messages":        json.RawMessage(record.MessagesSnapshot),
	})
}

// ExportPlaygroundRecords downloads durable Playground records for
// administrators. Without a user_id query parameter it includes all users;
// otherwise it is restricted to the requested positive user ID.
func ExportPlaygroundRecords(c *gin.Context) {
	rawUserID, hasUserID := c.GetQuery("user_id")
	userID, err := parsePlaygroundExportUserID(rawUserID, hasUserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, i18n.MsgLogInvalidUserId),
		})
		return
	}

	records, err := model.ListPlaygroundRecordsForExport(userID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	data, err := common.Marshal(records)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	filename := "playground-records"
	if userID != nil {
		filename += fmt.Sprintf("-%d", *userID)
	}
	filename += "-" + time.Now().UTC().Format("20060102T150405Z") + ".json"
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Data(http.StatusOK, "application/json; charset=utf-8", data)
}

func parsePlaygroundExportUserID(raw string, present bool) (*int, error) {
	if !present {
		return nil, nil
	}
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, errors.New("invalid user_id")
	}
	userID, err := strconv.Atoi(raw)
	if err != nil || userID <= 0 {
		return nil, errors.New("invalid user_id")
	}
	return &userID, nil
}

func ClearPlaygroundRecord(c *gin.Context) {
	var request clearPlaygroundRecordRequest
	if err := decodePlaygroundRecordRequest(c, &request); err != nil {
		playgroundRecordBadRequest(c, err)
		return
	}
	if err := validatePlaygroundRecordIdentity(
		request.RecordID,
		request.ConversationID,
		request.ClientCompletedAt,
	); err != nil {
		playgroundRecordBadRequest(c, err)
		return
	}

	if err := model.ClearPlaygroundConversation(
		c.GetInt("id"),
		request.RecordID,
		request.ConversationID,
		request.ClientCompletedAt,
	); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func decodePlaygroundRecordRequest(c *gin.Context, target any) error {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, playgroundRecordBodyLimit)
	return common.DecodeJson(c.Request.Body, target)
}

func validateSavePlaygroundRecordRequest(request *savePlaygroundRecordRequest) error {
	if err := validatePlaygroundRecordIdentity(
		request.RecordID,
		request.ConversationID,
		request.ClientCompletedAt,
	); err != nil {
		return err
	}

	switch request.Status {
	case model.PlaygroundStatusComplete, model.PlaygroundStatusError, model.PlaygroundStatusStopped:
	default:
		return fmt.Errorf("invalid status %q", request.Status)
	}
	if request.PromptTokens < 0 || request.CompletionTokens < 0 || request.TotalTokens < 0 || request.LatencyMS < 0 {
		return errors.New("token counts and latency must not be negative")
	}

	fields := []struct {
		name         string
		value        json.RawMessage
		expectedType string
	}{
		{name: "user_message", value: request.UserMessage, expectedType: "object"},
		{name: "request_messages", value: request.RequestMessages, expectedType: "array"},
		{name: "assistant_message", value: request.AssistantMessage, expectedType: "object"},
		{name: "parameters", value: request.Parameters, expectedType: "object"},
		{name: "messages_snapshot", value: request.MessagesSnapshot, expectedType: "array"},
	}
	for _, field := range fields {
		if err := validatePlaygroundJSON(field.name, field.value, field.expectedType); err != nil {
			return err
		}
	}
	return nil
}

func validatePlaygroundRecordIdentity(recordID, conversationID string, clientCompletedAt int64) error {
	if _, err := uuid.Parse(recordID); err != nil {
		return errors.New("record_id must be a UUID")
	}
	if _, err := uuid.Parse(conversationID); err != nil {
		return errors.New("conversation_id must be a UUID")
	}
	if clientCompletedAt <= 0 {
		return errors.New("client_completed_at must be positive")
	}
	return nil
}

func validatePlaygroundJSON(name string, raw json.RawMessage, expectedType string) error {
	if common.GetJsonType(raw) != expectedType {
		return fmt.Errorf("%s must be a JSON %s", name, expectedType)
	}

	var value any
	if err := common.Unmarshal(raw, &value); err != nil {
		return fmt.Errorf("%s is invalid JSON: %w", name, err)
	}
	if err := inspectPlaygroundJSON(value, 1); err != nil {
		return fmt.Errorf("%s: %w", name, err)
	}
	return nil
}

func inspectPlaygroundJSON(value any, depth int) error {
	switch typed := value.(type) {
	case map[string]any:
		if depth > playgroundJSONMaxDepth {
			return fmt.Errorf("JSON depth exceeds %d", playgroundJSONMaxDepth)
		}
		for key, child := range typed {
			if strings.EqualFold(key, "b64_json") {
				return errors.New("embedded base64 media is not allowed")
			}
			if err := inspectPlaygroundJSON(child, depth+1); err != nil {
				return err
			}
		}
	case []any:
		if depth > playgroundJSONMaxDepth {
			return fmt.Errorf("JSON depth exceeds %d", playgroundJSONMaxDepth)
		}
		for _, child := range typed {
			if err := inspectPlaygroundJSON(child, depth+1); err != nil {
				return err
			}
		}
	case string:
		if isBase64DataURL(typed) {
			return errors.New("embedded base64 media is not allowed")
		}
	}
	return nil
}

func isBase64DataURL(value string) bool {
	lower := strings.ToLower(strings.TrimSpace(value))
	if !strings.HasPrefix(lower, "data:") {
		return false
	}
	header := lower
	if comma := strings.IndexByte(lower, ','); comma >= 0 {
		header = lower[:comma]
	}
	return strings.Contains(header, ";base64")
}

func playgroundRecordBadRequest(c *gin.Context, err error) {
	c.JSON(http.StatusBadRequest, gin.H{
		"success": false,
		"message": common.TranslateMessage(c, "distributor.invalid_playground_request", map[string]any{
			"Error": err.Error(),
		}),
	})
}
