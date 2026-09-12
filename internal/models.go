package internal

import (
	"crypto/subtle"
	"errors"
	"fmt"
	"regexp"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"gorm.io/gorm"
)

const (
	InternalKeyStatusEnabled  = 1 // don't use 0, 0 is the default value!
	InternalKeyStatusDisabled = 2 // also don't use 0

	internalKeySecretLength    = 48
	internalKeySecretMinLength = 8
	internalKeySecretMaxLength = 128
)

var internalKeyKeyIdPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

type InternalKey struct {
	Id           int    `json:"id"`
	KeyId        string `json:"key_id" gorm:"type:varchar(64);uniqueIndex"`
	Key          string `json:"key" gorm:"type:varchar(128)"`
	Name         string `json:"name" gorm:"type:varchar(128)"`
	Status       int    `json:"status" gorm:"default:1"`
	CreatedTime  int64  `json:"created_time" gorm:"bigint"`
	AccessedTime int64  `json:"accessed_time" gorm:"bigint"`
}

func (InternalKey) TableName() string { return "internal_keys" }

var (
	ErrInternalKeyInvalid  = errors.New("invalid internal key credentials")
	ErrInternalKeyDisabled = errors.New("internal key disabled")
)

// ValidateInternalKeyKeyId reports whether keyId is a well-formed identifier:
// 1-64 characters of letters, digits, hyphens or underscores.
func ValidateInternalKeyKeyId(keyId string) bool {
	return internalKeyKeyIdPattern.MatchString(keyId)
}

func GetAllInternalKeys() ([]*InternalKey, error) {
	var keys []*InternalKey
	err := model.DB.Order("id desc").Find(&keys).Error
	return keys, err
}

func GetInternalKeyById(id int) (*InternalKey, error) {
	if id == 0 {
		return nil, errors.New("id 为空！")
	}
	internalKey := InternalKey{Id: id}
	err := model.DB.First(&internalKey, "id = ?", id).Error
	return &internalKey, err
}

func InternalKeyKeyIdExists(keyId string) (bool, error) {
	var count int64
	err := model.DB.Model(&InternalKey{}).Where("key_id = ?", keyId).Count(&count).Error
	return count > 0, err
}

// ValidateInternalKey authenticates an internal system call by key id + key.
// Key comparison is constant-time, and every failure sleeps randomly to blunt
// timing attacks on either half of the pair.
func ValidateInternalKey(keyId string, key string) (*InternalKey, error) {
	internalKey := &InternalKey{}
	err := model.DB.Where("key_id = ?", keyId).First(internalKey).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.RandomSleep()
			return nil, ErrInternalKeyInvalid
		}
		return nil, fmt.Errorf("%w: %v", model.ErrDatabase, err)
	}
	if internalKey.Status != InternalKeyStatusEnabled {
		common.RandomSleep()
		return nil, ErrInternalKeyDisabled
	}
	if subtle.ConstantTimeCompare([]byte(internalKey.Key), []byte(key)) != 1 {
		common.RandomSleep()
		return nil, ErrInternalKeyInvalid
	}
	// best effort: record last successful use
	if err := model.DB.Model(internalKey).Update("accessed_time", common.GetTimestamp()).Error; err != nil {
		common.SysError("failed to update internal key accessed_time: " + err.Error())
	}
	return internalKey, nil
}

func (internalKey *InternalKey) Insert() error {
	return model.DB.Create(internalKey).Error
}

// Update persists the given columns (name, status, key) of an existing key.
func (internalKey *InternalKey) Update(fields ...string) error {
	return model.DB.Model(internalKey).Select(fields).Updates(internalKey).Error
}

func DeleteInternalKeyById(id int) error {
	if id == 0 {
		return errors.New("id 为空！")
	}
	result := model.DB.Delete(&InternalKey{}, "id = ?", id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("密钥不存在")
	}
	return nil
}
