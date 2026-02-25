package model

type ReferralCommission struct {
	Id              int     `json:"id"               gorm:"primaryKey"`
	InviterId       int     `json:"inviter_id"       gorm:"index"`
	InviteeId       int     `json:"invitee_id"       gorm:"index"`
	TopUpId         int     `json:"top_up_id"`
	RechargeAmount  float64 `json:"recharge_amount"`
	CommissionQuota int     `json:"commission_quota"`
	CommissionRate  float64 `json:"commission_rate"`
	PaymentMethod   string  `json:"payment_method"   gorm:"type:varchar(50)"`
	CreatedAt       int64   `json:"created_at"       gorm:"autoCreateTime"`
}

type ReferralCommissionWithUser struct {
	ReferralCommission
	InviteeUsername string `json:"invitee_username"`
}

func GetUserReferralCommissions(inviterId int) ([]*ReferralCommissionWithUser, error) {
	var commissions []*ReferralCommissionWithUser
	err := DB.Table("referral_commissions").
		Select("referral_commissions.*, users.username as invitee_username").
		Joins("LEFT JOIN users ON users.id = referral_commissions.invitee_id").
		Where("referral_commissions.inviter_id = ?", inviterId).
		Order("referral_commissions.id desc").
		Find(&commissions).Error
	return commissions, err
}
