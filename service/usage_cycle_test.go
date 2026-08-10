package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestUsageCycleWithoutSubscriptionUsesTheCalendarMonth(t *testing.T) {
	now := time.Date(2026, 8, 10, 14, 30, 0, 0, time.Local)

	start, resetAt := UsageCycle(CycleMonth, nil, now)

	require.Equal(t, time.Date(2026, 8, 1, 0, 0, 0, 0, time.Local).Unix(), start)
	require.Equal(t, time.Date(2026, 9, 1, 0, 0, 0, 0, time.Local).Unix(), resetAt)
}

// Superseded 2026-08-10: an unmetered paying row used to fall back to the
// calendar month. It now anchors to the billing anniversary, so the portal card
// stops showing a renewal date and a refill date that disagree. What must still
// hold is that next_reset_time — which belongs to a pool this row does not have
// — is ignored rather than mistaken for a usage cycle.
func TestUsageCycleIgnoresNextResetTimeOnAnUnmeteredRow(t *testing.T) {
	anchor := time.Date(2026, 7, 20, 11, 0, 0, 0, time.Local)
	now := time.Date(2026, 8, 10, 14, 30, 0, 0, time.Local)
	sub := &model.UserSubscription{AmountTotal: 0, StartTime: anchor.Unix(), NextResetTime: 1788000000}

	start, resetAt := UsageCycle(CycleMonth, sub, now)

	require.Equal(t, time.Date(2026, 7, 20, 11, 0, 0, 0, time.Local).Unix(), start)
	require.Equal(t, time.Date(2026, 8, 20, 11, 0, 0, 0, time.Local).Unix(), resetAt)
	require.NotEqual(t, int64(1788000000), resetAt, "next_reset_time belongs to a pool this row has none of")
}

func TestUsageCycleFollowsAMeteredSubscription(t *testing.T) {
	now := time.Date(2026, 8, 10, 14, 30, 0, 0, time.Local)
	sub := &model.UserSubscription{
		AmountTotal:   13700000,
		StartTime:     1783000000,
		LastResetTime: 1786000000,
		NextResetTime: 1788000000,
	}

	start, resetAt := UsageCycle(CycleMonth, sub, now)

	require.Equal(t, int64(1786000000), start, "the pool and the counters must share one cycle")
	require.Equal(t, int64(1788000000), resetAt)
}

// A subscription bought this cycle has never reset, so start_time is the anchor.
func TestUsageCycleFallsBackToStartTimeBeforeTheFirstReset(t *testing.T) {
	now := time.Date(2026, 8, 10, 14, 30, 0, 0, time.Local)
	sub := &model.UserSubscription{AmountTotal: 13700000, StartTime: 1786500000, NextResetTime: 1789000000}

	start, _ := UsageCycle(CycleMonth, sub, now)

	require.Equal(t, int64(1786500000), start)
}

func TestUsageCycleOnDecemberRollsIntoNextYear(t *testing.T) {
	now := time.Date(2026, 12, 20, 9, 0, 0, 0, time.Local)

	_, resetAt := UsageCycle(CycleMonth, nil, now)

	require.Equal(t, time.Date(2027, 1, 1, 0, 0, 0, 0, time.Local).Unix(), resetAt)
}

// A paying tier with no metered pool (Plus today) still has a billing date.
// Anchoring the usage cycle to it means "your month" is the month they pay for,
// instead of the card showing a renewal date and a reset date that disagree.
func TestUsageCycleFollowsAnUnmeteredPayingSubscription(t *testing.T) {
	anchor := time.Date(2026, 8, 8, 9, 30, 0, 0, time.Local)
	now := time.Date(2026, 8, 10, 18, 0, 0, 0, time.Local)
	sub := &model.UserSubscription{AmountTotal: 0, StartTime: anchor.Unix(), EndTime: now.AddDate(0, 1, 0).Unix()}

	start, resetAt := UsageCycle(CycleMonth, sub, now)

	require.Equal(t, anchor.Unix(), start)
	require.Equal(t, time.Date(2026, 9, 8, 9, 30, 0, 0, time.Local).Unix(), resetAt)
}

// An annual Plus plan runs start->end over a YEAR. The usage cycle must still be
// monthly, so it walks anniversaries inside the term rather than using end_time.
func TestUsageCycleOnAnAnnualPlanStillCyclesMonthly(t *testing.T) {
	anchor := time.Date(2026, 8, 8, 9, 30, 0, 0, time.Local)
	now := time.Date(2026, 11, 20, 12, 0, 0, 0, time.Local)
	sub := &model.UserSubscription{AmountTotal: 0, StartTime: anchor.Unix(), EndTime: anchor.AddDate(1, 0, 0).Unix()}

	start, resetAt := UsageCycle(CycleMonth, sub, now)

	require.Equal(t, time.Date(2026, 11, 8, 9, 30, 0, 0, time.Local).Unix(), start)
	require.Equal(t, time.Date(2026, 12, 8, 9, 30, 0, 0, time.Local).Unix(), resetAt)
}

// Go's AddDate rolls overflow forward: Jan 31 + 1 month is March 3, not Feb 28.
// A subscriber who signed up on the 31st must not have their cycle drift.
func TestUsageCycleClampsAnchorsPastTheEndOfAShortMonth(t *testing.T) {
	anchor := time.Date(2026, 1, 31, 8, 0, 0, 0, time.Local)
	now := time.Date(2026, 2, 15, 8, 0, 0, 0, time.Local)
	sub := &model.UserSubscription{AmountTotal: 0, StartTime: anchor.Unix()}

	start, resetAt := UsageCycle(CycleMonth, sub, now)

	require.Equal(t, anchor.Unix(), start)
	require.Equal(t, time.Date(2026, 2, 28, 8, 0, 0, 0, time.Local).Unix(), resetAt,
		"February has no 31st; the cycle ends on the 28th, never on March 3")
}

func TestUsageCycleOnTheAnniversaryItselfStartsTheNewCycle(t *testing.T) {
	anchor := time.Date(2026, 8, 8, 9, 30, 0, 0, time.Local)
	now := time.Date(2026, 9, 8, 9, 30, 0, 0, time.Local)
	sub := &model.UserSubscription{AmountTotal: 0, StartTime: anchor.Unix()}

	start, resetAt := UsageCycle(CycleMonth, sub, now)

	require.Equal(t, now.Unix(), start)
	require.Equal(t, time.Date(2026, 10, 8, 9, 30, 0, 0, time.Local).Unix(), resetAt)
}

// A row with no usable anchor must not invent one.
func TestUsageCycleWithoutAnchorFallsBackToTheCalendarMonth(t *testing.T) {
	now := time.Date(2026, 8, 10, 14, 30, 0, 0, time.Local)
	sub := &model.UserSubscription{AmountTotal: 0, StartTime: 0}

	start, _ := UsageCycle(CycleMonth, sub, now)

	require.Equal(t, time.Date(2026, 8, 1, 0, 0, 0, 0, time.Local).Unix(), start)
}
