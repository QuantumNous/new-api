package helper

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

// RouteHint 返回要注入到响应体里的模型切换提示文本。
// 当 Token 开启了 ModelRouteNotify 且本次请求走了 image-aware 路由时，返回一段
// 形如 `> [Route: auto-coder → visual-model (image detected)]\n\n` 的提示；
// 否则返回空串（调用方应跳过注入）。
func RouteHint(c *gin.Context, info *relaycommon.RelayInfo) string {
	if info == nil || !info.TokenModelRouteNotify {
		return ""
	}
	entryModel := common.GetContextKeyString(c, constant.ContextKeyImageAwareEntryModel)
	if entryModel == "" {
		return ""
	}
	hasImage := common.GetContextKeyBool(c, constant.ContextKeyImageAwareHasImage)
	reason := "no image"
	if hasImage {
		reason = "image detected"
	}
	return fmt.Sprintf("> [Route: %s → %s (%s)]\n\n", entryModel, info.OriginModelName, reason)
}
