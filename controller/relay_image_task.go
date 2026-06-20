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

	baseURL := strings.TrimRight(common.GetContextKeyString(c, constant.ContextKeyChannelBaseUrl), "/")
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
