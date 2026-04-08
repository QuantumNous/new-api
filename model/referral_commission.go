package model

import "github.com/QuantumNous/new-api/common"

type ReferralCommission struct {
	Id              int     `json:"id"               gorm:"primaryKey"`
	InviterId       int     `json:"inviter_id"       gorm:"index"`
	InviteeId       int     `json:"invitee_id"       gorm:"index;uniqueIndex:idx_invitee_topup_method"`
	TopUpId         int     `json:"top_up_id"        gorm:"uniqueIndex:idx_invitee_topup_method"`
	RechargeAmount  float64 `json:"recharge_amount"`
	CommissionQuota int     `json:"commission_quota"`
	CommissionRate  float64 `json:"commission_rate"`
	PaymentMethod   string  `json:"payment_method"   gorm:"type:varchar(50);uniqueIndex:idx_invitee_topup_method"`
	CreatedAt       int64   `json:"created_at"       gorm:"autoCreateTime"`
}

type ReferralCommissionWithUser struct {
	ReferralCommission
	InviteeUsername string `json:"invitee_username"`
}

type InvitedUser struct {
	Id              int     `json:"id"`
	Username        string  `json:"username"`
	DisplayName     string  `json:"display_name"`
	Status          int     `json:"status"`
	CommissionCount int     `json:"commission_count"`
	TotalEarned     float64 `json:"total_earned"`
}

func GetInvitedUsers(inviterId int, pageInfo *common.PageInfo) ([]*InvitedUser, int64, error) {
	var total int64
	var users []*InvitedUser

	countQuery := DB.Table("users").Where("inviter_id = ?", inviterId)
	if err := countQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := DB.Table("users").
		Select("users.id, users.username, users.display_name, users.status, "+
			"COALESCE(rc.commission_count, 0) as commission_count, "+
			"COALESCE(rc.total_earned, 0) as total_earned").
		Joins("LEFT JOIN (SELECT invitee_id, COUNT(*) as commission_count, SUM(commission_quota) as total_earned "+
			"FROM referral_commissions WHERE inviter_id = ? GROUP BY invitee_id) rc ON rc.invitee_id = users.id", inviterId).
		Where("users.inviter_id = ?", inviterId).
		Order("users.id desc").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&users).Error
	return users, total, err
}

func GetUserReferralCommissions(inviterId int, pageInfo *common.PageInfo) ([]*ReferralCommissionWithUser, int64, error) {
	var total int64
	var commissions []*ReferralCommissionWithUser

	query := DB.Table("referral_commissions").
		Select("referral_commissions.*, users.username as invitee_username").
		Joins("LEFT JOIN users ON users.id = referral_commissions.invitee_id").
		Where("referral_commissions.inviter_id = ?", inviterId)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Order("referral_commissions.id desc").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&commissions).Error
	return commissions, total, err
}
