package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	InviteRewardStatusNone    = "none"
	InviteRewardStatusPending = "pending"
	InviteRewardStatusGranted = "granted"
	InviteRewardStatusBlocked = "blocked"

	InviteRewardTriggerManualTokenCreate  = "manual_token_create"
	InviteRewardTriggerInitialTokenCreate = "initial_token_create"
	InviteRewardTriggerTopUpSuccess       = "topup_success"

	InviteRewardEventStatusGranted = "granted"
	InviteRewardEventStatusBlocked = "blocked"

	InviteRewardBlockReasonInviterMissing      = "inviter_missing"
	InviteRewardBlockReasonInviterLimitReached = "inviter_limit_reached"

	defaultInviteRewardUSD = 5
)

type InviteRewardEvent struct {
	Id                 int    `json:"id"`
	InviteeId          int    `json:"invitee_id" gorm:"uniqueIndex"`
	InviterId          int    `json:"inviter_id" gorm:"index"`
	TriggerType        string `json:"trigger_type" gorm:"type:varchar(32);index"`
	TriggerTokenId     int    `json:"trigger_token_id" gorm:"index"`
	TriggerTopUpId     int    `json:"trigger_topup_id" gorm:"index;column:trigger_topup_id"`
	InviterRewardQuota int    `json:"inviter_reward_quota" gorm:"default:0"`
	InviteeRewardQuota int    `json:"invitee_reward_quota" gorm:"default:0"`
	Status             string `json:"status" gorm:"type:varchar(16);index"`
	Reason             string `json:"reason" gorm:"type:varchar(64);default:''"`
	CreatedAt          int64  `json:"created_at" gorm:"autoCreateTime;index"`
}

type inviteRewardGrantResult struct {
	handled            bool
	blocked            bool
	inviteeId          int
	inviterId          int
	inviterRewardQuota int
	inviteeRewardQuota int
	reason             string
}

type inviteRewardTrigger struct {
	triggerType    string
	triggerTokenId int
	triggerTopUpId int
}

func validateInviteRewardTrigger(triggerType string) error {
	switch triggerType {
	case InviteRewardTriggerManualTokenCreate, InviteRewardTriggerInitialTokenCreate, InviteRewardTriggerTopUpSuccess:
		return nil
	default:
		return fmt.Errorf("unsupported invite reward trigger type: %s", triggerType)
	}
}

func fixedInviteRewardQuota() int {
	return int(defaultInviteRewardUSD * common.QuotaPerUnit)
}

func TryGrantInviteRewardAfterTokenCreated(inviteeId int, triggerTokenId int, triggerType string) error {
	if inviteeId == 0 {
		return errors.New("inviteeId 为空！")
	}
	var result inviteRewardGrantResult
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		result, err = tryGrantInviteRewardInTx(tx, inviteeId, triggerTokenId, triggerType)
		return err
	})
	if err != nil {
		return err
	}
	runInviteRewardPostCommitHooks(result)
	return nil
}

func tryGrantInviteRewardInTx(tx *gorm.DB, inviteeId int, triggerTokenId int, triggerType string) (inviteRewardGrantResult, error) {
	return tryGrantInviteRewardForTriggerInTx(tx, inviteeId, inviteRewardTrigger{
		triggerType:    triggerType,
		triggerTokenId: triggerTokenId,
	})
}

func TryGrantInviteRewardAfterTopUpSucceeded(inviteeId int, triggerTopUpId int) error {
	if inviteeId == 0 {
		return errors.New("inviteeId 为空！")
	}
	var result inviteRewardGrantResult
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		result, err = tryGrantInviteRewardForTopUpInTx(tx, inviteeId, triggerTopUpId)
		return err
	})
	if err != nil {
		return err
	}
	runInviteRewardPostCommitHooks(result)
	return nil
}

func tryGrantInviteRewardForTopUpInTx(tx *gorm.DB, inviteeId int, triggerTopUpId int) (inviteRewardGrantResult, error) {
	return tryGrantInviteRewardForTriggerInTx(tx, inviteeId, inviteRewardTrigger{
		triggerType:    InviteRewardTriggerTopUpSuccess,
		triggerTopUpId: triggerTopUpId,
	})
}

