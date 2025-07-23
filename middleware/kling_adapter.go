package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"one-api/common"
	"one-api/constant"

	"github.com/gin-gonic/gin"
)

func KlingRequestConvert() func(c *gin.Context) {
	return func(c *gin.Context) {
		var originalReq map[string]interface{}
		if err := common.UnmarshalBodyReusable(c, &originalReq); err != nil {
			c.Next()
			return
		}

		// Support both model_name and model fields
		model, _ := originalReq["model_name"].(string)
		if model == "" {
			model, _ = originalReq["model"].(string)
		}
		prompt, _ := originalReq["prompt"].(string)

		unifiedReq := map[string]interface{}{
			"model":    model,
			"prompt":   prompt,
			"metadata": originalReq,
		}

		jsonData, err := json.Marshal(unifiedReq)
		if err != nil {
			c.Next()
			return
		}

		// Rewrite request body and path
		c.Request.Body = io.NopCloser(bytes.NewBuffer(jsonData))
		c.Request.URL.Path = "/v1/video/generations"
		if image, ok := originalReq["image"]; !ok || image == "" {
			c.Set("action", constant.TaskActionTextGenerate)
		}

		// We have to reset the request body for the next handlers
		c.Set(common.KeyRequestBody, jsonData)
		c.Next()
	}
}
