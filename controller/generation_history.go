package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// The playground keeps a history row per generation so a finished image or
// video survives a refresh, a new browser, and the upstream link expiring. Rows
// are written only from the /pg relays: API traffic a customer's own product
// sends with a key is not the playground's history.

const generationFailReasonLimit = 600

// generationRecordView is what the history list returns. Media paths are turned
// into signed capability URLs here, so the database only ever holds paths and a
// rotated secret invalidates nothing permanently.
type generationRecordView struct {
	ID         int64           `json:"id"`
	CreatedAt  int64           `json:"created_at"`
	Kind       string          `json:"kind"`
	Model      string          `json:"model"`
	Prompt     string          `json:"prompt"`
	Params     json.RawMessage `json:"params,omitempty"`
	Status     string          `json:"status"`
	TaskID     string          `json:"task_id,omitempty"`
	FailReason string          `json:"fail_reason,omitempty"`
	Quota      int             `json:"quota"`
	URLs       []string        `json:"urls"`
}

// GetGenerationRecords lists the caller's own playground history.
func GetGenerationRecords(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiError(c, errors.New("未登录"))
		return
	}

	kind := strings.TrimSpace(c.Query("kind"))
	if kind != "" && kind != model.GenerationKindImage && kind != model.GenerationKindVideo {
		common.ApiError(c, errors.New("kind 只能是 image 或 video"))
		return
	}

	page := queryInt(c, "p", 1)
	if page < 1 {
		page = 1
	}
	pageSize := queryInt(c, "page_size", 20)
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	records, total, err := model.ListGenerationRecords(userId, kind, (page-1)*pageSize, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	items := make([]generationRecordView, 0, len(records))
	for _, record := range records {
		items = append(items, buildGenerationRecordView(record))
	}
	c.JSON(200, gin.H{
		"success":   true,
		"message":   "",
		"data":      items,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// DeleteGenerationRecord removes one history row together with the media files
// it owns, so deleting history also frees the disk.
func DeleteGenerationRecord(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.ParseInt(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || id <= 0 {
		common.ApiError(c, errors.New("无效的记录编号"))
		return
	}

	record, err := model.GetGenerationRecord(userId, id)
	if err != nil {
		common.ApiError(c, errors.New("记录不存在"))
		return
	}

	service.DeleteGenerationMedia(decodeGenerationStoredPaths(record.ResultURLs))
	if err := model.DeleteGenerationRecord(userId, id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": id})
}

// GetGenerationMedia serves a stored image or video. The route carries no
// session, so it is guarded by the signed access parameter instead.
func GetGenerationMedia(c *gin.Context) {
	service.ServeGenerationMedia(c, c.Param("file"), c.Query("access"))
}

// finishPlaygroundImage writes the history row for a synchronous image relay.
// The body was captured while it streamed to the browser; only what it points
// at is persisted, never the response itself.
func finishPlaygroundImage(c *gin.Context, capture *service.GenerationCapture, fields service.GenerationRequestFields) {
	userId := c.GetInt("id")
	if userId == 0 || capture == nil {
		return
	}
	body := capture.Body()
	refs := service.ExtractGenerationMediaRefs(body)
	statusCode := capture.StatusCode()

	record := &model.GenerationRecord{
		UserId: userId,
		Kind:   model.GenerationKindImage,
		Model:  fields.Model,
		Prompt: fields.Prompt,
		Params: fields.Params,
		Status: model.GenerationStatusSuccess,
	}

	if statusCode >= 400 || len(refs) == 0 {
		record.Status = model.GenerationStatusFailure
		record.FailReason = generationFailReason(body, statusCode)
		if record.FailReason == "" && len(refs) == 0 {
			// Nothing usable and nothing to explain: the relay's own error
			// response already told the user, so there is nothing to remember.
			return
		}
	} else {
		stored := service.PersistGenerationMedia(userId, refs)
		if len(stored) == 0 {
			record.Status = model.GenerationStatusFailure
			record.FailReason = "生成成功，但结果文件保存失败，请重新生成"
		} else {
			record.ResultURLs = encodeGenerationStoredPaths(stored)
			record.Quota = generationQuotaFor(c, record.Model)
		}
	}

	if err := model.CreateGenerationRecord(record); err != nil {
		common.SysError(common.LogText("failed to write generation history: %s", err.Error()))
	}
}

// generationQuotaFor reads what the request that just finished was charged. A
// synchronous relay settles billing while it writes the response, so the ledger
// is the only place the amount exists; the request start time keeps the lookup
// from picking up an earlier generation of the same model.
func generationQuotaFor(c *gin.Context, modelName string) int {
	since := time.Now().Unix() - 90
	if value, exists := common.GetContextKey(c, constant.ContextKeyRequestStartTime); exists {
		if startedAt, ok := value.(time.Time); ok && !startedAt.IsZero() {
			since = startedAt.Unix() - 1
		}
	}
	return model.LatestGenerationCharge(c.GetInt("id"), modelName, since)
}

// finishPlaygroundTaskSubmit writes the row a submitted video task owns. The
// poll updates it in place once Ark reports a final state.
func finishPlaygroundTaskSubmit(c *gin.Context, capture *service.GenerationCapture, fields service.GenerationRequestFields) {
	userId := c.GetInt("id")
	if userId == 0 || capture == nil {
		return
	}
	body := capture.Body()
	state := service.ExtractGenerationTaskState(body)
	statusCode := capture.StatusCode()

	record := &model.GenerationRecord{
		UserId: userId,
		Kind:   model.GenerationKindVideo,
		Model:  fields.Model,
		Prompt: fields.Prompt,
		Params: fields.Params,
		TaskID: state.TaskID,
		Status: model.GenerationStatusQueued,
	}
	if statusCode >= 400 || state.TaskID == "" {
		record.Status = model.GenerationStatusFailure
		record.FailReason = generationFailReason(body, statusCode)
		if record.FailReason == "" {
			record.FailReason = "任务提交失败"
		}
	}
	if err := model.CreateGenerationRecord(record); err != nil {
		common.SysError(common.LogText("failed to write generation history: %s", err.Error()))
	}
}

// finishPlaygroundTaskPoll applies a poll result to the row the submission
// created. Failures here must never affect the poll response, so every error is
// only logged.
func finishPlaygroundTaskPoll(c *gin.Context, capture *service.GenerationCapture, taskId string) {
	userId := c.GetInt("id")
	if userId == 0 || capture == nil || taskId == "" {
		return
	}
	record, err := model.GetGenerationRecordByTaskID(taskId)
	if err != nil || record == nil || record.UserId != userId {
		return
	}
	if record.Status == model.GenerationStatusSuccess {
		return
	}

	state := service.ExtractGenerationTaskState(capture.Body())
	updates := map[string]any{}
	switch state.Status {
	case service.GenerationStatusSuccess:
		refs := state.Refs
		stored := service.PersistGenerationMedia(userId, refs)
		if len(stored) == 0 {
			updates["status"] = model.GenerationStatusFailure
			updates["fail_reason"] = "生成成功，但结果文件保存失败，请重新生成"
			break
		}
		updates["status"] = model.GenerationStatusSuccess
		updates["result_urls"] = encodeGenerationStoredPaths(stored)
	case service.GenerationStatusFailure:
		updates["status"] = model.GenerationStatusFailure
		reason := state.FailReason
		if reason == "" {
			reason = generationFailReason(capture.Body(), capture.StatusCode())
		}
		if reason == "" {
			reason = "生成失败"
		}
		updates["fail_reason"] = reason
	case service.GenerationStatusRunning, service.GenerationStatusQueued:
		updates["status"] = state.Status
	default:
		if capture.StatusCode() >= 400 {
			updates["status"] = model.GenerationStatusFailure
			updates["fail_reason"] = generationFailReason(capture.Body(), capture.StatusCode())
		}
	}
	if len(updates) == 0 {
		return
	}
	if task, exist, taskErr := model.GetByTaskId(userId, taskId); taskErr == nil && exist && task != nil {
		updates["quota"] = task.Quota
	}
	model.UpdateGenerationRecordByTaskID(taskId, updates)
}

func buildGenerationRecordView(record model.GenerationRecord) generationRecordView {
	view := generationRecordView{
		ID:         record.ID,
		CreatedAt:  record.CreatedAt,
		Kind:       record.Kind,
		Model:      record.Model,
		Prompt:     record.Prompt,
		Status:     record.Status,
		TaskID:     record.TaskID,
		FailReason: record.FailReason,
		Quota:      record.Quota,
		URLs:       make([]string, 0, 2),
	}
	if raw := strings.TrimSpace(record.Params); strings.HasPrefix(raw, "{") {
		view.Params = json.RawMessage(raw)
	}
	for _, path := range decodeGenerationStoredPaths(record.ResultURLs) {
		if url := service.BuildGenerationMediaURL(path); url != "" {
			view.URLs = append(view.URLs, url)
		}
	}
	return view
}

func generationFailReason(body []byte, statusCode int) string {
	reason := strings.TrimSpace(service.ExtractGenerationError(body))
	if reason == "" && statusCode >= 400 {
		reason = fmt.Sprintf("上游返回 HTTP %d", statusCode)
	}
	if runes := []rune(reason); len(runes) > generationFailReasonLimit {
		reason = string(runes[:generationFailReasonLimit])
	}
	return reason
}

func encodeGenerationStoredPaths(paths []string) string {
	encoded, err := json.Marshal(paths)
	if err != nil {
		return ""
	}
	return string(encoded)
}

func decodeGenerationStoredPaths(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	var paths []string
	if err := json.Unmarshal([]byte(raw), &paths); err != nil {
		return nil
	}
	return paths
}

func queryInt(c *gin.Context, key string, fallback int) int {
	value, err := strconv.Atoi(strings.TrimSpace(c.Query(key)))
	if err != nil {
		return fallback
	}
	return value
}
