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

	// Query most recent conclusive detection per base_url+claimed_model within lookback window.
	// We intentionally do not sync notcomplete rows into frontend-facing channel
	// state, so transient failures do not overwrite the last usable signal.
	// DISTINCT ON is PostgreSQL-specific — safe here because APIMASTER_PG_DB is always PG.
	var rows []apimasterDetectionRow
	err := model.APIMASTER_PG_DB.Raw(`
		SELECT DISTINCT ON (base_url, claimed_model)
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
		  AND claimed_model IS NOT NULL
		  AND status IN ('pass', 'suspicious')
		ORDER BY base_url, claimed_model, created_at DESC
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
		if d.ClaimedModel == "" || !splitChannelModels(ch.Models)[d.ClaimedModel] {
			continue
		}

		// Apply confidence boost before persisting
		boostedTop5Json, boostedTop1Score, rawTop1Score, rawTop5Json, boostedStatus := BoostDetectionResult(d.Top5Json, d.Top1Score, d.ClaimedModel, d.Status)
		if syncedDetectionExists(ch.Id, d.ClaimedModel, boostedStatus, d.DetectTime) {
			continue
		}

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

		// Keep fingerprint sync consistent with auto_detect:
		// suspicious disables only this channel+model ability; pass recovers only
		// a model that was auto-disabled by fingerprint. Other models on the same
		// channel must remain routable.
		if ch.Status != common.ChannelStatusManuallyDisabled {
			switch boostedStatus {
			case "suspicious":
				disableModelForFingerprint(&ch, d.ClaimedModel, now, updates)
			case "pass":
				recoverModelForFingerprint(&ch, d.ClaimedModel, updates)
				if ch.Status == common.ChannelStatusAutoDisabled {
					next := ch.ConsecutiveFingerprintPass + 1
					if next >= fingerprintRecoveryThreshold {
						updates["status"] = common.ChannelStatusEnabled
						updates["consecutive_fingerprint_pass"] = 0
					} else {
						updates["consecutive_fingerprint_pass"] = next
					}
				}
			}
		}

		if err := model.DB.Model(&model.Channel{}).Where("id = ?", ch.Id).Updates(updates).Error; err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("detection sync: failed to update channel %d: %v", ch.Id, err))
		}
	}
}

func syncedDetectionExists(channelId int, claimedModel string, status string, detectTime int64) bool {
	var count int64
	if err := model.DB.Table("channel_detect_logs").
		Where("channel_id = ? AND claimed_model = ? AND source = ? AND status = ? AND detect_time >= ?", channelId, claimedModel, "sync", status, detectTime).
		Count(&count).Error; err != nil {
		return false
	}
	return count > 0
}
