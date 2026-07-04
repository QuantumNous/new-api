package service

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// CommissionGuard 返佣防刷守卫
type CommissionGuard struct {
	// IP和设备追踪
	ipTracker     map[string]*IPRecord
	deviceTracker map[string]*DeviceRecord
	mu            sync.RWMutex
}

// IPRecord IP记录
type IPRecord struct {
	IP          string
	UserIDs     map[int]bool
	LastInvite  time.Time
	InviteCount int
}

// DeviceRecord 设备记录
type DeviceRecord struct {
	DeviceID    string
	UserIDs     map[int]bool
	LastInvite  time.Time
	InviteCount int
}

// NewCommissionGuard 创建防刷守卫实例
func NewCommissionGuard() *CommissionGuard {
	return &CommissionGuard{
		ipTracker:     make(map[string]*IPRecord),
		deviceTracker: make(map[string]*DeviceRecord),
	}
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

	// 同IP下已有 ≥5 个用户与邀请人关联时拒绝
	if count >= 5 {
		return fmt.Errorf("同IP注册用户数过多(%d)，疑似刷单", count)
	}

	return nil
}

// RecordIPDevice 记录IP和设备信息（在注册/登录时调用）
// 已废弃：IP信息改为持久化到 users.register_ip 字段，此函数保留仅为兼容
func (g *CommissionGuard) RecordIPDevice(userID int, ip string, deviceID string) {
	// 实际应该在注册时更新 users 表的 register_ip 字段
	// 示例：model.DB.Model(&model.User{}).Where("id = ?", userID).Update("register_ip", ip)
	// 此处暂不实现，待集成到注册流程
}

// CleanupExpiredRecords 清理过期记录（定期调用）
func (g *CommissionGuard) CleanupExpiredRecords() {
	g.mu.Lock()
	defer g.mu.Unlock()

	expireTime := time.Now().Add(-24 * time.Hour) // 保留24小时

	// 清理IP记录
	for key, record := range g.ipTracker {
		if record.LastInvite.Before(expireTime) {
			delete(g.ipTracker, key)
		}
	}

	// 清理设备记录
	for key, record := range g.deviceTracker {
		if record.LastInvite.Before(expireTime) {
			delete(g.deviceTracker, key)
		}
	}
}

// GetUserIPStats 获取用户IP统计（用于管理后台）
func (g *CommissionGuard) GetUserIPStats(userID int) map[string]interface{} {
	g.mu.RLock()
	defer g.mu.RUnlock()

	stats := make(map[string]interface{})

	// 查找用户关联的IP
	ips := make([]string, 0)
	for _, record := range g.ipTracker {
		if record.UserIDs[userID] {
			ips = append(ips, record.IP)
		}
	}

	// 查找用户关联的设备
	devices := make([]string, 0)
	for _, record := range g.deviceTracker {
		if record.UserIDs[userID] {
			devices = append(devices, record.DeviceID)
		}
	}

	stats["ips"] = ips
	stats["devices"] = devices
	stats["ip_count"] = len(ips)
	stats["device_count"] = len(devices)

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

	// 3. 检查IP聚集
	g.mu.RLock()
	defer g.mu.RUnlock()

	for _, record := range g.ipTracker {
		if record.UserIDs[userID] && len(record.UserIDs) > 5 {
			reasons = append(reasons, fmt.Sprintf("IP %s 关联%d个用户", record.IP, len(record.UserIDs)))
		}
	}

	return len(reasons) > 0, reasons
}
