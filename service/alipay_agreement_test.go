package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/require"
)

func TestBuildAlipayPeriodRuleFromPlan_Month(t *testing.T) {
	plan := &model.SubscriptionPlan{
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
	}
	execute := time.Date(2026, 7, 13, 0, 0, 0, 0, time.UTC)
	rule, err := BuildAlipayPeriodRuleFromPlan(plan, "19.99", execute)
	require.NoError(t, err)
	require.Equal(t, "MONTH", rule.PeriodType)
	require.Equal(t, "1", rule.Period)
	require.Equal(t, "19.99", rule.SingleAmount)
	require.Equal(t, "2026-07-13", rule.ExecuteTime)
}

func TestBuildAlipayPeriodRuleFromPlan_YearMapsToMonths(t *testing.T) {
	plan := &model.SubscriptionPlan{
		DurationUnit:  model.SubscriptionDurationYear,
		DurationValue: 1,
	}
	execute := time.Date(2026, 7, 13, 0, 0, 0, 0, time.UTC)
	rule, err := BuildAlipayPeriodRuleFromPlan(plan, "99.00", execute)
	require.NoError(t, err)
	require.Equal(t, "MONTH", rule.PeriodType)
	require.Equal(t, "12", rule.Period)
}

func TestBuildAlipayPeriodRuleFromPlan_RejectsHour(t *testing.T) {
	plan := &model.SubscriptionPlan{
		DurationUnit:  model.SubscriptionDurationHour,
		DurationValue: 24,
	}
	_, err := BuildAlipayPeriodRuleFromPlan(plan, "1.00", time.Now())
	require.Error(t, err)
}

func TestIsAlipayCyclePayConfigured(t *testing.T) {
	originalEnabled := setting.AlipayCyclePayEnabled
	originalPersonal := setting.AlipayCyclePayPersonalProductCode
	originalProduct := setting.AlipayCyclePayProductCode
	originalScene := setting.AlipayCyclePaySignScene
	originalAppID := setting.AlipayAppID
	originalPrivate := setting.AlipayPrivateKey
	originalPublic := setting.AlipayPublicKey
	originalGateway := setting.AlipayGateway
	t.Cleanup(func() {
		setting.AlipayCyclePayEnabled = originalEnabled
		setting.AlipayCyclePayPersonalProductCode = originalPersonal
		setting.AlipayCyclePayProductCode = originalProduct
		setting.AlipayCyclePaySignScene = originalScene
		setting.AlipayAppID = originalAppID
		setting.AlipayPrivateKey = originalPrivate
		setting.AlipayPublicKey = originalPublic
		setting.AlipayGateway = originalGateway
	})

	setting.AlipayCyclePayEnabled = true
	setting.AlipayCyclePayPersonalProductCode = "CYCLE_PAY_AUTH_P"
	setting.AlipayCyclePayProductCode = "GENERAL_WITHHOLDING"
	setting.AlipayCyclePaySignScene = "INDUSTRY|DEFAULT"
	setting.AlipayAppID = "app"
	setting.AlipayPrivateKey = "key"
	setting.AlipayPublicKey = "pub"
	setting.AlipayGateway = "https://openapi.alipay.com/gateway.do"
	require.True(t, IsAlipayCyclePayConfigured())

	setting.AlipayCyclePayEnabled = false
	require.False(t, IsAlipayCyclePayConfigured())
}
