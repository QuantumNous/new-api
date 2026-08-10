package model

import (
	"strings"
	"time"

	"gorm.io/gorm"
)

// Distributor 分销商（渠道商）实体，关联一个管理员账号（UserId）。
type Distributor struct {
	Id             int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId         int64  `json:"user_id" gorm:"not null;uniqueIndex"` // 分销商管理员账号
	Name           string `json:"name" gorm:"type:varchar(64);not null"`
	Tier           string `json:"tier" gorm:"type:varchar(16);default:'standard'"` // standard | gold | platinum
	CommissionRate int    `json:"commission_rate" gorm:"default:0"`                // 佣金比例（百分比）
	Status         int    `json:"status" gorm:"not null;default:1;index"`         // 1 启用, 2 停用
	CreatedAt      int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt      int64  `json:"updated_at" gorm:"bigint"`
}

// 分销商等级 / 状态白名单。
var AllowedDistributorTiers = map[string]bool{
	"standard": true,
	"gold":     true,
	"platinum": true,
}

const (
	DistributorStatusActive  = 1
	DistributorStatusDisabled = 2
)

var AllowedDistributorStatuses = map[int]bool{
	DistributorStatusActive:  true,
	DistributorStatusDisabled: true,
}

// DistributorPrice 分销商价格覆盖（下级用户的模型售价）。
type DistributorPrice struct {
	Id            int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	DistributorId int64  `json:"distributor_id" gorm:"not null;index"`
	Model         string `json:"model" gorm:"type:varchar(255);not null"`
	InputPrice    int64  `json:"input_price" gorm:"not null;default:0"`  // 每 1M 单位最小货币单位
	OutputPrice   int64  `json:"output_price" gorm:"not null;default:0"` // 每 1M 单位最小货币单位
	Currency      string `json:"currency" gorm:"type:varchar(8);not null;default:'CNY'"`
	Unit          string `json:"unit" gorm:"type:varchar(16);default:'token'"`
	CreatedAt     int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt     int64  `json:"updated_at" gorm:"bigint"`
}

// 价格覆盖单位 / 货币白名单（复用市场模型约定）。
var AllowedDistributorPriceUnits = map[string]bool{
	"token":  true,
	"image":  true,
	"second": true,
	"char":   true,
}

var AllowedDistributorPriceCurrencies = map[string]bool{
	"CNY": true,
	"USD": true,
}

// CreateDistributor 创建分销商。
func CreateDistributor(m *Distributor) error {
	now := time.Now().Unix()
	m.CreatedAt = now
	m.UpdatedAt = now
	return DB.Create(m).Error
}

// GetDistributorById 按 id 获取分销商。
func GetDistributorById(id int64) (*Distributor, error) {
	var m Distributor
	if err := DB.Where("id = ?", id).First(&m).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

// GetDistributorByUserId 按关联账号获取分销商。
func GetDistributorByUserId(userId int64) (*Distributor, error) {
	var m Distributor
	if err := DB.Where("user_id = ?", userId).First(&m).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

// SearchDistributors 分页列出分销商；keyword 为空时不过滤。
func SearchDistributors(page, pageSize int, keyword string) ([]*Distributor, int64, error) {
	var items []*Distributor
	var total int64
	q := DB.Model(&Distributor{})
	if strings.TrimSpace(keyword) != "" {
		q = q.Where("name LIKE ?", "%"+keyword+"%")
	}
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if err := q.Order("id DESC").Offset(offset).Limit(pageSize).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// UpdateDistributor 更新分销商可编辑字段。
func UpdateDistributor(m *Distributor) error {
	updates := map[string]interface{}{
		"name":            m.Name,
		"tier":            m.Tier,
		"commission_rate": m.CommissionRate,
		"status":          m.Status,
		"updated_at":      time.Now().Unix(),
	}
	return DB.Model(&Distributor{}).Where("id = ?", m.Id).Updates(updates).Error
}

// DeleteDistributor 删除分销商。
func DeleteDistributor(id int64) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("distributor_id = ?", id).Delete(&DistributorPrice{}).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", id).Delete(&Distributor{}).Error
	})
}

// CreateDistributorPrice 创建价格覆盖。
func CreateDistributorPrice(m *DistributorPrice) error {
	now := time.Now().Unix()
	m.CreatedAt = now
	m.UpdatedAt = now
	return DB.Create(m).Error
}

// SearchDistributorPrices 列出某分销商的全部价格覆盖。
func SearchDistributorPrices(distributorId int64) ([]*DistributorPrice, error) {
	var items []*DistributorPrice
	if err := DB.Where("distributor_id = ?", distributorId).Order("id ASC").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

// UpdateDistributorPrice 更新价格覆盖。
func UpdateDistributorPrice(m *DistributorPrice) error {
	updates := map[string]interface{}{
		"model":        m.Model,
		"input_price":  m.InputPrice,
		"output_price": m.OutputPrice,
		"currency":     m.Currency,
		"unit":         m.Unit,
		"updated_at":   time.Now().Unix(),
	}
	return DB.Model(&DistributorPrice{}).Where("id = ?", m.Id).Updates(updates).Error
}

// DeleteDistributorPrice 删除价格覆盖。
func DeleteDistributorPrice(id int64) error {
	return DB.Where("id = ?", id).Delete(&DistributorPrice{}).Error
}

// DistributorBilling 分销商下级账单汇总（基于下级用户额度近似）。
type DistributorBilling struct {
	DistributorId int64 `json:"distributor_id"`
	SubUserCount  int64 `json:"sub_user_count"`
	Allocated     int64 `json:"allocated"`
	Used          int64 `json:"used"`
}

// GetDistributorBilling 汇总下级用户（直接邀请）的额度与用量。
func GetDistributorBilling(distributorUserId int64) (*DistributorBilling, error) {
	var subUserIds []int64
	if err := DB.Model(&User{}).Where("inviter_id = ?", distributorUserId).Pluck("id", &subUserIds).Error; err != nil {
		return nil, err
	}
	billing := &DistributorBilling{DistributorId: distributorUserId, SubUserCount: int64(len(subUserIds))}
	if len(subUserIds) == 0 {
		return billing, nil
	}
	var allocated, used int64
	if err := DB.Model(&User{}).
		Where("id IN ?", subUserIds).
		Select("COALESCE(SUM(quota),0), COALESCE(SUM(used_quota),0)").
		Row().Scan(&allocated, &used); err != nil {
		return nil, err
	}
	billing.Allocated = allocated
	billing.Used = used
	return billing, nil
}
