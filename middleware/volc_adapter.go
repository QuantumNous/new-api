package middleware

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
)

func VolcRequestConvert() func(c *gin.Context) {
	return func(c *gin.Context) {
		path := c.FullPath()
		if path == "" && c.Request != nil && c.Request.URL != nil {
			path = c.Request.URL.Path
		}

		switch {
		case c.Request.Method == http.MethodPost && strings.HasSuffix(path, "/images/generations"):
			convertVolcImageRequest(c)
		case c.Request.Method == http.MethodPost && strings.HasSuffix(path, "/contents/generations/tasks"):
			convertVolcVideoSubmitRequest(c)
		case c.Request.Method == http.MethodGet && strings.HasSuffix(path, "/contents/generations/tasks"):
			convertVolcVideoListRequest(c)
		case c.Request.Method == http.MethodGet && strings.Contains(path, "/contents/generations/tasks/:id"):
			convertVolcVideoFetchRequest(c)
		case c.Request.Method == http.MethodDelete && strings.Contains(path, "/contents/generations/tasks/:id"):
			abortWithOpenAiMessage(c, http.StatusNotImplemented, "DELETE /api/v3/contents/generations/tasks/:id is not supported yet")
		}

		if !c.IsAborted() {
			c.Next()
		}
	}
}

func convertVolcImageRequest(c *gin.Context) {
	originalReq, ok := parseVolcRequestBody(c)
	if !ok {
		return
	}

	unifiedReq := map[string]any{
		"model":    firstNonEmptyString(originalReq, "model", "model_name", "req_key"),
		"prompt":   firstNonEmptyString(originalReq, "prompt", "content"),
		"metadata": originalReq,
	}
	rewriteRequestBody(c, unifiedReq)
	if c.IsAborted() {
		return
	}
	c.Request.URL.Path = "/v1/images/generations"
}

func convertVolcVideoSubmitRequest(c *gin.Context) {
	originalReq, ok := parseVolcRequestBody(c)
	if !ok {
		return
	}

	unifiedReq := map[string]any{
		"model":    firstNonEmptyString(originalReq, "model", "model_name", "req_key"),
		"prompt":   firstNonEmptyString(originalReq, "prompt", "content"),
		"metadata": originalReq,
	}
	rewriteRequestBody(c, unifiedReq)
	if c.IsAborted() {
		return
	}
	if image, ok := originalReq["image"]; !ok || image == "" {
		c.Set("action", constant.TaskActionTextGenerate)
	}
	c.Request.URL.Path = "/v1/video/generations"
}

func convertVolcVideoFetchRequest(c *gin.Context) {
	taskID := c.Param("id")
	if taskID == "" {
		abortWithOpenAiMessage(c, http.StatusBadRequest, "id path parameter is required")
		return
	}
	c.Request.URL.Path = "/v1/video/generations/" + taskID
	c.Set("task_id", taskID)
	c.Set("relay_mode", relayconstant.RelayModeVideoFetchByID)
}

func convertVolcVideoListRequest(c *gin.Context) {
	c.Request.URL.Path = "/v1/video/generations"
	c.Set("relay_mode", relayconstant.RelayModeVideoFetchList)
}

func parseVolcRequestBody(c *gin.Context) (map[string]any, bool) {
	var originalReq map[string]any
	if err := common.UnmarshalBodyReusable(c, &originalReq); err != nil {
		abortWithOpenAiMessage(c, http.StatusBadRequest, "Invalid request body")
		return nil, false
	}
	return originalReq, true
}

func rewriteRequestBody(c *gin.Context, body map[string]any) {
	jsonData, err := common.Marshal(body)
	if err != nil {
		abortWithOpenAiMessage(c, http.StatusInternalServerError, "Failed to marshal request body")
		return
	}
	c.Request.Body = io.NopCloser(bytes.NewBuffer(jsonData))
	c.Request.ContentLength = int64(len(jsonData))
	c.Set(common.KeyBodyStorage, nil)
	c.Set(common.KeyRequestBody, jsonData)
}

func firstNonEmptyString(data map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := data[key].(string); ok && value != "" {
			return value
		}
	}
	return ""
}
