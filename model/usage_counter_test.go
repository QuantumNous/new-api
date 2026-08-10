package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAddUsageAccumulatesWithinACycle(t *testing.T) {
	resetUsageTables(t)

	require.NoError(t, AddUsage(7, "month", 1786000000, 4000, 1))
	require.NoError(t, AddUsage(7, "month", 1786000000, 1500, 1))

	cost, requests, _, err := GetUsage(7, "month", 1786000000)
	require.NoError(t, err)
	require.Equal(t, int64(5500), cost)
	require.Equal(t, 2, requests)
}

// A new cycle is a new row — that is what removes the need for a reset job.
func TestAddUsageStartsFreshInANewCycle(t *testing.T) {
	resetUsageTables(t)
	require.NoError(t, AddUsage(7, "month", 1786000000, 4000, 1))

	cost, _, _, err := GetUsage(7, "month", 1788600000)
	require.NoError(t, err)
	require.Equal(t, int64(0), cost)
}

func TestGetUsageForAnUntouchedCycleIsZeroNotAnError(t *testing.T) {
	resetUsageTables(t)

	cost, requests, images, err := GetUsage(99, "month", 1786000000)
	require.NoError(t, err)
	require.Equal(t, int64(0), cost)
	require.Equal(t, 0, requests)
	require.Equal(t, 0, images)
}

func TestReserveImagesCountsEachDistinctHashOnce(t *testing.T) {
	resetUsageTables(t)

	n, err := ReserveImages(7, 1786000000, []string{"aaa", "bbb"}, 100)
	require.NoError(t, err)
	require.Equal(t, 2, n)

	n, err = ReserveImages(7, 1786000000, []string{"aaa"}, 100)
	require.NoError(t, err)
	require.Equal(t, 0, n, "already reserved this cycle")

	_, _, images, err := GetUsage(7, "month", 1786000000)
	require.NoError(t, err)
	require.Equal(t, 2, images)
}

func TestReserveImagesRefusesAtTheLimitWithoutPartiallyConsuming(t *testing.T) {
	resetUsageTables(t)
	_, err := ReserveImages(7, 1786000000, []string{"a", "b"}, 3)
	require.NoError(t, err)

	_, err = ReserveImages(7, 1786000000, []string{"c", "d"}, 3)
	require.ErrorIs(t, err, ErrImageLimitReached)

	_, _, images, err := GetUsage(7, "month", 1786000000)
	require.NoError(t, err)
	require.Equal(t, 2, images, "a refused batch must reserve nothing")
}

func TestReserveImagesWithZeroLimitRefusesEverything(t *testing.T) {
	resetUsageTables(t)

	_, err := ReserveImages(7, 1786000000, []string{"a"}, 0)
	require.ErrorIs(t, err, ErrImageLimitReached)
}

func TestReserveImagesDeduplicatesRepeatedHashWithinTheSameBatch(t *testing.T) {
	resetUsageTables(t)

	n, err := ReserveImages(7, 1786000000, []string{"a", "a"}, 100)
	require.NoError(t, err)
	require.Equal(t, 1, n)

	_, _, images, err := GetUsage(7, "month", 1786000000)
	require.NoError(t, err)
	require.Equal(t, 1, images)
}

func TestReserveImagesRepeatedHashWithinBatchCountsOnceAgainstTheLimit(t *testing.T) {
	resetUsageTables(t)

	n, err := ReserveImages(7, 1786000000, []string{"a", "a"}, 1)
	require.NoError(t, err)
	require.Equal(t, 1, n)
}

// FINDING 2 regression: AddUsage must update cost_used/requests_used via a
// SQL-side arithmetic expression, never a full-row Save of a struct read
// earlier — a full-row Save would clobber images_used with the stale value it
// had at read time. This does not exercise real concurrency (see the report
// for what that would and would not prove); it pins the current, correct
// value of images_used surviving an AddUsage call made after it was set.
func TestAddUsageDoesNotOverwriteImagesUsed(t *testing.T) {
	resetUsageTables(t)
	n, err := ReserveImages(7, 1786000000, []string{"a", "b"}, 100)
	require.NoError(t, err)
	require.Equal(t, 2, n)

	require.NoError(t, AddUsage(7, "month", 1786000000, 500, 1))

	cost, requests, images, err := GetUsage(7, "month", 1786000000)
	require.NoError(t, err)
	require.Equal(t, int64(500), cost)
	require.Equal(t, 1, requests)
	require.Equal(t, 2, images, "AddUsage must never touch images_used")
}

// The conditional increment must accept a batch that lands exactly on the
// limit and refuse the very next image, with no partial write on the refusal.
func TestReserveImagesAcceptsExactlyUpToTheLimitThenRefusesTheNext(t *testing.T) {
	resetUsageTables(t)

	n, err := ReserveImages(7, 1786000000, []string{"a", "b", "c"}, 3)
	require.NoError(t, err)
	require.Equal(t, 3, n)

	_, err = ReserveImages(7, 1786000000, []string{"d"}, 3)
	require.ErrorIs(t, err, ErrImageLimitReached)

	_, _, images, err := GetUsage(7, "month", 1786000000)
	require.NoError(t, err)
	require.Equal(t, 3, images, "the refused image must not have been partially reserved")
}

func resetUsageTables(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.Exec("DELETE FROM user_usage_counters").Error)
	require.NoError(t, DB.Exec("DELETE FROM user_image_uploads").Error)
}
