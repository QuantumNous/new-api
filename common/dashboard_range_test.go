package common

import (
	"math"
	"testing"

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
		{name: "empty", start: 0, end: 0},
		{name: "zero width", start: testRangeRef, end: testRangeRef},
		{name: "negative", start: -1, end: testRangeRef, wantErr: ErrDashboardRangeInvalid},
		{name: "future end", start: testRangeRef, end: testRangeRef + 7*testDay},
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
			segments := SplitDashboardRange(test.start, test.end)
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

func TestSplitDashboardRangeKeepsOpenEndedRangesUnsegmented(t *testing.T) {
	assert.Equal(t, []DashboardRangeSegment{{Start: 0, End: 0}}, SplitDashboardRange(0, 0))
	assert.Equal(t, []DashboardRangeSegment{{Start: testRangeRef, End: 0}}, SplitDashboardRange(testRangeRef, 0))
	assert.Equal(t, []DashboardRangeSegment{{Start: 0, End: testRangeRef}}, SplitDashboardRange(0, testRangeRef))
}

func TestSplitDashboardRangeInvertedRangeIsNotSegmented(t *testing.T) {
	segments := SplitDashboardRange(testRangeRef, testRangeRef-1)
	require.Len(t, segments, 1)
	assert.Equal(t, DashboardRangeSegment{Start: testRangeRef, End: testRangeRef - 1}, segments[0])
}

func TestSplitDashboardRangeDoesNotOverflow(t *testing.T) {
	start := int64(math.MaxInt64) - DashboardMaxRangeSeconds
	segments := SplitDashboardRange(start, math.MaxInt64)
	require.NotEmpty(t, segments)
	assert.LessOrEqual(t, len(segments), MaxDashboardRangeSegments)
	for _, segment := range segments {
		assert.LessOrEqual(t, segment.Start, segment.End)
	}
	assert.Equal(t, int64(math.MaxInt64), segments[len(segments)-1].End)
}
