package service

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/bytedance/gopkg/util/gopool"
)

const (
	// Tick frequency: how often we wake up to check whether any channel×model
	// pair is due for re-detection. Per-model intervals are read from options
	// table (detect_config_*); a model with interval=5min still won't fire more
	// often than this tick.
	autoDetectTickInterval   = 1 * time.Minute
	autoDetectChannelTimeout = 10 * time.Minute
	// default Flask URL; override with APIMASTER_FLASK_URL env var
	autoDetectDefaultFlaskURL = "http://127.0.0.1:7860"
)

var autoDetectOnce sync.Once

// StartAutoDetectTask periodically triggers fingerprint detection for all enabled channels
// by calling the apimaster Flask /api/fingerprint endpoint. Results are stored in
// channel_detect_log; detection_sync will pick them up from PG and adjust priorities.
func StartAutoDetectTask() {
	autoDetectOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		flaskURL := os.Getenv("APIMASTER_FLASK_URL")
		if flaskURL == "" {
			flaskURL = autoDetectDefaultFlaskURL
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf("auto-detect task started (tick=%s, flask=%s)", autoDetectTickInterval, flaskURL))
			ticker := time.NewTicker(autoDetectTickInterval)
			defer ticker.Stop()
			runAutoDetectOnce(flaskURL)
			for range ticker.C {
				runAutoDetectOnce(flaskURL)
			}
		})
	})
}

// runAutoDetectOnce: for each (channel × supported model) pair where the model
// has fingerprint_enabled=true, run a fingerprint detection if its interval has
// elapsed since the last fingerprint run for this pair.
func runAutoDetectOnce(flaskURL string) {
	ctx := context.Background()

	var channels []model.Channel
	// status IN (1,3): keep probing AutoDisabled (3) channels so they have a chance
	// to recover via the consecutive-pass counter. Skip ManuallyDisabled (2) — operator
	// said "stop touching it".
	if err := model.DB.Where("status IN (1, 3) AND base_url != '' AND base_url IS NOT NULL").Find(&channels).Error; err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("auto-detect: failed to list channels: %v", err))
		return
	}

	configuredModels := LoadAllConfiguredModels()
	if len(configuredModels) == 0 {
		return // no per-model config saved → nothing to do
	}

	now := time.Now().Unix()

	for _, ch := range channels {
		if ch.BaseURL == nil || *ch.BaseURL == "" {
			continue
		}
		channelModels := splitChannelModels(ch.Models)
		for _, m := range configuredModels {
			if !channelModels[m] {
				continue // channel doesn't support this model
			}
			cfg := LoadDetectConfig(m)
			if !cfg.FingerprintEnabled {
				continue
			}

			intervalSec := int64(cfg.FingerprintIntervalMinutes) * 60
			if intervalSec < 60 {
				intervalSec = 60
			}

			lastTime := lastFingerprintTime(ch.Id, m)
			if now-lastTime < intervalSec {
				continue // not yet due
			}

			detectOneChannel(ctx, flaskURL, &ch, m)
		}
	}
}

// splitChannelModels parses Channel.Models (comma-separated) into a set.
func splitChannelModels(models string) map[string]bool {
	out := map[string]bool{}
	for _, p := range strings.Split(models, ",") {
		p = strings.TrimSpace(p)
		if p != "" {
			out[strings.ToLower(p)] = true
		}
	}
	return out
}

// lastFingerprintTime returns the most recent detect_time for this channel×model
// from channel_detect_logs where source != 'uptime'. Returns 0 if none.
func lastFingerprintTime(channelId int, modelName string) int64 {
	var row struct{ DetectTime int64 }
	model.DB.Table("channel_detect_logs").
		Select("detect_time").
		Where("channel_id = ? AND claimed_model = ? AND source <> ?", channelId, modelName, "uptime").
		Order("detect_time DESC").
		Limit(1).
		Scan(&row)
	return row.DetectTime
}

