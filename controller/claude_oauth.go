package controller

import (
	"net/http"
	"one-api/common"
	"one-api/service"

	"github.com/gin-gonic/gin"
)

// ExchangeCodeRequest 授权码交换请求
type ExchangeCodeRequest struct {
	AuthorizationCode string `json:"authorization_code" binding:"required"`
	CodeVerifier      string `json:"code_verifier" binding:"required"`
	State             string `json:"state" binding:"required"`
}

// GenerateClaudeOAuthURL 生成Claude OAuth授权URL
func GenerateClaudeOAuthURL(c *gin.Context) {
	params, err := service.GenerateOAuthParams()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "生成OAuth授权URL失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "生成OAuth授权URL成功",
		"data":    params,
	})
}

// ExchangeClaudeOAuthCode 交换Claude OAuth授权码
func ExchangeClaudeOAuthCode(c *gin.Context) {
	var req ExchangeCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "请求参数错误: " + err.Error(),
		})
		return
	}

	// 解析授权码
	cleanedCode, err := service.ParseAuthorizationCode(req.AuthorizationCode)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// 交换token
	tokenResult, err := service.ExchangeCode(cleanedCode, req.CodeVerifier, req.State, nil)
	if err != nil {
		common.SysError("Claude OAuth token exchange failed: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "授权码交换失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "授权码交换成功",
		"data":    tokenResult,
	})
}
