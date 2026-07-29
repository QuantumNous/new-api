package model

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type sqliteQuickCheckRow struct {
	Result string `gorm:"column:quick_check"`
}

func CheckSavingsLifetimeSQLiteIntegrity() error {
	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		if err := checkSQLiteDatabaseIntegrity(DB, "main database"); err != nil {
			return err
		}
	}
	if common.UsingLogDatabase(common.DatabaseTypeSQLite) && LOG_DB != DB {
		if err := checkSQLiteDatabaseIntegrity(LOG_DB, "log database"); err != nil {
			return err
		}
	}
	return nil
}

func checkSQLiteDatabaseIntegrity(db *gorm.DB, label string) error {
	if db == nil {
		return fmt.Errorf("%s is not initialized", label)
	}
	var rows []sqliteQuickCheckRow
	if err := db.Raw("PRAGMA quick_check").Scan(&rows).Error; err != nil {
		return fmt.Errorf("check %s integrity: %w", label, err)
	}
	if len(rows) == 1 && strings.EqualFold(strings.TrimSpace(rows[0].Result), "ok") {
		return nil
	}
	issues := make([]string, 0, len(rows))
	for _, row := range rows {
		if issue := strings.TrimSpace(row.Result); issue != "" {
			issues = append(issues, issue)
		}
	}
	if len(issues) == 0 {
		issues = append(issues, "quick_check returned no result")
	}
	return fmt.Errorf("%s integrity check failed: %s", label, strings.Join(issues, "; "))
}

const (
	SavingsLifetimeEventTypeBase       = "base"
	SavingsLifetimeCoverageEstimated   = "estimated"
	SavingsLifetimeCoverageSkipped     = "skipped"
	SavingsLifetimeCalculationSnapshot = "snapshot"
	SavingsLifetimeCalculationRebuild  = "historical_rebuild_frozen"
)

type SavingsLifetimeEvent struct {
	ID                   int64  `json:"id" gorm:"primaryKey"`
	EventKey             string `json:"event_key" gorm:"type:varchar(128);uniqueIndex"`
	SourceKey            string `json:"source_key" gorm:"type:varchar(128);index"`
	LogID                int64  `json:"log_id" gorm:"index"`
	UserID               int    `json:"user_id" gorm:"index"`
	OccurredAt           int64  `json:"occurred_at" gorm:"bigint;index"`
	DayStartUTC          int64  `json:"day_start_utc" gorm:"bigint;index"`
	EventType            string `json:"event_type" gorm:"type:varchar(32)"`
	CoverageState        string `json:"coverage_state" gorm:"type:varchar(32)"`
	SkipReason           string `json:"skip_reason" gorm:"type:varchar(64)"`
	CalculationMode      string `json:"calculation_mode" gorm:"type:varchar(32)"`
	OfficialQuota        int64  `json:"official_quota"`
	ActualQuota          int64  `json:"actual_quota"`
	SavingsQuota         int64  `json:"savings_quota"`
	SavingsCNYMicros     int64  `json:"savings_cny_micros"`
	QuotaPerUnitSnapshot int64  `json:"quota_per_unit_snapshot"`
	USDCNYRateMicros     int64  `json:"usd_cny_rate_micros"`
	PriceSnapshotAt      int64  `json:"price_snapshot_at" gorm:"bigint"`
	PriceFingerprint     string `json:"price_fingerprint" gorm:"type:varchar(80)"`
	AggregateVersion     int    `json:"aggregate_version"`
	AggregatedAt         int64  `json:"aggregated_at" gorm:"bigint;index:idx_savings_events_pending,priority:1"`
	CreatedAt            int64  `json:"created_at" gorm:"bigint"`
}

type SavingsLifetimeDaily struct {
	ID                        int64 `json:"id" gorm:"primaryKey"`
	UserID                    int   `json:"user_id" gorm:"uniqueIndex:idx_savings_daily_user_day,priority:1"`
	DayStartUTC               int64 `json:"day_start_utc" gorm:"bigint;uniqueIndex:idx_savings_daily_user_day,priority:2"`
	RequestCount              int64 `json:"request_count"`
	EstimatedRequestCount     int64 `json:"estimated_request_count"`
	SnapshotRequestCount      int64 `json:"snapshot_request_count"`
	ReconstructedRequestCount int64 `json:"reconstructed_request_count"`
	OfficialQuota             int64 `json:"official_quota"`
	ActualQuota               int64 `json:"actual_quota"`
	SavingsQuota              int64 `json:"savings_quota"`
	SavingsCNYMicros          int64 `json:"savings_cny_micros"`
	FirstOccurredAt           int64 `json:"first_occurred_at" gorm:"bigint"`
	LastOccurredAt            int64 `json:"last_occurred_at" gorm:"bigint"`
	UpdatedAt                 int64 `json:"updated_at" gorm:"bigint"`
}

