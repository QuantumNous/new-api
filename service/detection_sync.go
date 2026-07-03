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
	BaseURL                 string  `gorm:"column:base_url"`
	Status                  string  `gorm:"column:status"`
	ClaimedModel            string  `gorm:"column:claimed_model"`
	PredictedTop1           string  `gorm:"column:predicted_top1"`
	Top1Score               float64 `gorm:"column:top1_score"`
	Top5Json                string  `gorm:"column:top5_json"` // JSON-stringified array from detections.top5
	FingerprintModelVersion string  `gorm:"column:fingerprint_model_version"`
	LatencyMeanMs           float64 `gorm:"column:latency_mean_ms"`
	NotcompleteReason       string  `gorm:"column:notcomplete_reason"`
	DetectTime              int64   `gorm:"column:detect_time"`
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

	// Query most recent conclusive detection per base_url within lookback window.
	// We intentionally do not sync notcomplete rows into frontend-facing channel
	// state, so transient failures do not overwrite the last usable signal.
	// DISTINCT ON is PostgreSQL-specific — safe here because APIMASTER_PG_DB is always PG.
	var rows []apimasterDetectionRow
	err := model.APIMASTER_PG_DB.Raw(`
		SELECT DISTINCT ON (base_url)
			base_url,
			status,
			claimed_model,
			COALESCE(predicted_top1, '')   AS predicted_top1,
			COALESCE(top1_score, 0)        AS top1_score,
			COALESCE(top5::text, '')       AS top5_json,
			COALESCE(fingerprint_model_version, '') AS fingerprint_model_version,
			COALESCE(latency_mean_ms, 0)   AS latency_mean_ms,
			COALESCE(notcomplete_reason, '') AS notcomplete_reason,
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
			// Note: dedup uses raw d.Status intentionally — we check against what Flask reported,
			// not the boosted status, to avoid re-processing on every sync tick.
			continue
		}

		// Apply confidence boost before persisting
		boostedTop5Json, boostedTop1Score, rawTop1Score, rawTop5Json, boostedStatus := BoostDetectionResult(d.Top5Json, d.Top1Score, d.ClaimedModel, d.Status)

		// Write log entry
		logEntry := model.ChannelDetectLog{
			ChannelId:               ch.Id,
			Source:                  "sync",
			Status:                  boostedStatus,
			BaseURL:                 d.BaseURL,
			ClaimedModel:            d.ClaimedModel,
			PredictedModel:          d.PredictedTop1,
			Top1Score:               boostedTop1Score,
			Top1ScoreRaw:            rawTop1Score,
			Top5Json:                boostedTop5Json,
			Top5JsonRaw:             rawTop5Json,
			FingerprintModelVersion: d.FingerprintModelVersion,
			LatencyMeanMs:           d.LatencyMeanMs,
			Note:                    d.NotcompleteReason,
			DetectTime:              d.DetectTime,
		}
		model.DB.Create(&logEntry)

		now := time.Now().Unix()
		updates := map[string]interface{}{
			"last_detected_at":   now,
			"last_detect_result": boostedStatus,
		}

		// Only adjust priority for conclusive results
		if boostedStatus == "pass" || boostedStatus == "suspicious" {
			priority := int64(0)
			if ch.Priority != nil {
				priority = *ch.Priority
			}
			if boostedStatus == "suspicious" {
				priority -= detectionPriorityPenalty
				if priority < 0 {
					priority = 0
				}
				updates["priority"] = priority
				if priority == 0 {
					updates["status"] = 2 // disable channel
				}
			} else {
				if ch.Status == 2 {
					updates["status"] = 1 // re-enable if previously disabled by detection
				}
				priority += detectionPriorityBonus
				if priority > detectionPriorityMax {
					priority = detectionPriorityMax
				}
				updates["priority"] = priority
			}
		}

		if err := model.DB.Model(&model.Channel{}).Where("id = ?", ch.Id).Updates(updates).Error; err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("detection sync: failed to update channel %d: %v", ch.Id, err))
		}
	}
}
