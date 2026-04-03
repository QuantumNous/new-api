package controller

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func readEmailBindRequest(c *gin.Context) (emailBindRequest, error) {
	var req emailBindRequest
	if err := decodeOptionalJSONBody(c, &req); err != nil {
		return req, err
	}
	if req.Email == "" {
		req.Email = firstNonEmptyRequestValue(c, "email")
	}
	if req.Code == "" {
		req.Code = firstNonEmptyRequestValue(c, "code")
	}
	return req, nil
}

func readWeChatBindRequest(c *gin.Context) (wechatBindRequest, error) {
	var req wechatBindRequest
	if err := decodeOptionalJSONBody(c, &req); err != nil {
		return req, err
	}
	if req.Code == "" {
		req.Code = firstNonEmptyRequestValue(c, "code")
	}
	return req, nil
}

func decodeOptionalJSONBody(c *gin.Context, req any) error {
	if c == nil || c.Request == nil || c.Request.Body == nil {
		return nil
	}
	if c.Request.Method != http.MethodPost {
		return nil
	}
	contentType := strings.ToLower(strings.TrimSpace(c.ContentType()))
	if !strings.Contains(contentType, "json") {
		return nil
	}
	return common.DecodeJson(c.Request.Body, req)
}

func firstNonEmptyRequestValue(c *gin.Context, key string) string {
	if c == nil {
		return ""
	}
	if value := strings.TrimSpace(c.PostForm(key)); value != "" {
		return value
	}
	return strings.TrimSpace(c.Query(key))
}