func tryGrantInviteRewardForTriggerInTx(tx *gorm.DB, inviteeId int, trigger inviteRewardTrigger) (inviteRewardGrantResult, error) {
	if err := validateInviteRewardTrigger(trigger.triggerType); err != nil {
		return inviteRewardGrantResult{}, err
	}

	var invitee User
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Select("id", "inviter_id", "invite_reward_status").
		Where("id = ?", inviteeId).
		First(&invitee).Error; err != nil {
		return inviteRewardGrantResult{}, err
	}
	if invitee.InviterId <= 0 || invitee.InviteRewardStatus != InviteRewardStatusPending {
		return inviteRewardGrantResult{}, nil
	}

	switch trigger.triggerType {
	case InviteRewardTriggerTopUpSuccess:
		var triggerTopUp TopUp
		if err := tx.Select("id").
			Where("id = ? AND user_id = ? AND status = ?", trigger.triggerTopUpId, invitee.Id, common.TopUpStatusSuccess).
			First(&triggerTopUp).Error; err != nil {
			return inviteRewardGrantResult{}, err
		}
	default:
		var triggerToken Token
		if err := tx.Select("id").
			Where("id = ? AND user_id = ?", trigger.triggerTokenId, invitee.Id).
			First(&triggerToken).Error; err != nil {
			return inviteRewardGrantResult{}, err
		}
	}

	var inviter User
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Select("id").
		Where("id = ?", invitee.InviterId).
		First(&inviter).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return blockInviteRewardForTriggerInTx(tx, invitee.Id, invitee.InviterId, trigger, InviteRewardBlockReasonInviterMissing)
		}
		return inviteRewardGrantResult{}, err
	}
	result := inviteRewardGrantResult{
		inviteeId:          invitee.Id,
		inviterId:          invitee.InviterId,
		inviterRewardQuota: fixedInviteRewardQuota(),
		inviteeRewardQuota: fixedInviteRewardQuota(),
	}
	event := InviteRewardEvent{
		InviteeId:          invitee.Id,
		InviterId:          invitee.InviterId,
		TriggerType:        trigger.triggerType,
		TriggerTokenId:     trigger.triggerTokenId,
		TriggerTopUpId:     trigger.triggerTopUpId,
		InviterRewardQuota: result.inviterRewardQuota,
		InviteeRewardQuota: result.inviteeRewardQuota,
		Status:             InviteRewardEventStatusGranted,
		Reason:             result.reason,
	}
	insert := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&event)
	if insert.Error != nil {
		return inviteRewardGrantResult{}, insert.Error
	}
	if insert.RowsAffected == 0 {
		return inviteRewardGrantResult{}, nil
	}

	if err := tx.Model(&User{}).
		Where("id = ?", invitee.InviterId).
		Update("aff_count", gorm.Expr("aff_count + ?", 1)).Error; err != nil {
		return inviteRewardGrantResult{}, err
	}
	if result.inviteeRewardQuota > 0 {
		if err := tx.Model(&User{}).
			Where("id = ?", invitee.Id).
			Update("quota", gorm.Expr("quota + ?", result.inviteeRewardQuota)).Error; err != nil {
			return inviteRewardGrantResult{}, err
		}
	}
	if result.inviterRewardQuota > 0 {
		inviterRewardUpdate := tx.Model(&User{}).Where("id = ?", invitee.InviterId)
		if common.QuotaForInviterMaxCount > 0 {
			inviterRewardUpdate = inviterRewardUpdate.Where("aff_count <= ?", common.QuotaForInviterMaxCount)
		}
		inviterRewardUpdate = inviterRewardUpdate.Updates(map[string]any{
			"aff_quota":   gorm.Expr("aff_quota + ?", result.inviterRewardQuota),
			"aff_history": gorm.Expr("aff_history + ?", result.inviterRewardQuota),
		})
		if inviterRewardUpdate.Error != nil {
			return inviteRewardGrantResult{}, inviterRewardUpdate.Error
		}
		if inviterRewardUpdate.RowsAffected == 0 {
			result.inviterRewardQuota = 0
			result.reason = InviteRewardBlockReasonInviterLimitReached
			if err := tx.Model(&InviteRewardEvent{}).
				Where("id = ?", event.Id).
				Updates(map[string]any{
					"inviter_reward_quota": 0,
					"reason":               InviteRewardBlockReasonInviterLimitReached,
				}).Error; err != nil {
				return inviteRewardGrantResult{}, err
			}
		}
	}
	update := tx.Model(&User{}).
		Where("id = ? AND invite_reward_status = ?", invitee.Id, InviteRewardStatusPending).
		Updates(map[string]any{
			"invite_reward_status":       InviteRewardStatusGranted,
			"invite_reward_granted_at":   common.GetTimestamp(),
			"invite_reward_block_reason": "",
		})
	if update.Error != nil {
		return inviteRewardGrantResult{}, update.Error
	}
	if update.RowsAffected == 0 {
		return inviteRewardGrantResult{}, errors.New("invite reward status changed before grant could be finalized")
	}
	result.handled = true
	return result, nil
}

