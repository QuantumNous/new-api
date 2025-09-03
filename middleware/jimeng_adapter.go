package middleware

import (
	"bytes"
	"encoding/json"
	"github.com/gin-gonic/gin"
	"io"
	"net/http"
	"one-api/common"
	"one-api/constant"
	relayconstant "one-api/relay/constant"
)

func JimengRequestConvert() func(c *gin.Context) {
	return func(c *gin.Context) {
		action := c.Query("Action")
		if action == "" {
			abortWithOpenAiMessage(c, http.StatusBadRequest, "Action query parameter is required")
			return
		}

		// Handle Jimeng official API request
		var originalReq map[string]interface{}
		if err := common.UnmarshalBodyReusable(c, &originalReq); err != nil {
			abortWithOpenAiMessage(c, http.StatusBadRequest, "Invalid request body")
			return
		}
		model, _ := originalReq["req_key"].(string)
		prompt, _ := originalReq["prompt"].(string)

		unifiedReq := map[string]interface{}{
			"model":    model,
			"prompt":   prompt,
			"metadata": originalReq,
		}

		jsonData, err := json.Marshal(unifiedReq)
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "Failed to marshal request body")
			return
		}

		// Update request body
		c.Request.Body = io.NopCloser(bytes.NewBuffer(jsonData))
		c.Set(common.KeyRequestBody, jsonData)

		if image, ok := originalReq["image"]; !ok || image == "" {
			c.Set("action", constant.TaskActionTextGenerate)
		}

		c.Request.URL.Path = "/v1/video/generations"

		if action == "CVSync2AsyncGetResult" {
			taskId, ok := originalReq["task_id"].(string)
			if !ok || taskId == "" {
				abortWithOpenAiMessage(c, http.StatusBadRequest, "task_id is required for CVSync2AsyncGetResult")
				return
			}
			c.Request.URL.Path = "/v1/video/generations/" + taskId
			c.Request.Method = http.MethodGet
			c.Set("task_id", taskId)
			c.Set("relay_mode", relayconstant.RelayModeVideoFetchByID)
		}
		c.Next()
	}
}
