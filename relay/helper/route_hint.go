package helper

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

// RouteHint 在 Token 开启 ModelRouteNotify 且本次走了 image-aware 路由时，返回注入响应体的提示文本；否则返回空串。
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
