package middleware

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// SubAccountForbidden 黑名单中间件：挂在子账户「不允许」碰的写入口上
// （充值/令牌写/兑换/签到/邀请/认证/对公转账/发票写/子账户管理/绘图日志等）。
//
// 子账户的本质是「隶属于某企业的只读视图」（users.parent_user_id > 0）。这是服务端
// 强制的安全边界，前端隐藏入口只是体验优化。管理员/超管恒放行（role>=Admin 本不会是子账户）。
//
// 与 KYCRequired 同构地兼容两条鉴权链路：优先读 TokenAuth 写入的 context key，
// UserAuth 链路 miss 时回源 userCache（GetUserCache 已实时回源 DB，主账户把某用户
// 改成子账户也能即时生效）。
func SubAccountForbidden() gin.HandlerFunc {
	return func(c *gin.Context) {
		role := readUserRole(c)
		if role >= common.RoleAdminUser {
			c.Next()
			return
		}
		if readUserParentId(c) > 0 {
			abortWithOpenAiMessage(c, http.StatusForbidden,
				common.TranslateMessage(c, i18n.MsgSubAccountForbidden),
				types.ErrorCodeAccessDenied)
			return
		}
		c.Next()
	}
}

// readUserParentId mirrors readUserEnterpriseStatus: prefer the TokenAuth-written
// context key, fall back to a userCache lookup on the UserAuth path. Returns 0
// (not a sub-account) when no user id is set or cache lookup fails.
func readUserParentId(c *gin.Context) int {
	if v, ok := c.Get(string(constant.ContextKeyUserParentId)); ok {
		if parentId, ok := v.(int); ok {
			return parentId
		}
	}
	userId := c.GetInt("id")
	if userId <= 0 {
		return 0
	}
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		return 0
	}
	return userCache.ParentUserId
}