func detectOneChannel(ctx context.Context, flaskURL string, ch *model.Channel, targetModel string) {
	baseURL := *ch.BaseURL
	apiKey := ch.Key
	// For multi-key channels the Key field may contain multiple keys separated by newlines
	if idx := strings.IndexByte(apiKey, '\n'); idx >= 0 {
		apiKey = strings.TrimSpace(apiKey[:idx])
	}
	if apiKey == "" || baseURL == "" {
		return
	}

	apiFormat := extractAPIFormat(ch.Setting)
	keyGroup := ExtractKeyGroup(ch.Setting)

	// source='auto' tells Flask to flag this row in apimaster.detections so user-facing
	// pages (history / stats / ranking) can filter background scans out.
	body, err := common.Marshal(map[string]string{
		"base_url":      baseURL,
		"api_key":       apiKey,
		"claimed_model": targetModel,
		"api_format":    apiFormat,
		"source":        "auto",
	})
	if err != nil {
		return
	}

	client := &http.Client{Timeout: autoDetectChannelTimeout}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, flaskURL+"/api/fingerprint", bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("auto-detect: channel %d request failed: %v", ch.Id, err))
		// Persist the failure so the UI dot-grid shows it instead of silently
		// disappearing — operator needs to see why detection didn't run.
		now := time.Now().Unix()
		model.DB.Create(&model.ChannelDetectLog{
			ChannelId:    ch.Id,
			Source:       "auto",
			Status:       "notcomplete",
			BaseURL:      baseURL,
			GroupName:    keyGroup,
			ClaimedModel: targetModel,
			Note:         fmt.Sprintf("Flask request failed: %v", err),
			DetectTime:   now,
		})
		return
	}
	defer resp.Body.Close()

	// Consume NDJSON stream; each line is {"type":"progress"|"result"|"error", ...}
	detectStatus := "notcomplete"
	predictedModel := targetModel
	noteText := ""
	top1Score := 0.0
	top5Json := ""
	fpVersion := ""

	scanner := bufio.NewScanner(resp.Body)
	// Default scanner buf is 64KB; Flask result event includes top5 + analysis text and can exceed that.
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		var event struct {
			Type  string         `json:"type"`
			Data  map[string]any `json:"data"`
			Error string         `json:"error"`
		}
		if err := common.Unmarshal(scanner.Bytes(), &event); err != nil {
			continue
		}
		switch event.Type {
		case "result":
			if event.Data != nil {
				if isPass, ok := event.Data["is_pass"].(bool); ok {
					if isPass {
						detectStatus = "pass"
					} else {
						detectStatus = "suspicious"
					}
				}
				if top, ok := event.Data["predicted_top1"].(string); ok && top != "" {
					predictedModel = top
				}
				if score, ok := event.Data["top1_score"].(float64); ok {
					top1Score = score
				}
				if v, ok := event.Data["fingerprint_model_version"].(string); ok && v != "" {
					fpVersion = v
				}
				// top5 is an array of {label,score,rank,...} — keep raw JSON so frontend
				// gets the exact same shape detection_sync delivers from apimaster PG.
				if top5Raw, ok := event.Data["top5"]; ok && top5Raw != nil {
					if b, err := common.Marshal(top5Raw); err == nil {
						top5Json = string(b)
					}
				}
			}
		case "error":
			detectStatus = "notcomplete"
			noteText = event.Error
		}
		// Stop on terminal events
		if event.Type == "result" || event.Type == "error" {
			break
		}
	}

	if detectStatus == "notcomplete" && noteText == "" {
		// Stream ended without a terminal event — likely truncation/timeout
		noteText = "Flask stream ended without result"
	}

	// Apply confidence boost before persisting: top1==claimed + score∈[40%,70%) → boost to [70%,80%)
	boostedTop5Json, boostedTop1Score, rawTop1Score, rawTop5Json, boostedStatus := BoostDetectionResult(top5Json, top1Score, targetModel, detectStatus)
	detectStatus = boostedStatus // routing state machine below uses this

	now := time.Now().Unix()

	logEntry := model.ChannelDetectLog{
		ChannelId:               ch.Id,
		Source:                  "auto",
		Status:                  boostedStatus,
		BaseURL:                 baseURL,
		GroupName:               keyGroup,
		ClaimedModel:            targetModel,
		PredictedModel:          predictedModel,
		Top1Score:               boostedTop1Score,
		Top1ScoreRaw:            rawTop1Score,
		Top5Json:                boostedTop5Json,
		Top5JsonRaw:             rawTop5Json,
		FingerprintModelVersion: fpVersion,
		Note:                    noteText,
		DetectTime:              now,
	}
	model.DB.Create(&logEntry)

	updates := map[string]interface{}{
		"last_detected_at":   now,
		"last_detect_result": detectStatus,
	}

	// Routing algorithm 0.2 status machine:
	//   suspicious → disable only this channel+model ability, leaving other models
	//     on the same channel routable.
	//   pass for an auto-disabled model → counter+1; counter==threshold → re-enable
	//     that channel+model ability.
	//   pass while channel status=3 → keep legacy channel recovery behavior.
	//   pass while status=1 → no-op (counter only matters during recovery)
	//   notcomplete → leave status & counter alone (transient errors shouldn't punish)
	//   status=2 (ManuallyDisabled) → algorithm never touches it
	if ch.Status != common.ChannelStatusManuallyDisabled {
		switch detectStatus {
		case "suspicious":
			disableModelForFingerprint(ch, targetModel, now, updates)
		case "pass":
			recoverModelForFingerprint(ch, targetModel, updates)
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
		logger.LogWarn(ctx, fmt.Sprintf("auto-detect: failed to update channel %d: %v", ch.Id, err))
	}
}

const autoDisabledModelsInfoKey = "auto_disabled_models"

