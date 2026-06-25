package controller

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// RelayImageTask proxies GET /v1/tasks/:task_id to the selected channel upstream.
// Optional query: ?model=gpt-image-2 (defaults to gpt-image-2 for channel selection).
func RelayImageTask(c *gin.Context) {
	taskID := strings.TrimSpace(c.Param("task_id"))
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"message": "task_id is required",
				"type":    "invalid_request_error",
				"code":    "missing_task_id",
			},
		})
		return
	}

	modelName := common.GetStringIfEmpty(c.Query("model"), "gpt-image-2")

	// New-style tasks (submitted after the gpt-image-2 race fallback shipped) carry our
	// own task_id, mapped via the Task table — this is what makes the race fallback fully
	// transparent to the client. Tasks submitted before that change won't be found here
	// (their task_id is still the literal upstream one) and fall through to the legacy
	// single-channel proxy below.
	if serveTrackedImageTask(c, taskID) {
		return
	}

	baseURL := strings.TrimRight(common.GetContextKeyString(c, constant.ContextKeyChannelBaseUrl), "/")
	if baseURL == "" {
		if err := setupImageTaskPollChannel(c, modelName, taskID); err != nil {
			requestId := c.GetString(common.RequestIdKey)
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error": gin.H{
					"message": common.MessageWithRequestId(err.Error(), requestId),
					"type":    "new_api_error",
					"code":    types.ErrorCodeModelNotFound,
				},
			})
			return
		}
		baseURL = strings.TrimRight(common.GetContextKeyString(c, constant.ContextKeyChannelBaseUrl), "/")
	}
	if baseURL == "" {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"message": "channel base URL not configured",
				"type":    "server_error",
			},
		})
		return
	}
	apiKey := common.GetContextKeyString(c, constant.ContextKeyChannelKey)
	upstreamURL := fmt.Sprintf("%s/v1/tasks/%s", baseURL, taskID)

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, upstreamURL, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"message": "failed to create upstream request",
				"type":    "server_error",
			},
		})
		return
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 30 * time.Second}

	resp, err := client.Do(req)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("RelayImageTask upstream error: %v", err))
		c.JSON(http.StatusBadGateway, gin.H{
			"error": gin.H{
				"message": "failed to fetch task status from upstream",
				"type":    "server_error",
			},
		})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"error": gin.H{
				"message": "failed to read upstream response",
				"type":    "server_error",
			},
		})
		return
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/json"
	}
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		body = service.RewriteImageResponseBody(body)
	}
	c.Data(resp.StatusCode, contentType, body)
}

