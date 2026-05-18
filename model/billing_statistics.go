package model

import (
	"database/sql"
	"errors"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	BillingStatsGranularityHour  = "hour"
	BillingStatsGranularityDay   = "day"
	BillingStatsGranularityWeek  = "week"
	BillingStatsGranularityMonth = "month"
	BillingStatsGranularityYear  = "year"

	BillingStatsUSDToCNYRate = 7
)

type BillingStatisticsQuery struct {
	StartTimestamp int64
	EndTimestamp   int64
	Granularity    string
	Username       string
	Page           int
	PageSize       int
}

type BillingStatisticsSummary struct {
	RechargeAmount     float64 `json:"recharge_amount"`
	SubscriptionAmount float64 `json:"subscription_amount"`
	TotalAmount        float64 `json:"total_amount"`
	RedundantAmount    float64 `json:"redundant_amount"`
	ConsumeQuota       int64   `json:"consume_quota"`
	ConsumeAmount      float64 `json:"consume_amount"`
}

type BillingStatisticsRow struct {
	BucketStart        int64   `json:"bucket_start"`
	BucketLabel        string  `json:"bucket_label"`
	UserId             int     `json:"user_id"`
	Username           string  `json:"username"`
	RechargeAmount     float64 `json:"recharge_amount"`
	SubscriptionAmount float64 `json:"subscription_amount"`
	TotalAmount        float64 `json:"total_amount"`
	RedundantAmount    float64 `json:"redundant_amount"`
	ConsumeQuota       int64   `json:"consume_quota"`
	ConsumeAmount      float64 `json:"consume_amount"`
}

type BillingStatisticsUserRow struct {
	UserId             int     `json:"user_id"`
	Username           string  `json:"username"`
	RechargeAmount     float64 `json:"recharge_amount"`
	SubscriptionAmount float64 `json:"subscription_amount"`
	TotalAmount        float64 `json:"total_amount"`
	RedundantAmount    float64 `json:"redundant_amount"`
	ConsumeQuota       int64   `json:"consume_quota"`
	ConsumeAmount      float64 `json:"consume_amount"`
}

type BillingStatisticsResult struct {
	StartTimestamp int64                      `json:"start_timestamp"`
	EndTimestamp   int64                      `json:"end_timestamp"`
	Granularity    string                     `json:"granularity"`
	Page           int                        `json:"page"`
	PageSize       int                        `json:"page_size"`
	TotalPages     int                        `json:"total_pages"`
	UserItemsTotal int                        `json:"user_items_total"`
	Summary        BillingStatisticsSummary   `json:"summary"`
	Items          []BillingStatisticsRow     `json:"items"`
	UserItems      []BillingStatisticsUserRow `json:"user_items"`
}

type billingStatsAggregate struct {
	UserId             int
	Username           string
	RechargeAmount     float64
	SubscriptionAmount float64
	ConsumeQuota       int64
}

type billingRechargeStatsRow struct {
	UserId             int
	RechargeAmount     float64
	SubscriptionAmount float64
}

type billingConsumeStatsRow struct {
	UserId       int
	Username     string
	ConsumeQuota int64
}

type billingStatsBucketRange struct {
	Start int64
	End   int64
	Label string
}

