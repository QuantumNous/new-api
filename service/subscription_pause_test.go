package service

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func init() {
	if err := i18n.Init(); err != nil {
		panic(err)
	}
}

// 2026-09-01, in the zone the server formats dates in.
var pauseResumeAt = time.Date(2026, 9, 1, 3, 0, 0, 0, time.UTC).Unix()

func TestSubscriptionPauseMessageNamesTheRefillDate(t *testing.T) {
	msg := subscriptionPauseMessage(i18n.LangEn, pauseResumeAt, true, time.UTC)

	require.Contains(t, msg, "September 1, 2026", "the whole point is the exact date, not 'next cycle'")
	require.Contains(t, msg, "JINN")
}

func TestSubscriptionPauseMessageInChinese(t *testing.T) {
	simplified := subscriptionPauseMessage(i18n.LangZhCN, pauseResumeAt, true, time.UTC)
	traditional := subscriptionPauseMessage(i18n.LangZhTW, pauseResumeAt, true, time.UTC)

	require.Contains(t, simplified, "2026年9月1日")
	require.Contains(t, traditional, "2026年9月1日")
	require.NotEqual(t, simplified, traditional, "zh-TW is a separate locale, not an alias for zh-CN")
}

// A plan with quota_reset_period never has no refill date to promise.
func TestSubscriptionPauseMessageWithoutARefillDate(t *testing.T) {
	for _, lang := range []string{i18n.LangEn, i18n.LangZhCN, i18n.LangZhTW} {
		msg := subscriptionPauseMessage(lang, 0, true, time.UTC)
		require.NotEmpty(t, msg)
		require.NotContains(t, msg, "1970", "no date is better than the epoch")
		require.NotContains(t, msg, "{{", "an unfilled template means a missing argument")
	}
}

func TestSubscriptionPauseMessageWithoutASubscription(t *testing.T) {
	paused := subscriptionPauseMessage(i18n.LangEn, pauseResumeAt, true, time.UTC)
	none := subscriptionPauseMessage(i18n.LangEn, 0, false, time.UTC)

	require.NotEqual(t, paused, none, "'you ran out' and 'you never had one' are different problems")
	require.NotEmpty(t, none)
}

// A missing yaml key makes go-i18n hand back the key itself.
func TestSubscriptionPauseMessagesAreTranslatedInEveryLocale(t *testing.T) {
	for _, lang := range []string{i18n.LangEn, i18n.LangZhCN, i18n.LangZhTW} {
		for _, msg := range []string{
			subscriptionPauseMessage(lang, pauseResumeAt, true, time.UTC),
			subscriptionPauseMessage(lang, 0, true, time.UTC),
			subscriptionPauseMessage(lang, 0, false, time.UTC),
		} {
			require.NotContains(t, msg, "subscription.", "untranslated key leaked into user-facing copy: "+msg)
		}
	}
}

// The old message was "订阅额度不足或未配置订阅: subscription quota insufficient,
// need=344000" — an internal string, an internal quota unit, and no date.
func TestSubscriptionPauseErrorKeepsInternalsOutOfTheUserMessage(t *testing.T) {
	cause := errors.New("subscription quota insufficient, need=344000")

	msg := subscriptionPauseUserMessage(i18n.LangEn, pauseResumeAt, true, time.UTC, cause)

	require.NotContains(t, msg, "need=")
	require.NotContains(t, msg, "insufficient")
	require.Contains(t, msg, "September 1, 2026")
}

func TestFormatPauseDateUsesTheGivenZone(t *testing.T) {
	// 2026-09-01T03:00Z is still 2026-08-31 in Los Angeles; the date a user is
	// told must be the date in the zone we format for.
	la, err := time.LoadLocation("America/Los_Angeles")
	require.NoError(t, err)

	require.Equal(t, "September 1, 2026", formatPauseDate(pauseResumeAt, i18n.LangEn, time.UTC))
	require.Equal(t, "August 31, 2026", formatPauseDate(pauseResumeAt, i18n.LangEn, la))
}

func TestFormatPauseDateInChinese(t *testing.T) {
	require.Equal(t, "2026年9月1日", formatPauseDate(pauseResumeAt, i18n.LangZhCN, time.UTC))
	require.Equal(t, "2026年9月1日", formatPauseDate(pauseResumeAt, i18n.LangZhTW, time.UTC))
	require.True(t, strings.HasPrefix(formatPauseDate(pauseResumeAt, i18n.LangZhCN, time.UTC), "2026"))
}

// The rows can disappear between the eligibility check and the pre-consume —
// a subscription that expired mid-request is "you have none", not "you ran out".
func TestSubscriptionPauseErrorDistinguishesAMissingSubscription(t *testing.T) {
	msg := subscriptionPauseUserMessage(i18n.LangEn, pauseResumeAt, true, time.UTC, errors.New("no active subscription"))

	require.NotEmpty(t, msg)
	require.Equal(t, subscriptionPauseMessage(i18n.LangEn, 0, false, time.UTC), msg)
	require.NotEqual(t, subscriptionPauseMessage(i18n.LangEn, pauseResumeAt, true, time.UTC), msg,
		"an exhausted pool and a missing subscription must not read the same")
}

func TestSubscriptionPauseMessageUsesTheSubscriptionsOwnRefillDate(t *testing.T) {
	truncate(t)
	now := time.Now().Unix()
	require.NoError(t, model.DB.Create(&model.UserSubscription{
		UserId: 77, PlanId: 1, AmountTotal: 20_640_000, AmountUsed: 20_640_000,
		StartTime: now - 86400, EndTime: now + 2592000, Status: "active",
		NextResetTime: pauseResumeAt,
	}).Error)

	msg := SubscriptionPauseMessage(i18n.LangEn, 77, errors.New("subscription quota insufficient, need=344000"))

	require.Contains(t, msg, formatPauseDate(pauseResumeAt, i18n.LangEn, time.Local))
}

func TestSubscriptionPauseMessageWhenNothingIsActive(t *testing.T) {
	truncate(t)

	msg := SubscriptionPauseMessage(i18n.LangEn, 78, errors.New("subscription quota insufficient"))

	require.Equal(t, subscriptionPauseMessage(i18n.LangEn, 0, false, time.Local), msg)
}

// A lapsed plan is why plenty of walls happen; the copy must not promise a
// refill date belonging to a subscription that has already ended.
func TestSubscriptionPauseMessageIgnoresExpiredSubscriptions(t *testing.T) {
	truncate(t)
	now := time.Now().Unix()
	require.NoError(t, model.DB.Create(&model.UserSubscription{
		UserId: 79, PlanId: 1, AmountTotal: 20_640_000, AmountUsed: 20_640_000,
		StartTime: now - 2592000, EndTime: now - 3600, Status: "active",
		NextResetTime: pauseResumeAt,
	}).Error)

	msg := SubscriptionPauseMessage(i18n.LangEn, 79, errors.New("subscription quota insufficient"))

	require.Equal(t, subscriptionPauseMessage(i18n.LangEn, 0, false, time.Local), msg)
	require.NotContains(t, msg, "September 1, 2026")
}
