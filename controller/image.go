package controller

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/openai/image_stream"

	"github.com/gin-gonic/gin"
)

func GetImageGenerationTask(c *gin.Context) {
	taskID := c.Param("task_id")
	if taskID == "" {
		imageTaskError(c, http.StatusBadRequest, "task_id is required")
		return
	}

	task, exists, err := model.GetByTaskId(c.GetInt("id"), taskID)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("query image task %s: %v", taskID, err))
		imageTaskError(c, http.StatusInternalServerError, "Failed to query image task")
		return
	}
	if !exists || task == nil || task.Platform != constant.TaskPlatformOpenAIImage {
		imageTaskError(c, http.StatusNotFound, "Image task not found")
		return
	}

	c.Header("Cache-Control", "no-store")
	if task.Status != model.TaskStatusSuccess && task.Status != model.TaskStatusFailure {
		c.Header("Retry-After", "2")
	}
	c.JSON(http.StatusOK, image_stream.BuildImageTaskResponse(task))
}

func imageTaskError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{
		"error": gin.H{
			"message": message,
			"type":    "invalid_request_error",
			"code":    "image_task_error",
		},
	})
}
