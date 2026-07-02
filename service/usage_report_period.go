package service

import (
	"time"

	"github.com/QuantumNous/new-api/model"
)

// ReportPeriod 周期信息
type ReportPeriod struct {
	PeriodType  string
	PeriodStart time.Time
	PeriodEnd   time.Time
	PeriodLabel string

	// 上周期（用于环比）
	PrevPeriodStart time.Time
	PrevPeriodEnd   time.Time

	// Unix 时间戳（用于查询 quota_data）
	StartTimestamp     int64
	EndTimestamp       int64
	PrevStartTimestamp int64
	PrevEndTimestamp   int64
}

// BuildReportPeriod 根据周期类型和当前时间构建默认报表周期。
// daily=昨天，weekly=上周，monthly=上月。
func BuildReportPeriod(periodType string, now time.Time) ReportPeriod {
	switch periodType {
	case model.ReportPeriodDaily:
		return BuildReportPeriodForDate(periodType, now.AddDate(0, 0, -1))
	case model.ReportPeriodWeekly:
		return BuildReportPeriodForDate(periodType, now.AddDate(0, 0, -7))
	case model.ReportPeriodMonthly:
		return BuildReportPeriodForDate(periodType, now.AddDate(0, -1, 0))
	default:
		return ReportPeriod{PeriodType: periodType}
	}
}

// BuildReportPeriodForDate 根据指定日期构建报表周期。
// daily=该日期自然日，weekly=该日期所在周，monthly=该日期所在月。
func BuildReportPeriodForDate(periodType string, target time.Time) ReportPeriod {
	loc := target.Location()
	switch periodType {
	case model.ReportPeriodDaily:
		start := time.Date(target.Year(), target.Month(), target.Day(), 0, 0, 0, 0, loc)
		end := start.AddDate(0, 0, 1).Add(-time.Second)
		prevStart := start.AddDate(0, 0, -1)
		prevEnd := start.Add(-time.Second)
		return newReportPeriod(periodType, start, end, prevStart, prevEnd, start.Format("2006-01-02"))

	case model.ReportPeriodWeekly:
		monday := reportStartOfWeek(target)
		sunday := monday.AddDate(0, 0, 7).Add(-time.Second)
		prevMonday := monday.AddDate(0, 0, -7)
		prevSunday := monday.Add(-time.Second)
		label := monday.Format("2006-01-02") + " ~ " + sunday.Format("2006-01-02")
		return newReportPeriod(periodType, monday, sunday, prevMonday, prevSunday, label)

	case model.ReportPeriodMonthly:
		monthStart := time.Date(target.Year(), target.Month(), 1, 0, 0, 0, 0, loc)
		monthEnd := monthStart.AddDate(0, 1, 0).Add(-time.Second)
		prevMonthStart := monthStart.AddDate(0, -1, 0)
		prevMonthEnd := monthStart.Add(-time.Second)
		return newReportPeriod(periodType, monthStart, monthEnd, prevMonthStart, prevMonthEnd, monthStart.Format("2006-01"))

	default:
		return ReportPeriod{PeriodType: periodType}
	}
}

func newReportPeriod(periodType string, start, end, prevStart, prevEnd time.Time, label string) ReportPeriod {
	return ReportPeriod{
		PeriodType:         periodType,
		PeriodStart:        start,
		PeriodEnd:          end,
		PeriodLabel:        label,
		PrevPeriodStart:    prevStart,
		PrevPeriodEnd:      prevEnd,
		StartTimestamp:     start.Unix(),
		EndTimestamp:       end.Unix(),
		PrevStartTimestamp: prevStart.Unix(),
		PrevEndTimestamp:   prevEnd.Unix(),
	}
}

func reportStartOfWeek(t time.Time) time.Time {
	dayStart := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
	weekday := int(dayStart.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	return dayStart.AddDate(0, 0, 1-weekday)
}
