package model

import (
	"context"
	"sync"

	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	userCallHourlyEventQueueSize = 8192
	userCallHourlyWorkerCount    = 4
)

type UserCallHourlyEvent struct {
	UserId    int
	Username  string
	CreatedAt int64
	IsError   bool
}

func AlignHourStartTs(createdAt int64) int64 {
	if createdAt <= 0 {
		return 0
	}
	return createdAt - (createdAt % 3600)
}

func UpsertUserCallHourly(ctx context.Context, db *gorm.DB, event *UserCallHourlyEvent) error {
	if event == nil || db == nil {
		return nil
	}
	hourStart := AlignHourStartTs(event.CreatedAt)
	if hourStart == 0 || event.UserId <= 0 {
		return nil
	}

	row := &UserCallHourly{
		HourStartTs:  hourStart,
		UserId:       event.UserId,
		Username:     event.Username,
		TotalCalls:   1,
		SuccessCalls: 0,
	}
	if !event.IsError {
		row.SuccessCalls = 1
	}

	return db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "hour_start_ts"},
			{Name: "user_id"},
		},
		DoUpdates: clause.Assignments(map[string]any{
			"username":      row.Username,
			"total_calls":   gorm.Expr("total_calls + ?", row.TotalCalls),
			"success_calls": gorm.Expr("success_calls + ?", row.SuccessCalls),
		}),
	}).Create(row).Error
}

var (
	userCallHourlyOnce  sync.Once
	userCallHourlyQueue chan *UserCallHourlyEvent
)

func initUserCallHourlyWriter() {
	userCallHourlyQueue = make(chan *UserCallHourlyEvent, userCallHourlyEventQueueSize)
	for i := 0; i < userCallHourlyWorkerCount; i++ {
		gopool.Go(func() {
			for event := range userCallHourlyQueue {
				func() {
					defer func() { _ = recover() }()
					_ = UpsertUserCallHourly(context.Background(), DB, event)
				}()
			}
		})
	}
}

func RecordUserCallHourlyEventAsync(_ any, event *UserCallHourlyEvent) {
	if event == nil {
		return
	}
	userCallHourlyOnce.Do(initUserCallHourlyWriter)

	select {
	case userCallHourlyQueue <- event:
	default:
		gopool.Go(func() {
			defer func() { _ = recover() }()
			_ = UpsertUserCallHourly(context.Background(), DB, event)
		})
	}
}