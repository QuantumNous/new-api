package service

import (
	"bufio"
	"bytes"
	"context"
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
	autoDetectInterval       = 6 * time.Hour
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
			logger.LogInfo(context.Background(), fmt.Sprintf("auto-detect task started (interval=%s, flask=%s)", autoDetectInterval, flaskURL))
			ticker := time.NewTicker(autoDetectInterval)
			defer ticker.Stop()
			runAutoDetectOnce(flaskURL)
			for range ticker.C {
				runAutoDetectOnce(flaskURL)
			}
		})
	})
}

func runAutoDetectOnce(flaskURL string) {
	ctx := context.Background()

	var channels []model.Channel
	if err := model.DB.Where("status = 1 AND base_url != '' AND base_url IS NOT NULL").Find(&channels).Error; err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("auto-detect: failed to list channels: %v", err))
		return
	}

	cutoff := time.Now().Add(-autoDetectInterval).Unix()

	for _, ch := range channels {
		if ch.BaseURL == nil || *ch.BaseURL == "" {
			continue
		}
		// Skip channels detected recently
		if ch.LastDetectedAt != nil && *ch.LastDetectedAt > cutoff {
			continue
		}
		// Pick the test model: prefer TestModel field, fall back to first in Models
		targetModel := pickDetectModel(&ch)
		if targetModel == "" {
			continue
		}

		detectOneChannel(ctx, flaskURL, &ch, targetModel)
	}
}

func pickDetectModel(ch *model.Channel) string {
	if ch.TestModel != nil && *ch.TestModel != "" {
		return strings.TrimSpace(*ch.TestModel)
	}
	parts := strings.Split(ch.Models, ",")
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			return p
		}
	}
	return ""
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

	body, err := common.Marshal(map[string]string{
		"base_url":      baseURL,
		"api_key":       apiKey,
		"claimed_model": targetModel,
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
		return
	}
	defer resp.Body.Close()

	// Consume NDJSON stream; each line is {"type":"progress"|"result"|"error", ...}
	detectStatus := "notcomplete"
	predictedModel := targetModel

	scanner := bufio.NewScanner(resp.Body)
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
			}
		case "error":
			detectStatus = "notcomplete"
		}
		// Stop on terminal events
		if event.Type == "result" || event.Type == "error" {
			break
		}
	}

	now := time.Now().Unix()

	logEntry := model.ChannelDetectLog{
		ChannelId:  ch.Id,
		Source:     "auto",
		Status:     detectStatus,
		BaseURL:    baseURL,
		Model:      predictedModel,
		DetectTime: now,
	}
	model.DB.Create(&logEntry)

	updates := map[string]interface{}{
		"last_detected_at":    now,
		"last_detect_result":  detectStatus,
	}
	if err := model.DB.Model(&model.Channel{}).Where("id = ?", ch.Id).Updates(updates).Error; err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("auto-detect: failed to update channel %d: %v", ch.Id, err))
	}
}
