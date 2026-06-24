package model

import (
	"errors"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type UserLDAPBinding struct {
	Id              int       `json:"id" gorm:"primaryKey"`
	UserId          int       `json:"user_id" gorm:"not null;uniqueIndex"`
	LDAPUserId      string    `json:"ldap_user_id" gorm:"column:ldap_user_id;type:varchar(512);not null;uniqueIndex"`
	LDAPUsername    string    `json:"ldap_username" gorm:"column:ldap_username;type:varchar(256)"`
	LDAPDisplayName string    `json:"ldap_display_name" gorm:"column:ldap_display_name;type:varchar(256)"`
	LDAPEmail       string    `json:"ldap_email" gorm:"column:ldap_email;type:varchar(256)"`
	LDAPGroups      string    `json:"ldap_groups" gorm:"column:ldap_groups;type:text"`
	LastSyncTime    int64     `json:"last_sync_time" gorm:"column:last_sync_time"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func (UserLDAPBinding) TableName() string {
	return "user_ldap_bindings"
}

func CreateUserLDAPBinding(binding *UserLDAPBinding) error {
	if binding.UserId == 0 {
		return errors.New("user ID is required")
	}
	if binding.LDAPUserId == "" {
		return errors.New("LDAP user ID is required")
	}
	ensureLDAPBindingSyncTime(binding)
	return DB.Create(binding).Error
}

func CreateUserLDAPBindingWithTx(tx *gorm.DB, binding *UserLDAPBinding) error {
	if binding.UserId == 0 {
		return errors.New("user ID is required")
	}
	if binding.LDAPUserId == "" {
		return errors.New("LDAP user ID is required")
	}
	ensureLDAPBindingSyncTime(binding)
	return tx.Create(binding).Error
}

func GetUserByLDAPBinding(ldapUserId string) (*User, error) {
	binding, err := GetUserLDAPBindingByLDAPUserId(ldapUserId)
	if err != nil {
		return nil, err
	}

	var user User
	if err := DB.First(&user, binding.UserId).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func IsLDAPUserIdTaken(ldapUserId string) bool {
	var count int64
	DB.Model(&UserLDAPBinding{}).Where("ldap_user_id = ?", ldapUserId).Count(&count)
	return count > 0
}

func GetUserLDAPBindingByUserId(userId int) (*UserLDAPBinding, error) {
	var binding UserLDAPBinding
	if err := DB.Where("user_id = ?", userId).First(&binding).Error; err != nil {
		return nil, err
	}
	return &binding, nil
}

func GetUserLDAPBindingByLDAPUserId(ldapUserId string) (*UserLDAPBinding, error) {
	var binding UserLDAPBinding
	if err := DB.Where("ldap_user_id = ?", ldapUserId).First(&binding).Error; err != nil {
		return nil, err
	}
	return &binding, nil
}

func DeleteUserLDAPBindingByUserId(userId int) error {
	return DB.Where("user_id = ?", userId).Delete(&UserLDAPBinding{}).Error
}

func (binding *UserLDAPBinding) SetGroups(groups []string) error {
	normalized := normalizeLDAPGroups(groups)
	bytes, err := common.Marshal(normalized)
	if err != nil {
		return err
	}
	binding.LDAPGroups = string(bytes)
	binding.LastSyncTime = time.Now().Unix()
	return nil
}

func (binding *UserLDAPBinding) GroupList() []string {
	if strings.TrimSpace(binding.LDAPGroups) == "" {
		return nil
	}
	var groups []string
	if err := common.UnmarshalJsonStr(binding.LDAPGroups, &groups); err != nil {
		return nil
	}
	return normalizeLDAPGroups(groups)
}

func (binding *UserLDAPBinding) UpdateSnapshot(username, displayName, email string, groups []string) error {
	binding.LDAPUsername = username
	binding.LDAPDisplayName = displayName
	binding.LDAPEmail = email
	return binding.SetGroups(groups)
}

func UpdateUserLDAPBindingSnapshot(binding *UserLDAPBinding) error {
	if binding.Id == 0 {
		return errors.New("LDAP binding ID is required")
	}
	ensureLDAPBindingSyncTime(binding)
	return DB.Model(&UserLDAPBinding{}).Where("id = ?", binding.Id).Updates(map[string]interface{}{
		"ldap_user_id":      binding.LDAPUserId,
		"ldap_username":     binding.LDAPUsername,
		"ldap_display_name": binding.LDAPDisplayName,
		"ldap_email":        binding.LDAPEmail,
		"ldap_groups":       binding.LDAPGroups,
		"last_sync_time":    binding.LastSyncTime,
	}).Error
}

func UpdateUserLDAPBindingUserId(bindingId int, userId int) error {
	if bindingId == 0 {
		return errors.New("LDAP binding ID is required")
	}
	if userId == 0 {
		return errors.New("user ID is required")
	}
	return DB.Model(&UserLDAPBinding{}).Where("id = ?", bindingId).Update("user_id", userId).Error
}

func normalizeLDAPGroups(groups []string) []string {
	normalized := make([]string, 0, len(groups))
	seen := make(map[string]struct{}, len(groups))
	for _, group := range groups {
		group = strings.TrimSpace(group)
		if group == "" {
			continue
		}
		if _, ok := seen[group]; ok {
			continue
		}
		seen[group] = struct{}{}
		normalized = append(normalized, group)
	}
	return normalized
}

func ensureLDAPBindingSyncTime(binding *UserLDAPBinding) {
	if binding.LastSyncTime == 0 {
		binding.LastSyncTime = time.Now().Unix()
	}
}
