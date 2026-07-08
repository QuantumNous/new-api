package middleware

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

// CanvasStaticAuth 画布静态应用(/canvas-app/*)的轻量登录态门禁。
//
// 与 UserAuth 的区别:浏览器加载 JS/CSS/图片等静态资源不会附带 New-Api-User
// 自定义头,因此这里只校验 session cookie 中的登录态与用户状态,并校验
// HeaderNavModules 中画布模块开关;不接受 access token(避免用系统 token
// 直接打开内置 UI)。
//
// - 模块关闭        -> 404
// - 未登录          -> 302 /login
// - 已登录但被禁用  -> 403
func CanvasStaticAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !canvasModuleEnabled() {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}
		session := sessions.Default(c)
		id := session.Get("id")
		if id == nil {
			c.Redirect(http.StatusFound, "/login")
			c.Abort()
			return
		}
		status, ok := session.Get("status").(int)
		if !ok || status != common.UserStatusEnabled {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}
		c.Next()
	}
}

// canvasModuleEnabled 读取 HeaderNavModules 选项中的 canvas 开关。
// 画布功能灰度期默认关闭:未配置(选项为空/键缺失/解析失败)一律视为关闭,
// 仅当 admin 在后台显式设置 canvas=true 时开放;前端导航同语义(`canvas === true`)。
func canvasModuleEnabled() bool {
	common.OptionMapRWMutex.RLock()
	raw := common.OptionMap["HeaderNavModules"]
	common.OptionMapRWMutex.RUnlock()
	if strings.TrimSpace(raw) == "" {
		return false
	}
	var modules map[string]interface{}
	if err := common.UnmarshalJsonStr(raw, &modules); err != nil {
		return false
	}
	enabled, ok := modules["canvas"].(bool)
	return ok && enabled
}