func GetBillingStatistics(query BillingStatisticsQuery) (*BillingStatisticsResult, error) {
	query.Granularity = normalizeBillingStatsGranularity(query.Granularity)
	query.Page, query.PageSize = normalizeBillingStatsPagination(query.Page, query.PageSize)
	if query.StartTimestamp <= 0 || query.EndTimestamp <= 0 {
		start, end := defaultBillingStatsRange()
		if query.StartTimestamp <= 0 {
			query.StartTimestamp = start
		}
		if query.EndTimestamp <= 0 {
			query.EndTimestamp = end
		}
	}
	if query.EndTimestamp <= query.StartTimestamp {
		return nil, errors.New("end_timestamp must be greater than start_timestamp")
	}

	userIds, userNames, err := billingStatsUsers(query.Username)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(query.Username) != "" && len(userIds) == 0 {
		return &BillingStatisticsResult{
			StartTimestamp: query.StartTimestamp,
			EndTimestamp:   query.EndTimestamp,
			Granularity:    query.Granularity,
			Page:           query.Page,
			PageSize:       query.PageSize,
			TotalPages:     0,
			UserItemsTotal: 0,
			Summary:        BillingStatisticsSummary{},
			Items:          []BillingStatisticsRow{},
			UserItems:      []BillingStatisticsUserRow{},
		}, nil
	}

	aggregates := map[int]*billingStatsAggregate{}
	if err := addRechargeBillingStats(query, userIds, userNames, aggregates); err != nil {
		return nil, err
	}
	if err := addConsumeBillingStats(query, userIds, userNames, aggregates); err != nil {
		return nil, err
	}
	if err := fillBillingStatsAggregateUsernames(aggregates, userNames); err != nil {
		return nil, err
	}
	items, err := getBillingStatsChartItems(query, userIds)
	if err != nil {
		return nil, err
	}

	userAggregates := make(map[int]*BillingStatisticsUserRow)
	summary := BillingStatisticsSummary{}
	for _, agg := range aggregates {
		row := BillingStatisticsUserRow{
			UserId:             agg.UserId,
			Username:           agg.Username,
			RechargeAmount:     agg.RechargeAmount,
			SubscriptionAmount: agg.SubscriptionAmount,
			TotalAmount:        agg.RechargeAmount + agg.SubscriptionAmount,
			ConsumeQuota:       agg.ConsumeQuota,
			ConsumeAmount:      quotaToBillingAmount(agg.ConsumeQuota),
		}
		row.RedundantAmount = row.TotalAmount - row.ConsumeAmount
		summary.RechargeAmount += row.RechargeAmount
		summary.SubscriptionAmount += row.SubscriptionAmount
		summary.ConsumeQuota += row.ConsumeQuota
		userAggregates[row.UserId] = &row
	}
	summary.TotalAmount = summary.RechargeAmount + summary.SubscriptionAmount
	summary.ConsumeAmount = quotaToBillingAmount(summary.ConsumeQuota)
	summary.RedundantAmount = summary.TotalAmount - summary.ConsumeAmount
	userItems := make([]BillingStatisticsUserRow, 0, len(userAggregates))
	for _, row := range userAggregates {
		row.TotalAmount = row.RechargeAmount + row.SubscriptionAmount
		row.ConsumeAmount = quotaToBillingAmount(row.ConsumeQuota)
		row.RedundantAmount = row.TotalAmount - row.ConsumeAmount
		userItems = append(userItems, *row)
	}

	sort.Slice(userItems, func(i, j int) bool {
		leftTotal := userItems[i].RechargeAmount + userItems[i].SubscriptionAmount + userItems[i].ConsumeAmount
		rightTotal := userItems[j].RechargeAmount + userItems[j].SubscriptionAmount + userItems[j].ConsumeAmount
		if leftTotal == rightTotal {
			return userItems[i].Username < userItems[j].Username
		}
		return leftTotal > rightTotal
	})
	userItemsTotal := len(userItems)
	totalPages := 0
	if userItemsTotal > 0 {
		totalPages = (userItemsTotal + query.PageSize - 1) / query.PageSize
		if query.Page > totalPages {
			query.Page = totalPages
		}
	}
	startIdx := (query.Page - 1) * query.PageSize
	if startIdx > userItemsTotal {
		startIdx = userItemsTotal
	}
	endIdx := startIdx + query.PageSize
	if endIdx > userItemsTotal {
		endIdx = userItemsTotal
	}
	pagedUserItems := userItems[startIdx:endIdx]

	return &BillingStatisticsResult{
		StartTimestamp: query.StartTimestamp,
		EndTimestamp:   query.EndTimestamp,
		Granularity:    query.Granularity,
		Page:           query.Page,
		PageSize:       query.PageSize,
		TotalPages:     totalPages,
		UserItemsTotal: userItemsTotal,
		Summary:        summary,
		Items:          items,
		UserItems:      pagedUserItems,
	}, nil
}

