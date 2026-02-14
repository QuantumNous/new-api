package group_monitor

import (
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

var autoGroupMonitorOnce sync.Once

// AutomaticallyGroupMonitor 后台定时分组监控任务
func AutomaticallyGroupMonitor() {
	if !common.IsMasterNode {
		return
	}
	autoGroupMonitorOnce.Do(func() {
		for {
			setting := GetGroupMonitorSetting()
			if !setting.Enabled {
				time.Sleep(1 * time.Minute)
				continue
			}
			for {
				setting = GetGroupMonitorSetting()
				interval := time.Duration(int(math.Round(setting.IntervalMins))) * time.Minute
				time.Sleep(interval)
				common.SysLog("group monitor: starting group health check")
				runGroupMonitor(setting)
				common.SysLog("group monitor: health check finished")
				_ = CleanupGroupMonitorLogs(setting.RetainDays)
				if !GetGroupMonitorSetting().Enabled {
					break
				}
			}
		}
	})
}

func runGroupMonitor(setting *GroupMonitorSetting) {
	configs, err := GetEnabledGroupMonitorConfigs()
	if err != nil {
		common.SysError(fmt.Sprintf("group monitor: failed to get configs: %v", err))
		return
	}

	for _, cfg := range configs {
		testModel := cfg.TestModel
		if testModel == "" {
			testModel = setting.TestModel
		}

		channelId := cfg.ChannelId
		if channelId <= 0 {
			common.SysLog(fmt.Sprintf("group monitor: group %s has no channel configured, skipping", cfg.GroupName))
			continue
		}

		channel, err := model.GetChannelById(channelId, true)
		if err != nil || channel == nil {
			common.SysLog(fmt.Sprintf("group monitor: channel %d not found for group %s, skipping", channelId, cfg.GroupName))
			continue
		}

		// 检查渠道是否被手动禁用
		if channel.Status == common.ChannelStatusManuallyDisabled {
			common.SysLog(fmt.Sprintf("group monitor: channel %d is manually disabled for group %s, skipping", channelId, cfg.GroupName))
			continue
		}

		// 自动回退：如果渠道不支持指定的测试模型，用渠道的第一个可用模型
		actualModel := testModel
		if !channelSupportsModel(channel, testModel) {
			models := channel.GetModels()
			if len(models) > 0 {
				actualModel = models[0]
			} else {
				common.SysLog(fmt.Sprintf("group monitor: channel %d has no models for group %s, skipping", channelId, cfg.GroupName))
				continue
			}
		}

		groupName := cfg.GroupName
		gopool.Go(func() {
			testAndRecord(groupName, channel, actualModel)
		})

		time.Sleep(common.RequestInterval)
	}
}

func channelSupportsModel(channel *model.Channel, testModel string) bool {
	models := channel.GetModels()
	for _, m := range models {
		if strings.TrimSpace(m) == testModel {
			return true
		}
	}
	return false
}

func testAndRecord(groupName string, channel *model.Channel, testModel string) {
	result := controller.TestChannelForMonitor(channel, testModel)

	log := &GroupMonitorLog{
		GroupName:   groupName,
		ChannelId:   channel.Id,
		ChannelName: channel.Name,
		ModelName:   testModel,
		LatencyMs:   result.LatencyMs,
		Success:     result.Success,
		ErrorMsg:    result.ErrorMsg,
		CreatedAt:   common.GetTimestamp(),
	}

	err := CreateGroupMonitorLog(log)
	if err != nil {
		common.SysError(fmt.Sprintf("group monitor: failed to save log for group %s: %v", groupName, err))
	}
}
