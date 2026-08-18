package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
)

type Redemption struct {
	Id            int            `json:"id"`
	UserId        int            `json:"user_id"`
	Key           string         `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status        int            `json:"status" gorm:"default:1"`
	Name          string         `json:"name" gorm:"index"`
	Quota         int            `json:"quota" gorm:"default:100"`
	CreatedTime   int64          `json:"created_time" gorm:"bigint"`
	RedeemedTime  int64          `json:"redeemed_time" gorm:"bigint"`
	Count         int            `json:"count" gorm:"-:all"` // only for api request
	UsedUserId    int            `json:"used_user_id"`
	ClaimedUserId int            `json:"claimed_user_id" gorm:"index;default:0"`
	ClaimedTime   int64          `json:"claimed_time" gorm:"bigint;default:0"`
	DeletedAt     gorm.DeletedAt `gorm:"index"`
	ExpiredTime   int64          `json:"expired_time" gorm:"bigint"` // 过期时间，0 表示不过期
}

func ClaimRedemptionByPurpose(purpose string, userId int) (*Redemption, error) {
	purpose = strings.TrimSpace(purpose)
	if purpose == "" {
		return nil, ErrRedemptionPurposeRequired
	}
	if userId == 0 {
		return nil, errors.New("invalid user id")
	}

	var claimed Redemption
	err := DB.Transaction(func(tx *gorm.DB) error {
		// Serialize claims for the same user across application instances. The
		// redemption path takes the same lock first to keep lock ordering stable.
		var user User
		if err := lockQuery(tx).Select("id").Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}

		now := common.GetTimestamp()
		available := lockQuery(tx).Where("name = ? AND status = ? AND claimed_user_id = ? AND (expired_time = 0 OR expired_time >= ?)",
			purpose, common.RedemptionCodeStatusEnabled, userId, now).
			Order("id asc").First(&claimed).Error
		if available == nil {
			return nil
		}
		if !errors.Is(available, gorm.ErrRecordNotFound) {
			return available
		}

		var usedCount int64
		if err := tx.Model(&Redemption{}).
			Where("name = ? AND status = ? AND used_user_id = ?", purpose, common.RedemptionCodeStatusUsed, userId).
			Count(&usedCount).Error; err != nil {
			return err
		}
		if usedCount > 0 {
			return ErrRedemptionAlreadyClaimed
		}

		for attempts := 0; attempts < 5; attempts++ {
			var candidate Redemption
			err := lockQuery(tx).Where("name = ? AND status = ? AND (claimed_user_id = 0 OR claimed_user_id IS NULL) AND (expired_time = 0 OR expired_time >= ?)",
				purpose, common.RedemptionCodeStatusEnabled, now).
				Order("id asc").First(&candidate).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrRedemptionCodesExhausted
			}
			if err != nil {
				return err
			}
			result := tx.Model(&Redemption{}).
				Where("id = ? AND status = ? AND (claimed_user_id = 0 OR claimed_user_id IS NULL)", candidate.Id, common.RedemptionCodeStatusEnabled).
				Updates(map[string]interface{}{"claimed_user_id": userId, "claimed_time": now})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 1 {
				candidate.ClaimedUserId = userId
				candidate.ClaimedTime = now
				claimed = candidate
				return nil
			}
		}
		return ErrRedemptionCodesExhausted
	})
	if err != nil {
		return nil, err
	}
	return &claimed, nil
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

func SearchRedemptions(keyword string, startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Build query based on keyword type
	query := tx.Model(&Redemption{})

	// Only try to convert to ID if the string represents a valid integer
	if id, err := strconv.Atoi(keyword); err == nil {
		query = query.Where("id = ? OR name LIKE ?", id, keyword+"%")
	} else {
		query = query.Where("name LIKE ?", keyword+"%")
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
	err = DB.First(&redemption, "id = ?", id).Error
	return &redemption, err
}

func Redeem(key string, userId int) (quota int, err error) {
	if key == "" {
		return 0, errors.New("未提供兑换码")
	}
	if userId == 0 {
		return 0, errors.New("无效的 user id")
	}
	redemption := &Redemption{}

	keyCol := "`key`"
	if common.UsingPostgreSQL {
		keyCol = `"key"`
	}
	common.RandomSleep()
	err = DB.Transaction(func(tx *gorm.DB) error {
		// Match ClaimRedemptionByPurpose's lock order so a claim racing with a
		// redemption cannot deadlock or allocate another code for this user.
		var user User
		if err := lockQuery(tx).Select("id").Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}

		err := tx.Set("gorm:query_option", "FOR UPDATE").Where(keyCol+" = ?", key).First(redemption).Error
		if err != nil {
			return errors.New("无效的兑换码")
		}
		if redemption.Status != common.RedemptionCodeStatusEnabled {
			return errors.New("该兑换码已被使用")
		}
		if redemption.ClaimedUserId != 0 && redemption.ClaimedUserId != userId {
			return errors.New("该兑换码已被其他用户领取")
		}
		if redemption.ExpiredTime != 0 && redemption.ExpiredTime < common.GetTimestamp() {
			return errors.New("该兑换码已过期")
		}
		if _, err := ApplyWalletQuotaMutationTx(tx, userId, int64(redemption.Quota), 0, "redemption", fmt.Sprintf("redemption:%d", redemption.Id)); err != nil {
			return err
		}
		redemption.RedeemedTime = common.GetTimestamp()
		redemption.Status = common.RedemptionCodeStatusUsed
		redemption.UsedUserId = userId
		err = tx.Save(redemption).Error
		return err
	})
	if err != nil {
		common.SysError("redemption failed: " + err.Error())
		return 0, ErrRedeemFailed
	}
	RecordLog(userId, LogTypeTopup, fmt.Sprintf("Redemption code top-up: %s (ID: %d)", logger.FormatQuota(redemption.Quota), redemption.Id))
	return redemption.Quota, nil
}

func (redemption *Redemption) Insert() error {
	var err error
	err = DB.Create(redemption).Error
	return err
}

func (redemption *Redemption) SelectUpdate() error {
	// This can update zero values
	return DB.Model(redemption).Select("redeemed_time", "status").Updates(redemption).Error
}

// Update Make sure your token's fields is completed, because this will update non-zero values
func (redemption *Redemption) Update() error {
	var err error
	err = DB.Model(redemption).Select("name", "status", "quota", "redeemed_time", "expired_time").Updates(redemption).Error
	return err
}

func (redemption *Redemption) Delete() error {
	var err error
	err = DB.Delete(redemption).Error
	return err
}

func DeleteRedemptionById(id int) (err error) {
	if id == 0 {
		return errors.New("id 为空！")
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
