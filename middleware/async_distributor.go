package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// AsyncImageDistribute selects only channels that explicitly opt in to the
// synchronous-to-asynchronous image wrapper. Synchronous relay selection is
// deliberately left unchanged.
func AsyncImageDistribute() func(c *gin.Context) {
	return func(c *gin.Context) {
		request, _, err := getModelRequest(c)
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusBadRequest, "invalid async image request: "+err.Error(), types.ErrorCodeInvalidRequest)
			return
		}
		if request.Model == "" {
			abortWithOpenAiMessage(c, http.StatusBadRequest, "model is required", types.ErrorCodeInvalidRequest)
			return
		}

		if common.GetContextKeyBool(c, constant.ContextKeyTokenModelLimitEnabled) {
			limits, ok := common.GetContextKey(c, constant.ContextKeyTokenModelLimit)
			allowed, valid := limits.(map[string]bool)
			if !ok || !valid || !allowed[ratio_setting.FormatMatchingModelName(request.Model)] {
				abortWithOpenAiMessage(c, http.StatusForbidden, fmt.Sprintf("token cannot access model %s", request.Model), types.ErrorCodeAccessDenied)
				return
			}
		}

		usingGroup := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
		selectedGroup := usingGroup
		var channel *model.Channel
		if usingGroup == "auto" {
			userGroup := common.GetContextKeyString(c, constant.ContextKeyUserGroup)
			for _, group := range service.GetUserAutoGroup(userGroup) {
				channel, err = model.GetAsyncImageChannel(group, request.Model)
				if err != nil {
					break
				}
				if channel != nil {
					selectedGroup = group
					common.SetContextKey(c, constant.ContextKeyAutoGroup, group)
					break
				}
			}
		} else {
			channel, err = model.GetAsyncImageChannel(usingGroup, request.Model)
		}
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "failed to select async image channel", types.ErrorCodeGetChannelFailed)
			return
		}
		if channel == nil {
			abortWithOpenAiMessage(c, http.StatusServiceUnavailable, fmt.Sprintf("no async image channel is enabled for model %s", request.Model), types.ErrorCodeModelNotFound)
			return
		}
		common.SetContextKey(c, constant.ContextKeyUsingGroup, selectedGroup)
		common.SetContextKey(c, constant.ContextKeyRequestStartTime, time.Now())
		if apiErr := SetupContextForSelectedChannel(c, channel, request.Model); apiErr != nil {
			abortWithOpenAiMessage(c, apiErr.StatusCode, apiErr.Error(), apiErr.GetErrorCode())
			return
		}
		c.Next()
	}
}
