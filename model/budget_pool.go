package model

import (
	"os"
	"strconv"
)

// BudgetPool 总预算池（单行，id 固定=1），所有个人余额拨付均来源于此池。
// 金额单位：元（v1 货币单位已定元，toQuotaUnit 退化为 1:1）。
type BudgetPool struct {
	Id          int     `json:"id" gorm:"primaryKey"`
	TotalBalance float64 `json:"total_balance" gorm:"type:decimal(18,2);not null;default:0"` // 单位：元
	Currency    string  `json:"currency" gorm:"type:varchar(8);not null;default:'CNY'"`
	UpdatedAt   int64   `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

func (BudgetPool) TableName() string { return "budget_pool" }

// SeedBudgetPoolIfEmpty 首启按环境变量 INITIAL_POOL_BALANCE 注入 id=1 的预算池行。
// 初始金额来源待定（env 注入 / 种子 / 手动充值），默认 0。
func SeedBudgetPoolIfEmpty() error {
	var cnt int64
	if err := DB.Model(&BudgetPool{}).Where("id = 1").Count(&cnt).Error; err != nil {
		return err
	}
	if cnt > 0 {
		return nil
	}
	balance := 0.0
	if v := os.Getenv("INITIAL_POOL_BALANCE"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			balance = f
		}
	}
	pool := BudgetPool{Id: 1, TotalBalance: balance, Currency: "CNY"}
	return DB.Create(&pool).Error
}
