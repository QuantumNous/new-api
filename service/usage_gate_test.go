package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/require"
)

func TestUsageLimitMessageNamesTheRefillDate(t *testing.T) {
	msg := UsageLimitMessage(i18n.LangEn, UsageLimitMonthly, pauseResumeAt)

	require.Contains(t, msg, "September 1, 2026")
	require.NotContains(t, msg, "usage.", "untranslated key leaked: "+msg)
}

func TestUsageLimitMessageDistinguishesImagesFromUsage(t *testing.T) {
	monthly := UsageLimitMessage(i18n.LangEn, UsageLimitMonthly, pauseResumeAt)
	images := UsageLimitMessage(i18n.LangEn, UsageLimitImages, pauseResumeAt)

	require.NotEqual(t, monthly, images)
	require.Contains(t, images, "image")
}

func TestUsageLimitMessageInEveryLocale(t *testing.T) {
	for _, lang := range []string{i18n.LangEn, i18n.LangZhCN, i18n.LangZhTW} {
		for _, kind := range []string{UsageLimitMonthly, UsageLimitImages} {
			msg := UsageLimitMessage(lang, kind, pauseResumeAt)
			require.NotEmpty(t, msg)
			require.NotContains(t, msg, "{{", "unfilled template in "+lang)
			require.NotContains(t, msg, "usage.", "untranslated key in "+lang)
		}
	}
}

func TestUsageLimitMessageWithoutADateStillReads(t *testing.T) {
	msg := UsageLimitMessage(i18n.LangEn, UsageLimitMonthly, 0)

	require.NotEmpty(t, msg)
	require.NotContains(t, msg, "1970", "no date is better than the epoch")
}

func withLimits(t *testing.T, cost string, images string) {
	t.Helper()
	require.NoError(t, setting.UpdateMonthlyCostLimitGroupByJSONString(cost))
	require.NoError(t, setting.UpdateMonthlyImageLimitGroupByJSONString(images))
	t.Cleanup(func() {
		_ = setting.UpdateMonthlyCostLimitGroupByJSONString(`{}`)
		_ = setting.UpdateMonthlyImageLimitGroupByJSONString(`{}`)
	})
}

func TestCheckUsageAllowsAFreshCycle(t *testing.T) {
	truncate(t)
	withLimits(t, `{"free":1300000}`, `{"free":0}`)

	require.NoError(t, CheckUsageAllowance(41, "free", i18n.LangEn, nil, nil, time.Now()))
}

func TestCheckUsageRefusesOnceTheCostLimitIsSpent(t *testing.T) {
	truncate(t)
	withLimits(t, `{"free":1000}`, `{"free":0}`)
	start, _ := UsageCycle(CycleMonth, nil, time.Now())
	require.NoError(t, model.AddUsage(42, CycleMonth, start, 1000, 1))

	err := CheckUsageAllowance(42, "free", i18n.LangEn, nil, nil, time.Now())

	require.Error(t, err)
	require.Contains(t, err.Error(), "refills on")
}

func TestCheckUsageRefusalIsLocalised(t *testing.T) {
	truncate(t)
	withLimits(t, `{"free":1000}`, `{"free":0}`)
	start, _ := UsageCycle(CycleMonth, nil, time.Now())
	require.NoError(t, model.AddUsage(46, CycleMonth, start, 1000, 1))

	en := CheckUsageAllowance(46, "free", i18n.LangEn, nil, nil, time.Now())
	require.Error(t, en)
	require.Contains(t, en.Error(), "refills on")

	zh := CheckUsageAllowance(46, "free", i18n.LangZhCN, nil, nil, time.Now())
	require.Error(t, zh)
	require.Contains(t, zh.Error(), "已用完")
	require.NotEqual(t, en.Error(), zh.Error(), "the same exhausted condition must not read the same in a different locale")
}

func TestCheckUsageWithAnUncappedGroupNeverRefuses(t *testing.T) {
	truncate(t)
	withLimits(t, `{"pro":0}`, `{"pro":100}`)
	start, _ := UsageCycle(CycleMonth, nil, time.Now())
	require.NoError(t, model.AddUsage(43, CycleMonth, start, 999999999, 1))

	require.NoError(t, CheckUsageAllowance(43, "pro", i18n.LangEn, nil, nil, time.Now()))
}

func TestCheckUsageRefusesImagesForATierWithoutTheEntitlement(t *testing.T) {
	truncate(t)
	withLimits(t, `{"plus":13200000}`, `{"plus":0}`)

	err := CheckUsageAllowance(44, "plus", i18n.LangEn, nil, []string{"hash-a"}, time.Now())

	require.Error(t, err)
}

func TestCheckUsageChargesAnImageOnlyOncePerCycle(t *testing.T) {
	truncate(t)
	withLimits(t, `{"pro":0}`, `{"pro":1}`)
	now := time.Now()

	require.NoError(t, CheckUsageAllowance(45, "pro", i18n.LangEn, nil, []string{"hash-a"}, now))
	require.NoError(t, CheckUsageAllowance(45, "pro", i18n.LangEn, nil, []string{"hash-a"}, now),
		"the same image re-sent on the next turn is already paid for")
	require.Error(t, CheckUsageAllowance(45, "pro", i18n.LangEn, nil, []string{"hash-b"}, now))
}
