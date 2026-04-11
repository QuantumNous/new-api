package middleware

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

const governorSelectionRejectedMessage = "all candidate channels are cooling or saturated"

var selectChannelForRetry = service.CacheGetRandomSatisfiedChannel
var setupChannelContext = SetupContextForSelectedChannel

func swapSelectChannelForTest(fn func(*service.RetryParam) (*model.Channel, string, error)) func() {
	previous := selectChannelForRetry
	selectChannelForRetry = fn
	return func() {
		selectChannelForRetry = previous
	}
}

func swapSetupContextForTest(fn func(*gin.Context, *model.Channel, string) *types.NewAPIError) func() {
	previous := setupChannelContext
	setupChannelContext = fn
	return func() {
		setupChannelContext = previous
	}
}

func SelectChannelForCurrentRetry(c *gin.Context, retryParam *service.RetryParam, modelName string) (*model.Channel, string, *types.NewAPIError) {
	if retryParam == nil {
		return nil, "", types.NewError(errors.New("retry param is nil"), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
	if retryParam.Ctx == nil {
		retryParam.Ctx = c
	}

	for {
		channel, selectGroup, err := selectChannelForRetry(retryParam)
		if err != nil {
			return nil, selectGroup, types.NewError(
				fmt.Errorf("get available channel failed: %w", err),
				types.ErrorCodeGetChannelFailed,
				types.ErrOptionWithSkipRetry(),
			)
		}
		if channel == nil {
			return nil, selectGroup, nil
		}
		if retryParam.IsExcluded(channel.Id) {
			return nil, selectGroup, types.NewError(
				fmt.Errorf("selected channel %d is already excluded", channel.Id),
				types.ErrorCodeGetChannelFailed,
				types.ErrOptionWithSkipRetry(),
			)
		}

		setupErr := setupChannelContext(c, channel, modelName)
		if setupErr == nil {
			return channel, selectGroup, nil
		}
		if setupErr.GetErrorCode() != types.ErrorCodeGovernorSelectionRejected {
			return nil, selectGroup, setupErr
		}

		retryParam.ExcludeChannel(channel.Id)
	}
}
