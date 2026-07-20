package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const (
	secureVerificationMethod2FA     = "2fa"
	secureVerificationMethodPasskey = "passkey"
)

type UniversalVerifyRequest struct {
	Method string `json:"method"`
	Code   string `json:"code,omitempty"`
	Scope  string `json:"scope"`
}

func UniversalVerify(c *gin.Context) {
	identity, ok := middleware.GetSessionAuthIdentity(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "当前认证方式不支持安全验证"})
		return
	}
	var request UniversalVerifyRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiError(c, fmt.Errorf("参数错误: %v", err))
		return
	}
	if request.Method != secureVerificationMethod2FA {
		common.ApiError(c, errors.New("Passkey 验证必须使用 Passkey verify 流程"))
		return
	}
	if !isAllowedSecurityProofScope(request.Scope) {
		common.ApiError(c, errors.New("不支持的安全验证范围"))
		return
	}
	if strings.TrimSpace(request.Code) == "" {
		common.ApiError(c, errors.New("验证码不能为空"))
		return
	}
	twoFA, err := model.GetTwoFAByUserId(identity.UserID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if twoFA == nil || !twoFA.IsEnabled {
		common.ApiError(c, errors.New("用户未启用2FA"))
		return
	}
	if !validateTwoFactorAuth(twoFA, request.Code) {
		common.ApiError(c, errors.New("验证失败，请检查验证码"))
		return
	}
	proofToken, expiresAt, err := service.IssueSecurityProof(identity, request.Method, []string{request.Scope})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordLog(identity.UserID, model.LogTypeSystem, "通用安全验证成功 (验证方式: 2FA)")
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "验证成功",
		"data": gin.H{
			"proof_token": proofToken,
			"expires_at":  expiresAt,
			"method":      request.Method,
			"scope":       request.Scope,
		},
	})
}

func isAllowedSecurityProofScope(scope string) bool {
	switch scope {
	case securityProofScopeChannelKeyRead, securityProofScopePasskeyRegister, securityProofScopePasskeyDelete:
		return true
	default:
		return false
	}
}
