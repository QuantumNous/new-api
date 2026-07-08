package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	BillingHoldStatusPending   = "pending"
	BillingHoldStatusRefunded  = "refunded"
	BillingHoldStatusConfirmed = "confirmed"
)

// BillingHold 记录 HoldRefund 挂起的预扣费，供超时对账任务处理。
type BillingHold struct {
	Id                int    `json:"id" gorm:"primaryKey"`
	RequestId         string `json:"request_id" gorm:"type:varchar(64);uniqueIndex;not null"`
	UserId            int    `json:"user_id" gorm:"index;not null"`
	TokenId           int    `json:"token_id" gorm:"not null;default:0"`
	TokenName         string `json:"token_name" gorm:"type:varchar(191);default:''"`
	ChannelId         int    `json:"channel_id" gorm:"not null;default:0"`
	ModelName         string `json:"model_name" gorm:"type:varchar(191);default:''"`
	Group             string `json:"group" gorm:"type:varchar(64);default:''"`
	PreConsumedQuota  int    `json:"pre_consumed_quota" gorm:"not null;default:0"`
	ReceivedResponses int    `json:"received_responses" gorm:"not null;default:0"`
	UpstreamTaskId    string `json:"upstream_task_id" gorm:"type:varchar(128);default:''"`
	ErrorStatus       int    `json:"error_status" gorm:"not null;default:0"`
	ErrorCode         string `json:"error_code" gorm:"type:varchar(64);default:''"`
	ErrorMessage      string `json:"error_message" gorm:"type:text"`
	Status            string `json:"status" gorm:"type:varchar(32);index;not null;default:'pending'"`
	VerifyDetail      string `json:"verify_detail" gorm:"type:text"`
	CreatedAt         int64  `json:"created_at" gorm:"bigint;index"`
	ReconcileAfter    int64  `json:"reconcile_after" gorm:"bigint;index"`
	ResolvedAt        int64  `json:"resolved_at" gorm:"bigint;default:0"`
}

func CreateBillingHold(hold *BillingHold) error {
	if hold == nil {
		return errors.New("billing hold is nil")
	}
	if hold.RequestId == "" {
		return errors.New("billing hold request_id is empty")
	}
	if hold.CreatedAt == 0 {
		hold.CreatedAt = common.GetTimestamp()
	}
	if hold.Status == "" {
		hold.Status = BillingHoldStatusPending
	}
	return DB.Create(hold).Error
}

func GetBillingHoldByRequestId(requestId string) (*BillingHold, error) {
	if requestId == "" {
		return nil, errors.New("request_id is empty")
	}
	hold := &BillingHold{}
	err := DB.Where("request_id = ?", requestId).First(hold).Error
	if err != nil {
		return nil, err
	}
	return hold, nil
}

func GetBillingHoldById(id int) (*BillingHold, error) {
	hold := &BillingHold{}
	err := DB.First(hold, id).Error
	if err != nil {
		return nil, err
	}
	return hold, nil
}

func ListDueBillingHolds(now int64, limit int) ([]*BillingHold, error) {
	if limit <= 0 {
		limit = 100
	}
	var holds []*BillingHold
	err := DB.Where("status = ? AND reconcile_after <= ?", BillingHoldStatusPending, now).
		Order("reconcile_after ASC").
		Limit(limit).
		Find(&holds).Error
	return holds, err
}

func MarkBillingHoldResolved(id int, status, verifyDetail string) error {
	if status == "" {
		return errors.New("status is empty")
	}
	return DB.Model(&BillingHold{}).
		Where("id = ? AND status IN ?", id, []string{BillingHoldStatusPending, "processing"}).
		Updates(map[string]interface{}{
			"status":        status,
			"verify_detail": verifyDetail,
			"resolved_at":   common.GetTimestamp(),
		}).Error
}

// BillingHoldContextPatch carries fields learned after the hold was first created.
type BillingHoldContextPatch struct {
	ChannelId      int
	UpstreamTaskId string
	ErrorStatus    int
	ErrorCode      string
	ErrorMessage   string
}

// UpdateBillingHoldContext merges later relay context (final channel, task_id, error).
func UpdateBillingHoldContext(id int, patch BillingHoldContextPatch) error {
	if id <= 0 {
		return errors.New("invalid billing hold id")
	}
	updates := map[string]interface{}{}
	if patch.ChannelId > 0 {
		updates["channel_id"] = patch.ChannelId
	}
	if strings.TrimSpace(patch.UpstreamTaskId) != "" {
		updates["upstream_task_id"] = strings.TrimSpace(patch.UpstreamTaskId)
	}
	if patch.ErrorStatus > 0 {
		updates["error_status"] = patch.ErrorStatus
	}
	if strings.TrimSpace(patch.ErrorCode) != "" {
		updates["error_code"] = strings.TrimSpace(patch.ErrorCode)
	}
	if strings.TrimSpace(patch.ErrorMessage) != "" {
		updates["error_message"] = patch.ErrorMessage
	}
	if len(updates) == 0 {
		return nil
	}
	return DB.Model(&BillingHold{}).
		Where("id = ? AND status IN ?", id, []string{BillingHoldStatusPending, "processing"}).
		Updates(updates).Error
}

func ClaimBillingHold(id int) (bool, error) {
	res := DB.Model(&BillingHold{}).
		Where("id = ? AND status = ?", id, BillingHoldStatusPending).
		Update("status", "processing")
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected > 0, nil
}

func ResetBillingHoldProcessing(id int) error {
	return DB.Model(&BillingHold{}).
		Where("id = ? AND status = ?", id, "processing").
		Update("status", BillingHoldStatusPending).Error
}

// SumUserOrphanPreconsumeGap returns topups - (user.quota + user.used_quota).
func SumUserOrphanPreconsumeGap(userId int) (gap int, err error) {
	user := &User{}
	if err = DB.Select("quota", "used_quota").Where("id = ?", userId).First(user).Error; err != nil {
		return 0, err
	}
	var topupSum float64
	err = DB.Model(&TopUp{}).
		Where("user_id = ? AND status = ?", userId, common.TopUpStatusSuccess).
		Select("COALESCE(SUM((CASE WHEN credited_amount > 0 THEN credited_amount ELSE amount END) * ?), 0)", common.QuotaPerUnit).
		Scan(&topupSum).Error
	if err != nil {
		return 0, err
	}
	accountTotal := user.Quota + user.UsedQuota
	gap = int(topupSum) - accountTotal
	return gap, nil
}

func ConfirmOrphanPreconsumeGap(userId int, quota int, content string) error {
	if userId <= 0 || quota <= 0 {
		return errors.New("invalid user or quota")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&User{}).Where("id = ?", userId).
			Update("used_quota", gorm.Expr("used_quota + ?", quota)).Error; err != nil {
			return err
		}
		username, _ := GetUsernameById(userId, false)
		log := &Log{
			UserId:    userId,
			Username:  username,
			CreatedAt: common.GetTimestamp(),
			Type:      LogTypeConsume,
			Content:   content,
			Quota:     quota,
			Other: common.MapToJsonStr(map[string]interface{}{
				"billing_hold_reconcile": true,
				"orphan_preconsume_gap":  true,
				"action":                 "confirm_charge",
			}),
		}
		return LOG_DB.Create(log).Error
	})
}
