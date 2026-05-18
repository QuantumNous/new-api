package model

import (
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
	BucketStart        int64
	BucketLabel        string
	UserId             int
	Username           string
	RechargeAmount     float64
	SubscriptionAmount float64
	ConsumeQuota       int64
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

	aggregates := map[string]*billingStatsAggregate{}
	if err := addRechargeBillingStats(query, userIds, userNames, aggregates); err != nil {
		return nil, err
	}
	if err := addConsumeBillingStats(query, userIds, userNames, aggregates); err != nil {
		return nil, err
	}

	userAggregates := make(map[int]*BillingStatisticsUserRow)
	summary := BillingStatisticsSummary{}
	for _, agg := range aggregates {
		row := BillingStatisticsRow{
			BucketStart:        agg.BucketStart,
			BucketLabel:        agg.BucketLabel,
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
		userRow := userAggregates[row.UserId]
		if userRow == nil {
			userRow = &BillingStatisticsUserRow{
				UserId:   row.UserId,
				Username: row.Username,
			}
			userAggregates[row.UserId] = userRow
		}
		if userRow.Username == "" {
			userRow.Username = row.Username
		}
		userRow.RechargeAmount += row.RechargeAmount
		userRow.SubscriptionAmount += row.SubscriptionAmount
		userRow.ConsumeQuota += row.ConsumeQuota
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
		Items:          []BillingStatisticsRow{},
		UserItems:      pagedUserItems,
	}, nil
}

func normalizeBillingStatsGranularity(granularity string) string {
	switch strings.ToLower(strings.TrimSpace(granularity)) {
	case BillingStatsGranularityDay, BillingStatsGranularityWeek, BillingStatsGranularityMonth:
		return strings.ToLower(strings.TrimSpace(granularity))
	default:
		return BillingStatsGranularityHour
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

func addRechargeBillingStats(query BillingStatisticsQuery, userIds []int, userNames map[int]string, aggregates map[string]*billingStatsAggregate) error {
	var topups []TopUp
	tx := DB.Model(&TopUp{}).
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
	if err := tx.Find(&topups).Error; err != nil {
		return err
	}

	for _, topup := range topups {
		timestamp := topup.CompleteTime
		if timestamp <= 0 {
			timestamp = topup.CreateTime
		}
		agg := getBillingStatsAggregate(query, userNames, aggregates, topup.UserId, timestamp)
		if topup.Amount == 0 {
			agg.SubscriptionAmount += topup.Money
			continue
		}
		agg.RechargeAmount += topup.Money
	}
	return nil
}

func addConsumeBillingStats(query BillingStatisticsQuery, userIds []int, userNames map[int]string, aggregates map[string]*billingStatsAggregate) error {
	var logs []Log
	tx := LOG_DB.Model(&Log{}).
		Select("user_id, username, created_at, quota").
		Where("type = ? AND created_at >= ? AND created_at < ?", LogTypeConsume, query.StartTimestamp, query.EndTimestamp)
	if len(userIds) > 0 {
		tx = tx.Where("user_id IN ?", userIds)
	}
	if err := tx.Find(&logs).Error; err != nil {
		return err
	}

	for _, log := range logs {
		if log.Username != "" {
			userNames[log.UserId] = log.Username
		}
		agg := getBillingStatsAggregate(query, userNames, aggregates, log.UserId, log.CreatedAt)
		agg.ConsumeQuota += int64(log.Quota)
	}
	return nil
}

func getBillingStatsAggregate(query BillingStatisticsQuery, userNames map[int]string, aggregates map[string]*billingStatsAggregate, userId int, timestamp int64) *billingStatsAggregate {
	bucketStart, bucketLabel := billingStatsBucket(timestamp, query.Granularity)
	key := strings.Join([]string{time.Unix(bucketStart, 0).Format(time.RFC3339), strconv.Itoa(userId)}, "|")
	if agg, ok := aggregates[key]; ok {
		return agg
	}
	username := userNames[userId]
	if username == "" && userId > 0 {
		username, _ = GetUsernameById(userId, false)
		userNames[userId] = username
	}
	agg := &billingStatsAggregate{
		BucketStart: bucketStart,
		BucketLabel: bucketLabel,
		UserId:      userId,
		Username:    username,
	}
	aggregates[key] = agg
	return agg
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
