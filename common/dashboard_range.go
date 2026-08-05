package common

import (
	"errors"
	"fmt"
)

// Dashboard time-range policy.
//
// The dashboard has to answer cross-month questions (for example 2026-07-01
// 00:00:42 through 2026-08-05 11:07:45, which is ~35 days) while never letting
// one request scan an unbounded slice of the consumption log. Two independent
// bounds are therefore enforced together:
//
//   - DashboardMaxRangeDays caps the total span a client may request. It is the
//     product bound and is enforced at the HTTP boundary in both frontends.
//   - DashboardMaxSegmentDays caps how much of that span a single SQL statement
//     may touch. A longer span is split into consecutive, non-overlapping
//     segments that are queried separately and merged server side.
//
// The segment bound keeps the worst case of an individual database statement
// identical to the historical 31-day query, so widening the total span does not
// widen per-statement database pressure. Removing the check entirely, or
// raising it without a segment bound, is explicitly not an option.
const (
	DashboardMaxRangeDays   int64 = 90
	DashboardMaxSegmentDays int64 = 31

	DashboardMaxRangeSeconds   = DashboardMaxRangeDays * 24 * 60 * 60
	DashboardMaxSegmentSeconds = DashboardMaxSegmentDays * 24 * 60 * 60
)

// MaxDashboardRangeSegments is the highest number of segments a valid range can
// produce. Callers use it to size a query timeout budget that stays bounded.
const MaxDashboardRangeSegments = int(DashboardMaxRangeSeconds/DashboardMaxSegmentSeconds) + 1

var (
	ErrDashboardRangeInvalid  = errors.New("请选择有效的查询时间范围")
	ErrDashboardRangeInverted = errors.New("结束时间不能早于开始时间")
	ErrDashboardRangeTooLarge = fmt.Errorf("查询时间跨度不能超过 %d 天", DashboardMaxRangeDays)
)

// DashboardRangeSegment is an inclusive [Start, End] epoch-second window. The
// bounds are inclusive because every dashboard query filters with
// `created_at >= start AND created_at <= end`; consecutive segments therefore
// start one second after the previous segment ended so no row is counted twice
// and no row falls between two segments.
type DashboardRangeSegment struct {
	Start int64
	End   int64
}

// ValidateDashboardRange rejects a range that a bounded query cannot serve.
// A zero start and zero end is accepted so the legacy "no explicit range"
// callers keep their existing behaviour.
func ValidateDashboardRange(start, end int64) error {
	if start < 0 || end < 0 {
		return ErrDashboardRangeInvalid
	}
	if end < start {
		return ErrDashboardRangeInverted
	}
	if end-start > DashboardMaxRangeSeconds {
		return ErrDashboardRangeTooLarge
	}
	return nil
}

// SplitDashboardRange returns the consecutive segments covering [start, end].
// The union of the segments is exactly the input range and the segments never
// overlap, so a per-segment aggregate can be summed without double counting.
//
// An open-ended range (either bound zero) is returned unchanged as a single
// segment: those callers intentionally omit the corresponding SQL predicate and
// must not have one synthesised here.
func SplitDashboardRange(start, end int64) []DashboardRangeSegment {
	if start == 0 || end == 0 || end < start {
		return []DashboardRangeSegment{{Start: start, End: end}}
	}
	segments := make([]DashboardRangeSegment, 0, MaxDashboardRangeSegments)
	for cursor := start; ; {
		segmentEnd := cursor + DashboardMaxSegmentSeconds
		// Guard against int64 overflow on an absurd start value; validation
		// bounds the span but not the absolute magnitude of the bounds.
		if segmentEnd < cursor || segmentEnd >= end {
			segments = append(segments, DashboardRangeSegment{Start: cursor, End: end})
			break
		}
		segments = append(segments, DashboardRangeSegment{Start: cursor, End: segmentEnd})
		cursor = segmentEnd + 1
	}
	return segments
}
