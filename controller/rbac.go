package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type replaceUserRolesRequest struct {
	RoleCodes []string `json:"role_codes"`
}

func ListRBACRoles(c *gin.Context) {
	roles, err := model.ListRolesWithPermissions()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, roles)
}

func ListRBACPermissions(c *gin.Context) {
	permissions, err := model.ListPermissions()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, permissions)
}

func ListRBACUserRoles(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	roles, err := model.ListUserRoles(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, roles)
}

func ReplaceRBACUserRoles(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req replaceUserRolesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.ReplaceUserRoles(userId, req.RoleCodes); err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordOperationAuditLog(
		userId,
		"RBAC roles updated",
		c.ClientIP(),
		"rbac.user_roles.update",
		map[string]interface{}{"target_user_id": userId, "role_codes": req.RoleCodes},
		map[string]interface{}{
			"admin_id":       c.GetInt("id"),
			"admin_username": c.GetString("username"),
			"admin_role":     c.GetInt("role"),
		},
		map[string]interface{}{"route": c.FullPath(), "method": c.Request.Method, "success": true},
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
	common.ApiSuccess(c, gin.H{"user_id": userId, "role_codes": req.RoleCodes})
}
