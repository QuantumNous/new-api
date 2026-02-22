package channeltest

import (
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

var autoDisabledSchedulerOnce sync.Once

func StartAutoDisabledChannelScheduler(run func(notify bool) error) {
	if run == nil {
		return
	}
	autoDisabledSchedulerOnce.Do(func() {
		for {
			if !operation_setting.GetMonitorSetting().AutoTestAutoDisabledChannelEnabled {
				time.Sleep(1 * time.Minute)
				continue
			}
			for {
				monitorSetting := operation_setting.GetMonitorSetting()
				frequency := monitorSetting.AutoTestAutoDisabledChannelMinutes
				time.Sleep(time.Duration(int(math.Round(frequency))) * time.Minute)
				common.SysLog(fmt.Sprintf("automatically test auto-disabled channels with interval %f minutes", frequency))
				common.SysLog("automatically testing auto-disabled channels")
				_ = run(false)
				common.SysLog("automatically auto-disabled channel test finished")
				if !operation_setting.GetMonitorSetting().AutoTestAutoDisabledChannelEnabled {
					break
				}
			}
		}
	})
}
