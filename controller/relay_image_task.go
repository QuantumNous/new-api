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
	c.Data(resp.StatusCode, contentType, body)
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