// serveTrackedImageTask handles GET /v1/tasks/:task_id for tasks tracked via the Task
// table (model.GetByOnlyTaskId). Returns false ("not handled") when no such row exists,
// so the caller falls back to the legacy single-channel proxy. When a hedge channel is
// recorded on the task, both channels are checked and whichever resolves first wins —
// the client only ever sees our own task_id and a clean, normalized status response.
func serveTrackedImageTask(c *gin.Context, taskID string) bool {
	task, found, err := model.GetByOnlyTaskId(taskID)
	if err != nil || !found || task == nil {
		return false
	}
	if task.UserId != c.GetInt("id") {
		return false
	}

	switch task.Status {
	case model.TaskStatusSuccess:
		c.JSON(http.StatusOK, buildImageTaskStatusResponse("succeeded", task.GetResultURL()))
		return true
	case model.TaskStatusFailure:
		service.RefundImageAsyncTaskQuota(c.Request.Context(), task, task.FailReason)
		c.JSON(http.StatusOK, buildImageTaskStatusResponse("failed", ""))
		return true
	}

	primaryChannel, err := model.GetChannelById(task.ChannelId, true)
	if err != nil || primaryChannel == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": gin.H{"message": "channel unavailable for task poll", "type": "server_error"},
		})
		return true
	}
	primaryKey, _, apiErr := primaryChannel.GetNextEnabledKey()
	if apiErr != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": gin.H{"message": apiErr.Error(), "type": "server_error"},
		})
		return true
	}
	targets := []service.ImageTaskTarget{{
		ChannelID: primaryChannel.Id,
		BaseURL:   primaryChannel.GetBaseURL(),
		APIKey:    primaryKey,
		TaskID:    task.GetUpstreamTaskID(),
	}}
	var hedgeChannel *model.Channel
	if task.PrivateData.HedgeChannelId != 0 && task.PrivateData.HedgeUpstreamTaskID != "" {
		if ch, herr := model.GetChannelById(task.PrivateData.HedgeChannelId, true); herr == nil && ch != nil {
			if hedgeKey, _, kerr := ch.GetNextEnabledKey(); kerr == nil {
				hedgeChannel = ch
				targets = append(targets, service.ImageTaskTarget{
					ChannelID: ch.Id,
					BaseURL:   ch.GetBaseURL(),
					APIKey:    hedgeKey,
					TaskID:    task.PrivateData.HedgeUpstreamTaskID,
				})
			}
		}
	}

	winner, status, imageURL, failReason, failCode := service.CheckImageTaskTargetsOnce(targets)
	fromStatus := task.Status
	switch status {
	case "succeeded", "success", "completed":
		cachedURL := service.CacheImageLocally(imageURL)
		task.PrivateData.ResultURL = cachedURL
		if winner.ChannelID != task.ChannelId {
			task.ChannelId = winner.ChannelID
			task.PrivateData.UpstreamTaskID = winner.TaskID
		}
		task.Status = model.TaskStatusSuccess
		task.Progress = "100%"
		task.FinishTime = time.Now().Unix()
		if ok, uerr := task.UpdateWithStatus(fromStatus); !ok || uerr != nil {
			// Another concurrent poll already resolved it first — serve that instead of
			// risking re-settling/overwriting it.
			if fresh, ffound, _ := model.GetByOnlyTaskId(taskID); ffound && fresh != nil {
				task = fresh
			}
		} else {
			// We're the poll that won the resolution race — backfill the consumption log's
			// "耗时" with the real submit→result latency (the original log row only has the
			// fast async-submit round-trip, since billing happens at submit time), and flag
			// whether the race fallback was ever triggered for this task (admin-only marker).
			realElapsed := int(task.FinishTime - task.SubmitTime)
			winnerChannelName := primaryChannel.Name
			if hedgeChannel != nil && winner.ChannelID == hedgeChannel.Id {
				winnerChannelName = hedgeChannel.Name
			}
			extraOther := map[string]interface{}{
				"fallback_triggered":           task.PrivateData.HedgeChannelId != 0,
				"fallback_winner_channel_id":   winner.ChannelID,
				"fallback_winner_channel_name": winnerChannelName,
				"result_url":                   cachedURL,
			}
			if uerr := model.UpdateLogResultByTaskID(task.UserId, task.TaskID, realElapsed, extraOther); uerr != nil {
				logger.LogWarn(c.Request.Context(), fmt.Sprintf("failed to backfill real duration for task %s: %v", task.TaskID, uerr))
			}
		}
		c.JSON(http.StatusOK, buildImageTaskStatusResponse("succeeded", task.GetResultURL()))
	case "failed", "error", "cancelled":
		if failReason == "" {
			failReason = "upstream task failed"
		}
		task.Status = model.TaskStatusFailure
		task.FailReason = failReason
		task.FinishTime = time.Now().Unix()
		if task.Progress == "" {
			task.Progress = "100%"
		}
		_, _ = task.UpdateWithStatus(fromStatus)
		elapsed := int(task.FinishTime - task.SubmitTime)
		if elapsed <= 0 {
			elapsed = 1
		}
		extraOther := map[string]interface{}{
			"task_fail_reason": failReason,
		}
		if failCode != "" {
			extraOther["task_fail_code"] = failCode
		}
		if uerr := model.UpdateLogResultByTaskID(task.UserId, task.TaskID, elapsed, extraOther); uerr != nil {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("failed to backfill task failure for %s: %v", task.TaskID, uerr))
		}
		service.RefundImageAsyncTaskQuota(c.Request.Context(), task, failReason)
		c.JSON(http.StatusOK, buildImageTaskStatusResponse("failed", ""))
	default:
		c.JSON(http.StatusOK, buildImageTaskStatusResponse("in_progress", ""))
	}
	return true
}

// buildImageTaskStatusResponse mirrors the upstream task-poll JSON shape
// ({"data":{"status":...,"result":{"images":[{"url":...}]}}}) so existing clients
// (which already parse that shape from the legacy proxy path) don't need to change.
func buildImageTaskStatusResponse(status, imageURL string) gin.H {
	data := gin.H{"status": status}
	if imageURL != "" {
		data["result"] = gin.H{"images": []gin.H{{"url": imageURL}}}
	}
	return gin.H{"data": data}
}

func setupImageTaskPollChannel(c *gin.Context, modelName, taskID string) error {
	userID := c.GetInt("id")

	if channelID, ok := model.FindChannelIDForImageTask(userID, taskID); ok {
		ch, err := model.GetChannelById(channelID, true)
		if err == nil && ch != nil && ch.Status == common.ChannelStatusEnabled {
			if policyErr := service.ValidateChannelClientPolicy(c, ch, modelName); policyErr == nil {
				if setupErr := middleware.SetupContextForSelectedChannel(c, ch, modelName); setupErr == nil {
					return nil
				}
			}
		}
	}

	if channelID, ok := model.FindRecentImageChannelID(userID, 2*3600); ok {
		ch, err := model.GetChannelById(channelID, true)
		if err == nil && ch != nil && ch.Status == common.ChannelStatusEnabled {
			if policyErr := service.ValidateChannelClientPolicy(c, ch, modelName); policyErr == nil {
				if setupErr := middleware.SetupContextForSelectedChannel(c, ch, modelName); setupErr == nil {
					return nil
				}
			}
		}
	}

	ch, err := service.SelectCheapestEnabledChannel(c, modelName)
	if err != nil {
		return fmt.Errorf("no available channel for model %s (task poll): %v", modelName, err)
	}
	if ch == nil {
		return fmt.Errorf("no available channel for model %s (task poll)", modelName)
	}
	if setupErr := middleware.SetupContextForSelectedChannel(c, ch, modelName); setupErr != nil {
		return fmt.Errorf("failed to configure channel for task poll: %s", setupErr.Error())
	}
	return nil
}
