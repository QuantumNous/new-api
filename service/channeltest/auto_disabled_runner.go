package channeltest

import (
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type ChannelTestExecution struct {
	Context      *gin.Context
	LocalErr     error
	NewAPIError  *types.NewAPIError
	Milliseconds int64
}

type AutoDisabledRunOptions struct {
	Notify                        bool
	Trigger                       string
	ResponseThresholdMilliseconds int64
	Execute                       func(channel *model.Channel) ChannelTestExecution
	EnableChannel                 func(channelId int, channelKey string, channelName string)
	HandleFailure                 func(channel *model.Channel, result ChannelTestExecution, err *types.NewAPIError, trigger string)
	NotifyDone                    func()
	SleepInterval                 time.Duration
}

func RunAutoDisabledChannelTest(options AutoDisabledRunOptions) error {
	if options.Execute == nil {
		return fmt.Errorf("auto-disabled channel test execute function is nil")
	}
	if options.EnableChannel == nil {
		return fmt.Errorf("auto-disabled channel test enable function is nil")
	}

	trigger := options.Trigger
	if trigger == "" {
		trigger = TriggerAuto
		if options.Notify {
			trigger = TriggerManual
		}
	}

	responseThresholdMilliseconds := options.ResponseThresholdMilliseconds
	if responseThresholdMilliseconds <= 0 {
		responseThresholdMilliseconds = 10000000
	}

	sleepInterval := options.SleepInterval
	if sleepInterval <= 0 {
		sleepInterval = common.RequestInterval
	}

	return SubmitWithPending(TaskKindAutoDisabledChannel, func() {
		channels, getChannelErr := model.GetAllChannels(0, 0, true, false)
		if getChannelErr != nil {
			common.SysLog(fmt.Sprintf("auto-disabled channel test aborted: %v", getChannelErr))
			return
		}

		candidates := 0
		tested := 0
		passed := 0
		enabled := 0

		for _, channel := range channels {
			if channel.Status != common.ChannelStatusAutoDisabled {
				continue
			}
			candidates++

			result := options.Execute(channel)
			tested++

			newAPIError := result.NewAPIError
			if result.LocalErr != nil {
				newAPIError = types.NewOpenAIError(result.LocalErr, types.ErrorCodeInvalidRequest, http.StatusBadRequest)
			}
			if newAPIError == nil && result.Milliseconds > responseThresholdMilliseconds {
				err := fmt.Errorf("响应时间 %.2fs 超过自动禁用渠道阈值 %.2fs", float64(result.Milliseconds)/1000.0, float64(responseThresholdMilliseconds)/1000.0)
				newAPIError = types.NewOpenAIError(err, types.ErrorCodeChannelResponseTimeExceeded, http.StatusRequestTimeout)
			}

			if newAPIError == nil {
				passed++
				channelKey := ""
				if result.Context != nil {
					channelKey = common.GetContextKeyString(result.Context, constant.ContextKeyChannelKey)
				}
				options.EnableChannel(channel.Id, channelKey, channel.Name)
				enabled++
			} else {
				if options.HandleFailure != nil {
					options.HandleFailure(channel, result, newAPIError, trigger)
				} else {
					RecordChannelTestErrorLog(result.Context, channel, "", trigger, ScopeAutoDisabled, int(result.Milliseconds/1000), false, newAPIError)
				}
			}

			channel.UpdateResponseTime(result.Milliseconds)
			time.Sleep(sleepInterval)
		}

		common.SysLog(fmt.Sprintf("auto-disabled channel test summary: candidates=%d tested=%d passed=%d enabled=%d", candidates, tested, passed, enabled))

		if options.Notify && options.NotifyDone != nil {
			options.NotifyDone()
		}
	})
}
