package common

import (
	"errors"
	"fmt"
	"math"
)

// Dashboard time-range contract.
//
// A dashboard range is a CLOSED, FULLY BOUNDED interval [Start, End] of Unix
// epoch seconds. There is deliberately no open-ended form: every dashboard
// query filters with `created_at >= start AND created_at <= end`, so a missing
// or zero bound would silently become the epoch (an unbounded scan) or an empty
// window. Both bounds are therefore required and must be strictly positive.
//
// Bucketing semantics: all dashboard aggregation buckets (hour and day) are
// aligned to Asia/Shanghai, i.e. a fixed UTC+8 offset with no daylight saving
// transition. China has observed no DST since 1991, so a constant offset is
// exact for every timestamp this product can receive and no location database
// is needed. The bounds themselves are timezone-neutral epoch seconds; only the
// bucket boundaries use the offset.
//
// Two independent size bounds are enforced together:
//
//   - DashboardMaxRangeDays caps the total span a client may request. It is the
//     product bound and is enforced at the HTTP boundary, again in the model
//     layer, and mirrored by both frontends.
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

	// DashboardBucketOffsetSeconds is the fixed Asia/Shanghai offset used to
	// align hour and day buckets. It is a constant on purpose: CST has no DST.
	DashboardBucketOffsetSeconds int64 = 8 * 60 * 60
)

// MaxDashboardRangeSegments is the highest number of segments a valid range can
// produce. Callers use it to size a query timeout budget that stays bounded.
const MaxDashboardRangeSegments = int(DashboardMaxRangeSeconds/DashboardMaxSegmentSeconds) + 1

// DashboardMaxTimestamp is the largest accepted bound.
//
// Both the Go bucket mirror and the SQL period expression shift a timestamp by
// DashboardBucketOffsetSeconds before dividing. Above this value that shift
// overflows int64 and the bucket silently wraps to a negative period, so the
// bound is refused up front rather than producing corrupt grouping. Every
// realistic timestamp is many orders of magnitude below it; this is a hard
// arithmetic guard, not a product limit.
const DashboardMaxTimestamp = math.MaxInt64 - DashboardBucketOffsetSeconds

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

// ValidateDashboardRange rejects any range a bounded query cannot serve.
//
// Both bounds are mandatory: a zero, negative, or missing bound is invalid,
// never "no filter". Callers that parse HTTP input must reject an unparsable or
// out-of-int64-range value before calling this, and must not silently coerce a
// parse failure to 0.
//
// Bounds above DashboardMaxTimestamp are refused so the fixed +28800 CST shift
// applied by the bucket arithmetic can never overflow int64.
func ValidateDashboardRange(start, end int64) error {
	if start <= 0 || end <= 0 {
		return ErrDashboardRangeInvalid
	}
	if start > DashboardMaxTimestamp || end > DashboardMaxTimestamp {
		return ErrDashboardRangeInvalid
	}
	if end < start {
		return ErrDashboardRangeInverted
	}
	// end and start are both positive and bounded, so this subtraction cannot
	// overflow.
	if end-start > DashboardMaxRangeSeconds {
		return ErrDashboardRangeTooLarge
	}
	return nil
}

// SplitDashboardRange validates the range and returns the consecutive segments
// covering [start, end]. The union of the segments is exactly the input range
// and the segments never overlap, so a per-segment aggregate can be summed
// without double counting.
//
// It returns the validation error rather than a best-effort segmentation, so a
// model-layer caller cannot accidentally issue an unbounded or inverted query
// by skipping the HTTP-level check.
func SplitDashboardRange(start, end int64) ([]DashboardRangeSegment, error) {
	if err := ValidateDashboardRange(start, end); err != nil {
		return nil, err
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
	return segments, nil
}

// ShiftToDashboardBucketSpace applies the fixed Asia/Shanghai offset used by
// the bucket arithmetic, reporting whether the shift is representable.
//
// The offset is added before the division in both the Go mirror and the SQL
// period expression. Doing it through one checked helper means the overflow
// condition is stated once and can be asserted directly, instead of being an
// implicit assumption spread across the query builders.
func ShiftToDashboardBucketSpace(timestamp int64) (int64, bool) {
	if timestamp > DashboardMaxTimestamp {
		return 0, false
	}
	if timestamp < math.MinInt64+DashboardBucketOffsetSeconds {
		return 0, false
	}
	return timestamp + DashboardBucketOffsetSeconds, true
}

// DashboardBucketStart truncates an epoch second to the start of its
// Asia/Shanghai bucket for the given step (3600 for hour, 86400 for day).
//
// It is the Go mirror of the SQL period expression, and exists so tests can
// assert the two agree without loading a timezone database. Both use truncating
// integer division on a positively shifted value; a validated dashboard range
// always has 0 < timestamp <= DashboardMaxTimestamp, so the shifted value is
// positive, representable, and truncation and flooring coincide.
//
// The second result is false when the timestamp is outside the representable
// bucket space; callers must not use the first result in that case.
func DashboardBucketStart(timestamp, stepSeconds int64) (int64, bool) {
	if stepSeconds <= 0 {
		return 0, false
	}
	shifted, ok := ShiftToDashboardBucketSpace(timestamp)
	if !ok {
		return 0, false
	}
	return (shifted/stepSeconds)*stepSeconds - DashboardBucketOffsetSeconds, true
}