func normalizeBillingStatsGranularity(granularity string) string {
	switch strings.ToLower(strings.TrimSpace(granularity)) {
	case BillingStatsGranularityDay, BillingStatsGranularityWeek, BillingStatsGranularityMonth, BillingStatsGranularityYear:
		return strings.ToLower(strings.TrimSpace(granularity))
	default:
		return BillingStatsGranularityDay
	}
}

func normalizeBillingStatsPagination(page int, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = common.ItemsPerPage
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

func defaultBillingStatsRange() (int64, int64) {
	now := time.Now()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	return start.Unix(), start.AddDate(0, 0, 1).Unix()
}

func billingStatsUsers(username string) ([]int, map[int]string, error) {
	username = strings.TrimSpace(username)
	if username == "" {
		return nil, map[int]string{}, nil
	}
	var users []User
	if err := DB.Model(&User{}).
		Select("id, username").
		Where("username = ?", username).
		Find(&users).Error; err != nil {
		return nil, nil, err
	}
	userIds := make([]int, 0, len(users))
	userNames := make(map[int]string, len(users))
	for _, user := range users {
		userIds = append(userIds, user.Id)
		userNames[user.Id] = user.Username
	}
	return userIds, userNames, nil
}

func addRechargeBillingStats(query BillingStatisticsQuery, userIds []int, userNames map[int]string, aggregates map[int]*billingStatsAggregate) error {
	var rows []billingRechargeStatsRow
	tx := DB.Model(&TopUp{}).
		Select(
			"user_id, COALESCE(SUM(CASE WHEN amount = 0 THEN money ELSE 0 END), 0) AS subscription_amount, COALESCE(SUM(CASE WHEN amount <> 0 THEN money ELSE 0 END), 0) AS recharge_amount",
		).
		Where(
			"status = ? AND ((complete_time > 0 AND complete_time >= ? AND complete_time < ?) OR (complete_time = 0 AND create_time >= ? AND create_time < ?))",
			common.TopUpStatusSuccess,
			query.StartTimestamp,
			query.EndTimestamp,
			query.StartTimestamp,
			query.EndTimestamp,
		)
	if len(userIds) > 0 {
		tx = tx.Where("user_id IN ?", userIds)
	}
	if err := tx.Group("user_id").Scan(&rows).Error; err != nil {
		return err
	}

	for _, row := range rows {
		agg := getBillingStatsAggregate(userNames, aggregates, row.UserId)
		agg.RechargeAmount += row.RechargeAmount
		agg.SubscriptionAmount += row.SubscriptionAmount
	}
	return nil
}

func addConsumeBillingStats(query BillingStatisticsQuery, userIds []int, userNames map[int]string, aggregates map[int]*billingStatsAggregate) error {
	var rows []billingConsumeStatsRow
	tx := LOG_DB.Model(&Log{}).
		Select("user_id, MAX(username) AS username, COALESCE(SUM(quota), 0) AS consume_quota").
		Where("type = ? AND created_at >= ? AND created_at < ?", LogTypeConsume, query.StartTimestamp, query.EndTimestamp)
	if len(userIds) > 0 {
		tx = tx.Where("user_id IN ?", userIds)
	}
	if err := tx.Group("user_id").Scan(&rows).Error; err != nil {
		return err
	}

	for _, row := range rows {
		if row.Username != "" {
			userNames[row.UserId] = row.Username
		}
		agg := getBillingStatsAggregate(userNames, aggregates, row.UserId)
		agg.ConsumeQuota += row.ConsumeQuota
	}
	return nil
}

func getBillingStatsChartItems(query BillingStatisticsQuery, userIds []int) ([]BillingStatisticsRow, error) {
	buckets := billingStatsBucketRanges(query.StartTimestamp, query.EndTimestamp, query.Granularity)
	items := make([]BillingStatisticsRow, 0, len(buckets))
	itemByBucket := make(map[int64]*BillingStatisticsRow, len(buckets))
	for _, bucket := range buckets {
		row := &BillingStatisticsRow{
			BucketStart: bucket.Start,
			BucketLabel: bucket.Label,
		}
		itemByBucket[bucket.Start] = row
		items = append(items, *row)
	}

	if err := addBillingStatsChartRechargeItems(query, userIds, buckets, itemByBucket); err != nil {
		return nil, err
	}
	if err := addBillingStatsChartConsumeItems(query, userIds, buckets, itemByBucket); err != nil {
		return nil, err
	}

	for index := range items {
		if row := itemByBucket[items[index].BucketStart]; row != nil {
			row.TotalAmount = row.RechargeAmount + row.SubscriptionAmount
			row.ConsumeAmount = quotaToBillingAmount(row.ConsumeQuota)
			row.RedundantAmount = row.TotalAmount - row.ConsumeAmount
			items[index] = *row
		}
	}

	return items, nil
}

func addBillingStatsChartRechargeItems(query BillingStatisticsQuery, userIds []int, buckets []billingStatsBucketRange, itemByBucket map[int64]*BillingStatisticsRow) error {
	if len(buckets) == 0 {
		return nil
	}
	selectSQL, selectArgs := billingStatsRechargeBucketSelectSQL(buckets)
	tx := DB.Model(&TopUp{}).
		Select(selectSQL, selectArgs...).
		Where(
			"status = ? AND ((complete_time > 0 AND complete_time >= ? AND complete_time < ?) OR (complete_time = 0 AND create_time >= ? AND create_time < ?))",
			common.TopUpStatusSuccess,
			query.StartTimestamp,
			query.EndTimestamp,
			query.StartTimestamp,
			query.EndTimestamp,
		)
	if len(userIds) > 0 {
		tx = tx.Where("user_id IN ?", userIds)
	}
	rows, err := tx.Rows()
	if err != nil {
		return err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil
	}

	values := make([]sql.NullFloat64, len(buckets)*2)
	scanArgs := make([]any, len(values))
	for i := range values {
		scanArgs[i] = &values[i]
	}
	if err := rows.Scan(scanArgs...); err != nil {
		return err
	}
	for index, bucket := range buckets {
		if item := itemByBucket[bucket.Start]; item != nil {
			item.SubscriptionAmount = values[index*2].Float64
			item.RechargeAmount = values[index*2+1].Float64
		}
	}
	return nil
}

func addBillingStatsChartConsumeItems(query BillingStatisticsQuery, userIds []int, buckets []billingStatsBucketRange, itemByBucket map[int64]*BillingStatisticsRow) error {
	if len(buckets) == 0 {
		return nil
	}
	selectSQL, selectArgs := billingStatsConsumeBucketSelectSQL(buckets)
	tx := LOG_DB.Model(&Log{}).
		Select(selectSQL, selectArgs...).
		Where("type = ? AND created_at >= ? AND created_at < ?", LogTypeConsume, query.StartTimestamp, query.EndTimestamp)
	if len(userIds) > 0 {
		tx = tx.Where("user_id IN ?", userIds)
	}
	rows, err := tx.Rows()
	if err != nil {
		return err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil
	}

	values := make([]sql.NullInt64, len(buckets))
	scanArgs := make([]any, len(values))
	for i := range values {
		scanArgs[i] = &values[i]
	}
	if err := rows.Scan(scanArgs...); err != nil {
		return err
	}
	for index, bucket := range buckets {
		if item := itemByBucket[bucket.Start]; item != nil {
			item.ConsumeQuota = values[index].Int64
		}
	}
	return nil
}

func billingStatsRechargeBucketSelectSQL(buckets []billingStatsBucketRange) (string, []any) {
	parts := make([]string, 0, len(buckets)*2)
	args := make([]any, 0, len(buckets)*10)
	for index, bucket := range buckets {
		condition := "((complete_time > 0 AND complete_time >= ? AND complete_time < ?) OR (complete_time = 0 AND create_time >= ? AND create_time < ?))"
		parts = append(parts,
			"COALESCE(SUM(CASE WHEN "+condition+" AND amount = 0 THEN money ELSE 0 END), 0) AS subscription_amount_"+strconv.Itoa(index),
			"COALESCE(SUM(CASE WHEN "+condition+" AND amount <> 0 THEN money ELSE 0 END), 0) AS recharge_amount_"+strconv.Itoa(index),
		)
		args = append(args, bucket.Start, bucket.End, bucket.Start, bucket.End)
		args = append(args, bucket.Start, bucket.End, bucket.Start, bucket.End)
	}
	return strings.Join(parts, ", "), args
}

func billingStatsConsumeBucketSelectSQL(buckets []billingStatsBucketRange) (string, []any) {
	parts := make([]string, 0, len(buckets))
	args := make([]any, 0, len(buckets)*2)
	for index, bucket := range buckets {
		parts = append(parts, "COALESCE(SUM(CASE WHEN created_at >= ? AND created_at < ? THEN quota ELSE 0 END), 0) AS consume_quota_"+strconv.Itoa(index))
		args = append(args, bucket.Start, bucket.End)
	}
	return strings.Join(parts, ", "), args
}

func getBillingStatsAggregate(userNames map[int]string, aggregates map[int]*billingStatsAggregate, userId int) *billingStatsAggregate {
	if agg, ok := aggregates[userId]; ok {
		return agg
	}
	username := userNames[userId]
	agg := &billingStatsAggregate{
		UserId:   userId,
		Username: username,
	}
	aggregates[userId] = agg
	return agg
}

func fillBillingStatsAggregateUsernames(aggregates map[int]*billingStatsAggregate, userNames map[int]string) error {
	missingUserIds := make([]int, 0)
	for userId, agg := range aggregates {
		if userId <= 0 || agg.Username != "" {
			continue
		}
		if username := userNames[userId]; username != "" {
			agg.Username = username
			continue
		}
		missingUserIds = append(missingUserIds, userId)
	}
	if len(missingUserIds) == 0 {
		return nil
	}

	var users []User
	if err := DB.Model(&User{}).
		Select("id, username").
		Where("id IN ?", missingUserIds).
		Find(&users).Error; err != nil {
		return err
	}
	for _, user := range users {
		userNames[user.Id] = user.Username
		if agg := aggregates[user.Id]; agg != nil && agg.Username == "" {
			agg.Username = user.Username
		}
	}
	return nil
}

func billingStatsBucketRanges(startTimestamp int64, endTimestamp int64, granularity string) []billingStatsBucketRange {
	if endTimestamp <= startTimestamp {
		return []billingStatsBucketRange{}
	}
	start := billingStatsBucketStart(time.Unix(startTimestamp, 0), granularity)
	end := time.Unix(endTimestamp, 0)
	ranges := make([]billingStatsBucketRange, 0)
	for current := start; current.Unix() < endTimestamp; current = billingStatsNextBucketStart(current, granularity) {
		next := billingStatsNextBucketStart(current, granularity)
		bucketEnd := next
		if bucketEnd.After(end) {
			bucketEnd = end
		}
		if bucketEnd.Unix() <= startTimestamp {
			continue
		}
		ranges = append(ranges, billingStatsBucketRange{
			Start: current.Unix(),
			End:   bucketEnd.Unix(),
			Label: billingStatsBucketLabel(current, granularity),
		})
	}
	return ranges
}

func billingStatsBucketStart(t time.Time, granularity string) time.Time {
	switch granularity {
	case BillingStatsGranularityMonth:
		return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, t.Location())
	case BillingStatsGranularityYear:
		return time.Date(t.Year(), 1, 1, 0, 0, 0, 0, t.Location())
	default:
		return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
	}
}

