package monitor

import (
	"database/sql"
	"time"

	"gorm.io/gorm"
)

const dbStartTimeKey = "prom_start_time"

// RegisterDBCallbacks adds Prometheus instrumentation callbacks to a GORM DB.
func RegisterDBCallbacks(db *gorm.DB) {
	if db == nil || !Enabled() {
		return
	}

	registerCallback(db, "create")
	registerCallback(db, "query")
	registerCallback(db, "update")
	registerCallback(db, "delete")
	registerCallback(db, "raw")
}

func registerCallback(db *gorm.DB, operation string) {
	beforeName := "prometheus:before_" + operation
	afterName := "prometheus:after_" + operation

	before := func(db *gorm.DB) {
		db.Set(dbStartTimeKey, time.Now())
	}
	after := func(db *gorm.DB) {
		recordDBMetrics(db, operation)
	}

	switch operation {
	case "create":
		_ = db.Callback().Create().Before("*").Register(beforeName, before)
		_ = db.Callback().Create().After("*").Register(afterName, after)
	case "query":
		_ = db.Callback().Query().Before("*").Register(beforeName, before)
		_ = db.Callback().Query().After("*").Register(afterName, after)
	case "update":
		_ = db.Callback().Update().Before("*").Register(beforeName, before)
		_ = db.Callback().Update().After("*").Register(afterName, after)
	case "delete":
		_ = db.Callback().Delete().Before("*").Register(beforeName, before)
		_ = db.Callback().Delete().After("*").Register(afterName, after)
	case "raw":
		_ = db.Callback().Raw().Before("*").Register(beforeName, before)
		_ = db.Callback().Raw().After("*").Register(afterName, after)
	}
}

func recordDBMetrics(db *gorm.DB, operation string) {
	if !Enabled() {
		return
	}
	status := "success"
	if db.Error != nil {
		status = "error"
	}
	DBQueriesTotal.WithLabelValues(operation, status).Inc()

	if v, ok := db.Get(dbStartTimeKey); ok {
		if start, ok := v.(time.Time); ok {
			DBQueryDuration.WithLabelValues(operation).Observe(time.Since(start).Seconds())
		}
	}
}

// StartDBPoolCollector starts a background goroutine that periodically collects DB pool stats.
func StartDBPoolCollector(sqlDB *sql.DB) {
	if sqlDB == nil || !Enabled() {
		return
	}

	go func() {
		var lastWaitCount int64
		var lastWaitDuration time.Duration

		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			stats := sqlDB.Stats()
			DBOpenConnections.WithLabelValues("open").Set(float64(stats.OpenConnections))
			DBOpenConnections.WithLabelValues("in_use").Set(float64(stats.InUse))
			DBOpenConnections.WithLabelValues("idle").Set(float64(stats.Idle))

			if delta := stats.WaitCount - lastWaitCount; delta > 0 {
				DBWaitTotal.Add(float64(delta))
				lastWaitCount = stats.WaitCount
			}
			if delta := stats.WaitDuration - lastWaitDuration; delta > 0 {
				DBWaitDuration.Add(delta.Seconds())
				lastWaitDuration = stats.WaitDuration
			}
		}
	}()
}
