package service

import (
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// CommissionService 返佣服务
type CommissionService struct {
	guard *CommissionGuard
}

// NewCommissionService 创建返佣服务实例
func NewCommissionService() *CommissionService {
	return &CommissionService{
		guard: NewCommissionGuard(),
	}
}

// CommissionRequest 返佣请求
type CommissionRequest struct {
	UserID    int    `json:"user_id"`    // 消费用户ID
	LogID     int64  `json:"log_id"`     // 消费日志ID
	OrderID   string `json:"order_id"`   // 订单ID
	ModelName string `json:"model_name"` // 使用的模型
	QuotaUsed int    `json:"quota_used"` // 消费金额
}

// CommissionResult 返佣结果
type CommissionResult struct {
	TotalCommission int                `json:"total_commission"`
	Details         []CommissionDetail `json:"details"`
}

// CommissionDetail 单笔返佣详情
type CommissionDetail struct {
	InviterID       int     `json:"inviter_id"`
	Level           int     `json:"level"`
	CommissionRate  float64 `json:"commission_rate"`
	CommissionQuota int     `json:"commission_quota"`
	Status          string  `json:"status"`
}

// CalculateCommission 计算返佣（不执行，仅计算）
func (s *CommissionService) CalculateCommission(req CommissionRequest) (*CommissionResult, error) {
	// 1. 查找用户的邀请链（最多3级）
	inviterChain, err := s.getInviterChain(req.UserID, 3)
	if err != nil {
		return nil, err
	}

	if len(inviterChain) == 0 {
		return &CommissionResult{}, nil
	}

	// 2. 获取适用的返佣规则
	rule, err := model.GetApplicableRule(req.ModelName, req.QuotaUsed)
	if err != nil {
		return nil, err
	}

	result := &CommissionResult{}

	// 3. 计算各级返佣
	for level, inviterID := range inviterChain {
		if inviterID == 0 {
			break
		}

		// 防刷检查
		if err := s.guard.PreCheck(req.UserID, inviterID); err != nil {
			common.SysLog(fmt.Sprintf("返佣防刷检查失败: user=%d, inviter=%d, err=%v", req.UserID, inviterID, err))
			continue
		}

		var rate float64
		switch level {
		case 0:
			rate = rule.Level1Rate
		case 1:
			rate = rule.Level2Rate
		case 2:
			rate = rule.Level3Rate
		}

		if rate <= 0 {
			continue
		}

		// 计算返佣金额（四舍五入，避免小额消费返佣恒为0）
		commissionQuota := int(math.Round(float64(req.QuotaUsed) * rate))
		if commissionQuota <= 0 {
			continue
		}

		// 检查单次上限
		if rule.MaxCommission > 0 && commissionQuota > rule.MaxCommission {
			commissionQuota = rule.MaxCommission
		}

		// 检查每日限额
		if !s.checkDailyLimit(inviterID, commissionQuota, rule.DailyLimit) {
			common.SysLog(fmt.Sprintf("返佣每日限额: inviter=%d, commission=%d, limit=%d", inviterID, commissionQuota, rule.DailyLimit))
			continue
		}

		// 检查每月限额
		if !s.checkMonthlyLimit(inviterID, commissionQuota, rule.MonthlyLimit) {
			common.SysLog(fmt.Sprintf("返佣每月限额: inviter=%d, commission=%d, limit=%d", inviterID, commissionQuota, rule.MonthlyLimit))
			continue
		}

		detail := CommissionDetail{
			InviterID:       inviterID,
			Level:           level + 1,
			CommissionRate:  rate,
			CommissionQuota: commissionQuota,
			Status:          "pending",
		}
		result.Details = append(result.Details, detail)
		result.TotalCommission += commissionQuota
	}

	return result, nil
}

// ProcessCommission 执行返佣（实时结算）
func (s *CommissionService) ProcessCommission(req CommissionRequest) (*CommissionResult, error) {
	// 计算返佣
	result, err := s.CalculateCommission(req)
	if err != nil {
		return nil, err
	}

	if len(result.Details) == 0 {
		return result, nil
	}

	// 开始事务
	affectedInviterIds := make(map[int]struct{})
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		for i, detail := range result.Details {
			// 1. 创建返佣记录（幂等：使用 SourceKey 去重）
			sourceKey := fmt.Sprintf("log:%d", req.LogID)
			if req.OrderID != "" {
				sourceKey = fmt.Sprintf("order:%s", req.OrderID)
			}

			log := &model.CommissionLog{
				UserID:           req.UserID,
				InviterID:        detail.InviterID,
				Level:            detail.Level,
				SourceKey:        sourceKey,
				OrderId:          req.OrderID,
				LogId:            req.LogID,
				ModelName:        req.ModelName,
				ConsumptionQuota: req.QuotaUsed,
				CommissionRate:   detail.CommissionRate,
				CommissionQuota:  detail.CommissionQuota,
				Status:           "settled",
				SettledAt:        &time.Time{},
			}
			*log.SettledAt = time.Now()

			// 使用 OnConflict DoNothing，RowsAffected=0 表示已存在（重复触发）
			res := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(log)
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				// 已存在（重复触发），跳过该级，绝不加钱
				result.Details[i].Status = "skipped"
				continue
			}

			// 2. 实时结算到邀请人余额
			if err := tx.Model(&model.User{}).
				Where("id = ?", detail.InviterID).
				Updates(map[string]interface{}{
					"quota":       gorm.Expr("quota + ?", detail.CommissionQuota),
					"aff_quota":   gorm.Expr("aff_quota + ?", detail.CommissionQuota),
					"aff_history": gorm.Expr("aff_history + ?", detail.CommissionQuota),
				}).Error; err != nil {
				return err
			}

			// 记录需要失效缓存的用户ID
			affectedInviterIds[detail.InviterID] = struct{}{}

			// 更新详情状态
			result.Details[i].Status = "settled"

			common.SysLog(fmt.Sprintf("返佣成功: consumer=%d, inviter=%d, level=%d, rate=%.2f%%, quota=%d",
				req.UserID, detail.InviterID, detail.Level, detail.CommissionRate*100, detail.CommissionQuota))
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// 事务成功后，失效受影响用户的缓存
	for inviterId := range affectedInviterIds {
		_ = model.InvalidateUserCache(inviterId)
	}

	return result, nil
}

// RefundCommission 退款扣回返佣
func (s *CommissionService) RefundCommission(logID int64) error {
	// 1. 查找相关返佣记录
	logs, err := model.GetCommissionLogByLogId(logID)
	if err != nil {
		return err
	}

	if len(logs) == 0 {
		return nil // 没有返佣记录，无需扣回
	}

	// 2. 开始事务
	affectedInviterIds := make(map[int]struct{})
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		for _, log := range logs {
			if log.Status != "settled" {
				continue // 只扣回已结算的
			}

			// 3. 扣除返佣金额（使用GREATEST防止负数）
			if err := tx.Model(&model.User{}).
				Where("id = ?", log.InviterID).
				Updates(map[string]interface{}{
					"quota":     gorm.Expr("GREATEST(0, quota - ?)", log.CommissionQuota),
					"aff_quota": gorm.Expr("GREATEST(0, aff_quota - ?)", log.CommissionQuota),
				}).Error; err != nil {
				return err
			}

			// 4. 更新返佣记录状态
			if err := tx.Model(&model.CommissionLog{}).
				Where("id = ?", log.Id).
				Update("status", "refunded").Error; err != nil {
				return err
			}

			// 记录需要失效缓存的用户ID
			affectedInviterIds[log.InviterID] = struct{}{}

			common.SysLog(fmt.Sprintf("返佣扣回: log_id=%d, inviter=%d, quota=%d",
				log.Id, log.InviterID, log.CommissionQuota))
		}

		return nil
	})

	if err != nil {
		return err
	}

	// 事务成功后，失效受影响用户的缓存
	for inviterId := range affectedInviterIds {
		_ = model.InvalidateUserCache(inviterId)
	}

	return nil
}

