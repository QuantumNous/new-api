package common

import (
	"math"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	testDay int64 = 24 * 60 * 60
	// The exact bounds moni reported on the dashboard home page:
	// 2026-07-01 00:00:42 through 2026-08-05 11:07:45 Asia/Shanghai.
	testRangeRef      int64 = 1782835242
	testReportedEnd   int64 = 1785899265
	testReportedSpanS int64 = testReportedEnd - testRangeRef // ~35 days 11 hours
)

func TestValidateDashboardRangeBoundaryMatrix(t *testing.T) {
	// The reported incident must be outside the old bound and inside the new one.
	require.Greater(t, testReportedSpanS, 31*testDay, "the reported range must exceed the old single-segment bound")
	require.Greater(t, testReportedSpanS, int64(2592000), "the reported range must exceed the old /api/data/self 30 day bound")
	require.Less(t, testReportedSpanS, DashboardMaxRangeSeconds, "the reported range must fit inside the product bound")

	tests := []struct {
		name    string
		start   int64
		end     int64
		wantErr error
	}{
		{name: "cross month within 31 days", start: testRangeRef, end: testRangeRef + 20*testDay},
		{name: "exactly 31 days", start: testRangeRef, end: testRangeRef + 31*testDay},
		{name: "31 days plus one second", start: testRangeRef, end: testRangeRef + 31*testDay + 1},
		{name: "reported 35 day range", start: testRangeRef, end: testReportedEnd},
		{name: "exactly 90 days", start: testRangeRef, end: testRangeRef + 90*testDay},
		{name: "90 days plus one second", start: testRangeRef, end: testRangeRef + 90*testDay + 1, wantErr: ErrDashboardRangeTooLarge},
		{name: "inverted", start: testRangeRef, end: testRangeRef - 1, wantErr: ErrDashboardRangeInverted},
		{name: "empty", start: 0, end: 0, wantErr: ErrDashboardRangeInvalid},
		{name: "zero width", start: testRangeRef, end: testRangeRef},
		{name: "negative start", start: -1, end: testRangeRef, wantErr: ErrDashboardRangeInvalid},
		{name: "negative end", start: testRangeRef, end: -1, wantErr: ErrDashboardRangeInvalid},
		{name: "one sided start only", start: testRangeRef, end: 0, wantErr: ErrDashboardRangeInvalid},
		{name: "one sided end only", start: 0, end: testReportedEnd, wantErr: ErrDashboardRangeInvalid},
		{name: "future end", start: testRangeRef, end: testRangeRef + 7*testDay},
		{name: "start at the CST shift limit", start: DashboardMaxTimestamp - DashboardMaxRangeSeconds, end: DashboardMaxTimestamp},
		{name: "end one past the CST shift limit", start: DashboardMaxTimestamp - 1, end: DashboardMaxTimestamp + 1, wantErr: ErrDashboardRangeInvalid},
		{name: "start one past the CST shift limit", start: DashboardMaxTimestamp + 1, end: DashboardMaxTimestamp + 2, wantErr: ErrDashboardRangeInvalid},
		{name: "max int64 end overflows the CST shift", start: testRangeRef, end: math.MaxInt64, wantErr: ErrDashboardRangeInvalid},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateDashboardRange(test.start, test.end)
			if test.wantErr == nil {
				assert.NoError(t, err)
				return
			}
			assert.ErrorIs(t, err, test.wantErr)
		})
	}
}

func TestSplitDashboardRangeCoversRangeExactlyWithoutOverlap(t *testing.T) {
	tests := []struct {
		name         string
		start        int64
		end          int64
		wantSegments int
	}{
		{name: "31 days is one segment", start: testRangeRef, end: testRangeRef + 31*testDay, wantSegments: 1},
		{name: "31 days plus one second splits", start: testRangeRef, end: testRangeRef + 31*testDay + 1, wantSegments: 2},
		{name: "reported 35 day range", start: testRangeRef, end: testReportedEnd, wantSegments: 2},
		{name: "exactly 90 days", start: testRangeRef, end: testRangeRef + 90*testDay, wantSegments: 3},
		{name: "zero width", start: testRangeRef, end: testRangeRef, wantSegments: 1},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			segments, err := SplitDashboardRange(test.start, test.end)
			require.NoError(t, err)
			require.Len(t, segments, test.wantSegments)
			assert.LessOrEqual(t, len(segments), MaxDashboardRangeSegments)

			assert.Equal(t, test.start, segments[0].Start)
			assert.Equal(t, test.end, segments[len(segments)-1].End)

			var covered int64
			for i, segment := range segments {
				require.LessOrEqual(t, segment.Start, segment.End)
				require.LessOrEqual(t, segment.End-segment.Start, DashboardMaxSegmentSeconds,
					"segment %d must not exceed the per-statement bound", i)
				covered += segment.End - segment.Start + 1
				if i > 0 {
					// Consecutive and non-overlapping: exactly one second apart.
					assert.Equal(t, segments[i-1].End+1, segment.Start)
				}
			}
			assert.Equal(t, test.end-test.start+1, covered,
				"segments must cover the inclusive range exactly once")
		})
	}
}

