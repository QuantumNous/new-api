package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	InvitationRebateStatusSuccess = "success"

	InvitationRebateConsumptionStatusPending          = "pending"
	InvitationRebateConsumptionStatusPartiallySettled = "partially_settled"
	InvitationRebateConsumptionStatusSettled          = "settled"
)

type InvitationRebateRecord struct {
	Id              int    `json:"id" gorm:"primaryKey"`
	InviterUserId   int    `json:"inviter_user_id" gorm:"not null;index"`
	InviteeUserId   int    `json:"invitee_user_id" gorm:"not null;index"`
	SourceType      string `json:"source_type" gorm:"type:varchar(32);not null;uniqueIndex:idx_invitation_rebate_source,priority:1"`
	SourceKey       string `json:"source_key" gorm:"type:varchar(128);not null;uniqueIndex:idx_invitation_rebate_source,priority:2"`
	SourceRequestId string `json:"source_request_id" gorm:"type:varchar(64);index;default:''"`
	SourceQuota     int    `json:"source_quota" gorm:"default:0"`
	RebateQuota     int    `json:"rebate_quota" gorm:"default:0"`
	RebateRatioBps  int    `json:"rebate_ratio_bps" gorm:"default:0"`
	Status          string `json:"status" gorm:"type:varchar(20);index;default:'success'"`
	CreatedAt       int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt       int64  `json:"updated_at" gorm:"bigint"`
}

func (r *InvitationRebateRecord) BeforeCreate(tx *gorm.DB) error {
	if r.SourceType == "" {
		return errors.New("invitation rebate source type is required")
	}
	if r.SourceKey == "" {
		return errors.New("invitation rebate source key is required")
	}
	if r.Status == "" {
		r.Status = InvitationRebateStatusSuccess
	}
	now := common.GetTimestamp()
	r.CreatedAt = now
	r.UpdatedAt = now
	return nil
}

func (r *InvitationRebateRecord) BeforeUpdate(tx *gorm.DB) error {
	r.UpdatedAt = common.GetTimestamp()
	return nil
}

type InvitationRebateConsumption struct {
	Id                 int    `json:"id" gorm:"primaryKey"`
	InviterUserId      int    `json:"inviter_user_id" gorm:"not null;index;uniqueIndex:idx_invitation_rebate_consumption_pair_source,priority:1"`
	InviteeUserId      int    `json:"invitee_user_id" gorm:"not null;index;uniqueIndex:idx_invitation_rebate_consumption_pair_source,priority:2"`
	SourceType         string `json:"source_type" gorm:"type:varchar(32);not null;uniqueIndex:idx_invitation_rebate_consumption_source,priority:1;uniqueIndex:idx_invitation_rebate_consumption_pair_source,priority:3"`
	SourceKey          string `json:"source_key" gorm:"type:varchar(128);not null;uniqueIndex:idx_invitation_rebate_consumption_source,priority:2;uniqueIndex:idx_invitation_rebate_consumption_pair_source,priority:4"`
	SourceRequestId    string `json:"source_request_id" gorm:"type:varchar(64);index;default:''"`
	SourceQuota        int    `json:"source_quota" gorm:"default:0"`
	SettledSourceQuota int    `json:"settled_source_quota" gorm:"default:0"`
	RebateRatioBps     int    `json:"rebate_ratio_bps" gorm:"default:0"`
	Status             string `json:"status" gorm:"type:varchar(20);index;default:'pending'"`
	CreatedAt          int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt          int64  `json:"updated_at" gorm:"bigint"`
}

func (r *InvitationRebateConsumption) BeforeCreate(tx *gorm.DB) error {
	if r.SourceType == "" {
		return errors.New("invitation rebate consumption source type is required")
	}
	if r.SourceKey == "" {
		return errors.New("invitation rebate consumption source key is required")
	}
	if r.Status == "" {
		r.Status = InvitationRebateConsumptionStatusPending
	}
	now := common.GetTimestamp()
	r.CreatedAt = now
	r.UpdatedAt = now
	return nil
}

func (r *InvitationRebateConsumption) BeforeUpdate(tx *gorm.DB) error {
	r.UpdatedAt = common.GetTimestamp()
	return nil
}

type InvitationRebateAccumulation struct {
	Id                       int   `json:"id" gorm:"primaryKey"`
	InviterUserId            int   `json:"inviter_user_id" gorm:"not null;index;uniqueIndex:idx_invitation_rebate_accumulation_pair,priority:1"`
	InviteeUserId            int   `json:"invitee_user_id" gorm:"not null;index;uniqueIndex:idx_invitation_rebate_accumulation_pair,priority:2"`
	PendingSourceQuota       int   `json:"pending_source_quota" gorm:"default:0"`
	TotalSourceQuota         int   `json:"total_source_quota" gorm:"default:0"`
	TotalSettledSourceQuota  int   `json:"total_settled_source_quota" gorm:"default:0"`
	TotalRebateQuota         int   `json:"total_rebate_quota" gorm:"default:0"`
	RebateNumeratorRemainder int64 `json:"rebate_numerator_remainder" gorm:"default:0"`
	CreatedAt                int64 `json:"created_at" gorm:"bigint;index"`
	UpdatedAt                int64 `json:"updated_at" gorm:"bigint"`
}

func (r *InvitationRebateAccumulation) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	r.CreatedAt = now
	r.UpdatedAt = now
	return nil
}

func (r *InvitationRebateAccumulation) BeforeUpdate(tx *gorm.DB) error {
	r.UpdatedAt = common.GetTimestamp()
	return nil
}