func billingStatsNextBucketStart(t time.Time, granularity string) time.Time {
	switch granularity {
	case BillingStatsGranularityMonth:
		return t.AddDate(0, 1, 0)
	case BillingStatsGranularityYear:
		return t.AddDate(1, 0, 0)
	default:
		return t.AddDate(0, 0, 1)
	}
}

func billingStatsBucketLabel(t time.Time, granularity string) string {
	switch granularity {
	case BillingStatsGranularityMonth:
		return t.Format("2006-01")
	case BillingStatsGranularityYear:
		return t.Format("2006")
	default:
		return t.Format("2006-01-02")
	}
}

func billingStatsBucketSQL(timestampExpr string, granularity string) string {
	switch {
	case common.UsingPostgreSQL:
		return billingStatsPostgresBucketSQL(timestampExpr, granularity)
	case common.UsingMySQL:
		return billingStatsMySQLBucketSQL(timestampExpr, granularity)
	default:
		return billingStatsSQLiteBucketSQL(timestampExpr, granularity)
	}
}

func billingStatsPostgresBucketSQL(timestampExpr string, granularity string) string {
	switch granularity {
	case BillingStatsGranularityMonth:
		return "CAST(EXTRACT(EPOCH FROM date_trunc('month', to_timestamp(" + timestampExpr + "))) AS BIGINT)"
	case BillingStatsGranularityYear:
		return "CAST(EXTRACT(EPOCH FROM date_trunc('year', to_timestamp(" + timestampExpr + "))) AS BIGINT)"
	default:
		return "CAST(EXTRACT(EPOCH FROM date_trunc('day', to_timestamp(" + timestampExpr + "))) AS BIGINT)"
	}
}