// There is exactly one meaning for a dashboard range: a closed, fully bounded
// interval. A zero or one-sided bound is rejected, never reinterpreted as "no
// filter" — that ambiguity is what allowed an unbounded predicate downstream.
func TestSplitDashboardRangeRejectsUnboundedAndOneSidedRanges(t *testing.T) {
	tests := []struct {
		name    string
		start   int64
		end     int64
		wantErr error
	}{
		{name: "both zero", start: 0, end: 0, wantErr: ErrDashboardRangeInvalid},
		{name: "missing end", start: testRangeRef, end: 0, wantErr: ErrDashboardRangeInvalid},
		{name: "missing start", start: 0, end: testRangeRef, wantErr: ErrDashboardRangeInvalid},
		{name: "negative start", start: -1, end: testRangeRef, wantErr: ErrDashboardRangeInvalid},
		{name: "negative end", start: testRangeRef, end: -1, wantErr: ErrDashboardRangeInvalid},
		{name: "inverted", start: testRangeRef, end: testRangeRef - 1, wantErr: ErrDashboardRangeInverted},
		{name: "too large", start: testRangeRef, end: testRangeRef + DashboardMaxRangeSeconds + 1, wantErr: ErrDashboardRangeTooLarge},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			segments, err := SplitDashboardRange(test.start, test.end)
			require.ErrorIs(t, err, test.wantErr)
			assert.Nil(t, segments, "a rejected range must not yield a queryable segment")
			assert.ErrorIs(t, ValidateDashboardRange(test.start, test.end), test.wantErr)
		})
	}
}

// The CST bucket arithmetic adds a fixed +28800 before dividing. A bound close
// enough to MaxInt64 for that shift to wrap must be refused, not silently
// bucketed into a negative period.
func TestDashboardRangeRefusesBoundsThatOverflowTheCSTShift(t *testing.T) {
	assert.Equal(t, int64(math.MaxInt64)-DashboardBucketOffsetSeconds, int64(DashboardMaxTimestamp))

	shifted, ok := ShiftToDashboardBucketSpace(DashboardMaxTimestamp)
	require.True(t, ok, "the largest accepted bound must still be shiftable")
	assert.Equal(t, int64(math.MaxInt64), shifted)
	assert.Greater(t, shifted, int64(0), "the shift must not wrap negative")

	_, ok = ShiftToDashboardBucketSpace(DashboardMaxTimestamp + 1)
	assert.False(t, ok, "one second past the limit must be reported as unrepresentable")
	_, ok = ShiftToDashboardBucketSpace(math.MaxInt64)
	assert.False(t, ok)

	_, ok = DashboardBucketStart(DashboardMaxTimestamp+1, 3600)
	assert.False(t, ok, "the bucket mirror must refuse an unshiftable timestamp")
	_, ok = DashboardBucketStart(testRangeRef, 0)
	assert.False(t, ok, "a non-positive step is not a bucket")

	for _, end := range []int64{DashboardMaxTimestamp + 1, math.MaxInt64} {
		segments, err := SplitDashboardRange(end-DashboardMaxRangeSeconds, end)
		assert.ErrorIs(t, err, ErrDashboardRangeInvalid)
		assert.Nil(t, segments)
	}
}

func TestSplitDashboardRangeStaysWithinTheShiftLimit(t *testing.T) {
	start := int64(DashboardMaxTimestamp) - DashboardMaxRangeSeconds
	segments, err := SplitDashboardRange(start, DashboardMaxTimestamp)
	require.NoError(t, err)
	require.NotEmpty(t, segments)
	assert.LessOrEqual(t, len(segments), MaxDashboardRangeSegments)
	for _, segment := range segments {
		assert.LessOrEqual(t, segment.Start, segment.End)
		shifted, ok := ShiftToDashboardBucketSpace(segment.End)
		require.True(t, ok, "every emitted segment bound must be shiftable")
		assert.Greater(t, shifted, int64(0))
	}
	assert.Equal(t, int64(DashboardMaxTimestamp), segments[len(segments)-1].End)
}

// Asia/Shanghai is a fixed UTC+8 offset with no daylight saving transition, so
// bucket alignment is a constant shift. This pins that assumption against the
// real tzdata rather than trusting the comment.
func TestDashboardBucketOffsetMatchesAsiaShanghaiWithoutDST(t *testing.T) {
	location, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		t.Skipf("tzdata unavailable: %v", err)
	}
	// Sample across the year, including the dates on which northern-hemisphere
	// DST transitions normally happen elsewhere.
	for _, moment := range []time.Time{
		time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 3, 29, 12, 0, 0, 0, time.UTC),
		time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 8, 5, 11, 7, 45, 0, time.UTC),
		time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC),
		time.Date(2026, 12, 31, 23, 59, 59, 0, time.UTC),
	} {
		_, offset := moment.In(location).Zone()
		assert.EqualValues(t, DashboardBucketOffsetSeconds, offset,
			"Asia/Shanghai must stay at a constant UTC+8 offset at %s", moment)
	}
}

func TestDashboardBucketStartAlignsToAsiaShanghaiBoundaries(t *testing.T) {
	// 2026-07-01 00:00:00 Asia/Shanghai.
	const cstMidnight int64 = 1782835200
	const hour int64 = 3600

	bucket := func(timestamp, step int64) int64 {
		value, ok := DashboardBucketStart(timestamp, step)
		require.True(t, ok)
		return value
	}

	assert.Equal(t, cstMidnight, bucket(cstMidnight, testDay))
	assert.Equal(t, cstMidnight, bucket(cstMidnight+testDay-1, testDay))
	assert.Equal(t, cstMidnight-testDay, bucket(cstMidnight-1, testDay))

	assert.Equal(t, cstMidnight, bucket(cstMidnight, hour))
	assert.Equal(t, cstMidnight, bucket(cstMidnight+hour-1, hour))
	assert.Equal(t, cstMidnight+hour, bucket(cstMidnight+hour, hour))

	// The reported selection starts 42 seconds into the first CST hour of July.
	assert.Equal(t, cstMidnight, bucket(testRangeRef, hour))
	assert.Equal(t, cstMidnight, bucket(testRangeRef, testDay))
}
