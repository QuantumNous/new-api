package model

import (
	"errors"
	"strconv"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

type RegistrationCode struct {
	Id          int            `json:"id"`
	Key         string         `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status      int            `json:"status" gorm:"default:1;index"`
	Name        string         `json:"name" gorm:"index"`
	CreatedTime int64          `json:"created_time" gorm:"bigint"`
	UsedTime    int64          `json:"used_time" gorm:"bigint"`
	ExpiredTime int64          `json:"expired_time" gorm:"bigint"` // 过期时间，0 表示不过期
	UsedUserId  int            `json:"used_user_id" gorm:"index"`
	Count       int            `json:"count" gorm:"-:all"` // only for api request
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

// RegistrationCodeWithUser carries the username of the consuming user so the
// admin list can render "used by" without a per-row lookup.
type RegistrationCodeWithUser struct {
	RegistrationCode
	UsedUsername string `json:"used_username"`
}

var (
	ErrRegistrationCodeInvalid = errors.New("无效的注册码")
	ErrRegistrationCodeUsed    = errors.New("该注册码已被使用")
	ErrRegistrationCodeExpired = errors.New("该注册码已过期")
)

func registrationCodeKeyCol() string {
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		return `"key"`
	}
	return "`key`"
}

func GetAllRegistrationCodes(startIdx int, num int) (codes []*RegistrationCodeWithUser, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	err = tx.Model(&RegistrationCode{}).Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	err = tx.Model(&RegistrationCode{}).
		Select("registration_codes.*, users.username AS used_username").
		Joins("LEFT JOIN users ON users.id = registration_codes.used_user_id").
		Order("registration_codes.id desc").Limit(num).Offset(startIdx).Find(&codes).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return codes, total, nil
}

func SearchRegistrationCodes(keyword string, status string, startIdx int, num int) (codes []*RegistrationCodeWithUser, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&RegistrationCode{})

	if keyword != "" {
		if id, err := strconv.Atoi(keyword); err == nil {
			query = query.Where("registration_codes.id = ? OR registration_codes.name LIKE ?", id, keyword+"%")
		} else {
			query = query.Where("registration_codes.name LIKE ?", keyword+"%")
		}
	}

	if status != "" {
		now := common.GetTimestamp()
		switch status {
		case "expired":
			query = query.Where(
				"registration_codes.status = ? AND registration_codes.expired_time != 0 AND registration_codes.expired_time < ?",
				common.RegistrationCodeStatusUnused,
				now,
			)
		case strconv.Itoa(common.RegistrationCodeStatusUnused):
			query = query.Where(
				"registration_codes.status = ? AND (registration_codes.expired_time = 0 OR registration_codes.expired_time >= ?)",
				common.RegistrationCodeStatusUnused,
				now,
			)
		case strconv.Itoa(common.RegistrationCodeStatusUsed):
			query = query.Where("registration_codes.status = ?", common.RegistrationCodeStatusUsed)
		}
	}

	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	err = query.
		Select("registration_codes.*, users.username AS used_username").
		Joins("LEFT JOIN users ON users.id = registration_codes.used_user_id").
		Order("registration_codes.id desc").Limit(num).Offset(startIdx).Find(&codes).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return codes, total, nil
}

func GetRegistrationCodeById(id int) (*RegistrationCode, error) {
	if id == 0 {
		return nil, errors.New("id 为空！")
	}
	code := RegistrationCode{Id: id}
	err := DB.First(&code, "id = ?", id).Error
	return &code, err
}

// ConsumeRegistrationCodeWithTx atomically flips a registration code from
// unused to used inside the caller's transaction. Concurrent consumers lose on
// the status compare-and-swap even without a row lock (e.g. on SQLite).
func ConsumeRegistrationCodeWithTx(tx *gorm.DB, key string, userId int) error {
	if key == "" {
		return ErrRegistrationCodeInvalid
	}
	if userId == 0 {
		return errors.New("无效的 user id")
	}
	code := &RegistrationCode{}
	err := lockForUpdate(tx).Where(registrationCodeKeyCol()+" = ?", key).First(code).Error
	if err != nil {
		return ErrRegistrationCodeInvalid
	}
	if code.Status != common.RegistrationCodeStatusUnused {
		return ErrRegistrationCodeUsed
	}
	if code.ExpiredTime != 0 && code.ExpiredTime < common.GetTimestamp() {
		return ErrRegistrationCodeExpired
	}
	result := tx.Model(&RegistrationCode{}).
		Where("id = ? AND status = ?", code.Id, common.RegistrationCodeStatusUnused).
		Updates(map[string]interface{}{
			"used_time":    common.GetTimestamp(),
			"status":       common.RegistrationCodeStatusUsed,
			"used_user_id": userId,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrRegistrationCodeUsed
	}
	return nil
}

// ConsumeRegistrationCode consumes a code in its own transaction.
func ConsumeRegistrationCode(key string, userId int) error {
	common.RandomSleep()
	return DB.Transaction(func(tx *gorm.DB) error {
		return ConsumeRegistrationCodeWithTx(tx, key, userId)
	})
}

// CheckRegistrationCodeUsable validates a code without consuming it, for
// fast-fail UX before user creation. The authoritative check happens in
// ConsumeRegistrationCodeWithTx inside the registration transaction.
func CheckRegistrationCodeUsable(key string) error {
	if key == "" {
		return ErrRegistrationCodeInvalid
	}
	code := &RegistrationCode{}
	if err := DB.Where(registrationCodeKeyCol()+" = ?", key).First(code).Error; err != nil {
		return ErrRegistrationCodeInvalid
	}
	if code.Status != common.RegistrationCodeStatusUnused {
		return ErrRegistrationCodeUsed
	}
	if code.ExpiredTime != 0 && code.ExpiredTime < common.GetTimestamp() {
		return ErrRegistrationCodeExpired
	}
	return nil
}

func (code *RegistrationCode) Insert() error {
	return DB.Create(code).Error
}

// Update updates editable fields only. Status transitions go through
// ConsumeRegistrationCodeWithTx exclusively.
func (code *RegistrationCode) Update() error {
	return DB.Model(code).Select("name", "expired_time").Updates(code).Error
}

func (code *RegistrationCode) Delete() error {
	return DB.Delete(code).Error
}

func DeleteRegistrationCodeById(id int) (err error) {
	if id == 0 {
		return errors.New("id 为空！")
	}
	code := RegistrationCode{Id: id}
	err = DB.Where(code).First(&code).Error
	if err != nil {
		return err
	}
	return code.Delete()
}

func DeleteInvalidRegistrationCodes() (int64, error) {
	now := common.GetTimestamp()
	result := DB.Where("status = ? OR (status = ? AND expired_time != 0 AND expired_time < ?)", common.RegistrationCodeStatusUsed, common.RegistrationCodeStatusUnused, now).Delete(&RegistrationCode{})
	return result.RowsAffected, result.Error
}
