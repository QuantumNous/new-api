package authz

import (
	"strings"

	"github.com/QuantumNous/new-api/model"
	casbinmodel "github.com/casbin/casbin/v2/model"
	"github.com/casbin/casbin/v2/persist"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type gormAdapter struct {
	db *gorm.DB
}

func newGormAdapter(db *gorm.DB) *gormAdapter {
	return &gormAdapter{db: db}
}

func (a *gormAdapter) LoadPolicy(m casbinmodel.Model) error {
	var rules []model.CasbinRule
	if err := a.db.Order("id asc").Find(&rules).Error; err != nil {
		return err
	}
	for _, rule := range rules {
		if err := persist.LoadPolicyLine(ruleToLine(rule), m); err != nil {
			return err
		}
	}
	return nil
}

func (a *gormAdapter) SavePolicy(m casbinmodel.Model) error {
	return a.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("1 = 1").Delete(&model.CasbinRule{}).Error; err != nil {
			return err
		}
		rules := make([]model.CasbinRule, 0)
		for ptype, ast := range m["p"] {
			for _, policy := range ast.Policy {
				rules = append(rules, newRule(ptype, policy))
			}
		}
		for ptype, ast := range m["g"] {
			for _, policy := range ast.Policy {
				rules = append(rules, newRule(ptype, policy))
			}
		}
		if len(rules) == 0 {
			return nil
		}
		return tx.Create(&rules).Error
	})
}

func (a *gormAdapter) AddPolicy(_ string, ptype string, rule []string) error {
	casbinRule := newRule(ptype, rule)
	var count int64
	if err := a.ruleQuery(a.db.Model(&model.CasbinRule{}), ptype, rule).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	return a.db.Clauses(clause.OnConflict{DoNothing: true}).Create(&casbinRule).Error
}

func (a *gormAdapter) RemovePolicy(_ string, ptype string, rule []string) error {
	return a.ruleQuery(a.db, ptype, rule).Delete(&model.CasbinRule{}).Error
}

func (a *gormAdapter) RemoveFilteredPolicy(_ string, ptype string, fieldIndex int, fieldValues ...string) error {
	query := a.db.Where("ptype = ?", ptype)
	for i, value := range fieldValues {
		if value == "" {
			continue
		}
		query = query.Where("v"+string(rune('0'+fieldIndex+i))+" = ?", value)
	}
	return query.Delete(&model.CasbinRule{}).Error
}

func (a *gormAdapter) ruleQuery(query *gorm.DB, ptype string, rule []string) *gorm.DB {
	query = query.Where("ptype = ?", ptype)
	for idx := 0; idx < 6; idx++ {
		value := ""
		if idx < len(rule) {
			value = rule[idx]
		}
		query = query.Where("v"+string(rune('0'+idx))+" = ?", value)
	}
	return query
}

func newRule(ptype string, policy []string) model.CasbinRule {
	rule := model.CasbinRule{Ptype: ptype}
	values := []*string{&rule.V0, &rule.V1, &rule.V2, &rule.V3, &rule.V4, &rule.V5}
	for idx, value := range policy {
		if idx >= len(values) {
			break
		}
		*values[idx] = value
	}
	return rule
}

func ruleToLine(rule model.CasbinRule) string {
	parts := []string{rule.Ptype}
	values := []string{rule.V0, rule.V1, rule.V2, rule.V3, rule.V4, rule.V5}
	if rule.Ptype == "p" && rule.V0 != "" && rule.V1 != "" && rule.V2 != "" && rule.V3 == "" {
		values[3] = EffectAllow
	}
	for _, value := range values {
		if value == "" {
			continue
		}
		parts = append(parts, value)
	}
	return strings.Join(parts, ", ")
}
