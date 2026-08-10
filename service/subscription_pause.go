package service

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
)

// formatPauseDate renders the refill date the way the user's locale writes
// dates. Empty when there is no date to name.
func formatPauseDate(unix int64, lang string, loc *time.Location) string {
	if unix <= 0 {
		return ""
	}
	if loc == nil {
		loc = time.Local
	}
	t := time.Unix(unix, 0).In(loc)
	if strings.HasPrefix(lang, "zh") {
		return fmt.Sprintf("%d年%d月%d日", t.Year(), int(t.Month()), t.Day())
	}
	return t.Format("January 2, 2006")
}

// subscriptionPauseMessage is what a user sees when their plan stops serving
// requests. A bar that fills with no explanation is the failure this exists to
// prevent, so the copy names the exact refill date rather than "next cycle".
func subscriptionPauseMessage(lang string, resumeAt int64, hasSubscription bool, loc *time.Location) string {
	if !hasSubscription {
		return i18n.Translate(lang, i18n.MsgSubscriptionNone)
	}
	if date := formatPauseDate(resumeAt, lang, loc); date != "" {
		return i18n.Translate(lang, i18n.MsgSubscriptionPausedUntil, map[string]any{"Date": date})
	}
	return i18n.Translate(lang, i18n.MsgSubscriptionPaused)
}

// causeIsMissingSubscription separates "you ran out" from "you never had one".
// The model layer reports both as plain errors; until it grows sentinels, the
// string is the only signal available.
func causeIsMissingSubscription(cause error) bool {
	return cause != nil && strings.Contains(cause.Error(), "no active subscription")
}

// subscriptionPauseUserMessage builds the wall copy from a funding failure. The
// cause never reaches the user: it carries internal quota units ("need=344000")
// and an untranslated internal string. Callers log it instead.
func subscriptionPauseUserMessage(lang string, resumeAt int64, hasSubscription bool, loc *time.Location, cause error) string {
	if causeIsMissingSubscription(cause) {
		hasSubscription = false
	}
	return subscriptionPauseMessage(lang, resumeAt, hasSubscription, loc)
}

// SubscriptionPauseMessage is the user-facing wall for a subscription funding
// refusal: branded, translated, and carrying the exact refill date. The caller
// logs the cause; it never reaches the user.
func SubscriptionPauseMessage(lang string, userId int, cause error) string {
	resumeAt, hasSubscription := subscriptionResumeAt(userId)
	return subscriptionPauseUserMessage(lang, resumeAt, hasSubscription, time.Local, cause)
}

// subscriptionResumeAt reports when the user's metered pool next refills, using
// the same earliest-positive rule the portal's usage bar draws. Only active,
// unexpired rows count — a lapsed plan has no refill date to promise.
func subscriptionResumeAt(userId int) (int64, bool) {
	summaries, err := model.GetAllActiveUserSubscriptions(userId)
	if err != nil || len(summaries) == 0 {
		return 0, false
	}
	subs := make([]model.UserSubscription, 0, len(summaries))
	for _, summary := range summaries {
		if summary.Subscription != nil {
			subs = append(subs, *summary.Subscription)
		}
	}
	_, _, resetAt := SumIncludedPools(subs)
	return resetAt, true
}
