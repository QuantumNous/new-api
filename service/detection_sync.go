package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/bytedance/gopkg/util/gopool"
)

const (
	detectionSyncInterval = 30 * time.Second
	detectionLookback     = 24 * time.Hour
	// suspicious detection drops priority by this amount
	detectionPriorityPenalty = int64(10)
	// pass detection raises priority by this amount
	detectionPriorityBonus = int64(5)
	detectionPriorityMax   = int64(100)
)

var detectionSyncOnce sync.Once

type apimasterDetectionRow struct {
	BaseURL    string `gorm:"column:base_url"`
	Status     string `gorm:"column:status"`
	Model      string `gorm:"column:model"`
	DetectTime int64  `gorm:"column:detect_time"`
}

// StartDetectionSyncTask periodically reads apimaster's detections PG table and
// updates matching new-api channel priorities. Requires APIMASTER_PG_DB to be initialized.
func StartDetectionSyncTask() {
	detectionSyncOnce.Do(func() {
		if !common.IsMasterNode || model.APIMASTER_PG_DB == nil {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf("detection sync task started (interval=%s)", detectionSyncInterval))
			ticker := time.NewTicker(detectionSyncInterval)
			defer ticker.Stop()
			runDetectionSyncOnce()
			for range ticker.C {
				runDetectionSyncOnce()
			}
		})
	})
}

func runDetectionSyncOnce() {
	ctx := context.Background()
	since := time.Now().Add(-detectionLookback)

	// Query most recent detection per base_url within lookback window.
	// DISTINCT ON is PostgreSQL-specific — safe here because APIMASTER_PG_DB is always PG.
	var rows []apimasterDetectionRow
	err := model.APIMASTER_PG_DB.Raw(`
		SELECT DISTINCT ON (base_url)
			base_url,
			status,
			claimed_model AS model,
			EXTRACT(EPOCH FROM created_at)::bigint AS detect_time
		FROM detections
		WHERE created_at > $1
		  AND base_url IS NOT NULL
		  AND status IN ('pass', 'suspicious')
		ORDER BY base_url, created_at DESC
	`, since).Scan(&rows).Error
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("detection sync: PG query failed: %v", err))
		return
	}

	for _, row := range rows {
		applyDetectionResult(ctx, row)
	}
}

func applyDetectionResult(ctx context.Context, d apimasterDetectionRow) {
	// Find all channels matching this base_url
	var channels []model.Channel
	if err := model.DB.Where("base_url = ?", d.BaseURL).Find(&channels).Error; err != nil || len(channels) == 0 {
		return
	}

	for _, ch := range channels {
		// Skip if we already processed a result at this timestamp or newer
		if ch.LastDetectResult == d.Status && ch.LastDetectedAt != nil && *ch.LastDetectedAt >= d.DetectTime {
			continue
		}

		// Write log entry
		logEntry := model.ChannelDetectLog{
			ChannelId:  ch.Id,
			Source:     "sync",
			Status:     d.Status,
			BaseURL:    d.BaseURL,
			Model:      d.Model,
			DetectTime: d.DetectTime,
		}
		model.DB.Create(&logEntry)

		// Compute priority update
		priority := int64(0)
		if ch.Priority != nil {
			priority = *ch.Priority
		}
		now := time.Now().Unix()
		updates := map[string]interface{}{
			"last_detected_at":    now,
			"last_detect_result":  d.Status,
		}

		if d.Status == "suspicious" {
			priority -= detectionPriorityPenalty
			if priority < 0 {
				priority = 0
			}
			updates["priority"] = priority
			if priority == 0 {
				updates["status"] = 2 // disable channel
			}
		} else if d.Status == "pass" {
			if ch.Status == 2 {
				updates["status"] = 1 // re-enable if previously disabled by detection
			}
			priority += detectionPriorityBonus
			if priority > detectionPriorityMax {
				priority = detectionPriorityMax
			}
			updates["priority"] = priority
		}

		if err := model.DB.Model(&model.Channel{}).Where("id = ?", ch.Id).Updates(updates).Error; err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("detection sync: failed to update channel %d: %v", ch.Id, err))
		}
	}
}