// getInviterChain 获取邀请链
func (s *CommissionService) getInviterChain(userID int, maxLevel int) ([]int, error) {
	chain := make([]int, 0, maxLevel)
	visited := make(map[int]bool)
	currentID := userID

	for i := 0; i < maxLevel; i++ {
		if visited[currentID] {
			break // 检测到循环
		}
		visited[currentID] = true

		var user model.User
		if err := model.DB.Select("inviter_id").First(&user, currentID).Error; err != nil {
			break
		}

		if user.InviterId == 0 {
			break
		}

		// 检查邀请人是否存在且有效
		var inviter model.User
		if err := model.DB.Select("id, status").First(&inviter, user.InviterId).Error; err != nil {
			break
		}

		if inviter.Status != common.UserStatusEnabled {
			break // 邀请人已禁用
		}

		chain = append(chain, user.InviterId)
		currentID = user.InviterId
	}

	return chain, nil
}

// checkDailyLimit 检查每日限额
func (s *CommissionService) checkDailyLimit(inviterID int, newCommission int, dailyLimit int) bool {
	if dailyLimit <= 0 {
		return true // 不限制
	}

	// 计算今日已返佣总额
	today := time.Now().Format("2006-01-02")
	var totalToday int64
	err := model.DB.Model(&model.CommissionLog{}).
		Where("inviter_id = ? AND status = ? AND DATE(created_at) = ?", inviterID, "settled", today).
		Select("COALESCE(SUM(commission_quota), 0)").
		Scan(&totalToday).Error

	if err != nil {
		common.SysLog(fmt.Sprintf("检查每日限额失败: %v", err))
		return false // 查询失败，拒绝返佣
	}

	return int(totalToday)+newCommission <= dailyLimit
}

