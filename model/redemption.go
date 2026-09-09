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
	Id                 int            `json:"id"`
	UserId             int            `json:"user_id"`
	Key                string         `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status             int            `json:"status" gorm:"default:1"`
	Type               int            `json:"type" gorm:"type:int;default:0;index"`
	Name               string         `json:"name" gorm:"index"`
	Quota              int            `json:"quota" gorm:"default:100"`
	CreatedTime        int64          `json:"created_time" gorm:"bigint"`
	RedeemedTime       int64          `json:"redeemed_time" gorm:"bigint"`
	Count              int            `json:"count" gorm:"-:all"` // only for api request
	UsedUserId         int            `json:"used_user_id"`
	AgentUserId        int            `json:"agent_user_id" gorm:"index"`
	AgentOrderId       int            `json:"agent_order_id" gorm:"index"`
	SubscriptionPlanId int            `json:"subscription_plan_id" gorm:"index"`
	DeletedAt          gorm.DeletedAt `gorm:"index"`
	ExpiredTime        int64          `json:"expired_time" gorm:"bigint"` // 过期时间，0 表示不过期
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
	err = tx.Model(&Redemption{}).Where("type = ?", common.RedemptionCodeTypeQuota).Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 获取分页数据
	err = tx.Where("type = ?", common.RedemptionCodeTypeQuota).Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
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

	query := tx.Model(&Redemption{}).Where("type = ?", common.RedemptionCodeTypeQuota)

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
		return nil, errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	var err error = nil
	err = DB.Where("id = ? AND type = ?", id, common.RedemptionCodeTypeQuota).First(&redemption).Error
	return &redemption, err
}

func Redeem(key string, userId int) (quota int, err error) {
	quota, _, err = RedeemWithAgent(key, userId)
	return quota, err
}

func RedeemWithAgent(key string, userId int) (quota int, agentUserId int, err error) {
	if key == "" {
		return 0, 0, errors.New("未提供兑换码")
	}
	if userId == 0 {
		return 0, 0, errors.New("无效的 user id")
	}
	redemption := &Redemption{}

	keyCol := "`key`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		keyCol = `"key"`
	}
	common.RandomSleep()
	err = DB.Transaction(func(tx *gorm.DB) error {
		err := lockForUpdate(tx).Where(keyCol+" = ? AND type = ?", key, common.RedemptionCodeTypeQuota).First(redemption).Error
		if err != nil {
			return errors.New("无效的兑换码")
		}
		if redemption.Status != common.RedemptionCodeStatusEnabled {
			return errors.New("该兑换码已被使用")
		}
		if redemption.ExpiredTime != 0 && redemption.ExpiredTime < common.GetTimestamp() {
			return errors.New("该兑换码已过期")
		}
		// Compare-and-swap on status: only the transaction that flips
		// enabled -> used may credit quota, so a concurrent redeem of the
		// same code loses here even without a row lock (e.g. on SQLite).
		result := tx.Model(&Redemption{}).
			Where("id = ? AND status = ?", redemption.Id, common.RedemptionCodeStatusEnabled).
			Updates(map[string]any{
				"redeemed_time": common.GetTimestamp(),
				"status":        common.RedemptionCodeStatusUsed,
				"used_user_id":  userId,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("该兑换码已被使用")
		}
		if redemption.Quota == 0 {
			// Zero-value legacy codes are still consumed, but there is
			// nothing to credit; upstream's wallet guard rejects <= 0.
			return nil
		}
		return creditTopUpQuota(tx, userId, redemption.Quota, nil)
	})
	if err != nil {
		common.SysError("redemption failed: " + err.Error())
		return 0, 0, ErrRedeemFailed
	}
	if redemption.Quota > 0 {
		syncCreditUserQuotaCache(userId, redemption.Quota, "redemption")
		RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码充值 %s，兑换码ID %d", logger.LogQuota(redemption.Quota), redemption.Id))
	}
	return redemption.Quota, redemption.AgentUserId, nil
}

func (redemption *Redemption) Insert() error {
	if redemption.Type != common.RedemptionCodeTypeQuota {
		return errors.New("legacy redemption insert only supports quota codes")
	}
	if redemption.Quota <= 0 {
		return errors.New("redemption quota must be positive")
	}
	if err := common.ValidateWalletQuota(redemption.Quota); err != nil {
		return err
	}
	var err error
	err = DB.Create(redemption).Error
	return err
}

func (redemption *Redemption) SelectUpdate() error {
	// This can update zero values
	result := DB.Model(&Redemption{}).Where("id = ? AND type = ?", redemption.Id, common.RedemptionCodeTypeQuota).
		Select("redeemed_time", "status").Updates(redemption)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		var existing Redemption
		return DB.Select("id").Where("id = ? AND type = ?", redemption.Id, common.RedemptionCodeTypeQuota).First(&existing).Error
	}
	return nil
}

// Update Make sure your token's fields is completed, because this will update non-zero values
func (redemption *Redemption) Update() error {
	if redemption.Quota <= 0 {
		return errors.New("redemption quota must be positive")
	}
	if err := common.ValidateWalletQuota(redemption.Quota); err != nil {
		return err
	}
	result := DB.Model(&Redemption{}).Where("id = ? AND type = ?", redemption.Id, common.RedemptionCodeTypeQuota).
		Select("name", "status", "quota", "redeemed_time", "expired_time").Updates(redemption)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		var existing Redemption
		return DB.Select("id").Where("id = ? AND type = ?", redemption.Id, common.RedemptionCodeTypeQuota).First(&existing).Error
	}
	return nil
}

func (redemption *Redemption) Delete() error {
	result := DB.Where("id = ? AND type = ?", redemption.Id, common.RedemptionCodeTypeQuota).Delete(&Redemption{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func DeleteRedemptionById(id int) (err error) {
	if id == 0 {
		return errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	err = DB.Where("id = ? AND type = ?", id, common.RedemptionCodeTypeQuota).First(&redemption).Error
	if err != nil {
		return err
	}
	return redemption.Delete()
}

func DeleteInvalidRedemptions() (int64, error) {
	now := common.GetTimestamp()
	result := DB.Where("type = ? AND (status IN ? OR (status = ? AND expired_time != 0 AND expired_time < ?))", common.RedemptionCodeTypeQuota, []int{common.RedemptionCodeStatusUsed, common.RedemptionCodeStatusDisabled}, common.RedemptionCodeStatusEnabled, now).Delete(&Redemption{})
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
	result := DB.Where("id IN ? AND type = ?", ids, common.RedemptionCodeTypeQuota).Delete(&Redemption{})
	return result.RowsAffected, result.Error
}
