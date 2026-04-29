package graylight

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	svc "github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// VolcTaskDelete handles DELETE /api/v3/contents/generations/tasks/:id.
//
// Steps:
//  1. Auth (via TokenAuth middleware) and ownership check (user_id matches task.UserId).
//  2. If task is already terminal, return current state — no upstream call.
//  3. Forward DELETE to Volc with the channel's API key.
//  4. On Volc 200: update local task to cancelled status + refund pre-charge.
//  5. Return Volc-native task response shape (same as GET).
func VolcTaskDelete(c *gin.Context) {
	userID := c.GetInt("id")
	publicTaskID := strings.TrimSpace(c.Param("id"))

	if publicTaskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task id is required"})
		return
	}

	// 1. Look up task with ownership check (mirrors GET-by-ID path).
	task, exist, err := model.GetByTaskId(userID, publicTaskID)
	if err != nil {
		logger.LogError(c, "VolcTaskDelete: DB error for task "+publicTaskID+": "+err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if !exist || task == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	// 2. If already terminal, return current state — no upstream call.
	if isTerminalStatus(task.Status) {
		respBody := buildVolcDeleteResp(task)
		c.Data(http.StatusOK, "application/json", respBody)
		return
	}

	// 3. Look up channel to get base URL and API key.
	ch, chErr := model.CacheGetChannel(task.ChannelId)
	if chErr != nil {
		logger.LogError(c, fmt.Sprintf("VolcTaskDelete: CacheGetChannel(%d) failed: %s", task.ChannelId, chErr.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "channel unavailable"})
		return
	}

	baseURL := constant.ChannelBaseURLs[ch.Type]
	if ch.GetBaseURL() != "" {
		baseURL = ch.GetBaseURL()
	}
	upstreamTaskID := task.GetUpstreamTaskID()
	deleteURL := strings.TrimRight(baseURL, "/") + "/api/v3/contents/generations/tasks/" + upstreamTaskID

	apiKey := ch.Key
	// Use private key override if stored (Gemini/Vertex pattern).
	if task.PrivateData.Key != "" {
		apiKey = task.PrivateData.Key
	}

	proxy := ch.GetSetting().Proxy
	httpClient, clientErr := svc.GetHttpClientWithProxy(proxy)
	if clientErr != nil {
		logger.LogError(c, "VolcTaskDelete: create HTTP client failed: "+clientErr.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	req, reqErr := http.NewRequestWithContext(context.Background(), http.MethodDelete, deleteURL, nil)
	if reqErr != nil {
		logger.LogError(c, "VolcTaskDelete: build DELETE request failed: "+reqErr.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Accept", "application/json")

	// 4. Forward DELETE to Volc.
	resp, doErr := httpClient.Do(req)
	if doErr != nil {
		logger.LogError(c, "VolcTaskDelete: upstream DELETE failed: "+doErr.Error())
		c.JSON(http.StatusBadGateway, gin.H{"error": "upstream request failed"})
		return
	}
	defer resp.Body.Close()
	respBody, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		logger.LogError(c, "VolcTaskDelete: read upstream response failed: "+readErr.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	if resp.StatusCode != http.StatusOK {
		// Pass Volc error back to caller unchanged.
		c.Data(resp.StatusCode, "application/json", respBody)
		return
	}

	// 5. Volc confirmed cancellation — update local task.
	ctx := context.Background()
	now := time.Now().Unix()
	snap := task.Snapshot()

	task.Status = model.TaskStatusFailure
	task.Progress = "100%"
	task.FailReason = "cancelled"
	if task.FinishTime == 0 {
		task.FinishTime = now
	}

	won, updateErr := task.UpdateWithStatus(snap.Status)
	if updateErr != nil {
		logger.LogError(ctx, "VolcTaskDelete: UpdateWithStatus failed for task "+task.TaskID+": "+updateErr.Error())
	} else if won && task.Quota != 0 {
		// Refund the pre-charge since the task was cancelled.
		svc.RefundTaskQuota(ctx, task, "cancelled")
	}

	// 6. Return Volc-native shape for the now-cancelled task.
	c.Data(http.StatusOK, "application/json", buildVolcDeleteResp(task))
}

// buildVolcDeleteResp builds a Volc-native ContentGenerationTask JSON response
// for a cancelled/terminal task, using the same shape as buildVolcNativeTaskFetchResp
// in relay/relay_task.go.
func buildVolcDeleteResp(t *model.Task) []byte {
	arkStatus := volcDeleteMapStatus(t.Status, t.FailReason)
	modelName := t.Properties.OriginModelName
	if modelName == "" {
		modelName = t.Properties.UpstreamModelName
	}
	synth := map[string]interface{}{
		"id":         t.TaskID,
		"model":      modelName,
		"status":     arkStatus,
		"created_at": t.CreatedAt,
		"updated_at": t.UpdatedAt,
	}
	if t.FailReason != "" {
		code := "task_failed"
		if t.FailReason == "cancelled" {
			code = "cancelled"
		}
		synth["error"] = map[string]string{
			"message": t.FailReason,
			"code":    code,
		}
	}
	b, err := common.Marshal(synth)
	if err != nil {
		return []byte(`{"id":"` + t.TaskID + `","status":"` + arkStatus + `"}`)
	}
	return b
}

// isTerminalStatus returns true if the task status is a terminal state.
func isTerminalStatus(s model.TaskStatus) bool {
	return s == model.TaskStatusSuccess || s == model.TaskStatusFailure
}

// volcDeleteMapStatus maps internal task status to Volc Ark status strings.
// For a DELETE operation, a task that was cancelled keeps its "cancelled" status.
func volcDeleteMapStatus(status model.TaskStatus, failReason string) string {
	switch status {
	case model.TaskStatusSuccess:
		return "succeeded"
	case model.TaskStatusFailure:
		if failReason == "cancelled" {
			return "cancelled"
		}
		return "failed"
	case model.TaskStatusInProgress:
		return "running"
	default:
		return "queued"
	}
}