type SavingsLifetimeTotal struct {
	UserID                    int   `json:"user_id" gorm:"primaryKey"`
	RequestCount              int64 `json:"request_count"`
	EstimatedRequestCount     int64 `json:"estimated_request_count"`
	SnapshotRequestCount      int64 `json:"snapshot_request_count"`
	ReconstructedRequestCount int64 `json:"reconstructed_request_count"`
	OfficialQuota             int64 `json:"official_quota"`
	ActualQuota               int64 `json:"actual_quota"`
	SavingsQuota              int64 `json:"savings_quota"`
	SavingsCNYMicros          int64 `json:"savings_cny_micros"`
	StatisticsStartedAt       int64 `json:"statistics_started_at" gorm:"bigint"`
	LastAggregatedAt          int64 `json:"last_aggregated_at" gorm:"bigint"`
}

func (event *SavingsLifetimeEvent) BeforeCreate(_ *gorm.DB) error {
	if event.CreatedAt == 0 {
		event.CreatedAt = time.Now().Unix()
	}
	if event.AggregateVersion == 0 {
		event.AggregateVersion = 1
	}
	return nil
}

func CreateSavingsLifetimeEvents(events []SavingsLifetimeEvent) error {
	if len(events) == 0 {
		return nil
	}
	return DB.Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(&events, 500).Error
}

func AggregatePendingSavingsLifetimeEvents(limit int) (int, error) {
	if limit <= 0 {
		limit = 1000
	}
	processed := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		var events []SavingsLifetimeEvent
		if err := lockForUpdate(tx).
			Where("aggregated_at = ?", 0).
			Order("id asc").
			Limit(limit).
			Find(&events).Error; err != nil {
			return err
		}
		if len(events) == 0 {
			return nil
		}

		userIDs := make([]int, 0)
		userSet := make(map[int]struct{})
		minDay, maxDay := events[0].DayStartUTC, events[0].DayStartUTC
		for i := range events {
			if _, ok := userSet[events[i].UserID]; !ok {
				userSet[events[i].UserID] = struct{}{}
				userIDs = append(userIDs, events[i].UserID)
			}
			if events[i].DayStartUTC < minDay {
				minDay = events[i].DayStartUTC
			}
			if events[i].DayStartUTC > maxDay {
				maxDay = events[i].DayStartUTC
			}
		}

		var existingDaily []SavingsLifetimeDaily
		if err := lockForUpdate(tx).
			Where("user_id IN ? AND day_start_utc >= ? AND day_start_utc <= ?", userIDs, minDay, maxDay).
			Find(&existingDaily).Error; err != nil {
			return err
		}
		var existingTotals []SavingsLifetimeTotal
		if err := lockForUpdate(tx).Where("user_id IN ?", userIDs).Find(&existingTotals).Error; err != nil {
			return err
		}

		type dailyKey struct {
			UserID int
			Day    int64
		}
		dailyByKey := make(map[dailyKey]*SavingsLifetimeDaily, len(existingDaily)+len(events))
		for i := range existingDaily {
			row := &existingDaily[i]
			dailyByKey[dailyKey{UserID: row.UserID, Day: row.DayStartUTC}] = row
		}
		totalByUser := make(map[int]*SavingsLifetimeTotal, len(existingTotals)+len(userIDs))
		for i := range existingTotals {
			row := &existingTotals[i]
			totalByUser[row.UserID] = row
		}

		now := time.Now().Unix()
		for i := range events {
			event := &events[i]
			key := dailyKey{UserID: event.UserID, Day: event.DayStartUTC}
			daily := dailyByKey[key]
			if daily == nil {
				daily = &SavingsLifetimeDaily{UserID: event.UserID, DayStartUTC: event.DayStartUTC}
				dailyByKey[key] = daily
			}
			total := totalByUser[event.UserID]
			if total == nil {
				total = &SavingsLifetimeTotal{UserID: event.UserID}
				totalByUser[event.UserID] = total
			}
			if err := addSavingsLifetimeEvent(daily, total, event, now); err != nil {
				return err
			}
		}

		dailyRows := make([]SavingsLifetimeDaily, 0, len(dailyByKey))
		for _, row := range dailyByKey {
			dailyRows = append(dailyRows, *row)
		}
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "day_start_utc"}},
			UpdateAll: true,
		}).Create(&dailyRows).Error; err != nil {
			return err
		}

		totalRows := make([]SavingsLifetimeTotal, 0, len(totalByUser))
		for _, row := range totalByUser {
			totalRows = append(totalRows, *row)
		}
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}},
			UpdateAll: true,
		}).Create(&totalRows).Error; err != nil {
			return err
		}

		eventIDs := make([]int64, 0, len(events))
		for i := range events {
			eventIDs = append(eventIDs, events[i].ID)
		}
		result := tx.Model(&SavingsLifetimeEvent{}).
			Where("id IN ? AND aggregated_at = ?", eventIDs, 0).
			Update("aggregated_at", now)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != int64(len(events)) {
			return errors.New("savings lifetime event aggregation conflict")
		}
		processed = len(events)
		return nil
	})
	return processed, err
}

