package service

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func InitializeChannelRetry(c *gin.Context, channel *model.Channel) {
	if channel == nil {
		return
	}
	currentID := common.GetContextKeyInt(c, constant.ContextKeyChannelRetryCurrentID)
	if currentID == channel.Id {
		return
	}
	common.SetContextKey(c, constant.ContextKeyChannelRetryCurrentID, channel.Id)
	common.SetContextKey(c, constant.ContextKeyChannelRetryAttempts, 0)
	common.SetContextKey(c, constant.ContextKeyChannelRetryMaxAttempts, channel.GetRetryAttempts())
}

func GetLockedRetryChannelID(c *gin.Context) int {
	return common.GetContextKeyInt(c, constant.ContextKeyChannelRetryCurrentID)
}

func RecordChannelFailure(c *gin.Context, channelID int) bool {
	if channelID <= 0 || GetLockedRetryChannelID(c) != channelID {
		return false
	}
	attempts := common.GetContextKeyInt(c, constant.ContextKeyChannelRetryAttempts) + 1
	maxAttempts := common.GetContextKeyInt(c, constant.ContextKeyChannelRetryMaxAttempts)
	common.SetContextKey(c, constant.ContextKeyChannelRetryAttempts, attempts)
	if attempts < maxAttempts {
		return true
	}
	excluded := GetExcludedRetryChannelIDs(c)
	excluded[channelID] = struct{}{}
	common.SetContextKey(c, constant.ContextKeyChannelRetryExcludedIDs, excluded)
	ClearLockedRetryChannel(c)
	return false
}

func ClearLockedRetryChannel(c *gin.Context) {
	common.SetContextKey(c, constant.ContextKeyChannelRetryCurrentID, 0)
	common.SetContextKey(c, constant.ContextKeyChannelRetryAttempts, 0)
	common.SetContextKey(c, constant.ContextKeyChannelRetryMaxAttempts, 0)
}

func GetExcludedRetryChannelIDs(c *gin.Context) map[int]struct{} {
	value, exists := common.GetContextKey(c, constant.ContextKeyChannelRetryExcludedIDs)
	if !exists {
		return make(map[int]struct{})
	}
	excluded, ok := value.(map[int]struct{})
	if !ok {
		return make(map[int]struct{})
	}
	return excluded
}
