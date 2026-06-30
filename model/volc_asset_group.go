package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// VolcAssetUserGroup 维护「new-api 用户 → 各出口上的资产分组」映射，用于资产接口的用户隔离。
// 每个用户在每个出口(outbound)上拥有一个由系统自动开通的专属分组；所有绑定以 JSON 存于 Groups 列，
// 键为出口 Id。采用单行 + JSON 列而非复合唯一索引，避免跨数据库的索引迁移问题（仅需 ADD COLUMN）。
type VolcAssetUserGroup struct {
	Id        int    `json:"id" gorm:"primaryKey"`
	UserId    int    `json:"user_id" gorm:"uniqueIndex"`
	Groups    string `json:"groups" gorm:"type:text"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

// AssetGroupBinding 是用户在某个出口上的资产分组绑定。
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

// GetVolcAssetUserGroupBinding 返回用户在某出口上的资产分组绑定；不存在时返回 gorm.ErrRecordNotFound。
func GetVolcAssetUserGroupBinding(userId int, outboundId string) (*AssetGroupBinding, error) {
	if userId == 0 {
		return nil, errors.New("userId 为空")
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

// SaveVolcAssetUserGroupBinding 以 (UserId) 为行键、出口 Id 为字段键 upsert 一条分组绑定。
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
