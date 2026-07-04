package service

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

// 全局唯一实例（guard 的内存态依赖单例）
var commissionSvc = NewCommissionService()

// GetCommissionService 获取全局返佣服务实例
func GetCommissionService() *CommissionService {
	return commissionSvc
}

// InitCommission 注册消费→返佣挂钩,在 main.go 启动时调用一次
func InitCommission() {
	model.OnConsumeLogRecorded = func(logId int64, userId int, modelName string, quota int) {
		if !common.CommissionEnabled || quota <= 0 {
			return
		}
		gopool.Go(func() { // 带 recover,panic 不会杀进程
			req := CommissionRequest{
				UserID: userId, LogID: logId,
				ModelName: modelName, QuotaUsed: quota,
			}
			if _, err := commissionSvc.ProcessCommission(req); err != nil {
				common.SysLog(fmt.Sprintf("返佣处理失败: log=%d user=%d err=%v", logId, userId, err))
			}
		})
	}
}