// checkMonthlyLimit 检查每月限额
func (s *CommissionService) checkMonthlyLimit(inviterID int, newCommission int, monthlyLimit int) bool {
	if monthlyLimit <= 0 {
		return true // 不限制
	}

	// 计算本月已返佣总额
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	var totalMonth int64
	err := model.DB.Model(&model.CommissionLog{}).
		Where("inviter_id = ? AND status = ? AND created_at >= ?", inviterID, "settled", monthStart).
		Select("COALESCE(SUM(commission_quota), 0)").
		Scan(&totalMonth).Error

	if err != nil {
		common.SysLog(fmt.Sprintf("检查每月限额失败: %v", err))
		return false // 查询失败，拒绝返佣
	}

	return int(totalMonth)+newCommission <= monthlyLimit
}

// checkDailyLimitTx 事务内检查每日限额（使用 tx 查询，Unix 秒范围）
func (s *CommissionService) checkDailyLimitTx(tx *gorm.DB, inviterID int, newCommission int, dailyLimit int) bool {
	if dailyLimit <= 0 {
		return true // 不限制
	}

	// 计算今日已返佣总额（Unix 秒范围）
	now := time.Now()
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()
	dayEnd := dayStart + 86400

	var totalToday int64
	err := tx.Model(&model.CommissionLog{}).
		Where("inviter_id = ? AND status = ? AND created_at >= ? AND created_at < ?", inviterID, "settled", dayStart, dayEnd).
		Select("COALESCE(SUM(commission_quota), 0)").
		Scan(&totalToday).Error

	if err != nil {
		common.SysLog(fmt.Sprintf("检查每日限额失败: %v", err))
		return false // 查询失败，拒绝返佣
	}

	return int(totalToday)+newCommission <= dailyLimit
}

// checkMonthlyLimitTx 事务内检查每月限额（使用 tx 查询，Unix 秒范围）
func (s *CommissionService) checkMonthlyLimitTx(tx *gorm.DB, inviterID int, newCommission int, monthlyLimit int) bool {
	if monthlyLimit <= 0 {
		return true // 不限制
	}

	// 计算本月已返佣总额（Unix 秒范围）
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Unix()

	var totalMonth int64
	err := tx.Model(&model.CommissionLog{}).
		Where("inviter_id = ? AND status = ? AND created_at >= ?", inviterID, "settled", monthStart).
		Select("COALESCE(SUM(commission_quota), 0)").
		Scan(&totalMonth).Error

	if err != nil {
		common.SysLog(fmt.Sprintf("检查每月限额失败: %v", err))
		return false // 查询失败，拒绝返佣
	}

	return int(totalMonth)+newCommission <= monthlyLimit
}

// TransferAffQuotaToQuota 转移邀请额度到余额
func (s *CommissionService) TransferAffQuotaToQuota(userID int, quota int) error {
	// 检查quota是否小于最小额度
	if float64(quota) < common.QuotaPerUnit {
		return fmt.Errorf("转移额度最小为%s！", logger.LogQuota(int(common.QuotaPerUnit)))
	}

	// 开始数据库事务
	tx := model.DB.Begin()
	if tx.Error != nil {
		return tx.Error
	}
	defer tx.Rollback()

	// 原子更新：aff_quota >= quota 时才扣减（避免并发超扣）
	result := tx.Model(&model.User{}).
		Where("id = ? AND aff_quota >= ?", userID, quota).
		Updates(map[string]interface{}{
			"aff_quota": gorm.Expr("aff_quota - ?", quota),
			"quota":     gorm.Expr("quota + ?", quota),
		})

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("邀请额度不足！")
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return err
	}

	// 事务成功后，失效用户缓存
	_ = model.InvalidateUserCache(userID)

	return nil
}