func addSavingsLifetimeEvent(daily *SavingsLifetimeDaily, total *SavingsLifetimeTotal, event *SavingsLifetimeEvent, now int64) error {
	if event.EventType == SavingsLifetimeEventTypeBase {
		if !checkedAddInt64(&daily.RequestCount, 1) || !checkedAddInt64(&total.RequestCount, 1) {
			return errors.New("savings lifetime request count overflow")
		}
		if daily.FirstOccurredAt == 0 || event.OccurredAt < daily.FirstOccurredAt {
			daily.FirstOccurredAt = event.OccurredAt
		}
		if event.OccurredAt > daily.LastOccurredAt {
			daily.LastOccurredAt = event.OccurredAt
		}
		if total.StatisticsStartedAt == 0 || event.OccurredAt < total.StatisticsStartedAt {
			total.StatisticsStartedAt = event.OccurredAt
		}
	}
	if event.CoverageState == SavingsLifetimeCoverageEstimated {
		if event.EventType == SavingsLifetimeEventTypeBase {
			if !checkedAddInt64(&daily.EstimatedRequestCount, 1) || !checkedAddInt64(&total.EstimatedRequestCount, 1) {
				return errors.New("savings lifetime estimated count overflow")
			}
			if event.CalculationMode == SavingsLifetimeCalculationRebuild {
				if !checkedAddInt64(&daily.ReconstructedRequestCount, 1) || !checkedAddInt64(&total.ReconstructedRequestCount, 1) {
					return errors.New("savings lifetime reconstructed count overflow")
				}
			} else {
				if !checkedAddInt64(&daily.SnapshotRequestCount, 1) || !checkedAddInt64(&total.SnapshotRequestCount, 1) {
					return errors.New("savings lifetime snapshot count overflow")
				}
			}
		}
		if !checkedAddInt64(&daily.OfficialQuota, event.OfficialQuota) ||
			!checkedAddInt64(&daily.ActualQuota, event.ActualQuota) ||
			!checkedAddInt64(&daily.SavingsQuota, event.SavingsQuota) ||
			!checkedAddInt64(&daily.SavingsCNYMicros, event.SavingsCNYMicros) ||
			!checkedAddInt64(&total.OfficialQuota, event.OfficialQuota) ||
			!checkedAddInt64(&total.ActualQuota, event.ActualQuota) ||
			!checkedAddInt64(&total.SavingsQuota, event.SavingsQuota) ||
			!checkedAddInt64(&total.SavingsCNYMicros, event.SavingsCNYMicros) {
			return errors.New("savings lifetime amount overflow")
		}
	}
	daily.UpdatedAt = now
	total.LastAggregatedAt = now
	return nil
}

func checkedAddInt64(target *int64, delta int64) bool {
	if (delta > 0 && *target > math.MaxInt64-delta) || (delta < 0 && *target < math.MinInt64-delta) {
		return false
	}
	*target += delta
	return true
}

func GetSavingsLifetimeTotal(userID int) (*SavingsLifetimeTotal, error) {
	var total SavingsLifetimeTotal
	err := DB.Where("user_id = ?", userID).First(&total).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return &SavingsLifetimeTotal{UserID: userID}, nil
	}
	if err != nil {
		return nil, err
	}
	return &total, nil
}

func CountPendingSavingsLifetimeEvents() (int64, error) {
	var count int64
	err := DB.Model(&SavingsLifetimeEvent{}).Where("aggregated_at = ?", 0).Count(&count).Error
	return count, err
}
