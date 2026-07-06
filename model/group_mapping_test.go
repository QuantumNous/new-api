package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupRuleTestDB(t *testing.T) {
	t.Helper()
	origDB := DB
	t.Cleanup(func() { DB = origDB }) // 恢复全局 DB，避免污染其他测试
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&GroupMappingRule{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	DB = db
}

func TestCreateAndGetGroupMappingRule(t *testing.T) {
	setupRuleTestDB(t)
	rule := &GroupMappingRule{
		JobTitle:    "工程师",
		TargetGroup: "dev",
		Enabled:     true,
		Priority:    10,
		Remark:      "test",
	}
	if err := CreateGroupMappingRule(rule); err != nil {
		t.Fatal(err)
	}
	if rule.Id == 0 {
		t.Fatal("expected id assigned")
	}
	got, err := GetGroupMappingRuleByJobTitle("工程师")
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || got.TargetGroup != "dev" {
		t.Errorf("unexpected: %+v", got)
	}
}

func TestUpdateGroupMappingRule(t *testing.T) {
	setupRuleTestDB(t)
	rule := &GroupMappingRule{JobTitle: "工程师", TargetGroup: "dev", Enabled: true}
	CreateGroupMappingRule(rule)
	rule.TargetGroup = "backend"
	rule.Enabled = false
	if err := UpdateGroupMappingRule(rule); err != nil {
		t.Fatal(err)
	}
	got, _ := GetGroupMappingRuleByJobTitle("工程师")
	// disabled 规则不会被精确查询返回，所以 got 应为 nil
	if got != nil {
		t.Errorf("disabled rule should not be returned by GetGroupMappingRuleByJobTitle, got %+v", got)
	}
}

func TestDeleteGroupMappingRule(t *testing.T) {
	setupRuleTestDB(t)
	rule := &GroupMappingRule{JobTitle: "工程师", TargetGroup: "dev", Enabled: true}
	CreateGroupMappingRule(rule)
	if err := DeleteGroupMappingRule(rule.Id); err != nil {
		t.Fatal(err)
	}
	rules, _ := GetAllGroupMappingRules()
	if len(rules) != 0 {
		t.Errorf("expected 0 rules after delete, got %d", len(rules))
	}
}

func TestUpdateGroupMappingRulesInTx_Upsert(t *testing.T) {
	setupRuleTestDB(t)
	// 先插一条
	CreateGroupMappingRule(&GroupMappingRule{JobTitle: "工程师", TargetGroup: "dev", Enabled: true})
	// 批量 upsert：更新现有 + 新增一条
	rules := []GroupMappingRule{
		{JobTitle: "工程师", TargetGroup: "backend"},
		{JobTitle: "产品", TargetGroup: "pm"},
	}
	if err := UpdateGroupMappingRulesInTx(rules); err != nil {
		t.Fatal(err)
	}
	all, _ := GetAllGroupMappingRules()
	if len(all) != 2 {
		t.Fatalf("expected 2 rules, got %d", len(all))
	}
	byTitle := map[string]string{}
	for _, r := range all {
		byTitle[r.JobTitle] = r.TargetGroup
	}
	if byTitle["工程师"] != "backend" {
		t.Errorf("expected 工程师 updated to backend, got %s", byTitle["工程师"])
	}
	if byTitle["产品"] != "pm" {
		t.Errorf("expected 产品 = pm, got %s", byTitle["产品"])
	}
}

func TestGetGroupMappingRuleByJobTitle_TrimSpace(t *testing.T) {
	setupRuleTestDB(t)
	CreateGroupMappingRule(&GroupMappingRule{JobTitle: "工程师", TargetGroup: "dev", Enabled: true})
	// 带空格的输入应被 trim 后匹配
	got, err := GetGroupMappingRuleByJobTitle("  工程师  ")
	if err != nil {
		t.Fatal(err)
	}
	if got == nil {
		t.Error("expected match after trim")
	}
}