func disableModelForFingerprint(ch *model.Channel, targetModel string, now int64, updates map[string]interface{}) {
	targetModel = strings.TrimSpace(targetModel)
	if ch == nil || targetModel == "" {
		return
	}

	info := ch.GetOtherInfo()
	autoDisabledModels := autoDisabledModelInfo(info)
	_, alreadyAutoDisabled := autoDisabledModels[targetModel]

	var enabledCount int64
	if err := model.DB.Table("abilities").
		Where("channel_id = ? AND model = ? AND enabled = ?", ch.Id, targetModel, true).
		Count(&enabledCount).Error; err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("auto-detect: failed to count enabled abilities channel=%d model=%s: %v", ch.Id, targetModel, err))
		return
	}

	// If the operator had already disabled this model manually, do not mark it as
	// auto-disabled. That prevents future fingerprint passes from re-enabling a
	// manually disabled channel+model pair.
	if enabledCount == 0 && !alreadyAutoDisabled {
		return
	}

	if err := model.DB.Table("abilities").
		Where("channel_id = ? AND model = ? AND enabled = ?", ch.Id, targetModel, true).
		Update("enabled", false).Error; err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("auto-detect: failed to disable ability channel=%d model=%s: %v", ch.Id, targetModel, err))
		return
	}

	autoDisabledModels[targetModel] = map[string]interface{}{
		"disabled_at": now,
		"pass_count":  0,
		"reason":      "fingerprint suspicious",
	}
	info[autoDisabledModelsInfoKey] = autoDisabledModels
	ch.SetOtherInfo(info)
	updates["other_info"] = ch.OtherInfo
	model.InitChannelCache()
}

func recoverModelForFingerprint(ch *model.Channel, targetModel string, updates map[string]interface{}) {
	targetModel = strings.TrimSpace(targetModel)
	if ch == nil || targetModel == "" {
		return
	}

	info := ch.GetOtherInfo()
	autoDisabledModels := autoDisabledModelInfo(info)
	raw, ok := autoDisabledModels[targetModel]
	if !ok {
		return
	}

	entry, ok := raw.(map[string]interface{})
	if !ok {
		entry = map[string]interface{}{}
	}
	passCount := autoDisabledModelPassCount(entry) + 1
	if passCount < fingerprintRecoveryThreshold {
		entry["pass_count"] = passCount
		autoDisabledModels[targetModel] = entry
		info[autoDisabledModelsInfoKey] = autoDisabledModels
		ch.SetOtherInfo(info)
		updates["other_info"] = ch.OtherInfo
		return
	}

	if err := model.DB.Table("abilities").
		Where("channel_id = ? AND model = ?", ch.Id, targetModel).
		Update("enabled", true).Error; err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("auto-detect: failed to re-enable ability channel=%d model=%s: %v", ch.Id, targetModel, err))
		return
	}

	delete(autoDisabledModels, targetModel)
	if len(autoDisabledModels) == 0 {
		delete(info, autoDisabledModelsInfoKey)
	} else {
		info[autoDisabledModelsInfoKey] = autoDisabledModels
	}
	ch.SetOtherInfo(info)
	updates["other_info"] = ch.OtherInfo
	model.InitChannelCache()
}

func autoDisabledModelInfo(info map[string]interface{}) map[string]interface{} {
	if info == nil {
		return map[string]interface{}{}
	}
	raw, ok := info[autoDisabledModelsInfoKey]
	if !ok || raw == nil {
		return map[string]interface{}{}
	}
	if m, ok := raw.(map[string]interface{}); ok {
		return m
	}
	return map[string]interface{}{}
}

func autoDisabledModelPassCount(entry map[string]interface{}) int {
	if entry == nil {
		return 0
	}
	switch v := entry["pass_count"].(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	case json.Number:
		n, _ := v.Int64()
		return int(n)
	default:
		return 0
	}
}

// fingerprintRecoveryThreshold = how many consecutive fingerprint pass results
// an auto-disabled channel/model must accumulate before it's re-enabled.
// 12 ≈ 12 minutes at the default 1-minute tick or 12 hours at hourly tick —
// enough confidence without keeping a confirmed-bad route offline forever.
const fingerprintRecoveryThreshold = 12

// RunChannelDetectionNow triggers a single fingerprint detection for the given
// channel+model on-demand. Used by the "手动检测" button in model-data UI when
// an operator wants to verify a channel without waiting for the next scheduled
// tick. Reuses detectOneChannel verbatim (source='auto'), so the result lands
// in channel_detect_logs identically and the status machine reacts the same way.
//
// Synchronous — callers should run in a goroutine because the upstream
// fingerprint call takes 5–15s.
func RunChannelDetectionNow(ch *model.Channel, targetModel string) {
	if ch == nil {
		return
	}
	flaskURL := os.Getenv("APIMASTER_FLASK_URL")
	if flaskURL == "" {
		flaskURL = autoDetectDefaultFlaskURL
	}
	detectOneChannel(context.Background(), flaskURL, ch, targetModel)
}

// extractAPIFormat reads api_format from channel.Setting JSON.
// Returns "openai-compatible" if absent or unrecognized.
func extractAPIFormat(setting *string) string {
	if setting == nil || *setting == "" {
		return "openai-compatible"
	}
	var s struct {
		APIFormat string `json:"api_format"`
	}
	if err := common.Unmarshal([]byte(*setting), &s); err != nil {
		return "openai-compatible"
	}
	switch s.APIFormat {
	case "openai-compatible", "openai", "anthropic", "gemini":
		return s.APIFormat
	}
	return "openai-compatible"
}
