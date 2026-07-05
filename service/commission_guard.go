package service

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// CommissionGuard 返佣防刷守卫
type CommissionGuard struct {
	// B3: 死掉的内存追踪器已删除，改为直接查库
}

// NewCommissionGuard 创建防刷守卫实例
func NewCommissionGuard() *CommissionGuard {
	return &CommissionGuard{}
}

// PreCheck 返佣前检查
func (g *CommissionGuard) PreCheck(userID int, inviterID int) error {
	// 1. 检查自邀请
	if userID == inviterID {
		return errors.New("不能邀请自己")
	}

	// 2. 检查邀请链循环
	if g.hasCircularInvitation(userID, inviterID) {
		return errors.New("检测到循环邀请")
	}

	// 3. 检查邀请频率
	if err := g.checkInvitationFrequency(inviterID); err != nil {
		return err
	}

	// 4. 检查同IP/设备（如果配置启用）
	if common.AntiSpamEnabled {
		if err := g.checkSameIPDevice(userID, inviterID); err != nil {
			return err
		}
	}

	return nil
}

// hasCircularInvitation 检测循环邀请
func (g *CommissionGuard) hasCircularInvitation(userID int, inviterID int) bool {
	visited := make(map[int]bool)
	current := inviterID

	for i := 0; i < 10; i++ { // 最多检查10层
		if current == 0 {
			return false
		}

		if current == userID {
			return true // 找到循环
		}

		if visited[current] {
			return true // 检测到其他循环
		}
		visited[current] = true

		var user model.User
		if err := model.DB.Select("inviter_id").First(&user, current).Error; err != nil {
			break
		}
		current = user.InviterId
	}

	return false
}

// checkInvitationFrequency 检查邀请频率
func (g *CommissionGuard) checkInvitationFrequency(inviterID int) error {
	// 检查每日邀请上限
	dailyLimit := common.MaxDailyInvites
	if dailyLimit <= 0 {
		return nil
	}

	// 统计今日邀请数（使用 Unix 秒范围，兼容 int64 时间戳）
	now := time.Now()
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()
	dayEnd := dayStart + 86400

	var count int64
	err := model.DB.Model(&model.User{}).
		Where("inviter_id = ? AND created_at >= ? AND created_at < ?", inviterID, dayStart, dayEnd).
		Count(&count).Error

	if err != nil {
		common.SysLog(fmt.Sprintf("检查邀请频率失败: %v", err))
		return fmt.Errorf("检查邀请频率失败: %v", err) // fail-closed
	}

	if int(count) >= dailyLimit {
		return fmt.Errorf("今日邀请次数已达上限(%d)", dailyLimit)
	}

	return nil
}

// checkSameIPDevice 检查同IP注册用户数（持久化版本）
func (g *CommissionGuard) checkSameIPDevice(userID int, inviterID int) error {
	// 获取当前用户的注册IP
	var currentUser model.User
	if err := model.DB.Select("register_ip").First(&currentUser, userID).Error; err != nil {
		return nil // 查询失败，放行
	}

	if currentUser.RegisterIP == "" {
		return nil // 无IP记录，放行
	}

	// 查询同IP下与该邀请人关联的用户数
	var count int64
	err := model.DB.Model(&model.User{}).
		Where("register_ip = ? AND inviter_id = ? AND id != ?", currentUser.RegisterIP, inviterID, userID).
		Count(&count).Error

	if err != nil {
		common.SysLog(fmt.Sprintf("检查同IP用户数失败: %v", err))
		return nil // 查询失败，放行
	}

	// 同IP下已有 ≥N 个用户与邀请人关联时拒绝（N由 CommissionSameIPLimit 配置）
	if count >= int64(common.CommissionSameIPLimit) {
		return fmt.Errorf("同IP注册用户数过多(%d)，疑似刷单", count)
	}

	// 全局:同 IP 注册的账号总数(不分邀请人，堵环形绕过)
	var globalCount int64
	if err := model.DB.Model(&model.User{}).
		Where("register_ip = ? AND register_ip != ''", currentUser.RegisterIP).
		Count(&globalCount).Error; err == nil {
		if globalCount > int64(common.CommissionGlobalIPLimit) {
			return fmt.Errorf("同IP注册账号总数过多(%d)，疑似刷单", globalCount)
		}
	}

	return nil
}

// GetUserIPStats 获取用户IP统计（B3: 改为查库实现）
func (g *CommissionGuard) GetUserIPStats(userID int) map[string]interface{} {
	stats := make(map[string]interface{})

	// 查询用户的 register_ip
	var user model.User
	if err := model.DB.Select("register_ip").First(&user, userID).Error; err != nil {
		stats["register_ip"] = ""
		stats["same_ip_count"] = 0
		return stats
	}

	stats["register_ip"] = user.RegisterIP

	if user.RegisterIP == "" {
		stats["same_ip_count"] = 0
		return stats
	}

	// 查询同IP用户数
	var count int64
	model.DB.Model(&model.User{}).
		Where("register_ip = ?", user.RegisterIP).
		Count(&count)

	stats["same_ip_count"] = count
	return stats
}

// DetectSuspiciousActivity 检测可疑活动
func (g *CommissionGuard) DetectSuspiciousActivity(userID int) (bool, []string) {
	reasons := make([]string, 0)

	// 1. 检查短时间内大量邀请（使用 Unix 秒，兼容 int64 时间戳）
	var recentInvites int64
	oneHourAgo := time.Now().Add(-1 * time.Hour).Unix()
	err := model.DB.Model(&model.User{}).
		Where("inviter_id = ? AND created_at >= ?", userID, oneHourAgo).
		Count(&recentInvites).Error

	if err == nil && recentInvites > 10 {
		reasons = append(reasons, fmt.Sprintf("1小时内邀请%d人", recentInvites))
	}

	// 2. 检查邀请用户的消费模式
	var inviterUsers []model.User
	model.DB.Where("inviter_id = ?", userID).Find(&inviterUsers)

	if len(inviterUsers) > 5 {
		// 检查这些用户的消费是否异常（例如都很低）
		var lowConsumptionCount int
		for _, user := range inviterUsers {
			if user.UsedQuota < 1000 { // 低消费阈值
				lowConsumptionCount++
			}
		}

		if float64(lowConsumptionCount)/float64(len(inviterUsers)) > 0.8 {
			reasons = append(reasons, fmt.Sprintf("%.0f%%邀请用户低消费", float64(lowConsumptionCount)*100/float64(len(inviterUsers))))
		}
	}

	// 3. 检查IP聚集（B3: 改为查库实现）
	var user model.User
	if err := model.DB.Select("register_ip").First(&user, userID).Error; err == nil && user.RegisterIP != "" {
		var ipCount int64
		model.DB.Model(&model.User{}).
			Where("register_ip = ?", user.RegisterIP).
			Count(&ipCount)

		if ipCount > 5 {
			reasons = append(reasons, fmt.Sprintf("IP %s 关联%d个用户", user.RegisterIP, ipCount))
		}
	}

	return len(reasons) > 0, reasons
}
