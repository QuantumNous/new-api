package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// VolcAssetUserGroup maintains the mapping "new-api user -> asset group on each
// outbound", used for per-user isolation of the asset endpoints. Each user has a
// system-provisioned dedicated group on each outbound; all bindings are stored as
// JSON in the Groups column, keyed by outbound Id. A single row + JSON column is
// used instead of a composite unique index to avoid cross-database index migration
// issues (only ADD COLUMN is needed).
type VolcAssetUserGroup struct {
	Id        int    `json:"id" gorm:"primaryKey"`
	UserId    int    `json:"user_id" gorm:"uniqueIndex"`
	Groups    string `json:"groups" gorm:"type:text"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

// AssetGroupBinding is a user's asset group binding on a given outbound.
type AssetGroupBinding struct {
	OutboundId  string `json:"outbound_id"`
	Format      string `json:"format"`
	ProjectName string `json:"project_name"`
	GroupId     string `json:"group_id"`
	GroupType   string `json:"group_type"`
}

func (r *VolcAssetUserGroup) parseBindings() map[string]AssetGroupBinding {
	bindings := make(map[string]AssetGroupBinding)
	if r.Groups == "" {
		return bindings
	}
	_ = common.Unmarshal([]byte(r.Groups), &bindings)
	return bindings
}

// GetVolcAssetUserGroupBinding returns the user's asset group binding on a given
// outbound; it returns gorm.ErrRecordNotFound when none exists.
func GetVolcAssetUserGroupBinding(userId int, outboundId string) (*AssetGroupBinding, error) {
	if userId == 0 {
		return nil, errors.New("userId is empty")
	}
	var row VolcAssetUserGroup
	if err := DB.Where("user_id = ?", userId).First(&row).Error; err != nil {
		return nil, err
	}
	if binding, ok := row.parseBindings()[outboundId]; ok {
		return &binding, nil
	}
	return nil, gorm.ErrRecordNotFound
}

// SaveVolcAssetUserGroupBinding upserts one group binding, keyed by (UserId) at
// the row level and by outbound Id at the field level.
func SaveVolcAssetUserGroupBinding(userId int, binding AssetGroupBinding) error {
	if userId == 0 || binding.OutboundId == "" {
		return errors.New("invalid volc asset user group binding")
	}
	now := common.GetTimestamp()

	var row VolcAssetUserGroup
	err := DB.Where("user_id = ?", userId).First(&row).Error
	if err == nil {
		bindings := row.parseBindings()
		bindings[binding.OutboundId] = binding
		data, mErr := common.Marshal(bindings)
		if mErr != nil {
			return mErr
		}
		row.Groups = string(data)
		row.UpdatedAt = now
		return DB.Save(&row).Error
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	data, mErr := common.Marshal(map[string]AssetGroupBinding{binding.OutboundId: binding})
	if mErr != nil {
		return mErr
	}
	return DB.Create(&VolcAssetUserGroup{
		UserId:    userId,
		Groups:    string(data),
		CreatedAt: now,
		UpdatedAt: now,
	}).Error
}
