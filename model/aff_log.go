package model

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type AffLog struct {
	Id          int   `json:"id" gorm:"primaryKey;autoIncrement"`
	InviterId   int   `json:"inviter_id" gorm:"index;not null"`
	InviteeId   int   `json:"invitee_id" gorm:"not null"`
	TopupAmount int   `json:"topup_amount"` // 充值额（quota 单位）
	Commission  int   `json:"commission"`   // 返佣额（quota 单位）
	CreatedAt   int64 `json:"created_at"`
}

func (AffLog) TableName() string {
	return "aff_logs"
}

func resolveAffCommissionRatio(user *User) int {
	if user == nil || user.InviterId == 0 {
		return 0
	}
	if user.AffRatioSnapshot != nil {
		return *user.AffRatioSnapshot
	}
	return common.AffRatio
}

// ProcessAffCommission 在充值成功后调用，给邀请者加返佣、被邀请者加奖励。
// userId 是充值用户，quotaToAdd 是本次充值对应的 quota 数量。
func ProcessAffCommission(userId int, quotaToAdd int) {
	user, err := GetUserById(userId, false)
	if err != nil || user == nil || user.InviterId == 0 {
		return
	}

	ratio := resolveAffCommissionRatio(user)
	if ratio <= 0 {
		return
	}

	commission := quotaToAdd * ratio / 100
	if commission <= 0 {
		return
	}

	// 邀请者：加到待划转池（aff_quota + aff_history）。被邀请者无奖励。
	err = DB.Model(&User{}).Where("id = ?", user.InviterId).Updates(map[string]interface{}{
		"aff_quota":   gorm.Expr("aff_quota + ?", commission),
		"aff_history": gorm.Expr("aff_history + ?", commission),
	}).Error
	if err != nil {
		common.SysLog("ProcessAffCommission: failed to update inviter quota: " + err.Error())
		return
	}

	// 写记录
	log := &AffLog{
		InviterId:   user.InviterId,
		InviteeId:   userId,
		TopupAmount: quotaToAdd,
		Commission:  commission,
		CreatedAt:   time.Now().Unix(),
	}
	if err = DB.Create(log).Error; err != nil {
		common.SysLog("ProcessAffCommission: failed to insert aff_log: " + err.Error())
	}
}

// GetAffLogs 查询邀请者的返佣记录，分页。
func GetAffLogs(inviterId int, page, pageSize int) (logs []AffLog, total int64, err error) {
	query := DB.Model(&AffLog{}).Where("inviter_id = ?", inviterId)
	query.Count(&total)
	err = query.Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&logs).Error
	return
}

// GetInviteList 查询邀请者邀请的用户列表。
func GetInviteList(inviterId int, page, pageSize int) (users []User, total int64, err error) {
	query := DB.Model(&User{}).Where("inviter_id = ?", inviterId).Select("id, username, display_name, created_at")
	query.Count(&total)
	err = query.Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&users).Error
	return
}
