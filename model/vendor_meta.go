package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"gorm.io/gorm"
)

// Vendor 用于存储供应商信息，供模型引用
// Name 唯一，用于在模型中关联
// Icon 采用 @lobehub/icons 的图标名，前端可直接渲染
// Status 预留字段，1 表示启用
// 本表同样遵循 3NF 设计范式

type Vendor struct {
	Id          int            `json:"id"`
	Name        string         `json:"name" gorm:"size:128;not null;uniqueIndex:uk_vendor_name_delete_at,priority:1"`
	Description string         `json:"description,omitempty" gorm:"type:text"`
	Icon        string         `json:"icon,omitempty" gorm:"type:varchar(128)"`
	Status      int            `json:"status" gorm:"default:1"`
	CreatedTime int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index;uniqueIndex:uk_vendor_name_delete_at,priority:2"`
}

// Insert 创建新的供应商记录
func (v *Vendor) Insert() error {
	now := common.GetTimestamp()
	v.CreatedTime = now
	v.UpdatedTime = now
	return DB.Create(v).Error
}

// IsVendorNameDuplicated 检查供应商名称是否重复（排除自身 ID）
func IsVendorNameDuplicated(id int, name string) (bool, error) {
	if name == "" {
		return false, nil
	}
	var cnt int64
	err := DB.Model(&Vendor{}).Where("name = ? AND id <> ?", name, id).Count(&cnt).Error
	return cnt > 0, err
}

// Update 更新供应商记录
func (v *Vendor) Update() error {
	v.UpdatedTime = common.GetTimestamp()
	return DB.Save(v).Error
}

// Delete 软删除供应商
func (v *Vendor) Delete() error {
	return DB.Delete(v).Error
}

// GetVendorByID 根据 ID 获取供应商
func GetVendorByID(id int) (*Vendor, error) {
	var v Vendor
	err := DB.First(&v, id).Error
	if err != nil {
		return nil, err
	}
	return &v, nil
}

// GetAllVendors 获取全部供应商（分页）
func GetAllVendors(offset int, limit int) ([]*Vendor, error) {
	var vendors []*Vendor
	err := DB.Offset(offset).Limit(limit).Find(&vendors).Error
	return vendors, err
}

// SearchVendors 按关键字搜索供应商
func SearchVendors(keyword string, offset int, limit int) ([]*Vendor, int64, error) {
	db := DB.Model(&Vendor{})
	if keyword != "" {
		like := "%" + keyword + "%"
		db = db.Where("name LIKE ? OR description LIKE ?", like, like)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var vendors []*Vendor
	if err := db.Offset(offset).Limit(limit).Order("id DESC").Find(&vendors).Error; err != nil {
		return nil, 0, err
	}
	return vendors, total, nil
}

func resolveVendorNameAndIcon(channel *Channel) (string, string) {
	if channel == nil {
		return "Custom", "Globe"
	}

	name := strings.TrimSpace(channel.Name)
	switch channel.Type {
	case constant.ChannelTypeAdvancedCustom, constant.ChannelTypeNewAPI, constant.ChannelTypeSub2API, constant.ChannelTypeCustom:
		if name != "" {
			return name, "Globe"
		}
		return constant.GetChannelTypeName(channel.Type), "Globe"
	default:
		typeName := constant.GetChannelTypeName(channel.Type)
		if typeName != "" && typeName != "Unknown" {
			return typeName, "Globe"
		}
		if name != "" {
			return name, "Globe"
		}
		return "Custom", "Globe"
	}
}

// EnsureVendorForChannel 检查并自动创建渠道对应的供应商记录，返回 Vendor ID
func EnsureVendorForChannel(channel *Channel, tx *gorm.DB) (int, error) {
	if channel == nil {
		return 0, nil
	}

	name, icon := resolveVendorNameAndIcon(channel)
	if name == "" {
		return 0, nil
	}

	useDB := DB
	if tx != nil {
		useDB = tx
	}

	var vendor Vendor
	err := useDB.Where("name = ? AND deleted_at IS NULL", name).First(&vendor).Error
	if err == nil {
		return vendor.Id, nil
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		newVendor := Vendor{
			Name:        name,
			Description: fmt.Sprintf("%s 渠道自动创建供应商", name),
			Icon:        icon,
			Status:      1,
			CreatedTime: common.GetTimestamp(),
			UpdatedTime: common.GetTimestamp(),
		}
		if err := useDB.Create(&newVendor).Error; err != nil {
			return 0, err
		}
		return newVendor.Id, nil
	}

	return 0, err
}

// AutoBindChannelModelsToVendor 为渠道拥有的模型自动补充元数据并绑定 Vendor ID
func AutoBindChannelModelsToVendor(channel *Channel, vendorID int, tx *gorm.DB) error {
	if channel == nil || channel.Models == "" || vendorID <= 0 {
		return nil
	}

	useDB := DB
	if tx != nil {
		useDB = tx
	}

	models := strings.Split(channel.Models, ",")
	now := common.GetTimestamp()

	for _, modelName := range models {
		modelName = strings.TrimSpace(modelName)
		if modelName == "" {
			continue
		}

		var existing Model
		err := useDB.Where("model_name = ? AND deleted_at IS NULL", modelName).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			newModel := Model{
				ModelName:    modelName,
				VendorID:     vendorID,
				Status:       1,
				SyncOfficial: 0,
				Endpoints:    `["openai"]`,
				CreatedTime:  now,
				UpdatedTime:  now,
			}
			if err := useDB.Create(&newModel).Error; err != nil {
				common.SysError(fmt.Sprintf("auto bind model failed: %s, err: %v", modelName, err))
			}
		} else if err == nil && existing.VendorID == 0 {
			useDB.Model(&existing).Update("vendor_id", vendorID)
		}
	}
	return nil
}

// EnsureChannelVendorAndModels 自动确保渠道对应的供应商和模型元数据已关联
func EnsureChannelVendorAndModels(channel *Channel, tx *gorm.DB) error {
	if channel == nil {
		return nil
	}
	vendorID, err := EnsureVendorForChannel(channel, tx)
	if err != nil {
		common.SysError(fmt.Sprintf("EnsureVendorForChannel failed for channel %d (%s): %v", channel.Id, channel.Name, err))
		return err
	}
	return AutoBindChannelModelsToVendor(channel, vendorID, tx)
}

