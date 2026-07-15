package middleware

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// RequireRole 校验当前登录用户的 RoleLevel（见 model.RoleLevel*）是否属于给定集合，
// 否则返回 403。用于治理端点（区别于原生 AdminAuth/RootAuth 的 admin/common 角色）。
//
// 前置条件：调用方必须先经过 authHelper（UserAuth/AdminAuth/GovernanceAuth 等）填充
// context 中的 role_level 与 department，否则读到默认值 0（普通用户）而被拒。
func RequireRole(levels ...int) gin.HandlerFunc {
	return func(c *gin.Context) {
		level := c.GetInt("role_level")
		ok := false
		for _, l := range levels {
			if l == level {
				ok = true
				break
			}
		}
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": common.TranslateMessage(c, i18n.MsgAuthInsufficientPrivilege),
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// GovernanceAuth 治理域鉴权：先完成会话/令牌鉴权（填充 id/role_level/department），
// 再要求 RoleLevel 为部门管理员或超级管理员（普通用户被拒 403）。
// 适用于预算池、额度审批等治理端点。
func GovernanceAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHelper(c, common.RoleCommonUser) // 至少需登录用户
		if c.IsAborted() {
			return
		}
		RequireRole(model.RoleLevelDeptAdmin, model.RoleLevelSuperAdmin)(c)
	}
}

// IsDeptAdmin 当前用户是否为部门管理员（RoleLevel=10）。
func IsDeptAdmin(c *gin.Context) bool {
	return c.GetInt("role_level") == model.RoleLevelDeptAdmin
}

// IsSuperAdmin 当前用户是否为超级管理员（RoleLevel=100）。
func IsSuperAdmin(c *gin.Context) bool {
	return c.GetInt("role_level") == model.RoleLevelSuperAdmin
}
