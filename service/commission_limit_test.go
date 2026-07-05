package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func seedLimitRule(t *testing.T, daily, monthly int) {
	t.Helper()
	model.DB.Unscoped().Where("1 = 1").Delete(&model.CommissionRule{})
	r := model.CommissionRule{RuleName: "lim", RuleCode: "lim", RuleType: "percentage",
		Level1Rate: 0.10, DailyLimit: daily, MonthlyLimit: monthly, IsActive: true, Priority: 100}
	if err := model.DB.Create(&r).Error; err != nil {
		t.Fatal(err)
	}
}

func seedPair(t *testing.T) (inviter, consumer int) {
	t.Helper()
	model.DB.Unscoped().Where("1 = 1").Delete(&model.CommissionLog{})
	model.DB.Unscoped().Where("1 = 1").Delete(&model.User{})
	mk := func(name string, inv int) int {
		u := model.User{Username: name, AffCode: name, Status: common.UserStatusEnabled, InviterId: inv}
		model.DB.Create(&u)
		return u.Id
	}
	inviter = mk("lim_a", 0)
	consumer = mk("lim_b", inviter)
	return
}

func quotaOfUser(t *testing.T, id int) int {
	t.Helper()
	var u model.User
	model.DB.Select("quota").First(&u, id)
	return u.Quota
}

// 日限额:第二笔应被拦
func TestDailyLimitBlocks(t *testing.T) {
	a, b := seedPair(t)
	seedLimitRule(t, 1500, 0)
	svc := NewCommissionService()
	svc.ProcessCommission(CommissionRequest{UserID: b, LogID: 8201, ModelName: "m", QuotaUsed: 10000})
	svc.ProcessCommission(CommissionRequest{UserID: b, LogID: 8202, ModelName: "m", QuotaUsed: 10000})
	if got := quotaOfUser(t, a); got != 1000 {
		t.Fatalf("日限额未生效: quota=%d, 期望 1000", got)
	}
}

// 日限额边界:恰好达到上限应放行
func TestDailyLimitExactBoundary(t *testing.T) {
	a, b := seedPair(t)
	seedLimitRule(t, 2000, 0)
	svc := NewCommissionService()
	svc.ProcessCommission(CommissionRequest{UserID: b, LogID: 8301, ModelName: "m", QuotaUsed: 10000})
	svc.ProcessCommission(CommissionRequest{UserID: b, LogID: 8302, ModelName: "m", QuotaUsed: 10000})
	if got := quotaOfUser(t, a); got != 2000 {
		t.Fatalf("边界值处理错误: quota=%d, 期望 2000(恰好达上限应放行)", got)
	}
}

// 月限额:独立于日限额生效
func TestMonthlyLimitBlocks(t *testing.T) {
	a, b := seedPair(t)
	seedLimitRule(t, 0, 1500)
	svc := NewCommissionService()
	svc.ProcessCommission(CommissionRequest{UserID: b, LogID: 8401, ModelName: "m", QuotaUsed: 10000})
	svc.ProcessCommission(CommissionRequest{UserID: b, LogID: 8402, ModelName: "m", QuotaUsed: 10000})
	if got := quotaOfUser(t, a); got != 1000 {
		t.Fatalf("月限额未生效: quota=%d, 期望 1000", got)
	}
}
