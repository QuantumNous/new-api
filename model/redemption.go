package model

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
)

type Redemption struct {
	Id           int            `json:"id"`
	UserId       int            `json:"user_id"`
	Key          string         `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status       int            `json:"status" gorm:"default:1"`
	Name         string         `json:"name" gorm:"index"`
	Quota        int            `json:"quota" gorm:"default:100"`
	PlanId       int            `json:"plan_id" gorm:"default:0"`
	Type         string         `json:"type" gorm:"-:all"` // optional request discriminator; legacy requests omit it
	CreatedTime  int64          `json:"created_time" gorm:"bigint"`
	RedeemedTime int64          `json:"redeemed_time" gorm:"bigint"`
	Count        int            `json:"count" gorm:"-:all"` // only for api request
	UsedUserId   int            `json:"used_user_id"`
	DeletedAt    gorm.DeletedAt `gorm:"index"`
	ExpiredTime  int64          `json:"expired_time" gorm:"bigint"` // 过期时间，0 表示不过期
}

func GetAllRedemptions(startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	// 开始事务
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 获取总数
	err = tx.Model(&Redemption{}).Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 获取分页数据
	err = tx.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 提交事务
	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return redemptions, total, nil
}

func SearchRedemptions(keyword string, status string, startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&Redemption{})

	if keyword != "" {
		if id, err := strconv.Atoi(keyword); err == nil {
			query = query.Where("id = ? OR name LIKE ?", id, keyword+"%")
		} else {
			query = query.Where("name LIKE ?", keyword+"%")
		}
	}

	if status != "" {
		now := common.GetTimestamp()
		switch status {
		case "expired":
			query = query.Where(
				"status = ? AND expired_time != 0 AND expired_time < ?",
				common.RedemptionCodeStatusEnabled,
				now,
			)
		case strconv.Itoa(common.RedemptionCodeStatusEnabled):
			query = query.Where(
				"status = ? AND (expired_time = 0 OR expired_time >= ?)",
				common.RedemptionCodeStatusEnabled,
				now,
			)
		case strconv.Itoa(common.RedemptionCodeStatusDisabled):
			query = query.Where("status = ?", common.RedemptionCodeStatusDisabled)
		case strconv.Itoa(common.RedemptionCodeStatusUsed):
			query = query.Where("status = ?", common.RedemptionCodeStatusUsed)
		}
	}

	// Get total count
	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// Get paginated data
	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return redemptions, total, nil
}

func GetRedemptionById(id int) (*Redemption, error) {
	if id == 0 {
		return nil, common.NewMessage("ID is empty")
	}
	redemption := Redemption{Id: id}
	var err error = nil
	err = DB.First(&redemption, "id = ?", id).Error
	return &redemption, err
}

type SubscriptionRedemptionResult struct {
	Type      string `json:"type"`
	PlanId    int    `json:"plan_id"`
	PlanTitle string `json:"plan_title"`
}

func Redeem(key string, userId int) (data any, err error) {
	if key == "" {
		return 0, errors.New("redemption code not provided")
	}
	if userId == 0 {
		return 0, errors.New("invalid user id")
	}
	redemption := &Redemption{}

	keyCol := "`key`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		keyCol = `"key"`
	}
	common.RandomSleep()
	creditFences, err := acquireUserQuotaMutationFences(userId)
	if err != nil {
		common.SysError("redemption quota fence acquisition failed: " + err.Error())
		return 0, ErrRedeemFailed
	}
	creditCommitted := false
	defer func() { finalizeUserQuotaMutationFences(creditFences, creditCommitted) }()
	var subscriptionPlan *SubscriptionPlan

	err = DB.Transaction(func(tx *gorm.DB) error {
		// Serialize grants for this user, including purchases with a per-user limit.
		var user User
		if err := lockForUpdate(tx).Select("id", "quota").Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		err := lockForUpdate(tx).Where(keyCol+" = ?", key).First(redemption).Error
		if err != nil {
			return errors.New("invalid redemption code")
		}
		if redemption.Status != common.RedemptionCodeStatusEnabled {
			return errors.New("redemption code already used")
		}
		if redemption.ExpiredTime != 0 && redemption.ExpiredTime < common.GetTimestamp() {
			return errors.New("redemption code expired")
		}
		if redemption.PlanId < 0 || (redemption.PlanId == 0 && redemption.Quota <= 0) || (redemption.PlanId > 0 && redemption.Quota != 0) {
			return errors.New("invalid redemption entitlement")
		}
		if redemption.PlanId > 0 {
			var plan SubscriptionPlan
			if err := lockForUpdate(tx).Where("id = ? AND enabled = ?", redemption.PlanId, true).First(&plan).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					// Users still see the generic failure; the log tells operators why.
					return fmt.Errorf("redemption %d targets subscription plan %d which is disabled or deleted", redemption.Id, redemption.PlanId)
				}
				return err
			}
			subscriptionPlan = &plan
		}
		// Compare-and-swap on status: only the transaction that flips
		// enabled -> used may credit quota, so a concurrent redeem of the
		// same code loses here even without a row lock (e.g. on SQLite).
		result := tx.Model(&Redemption{}).
			Where("id = ? AND status = ? AND quota = ? AND plan_id = ?", redemption.Id, common.RedemptionCodeStatusEnabled, redemption.Quota, redemption.PlanId).
			Updates(map[string]any{
				"redeemed_time": common.GetTimestamp(),
				"status":        common.RedemptionCodeStatusUsed,
				"used_user_id":  userId,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("redemption code already used")
		}
		if subscriptionPlan != nil {
			_, err := CreateUserSubscriptionFromPlanTx(tx, userId, subscriptionPlan, "redemption")
			return err
		}
		if err := recordWalletRefundCreditTx(tx, user, walletRefundNonrefundable, "redemption", int64(redemption.Id), int64(redemption.Quota), ""); err != nil {
			return err
		}
		return creditTopUpQuotaProtected(tx, userId, redemption.Quota, nil, creditFences)
	})
	if err != nil {
		common.SysError(common.LogText("redemption failed: %s", err.Error()))
		return 0, ErrRedeemFailed
	}
	if subscriptionPlan != nil {
		if subscriptionPlan.UpgradeGroup != "" {
			refreshSubscriptionUserGroupCache(userId, common.LogText("subscription redemption"))
		}
		RecordLog(userId, LogTypeTopup, common.NewMessage("Opened subscription plan {{plan}} with a redemption code, code ID {{id}}", map[string]any{"plan": subscriptionPlan.Id, "id": redemption.Id}))
		return SubscriptionRedemptionResult{Type: "subscription", PlanId: subscriptionPlan.Id, PlanTitle: subscriptionPlan.Title}, nil
	}
	creditCommitted = true
	syncCreditUserQuotaCache(creditFences, userId, redemption.Quota, common.LogText("redemption"))
	RecordLog(userId, LogTypeTopup, common.NewMessage("Topped up {{quota}} with a redemption code, code ID {{id}}", map[string]any{"quota": logger.FormatQuota(redemption.Quota), "id": redemption.Id}))
	return redemption.Quota, nil
}

func (redemption *Redemption) validateEntitlement(tx *gorm.DB, checkPlan bool) error {
	if redemption.Type != "" && redemption.Type != "quota" && redemption.Type != "subscription" {
		return errors.New("invalid redemption type")
	}
	if (redemption.Type == "quota" && redemption.PlanId != 0) || (redemption.Type == "subscription" && redemption.PlanId <= 0) {
		return errors.New("redemption type does not match entitlement")
	}
	if redemption.PlanId < 0 {
		return errors.New("invalid redemption plan id")
	}
	if redemption.PlanId == 0 {
		if redemption.Quota <= 0 {
			return errors.New("redemption quota must be positive")
		}
		return common.ValidateWalletQuota(redemption.Quota)
	}
	if redemption.Quota != 0 {
		return errors.New("subscription redemption quota must be zero")
	}
	if checkPlan {
		var plan SubscriptionPlan
		return lockForUpdate(tx).Where("id = ? AND enabled = ?", redemption.PlanId, true).First(&plan).Error
	}
	return nil
}

func (redemption *Redemption) Insert() error {
	if redemption.PlanId == 0 {
		if err := redemption.validateEntitlement(DB, false); err != nil {
			return err
		}
		return DB.Create(redemption).Error
	}
	// Preserve the legacy quota column default for existing schemas. GORM fills
	// zero-valued fields tagged with a default before INSERT, so explicitly set
	// the gift code's quota to zero in the same transaction. Lock the enabled
	// plan through commit so issuance cannot race with disabling it.
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := redemption.validateEntitlement(tx, true); err != nil {
			return err
		}
		if err := tx.Create(redemption).Error; err != nil {
			return err
		}
		return tx.Model(redemption).Update("quota", 0).Error
	})
	if err == nil {
		redemption.Quota = 0
	}
	return err
}

// Update validates the current entitlement and atomically applies a full or status-only edit.
func (redemption *Redemption) Update(statusOnly bool) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var current Redemption
		if err := lockForUpdate(tx).Where("id = ?", redemption.Id).First(&current).Error; err != nil {
			return err
		}
		if statusOnly {
			// Status-only requests must never replay stale entitlement or metadata
			// loaded by the controller before another administrator edited the code.
			redemption.Name = current.Name
			redemption.Quota = current.Quota
			redemption.PlanId = current.PlanId
			redemption.ExpiredTime = current.ExpiredTime
			redemption.Type = ""
		}
		if current.Status != common.RedemptionCodeStatusUsed && redemption.Status == common.RedemptionCodeStatusUsed {
			return errors.New("only redemption may mark a code as used")
		}
		if current.Status == common.RedemptionCodeStatusUsed &&
			(redemption.Status != common.RedemptionCodeStatusUsed || redemption.Quota != current.Quota || redemption.PlanId != current.PlanId) {
			return errors.New("used redemption entitlement cannot be changed or re-enabled")
		}
		if redemption.Status != common.RedemptionCodeStatusEnabled && redemption.Status != common.RedemptionCodeStatusDisabled && redemption.Status != common.RedemptionCodeStatusUsed {
			return errors.New("invalid redemption status")
		}
		if err := redemption.validateEntitlement(tx, redemption.PlanId != current.PlanId); err != nil {
			return err
		}
		if current.Name == redemption.Name && current.Status == redemption.Status &&
			current.Quota == redemption.Quota && current.PlanId == redemption.PlanId &&
			current.ExpiredTime == redemption.ExpiredTime {
			return nil
		}
		result := tx.Model(&Redemption{}).Where("id = ? AND status = ? AND quota = ? AND plan_id = ?", current.Id, current.Status, current.Quota, current.PlanId).
			Updates(map[string]any{"name": redemption.Name, "status": redemption.Status, "quota": redemption.Quota, "plan_id": redemption.PlanId, "expired_time": redemption.ExpiredTime})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return errors.New("redemption changed concurrently")
		}
		return nil
	})
}

func (redemption *Redemption) Delete() error {
	var err error
	err = DB.Delete(redemption).Error
	return err
}

func DeleteRedemptionById(id int) (err error) {
	if id == 0 {
		return common.NewMessage("ID is empty")
	}
	redemption := Redemption{Id: id}
	err = DB.Where(redemption).First(&redemption).Error
	if err != nil {
		return err
	}
	return redemption.Delete()
}

func DeleteInvalidRedemptions() (int64, error) {
	now := common.GetTimestamp()
	result := DB.Where("status IN ? OR (status = ? AND expired_time != 0 AND expired_time < ?)", []int{common.RedemptionCodeStatusUsed, common.RedemptionCodeStatusDisabled}, common.RedemptionCodeStatusEnabled, now).Delete(&Redemption{})
	return result.RowsAffected, result.Error
}

// BatchDeleteRedemptions soft-deletes the selected codes in one statement.
func BatchDeleteRedemptions(ids []int) (int64, error) {
	if len(ids) == 0 || len(ids) > 1000 {
		return 0, errors.New("select between 1 and 1000 redemption codes")
	}
	for _, id := range ids {
		if id <= 0 {
			return 0, errors.New("redemption IDs must be positive")
		}
	}
	result := DB.Where("id IN ?", ids).Delete(&Redemption{})
	return result.RowsAffected, result.Error
}