func billingStatsMySQLBucketSQL(timestampExpr string, granularity string) string {
	switch granularity {
	case BillingStatsGranularityMonth:
		return "UNIX_TIMESTAMP(DATE_FORMAT(FROM_UNIXTIME(" + timestampExpr + "), '%Y-%m-01 00:00:00'))"
	case BillingStatsGranularityYear:
		return "UNIX_TIMESTAMP(DATE_FORMAT(FROM_UNIXTIME(" + timestampExpr + "), '%Y-01-01 00:00:00'))"
	default:
		return "UNIX_TIMESTAMP(DATE(FROM_UNIXTIME(" + timestampExpr + ")))"
	}
}

func billingStatsSQLiteBucketSQL(timestampExpr string, granularity string) string {
	switch granularity {
	case BillingStatsGranularityMonth:
		return "CAST(strftime('%s', datetime(" + timestampExpr + ", 'unixepoch', 'localtime', 'start of month', 'utc')) AS INTEGER)"
	case BillingStatsGranularityYear:
		return "CAST(strftime('%s', datetime(" + timestampExpr + ", 'unixepoch', 'localtime', 'start of year', 'utc')) AS INTEGER)"
	default:
		return "CAST(strftime('%s', datetime(" + timestampExpr + ", 'unixepoch', 'localtime', 'start of day', 'utc')) AS INTEGER)"
	}
}

func billingStatsBucket(timestamp int64, granularity string) (int64, string) {
	t := time.Unix(timestamp, 0)
	switch granularity {
	case BillingStatsGranularityDay:
		start := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
		return start.Unix(), start.Format("2006-01-02")
	case BillingStatsGranularityWeek:
		weekday := int(t.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		startDay := t.AddDate(0, 0, 1-weekday)
		start := time.Date(startDay.Year(), startDay.Month(), startDay.Day(), 0, 0, 0, 0, t.Location())
		return start.Unix(), start.Format("2006-01-02")
	case BillingStatsGranularityMonth:
		start := time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, t.Location())
		return start.Unix(), start.Format("2006-01")
	default:
		start := time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), 0, 0, 0, t.Location())
		return start.Unix(), start.Format("2006-01-02 15:00")
	}
}

func quotaToBillingAmount(quota int64) float64 {
	if common.QuotaPerUnit <= 0 {
		return 0
	}
	return float64(quota) / common.QuotaPerUnit * BillingStatsUSDToCNYRate
}
