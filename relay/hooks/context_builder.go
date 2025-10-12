package hooks

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/core/interfaces"
	"github.com/gin-gonic/gin"
)

// BuildHookContext 从Gin Context构建HookContext
func BuildHookContext(c *gin.Context) *interfaces.HookContext {
	ctx := &interfaces.HookContext{
		GinContext: c,
		Request:    c.Request,
		Data:       make(map[string]interface{}),
	}
	
	// 提取Channel信息
	if channelID, ok := common.GetContextKey(c, constant.ContextKeyChannelId); ok {
		if id, ok := channelID.(int); ok {
			ctx.ChannelID = id
		}
	}
	
	if channelType, ok := common.GetContextKey(c, constant.ContextKeyChannelType); ok {
		if t, ok := channelType.(int); ok {
			ctx.ChannelType = t
		}
	}
	
	if channelName, ok := common.GetContextKey(c, constant.ContextKeyChannelName); ok {
		if name, ok := channelName.(string); ok {
			ctx.ChannelName = name
		}
	}
	
	// 提取Model信息
	if originalModel, ok := common.GetContextKey(c, constant.ContextKeyOriginalModel); ok {
		if m, ok := originalModel.(string); ok {
			ctx.OriginalModel = m
			ctx.Model = m // 使用OriginalModel作为Model
		}
	}
	
	// 提取User信息
	if userID, ok := common.GetContextKey(c, constant.ContextKeyUserId); ok {
		if id, ok := userID.(int); ok {
			ctx.UserID = id
		}
	}
	
	if tokenID, ok := common.GetContextKey(c, constant.ContextKeyTokenId); ok {
		if id, ok := tokenID.(int); ok {
			ctx.TokenID = id
		}
	}
	
	if group, ok := common.GetContextKey(c, constant.ContextKeyUsingGroup); ok {
		if g, ok := group.(string); ok {
			ctx.Group = g
		}
	}
	
	return ctx
}

// UpdateHookContextWithResponse 更新HookContext的Response信息
func UpdateHookContextWithResponse(ctx *interfaces.HookContext, resp *http.Response, body []byte) {
	ctx.Response = resp
	ctx.ResponseBody = body
}

// UpdateHookContextWithRequest 更新HookContext的Request信息
func UpdateHookContextWithRequest(ctx *interfaces.HookContext, body []byte) {
	ctx.RequestBody = body
}

