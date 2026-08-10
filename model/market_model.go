package model

import (
	"time"
)

// MarketModel 模型商店（Model Market）的商品条目：面向客户的单模型商业上架信息。
// 与内部计费表 Pricing（成本比例，随默认刷新）解耦——此处为管理员可维护的“门店价格”，
// 同时关联实际可路由的模型名（= Pricing.ModelName）与营销分类（= PublicModelCategory.Category）。
type MarketModel struct {
	Id          int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	Model       string `json:"model" gorm:"type:varchar(255);not null;uniqueIndex"` // 实际模型名，= Pricing.ModelName
	Provider    string `json:"provider" gorm:"type:varchar(64);index"`             // OpenAI / Anthropic / ...
	Category    string `json:"category" gorm:"type:varchar(32);not null;index"`     // = PublicModelCategory.Category
	Tags        string `json:"tags" gorm:"type:varchar(255)"`                        // vision,reasoning,streaming
	InputPrice  int64  `json:"input_price" gorm:"not null;default:0"`               // 客户价：每 1M 个计价单位的最小货币单位（如 CNY 分 / USD 美分），见 Currency
	OutputPrice int64  `json:"output_price" gorm:"not null;default:0"`              // 客户价：同上，输出侧
	Currency    string `json:"currency" gorm:"type:varchar(8);not null;default:'CNY'"` // CNY / USD，计价货币
	Unit        string `json:"unit" gorm:"type:varchar(16);default:'token'"`        // token|image|second|char（计价数量单位）
	Metadata    string `json:"metadata" gorm:"type:text"`                           // JSON：按 locale 的展示覆盖，如 {"zh":{"name":...},"en":{"name":...}}
	TrialQuota  int64  `json:"trial_quota" gorm:"default:0"`                         // 首次激活赠送的试用额度（v1 仅展示，未启用激活）
	Status      int    `json:"status" gorm:"not null;default:1;index"`             // 1 available, 2 coming_soon, 3 disabled
	Featured    bool   `json:"featured" gorm:"default:false;index"`
	Sort        int    `json:"sort" gorm:"default:0"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt   int64  `json:"updated_at" gorm:"bigint"`
}

// MarketModel 状态常量。
const (
	MarketModelStatusAvailable  = 1
	MarketModelStatusComingSoon = 2
	MarketModelStatusDisabled   = 3
)

// AllowedMarketModelStatuses 上架状态白名单。
var AllowedMarketModelStatuses = map[int]bool{
	MarketModelStatusAvailable:  true,
	MarketModelStatusComingSoon: true,
	MarketModelStatusDisabled:   true,
}

// AllowedMarketModelUnits 计价单位白名单。
var AllowedMarketModelUnits = map[string]bool{
	"token":  true,
	"image":  true,
	"second": true,
	"char":   true,
}

// AllowedMarketModelCurrencies 计价货币白名单。
var AllowedMarketModelCurrencies = map[string]bool{
	"CNY": true,
	"USD": true,
}

// CreateMarketModel 写入一条模型上架记录（由调用方负责填充时间戳与默认值）。
func CreateMarketModel(m *MarketModel) error {
	now := time.Now().Unix()
	m.CreatedAt = now
	m.UpdatedAt = now
	return DB.Create(m).Error
}

// GetMarketModelById 按 id 获取单条上架记录。
func GetMarketModelById(id int64) (*MarketModel, error) {
	var m MarketModel
	err := DB.Where("id = ?", id).First(&m).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// SearchMarketModels 列出上架模型；status/category 为空时不过滤。按 category、sort 升序。
func SearchMarketModels(status, category string) ([]*MarketModel, error) {
	var items []*MarketModel
	q := DB.Order("category ASC").Order("sort ASC")
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if category != "" {
		q = q.Where("category = ?", category)
	}
	err := q.Find(&items).Error
	return items, err
}

// UpdateMarketModel 更新上架记录的可编辑字段（Model 为唯一键，不可变）。
func UpdateMarketModel(m *MarketModel) error {
	updates := map[string]interface{}{
		"provider":     m.Provider,
		"category":     m.Category,
		"tags":         m.Tags,
		"input_price":  m.InputPrice,
		"output_price": m.OutputPrice,
		"currency":     m.Currency,
		"unit":         m.Unit,
		"metadata":     m.Metadata,
		"trial_quota":  m.TrialQuota,
		"status":       m.Status,
		"featured":     m.Featured,
		"sort":         m.Sort,
		"updated_at":   time.Now().Unix(),
	}
	return DB.Model(&MarketModel{}).Where("id = ?", m.Id).Updates(updates).Error
}

// DeleteMarketModel 按 id 删除上架记录。
func DeleteMarketModel(id int64) error {
	return DB.Where("id = ?", id).Delete(&MarketModel{}).Error
}

// CountMarketModelsByModel 判断某模型名是否已上架（用于唯一性校验）。
func CountMarketModelsByModel(model string) (int64, error) {
	var cnt int64
	err := DB.Model(&MarketModel{}).Where("model = ?", model).Count(&cnt).Error
	return cnt, err
}
