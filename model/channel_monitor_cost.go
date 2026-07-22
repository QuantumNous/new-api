package model

import (
	"context"
	"fmt"

	"github.com/QuantumNous/new-api/common"
)

const (
	channelMonitorCostDaySeconds            int64 = 24 * 60 * 60
	channelMonitorCostTimezoneOffsetSeconds int64 = 8 * 60 * 60
)

// ChannelMonitorDailyQuota is the net logged quota for one channel/group/day.
// Consume logs increase it and refund logs decrease it.
type ChannelMonitorDailyQuota struct {
	DayStart  int64
	ChannelId int
	Group     string
	Quota     int64
}

type channelMonitorDailyQuotaRow struct {
	DayBucket int64  `gorm:"column:day_bucket"`
	ChannelId int    `gorm:"column:channel_id"`
	Group     string `gorm:"column:group_name"`
	Quota     int64  `gorm:"column:quota"`
}

// GetChannelMonitorDailyQuotas aggregates consume/refund logs by Beijing day.
// The caller converts quota into an upstream cost because that conversion is
// channel-monitor configuration, not an intrinsic property of a log row.
func GetChannelMonitorDailyQuotas(ctx context.Context, startTimestamp int64, endTimestamp int64) ([]ChannelMonitorDailyQuota, error) {
	if startTimestamp >= endTimestamp {
		return []ChannelMonitorDailyQuota{}, nil
	}

	dayBucket := channelMonitorCostDayBucketSQL()
	groupColumn := channelMonitorLogGroupColumn()
	selectColumns := fmt.Sprintf(
		"%s AS day_bucket, channel_id, %s AS group_name, "+
			"SUM(CASE WHEN type = %d THEN quota WHEN type = %d THEN -quota ELSE 0 END) AS quota",
		dayBucket,
		groupColumn,
		LogTypeConsume,
		LogTypeRefund,
	)
	groupColumns := dayBucket + ", channel_id, " + groupColumn

	var rows []channelMonitorDailyQuotaRow
	err := LOG_DB.WithContext(ctx).
		Model(&Log{}).
		Select(selectColumns).
		Where("channel_id > ?", 0).
		Where("type IN ?", []int{LogTypeConsume, LogTypeRefund}).
		Where("created_at >= ? AND created_at < ?", startTimestamp, endTimestamp).
		Group(groupColumns).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	items := make([]ChannelMonitorDailyQuota, 0, len(rows))
	for _, row := range rows {
		items = append(items, ChannelMonitorDailyQuota{
			DayStart:  row.DayBucket*channelMonitorCostDaySeconds - channelMonitorCostTimezoneOffsetSeconds,
			ChannelId: row.ChannelId,
			Group:     row.Group,
			Quota:     row.Quota,
		})
	}
	return items, nil
}

func channelMonitorCostDayBucketSQL() string {
	const offset = channelMonitorCostTimezoneOffsetSeconds
	switch {
	case common.UsingLogDatabase(common.DatabaseTypeMySQL):
		return fmt.Sprintf("FLOOR((created_at + %d) / %d)", offset, channelMonitorCostDaySeconds)
	case common.UsingLogDatabase(common.DatabaseTypeClickHouse):
		return fmt.Sprintf("intDiv(created_at + %d, %d)", offset, channelMonitorCostDaySeconds)
	default:
		// SQLite and PostgreSQL both use integer division when both operands are integers.
		return fmt.Sprintf("(created_at + %d) / %d", offset, channelMonitorCostDaySeconds)
	}
}
