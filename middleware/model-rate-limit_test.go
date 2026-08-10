package middleware

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestRateLimitWindowStartReadsTheOldestEntry(t *testing.T) {
	now := time.Unix(1786000000, 0).UTC()
	entry := now.Add(-10 * time.Minute).Format(timeFormat)

	start, ok := rateLimitWindowStart(entry, now)

	require.True(t, ok)
	require.Equal(t, int64(1786000000-600), start)
}

// recordRedisRequest formats local-clock values with a literal "Z", so an entry
// is not a UTC timestamp. Reading it as one would skew every reset time by the
// server's offset — eight hours, on a China-timezone host.
func TestRateLimitWindowStartIsImmuneToServerTimezone(t *testing.T) {
	shanghai := time.FixedZone("CST", 8*60*60)
	now := time.Unix(1786000000, 0).In(shanghai)
	entry := now.Add(-10 * time.Minute).Format(timeFormat)

	start, ok := rateLimitWindowStart(entry, now)

	require.True(t, ok)
	require.Equal(t, int64(1786000000-600), start)
}

func TestRateLimitWindowStartRejectsUnreadableEntries(t *testing.T) {
	now := time.Unix(1786000000, 0).UTC()

	_, ok := rateLimitWindowStart("", now)
	require.False(t, ok, "an empty list index yields an empty string")

	_, ok = rateLimitWindowStart("not-a-time", now)
	require.False(t, ok)
}

// Clocks move. An entry stamped a hair ahead of now must not push the reset
// time into the future.
func TestRateLimitWindowStartClampsFutureEntries(t *testing.T) {
	now := time.Unix(1786000000, 0).UTC()
	entry := now.Add(2 * time.Second).Format(timeFormat)

	start, ok := rateLimitWindowStart(entry, now)

	require.True(t, ok)
	require.Equal(t, int64(1786000000), start)
}

func stampsAgo(now time.Time, secondsAgo ...int) []string {
	out := make([]string, 0, len(secondsAgo))
	for _, s := range secondsAgo {
		out = append(out, now.Add(-time.Duration(s)*time.Second).Format(timeFormat))
	}
	return out
}

func TestCountRateLimitWindowCountsEntriesInsideTheWindow(t *testing.T) {
	now := time.Unix(1786000000, 0).UTC()

	used, start := countRateLimitWindow(stampsAgo(now, 60, 600, 6000), now, 5*time.Hour)

	require.Equal(t, int64(3), used)
	require.Equal(t, int64(1786000000-6000), start, "the oldest live entry is the one that ages out first")
}

// The list is trimmed by length, not by age, and the key's TTL is refreshed on
// every write — so a steady user's list keeps entries far older than the
// window. Counting those would show a full bar to someone who is not throttled.
func TestCountRateLimitWindowIgnoresEntriesThatHaveAgedOut(t *testing.T) {
	now := time.Unix(1786000000, 0).UTC()

	used, start := countRateLimitWindow(stampsAgo(now, 100, 3*24*3600), now, 5*time.Hour)

	require.Equal(t, int64(1), used)
	require.Equal(t, int64(1786000000-100), start)
}

func TestCountRateLimitWindowWithEverythingAgedOut(t *testing.T) {
	now := time.Unix(1786000000, 0).UTC()

	used, start := countRateLimitWindow(stampsAgo(now, 3*24*3600), now, 5*time.Hour)

	require.Equal(t, int64(0), used)
	require.Equal(t, int64(0), start)
}

func TestCountRateLimitWindowSkipsUnreadableEntries(t *testing.T) {
	now := time.Unix(1786000000, 0).UTC()
	entries := append([]string{"not-a-time", ""}, stampsAgo(now, 60)...)

	used, start := countRateLimitWindow(entries, now, 5*time.Hour)

	require.Equal(t, int64(1), used)
	require.Equal(t, int64(1786000000-60), start)
}

func TestCountRateLimitWindowEmpty(t *testing.T) {
	now := time.Unix(1786000000, 0).UTC()

	used, start := countRateLimitWindow(nil, now, 5*time.Hour)

	require.Equal(t, int64(0), used)
	require.Equal(t, int64(0), start)
}