func blockInviteRewardInTx(tx *gorm.DB, inviteeId int, inviterId int, triggerTokenId int, triggerType string, reason string) (inviteRewardGrantResult, error) {
	return blockInviteRewardForTriggerInTx(tx, inviteeId, inviterId, inviteRewardTrigger{
		triggerType:    triggerType,
		triggerTokenId: triggerTokenId,
	}, reason)
}

func blockInviteRewardForTriggerInTx(tx *gorm.DB, inviteeId int, inviterId int, trigger inviteRewardTrigger, reason string) (inviteRewardGrantResult, error) {
	event := InviteRewardEvent{
		InviteeId:      inviteeId,
		InviterId:      inviterId,
		TriggerType:    trigger.triggerType,
		TriggerTokenId: trigger.triggerTokenId,
		TriggerTopUpId: trigger.triggerTopUpId,
		Status:         InviteRewardEventStatusBlocked,
		Reason:         reason,
	}
	insert := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&event)
	if insert.Error != nil {
		return inviteRewardGrantResult{}, insert.Error
	}
	if insert.RowsAffected == 0 {
		return inviteRewardGrantResult{}, nil
	}
	update := tx.Model(&User{}).
		Where("id = ? AND invite_reward_status = ?", inviteeId, InviteRewardStatusPending).
		Updates(map[string]any{
			"invite_reward_status":       InviteRewardStatusBlocked,
			"invite_reward_block_reason": reason,
		})
	if update.Error != nil {
		return inviteRewardGrantResult{}, update.Error
	}
	if update.RowsAffected == 0 {
		return inviteRewardGrantResult{}, errors.New("invite reward status changed before block could be finalized")
	}
	return inviteRewardGrantResult{
		handled:   true,
		blocked:   true,
		inviteeId: inviteeId,
		inviterId: inviterId,
		reason:    reason,
	}, nil
}

func runInviteRewardPostCommitHooks(result inviteRewardGrantResult) {
	if !result.handled {
		return
	}
	gopool.Go(func() {
		_ = InvalidateUserCache(result.inviteeId)
		if result.inviterId > 0 {
			_ = InvalidateUserCache(result.inviterId)
		}
	})
	if result.blocked {
		common.SysLog(fmt.Sprintf("invite reward blocked for invitee %d: %s", result.inviteeId, result.reason))
		return
	}
	if result.inviteeRewardQuota > 0 {
		RecordLog(result.inviteeId, LogTypeSystem, fmt.Sprintf("使用邀请码赠送 %s", logger.LogQuota(result.inviteeRewardQuota)))
	}
	if result.inviterRewardQuota > 0 {
		RecordLog(result.inviterId, LogTypeSystem, fmt.Sprintf("邀请用户赠送 %s", logger.LogQuota(result.inviterRewardQuota)))
	}
	if result.reason == InviteRewardBlockReasonInviterLimitReached {
		RecordLog(result.inviterId, LogTypeSystem, "已达到邀请奖励上限，不再获得邀请者奖励")
		common.SysLog(fmt.Sprintf("invite reward inviter quota skipped for invitee %d: %s", result.inviteeId, result.reason))
	}
}
