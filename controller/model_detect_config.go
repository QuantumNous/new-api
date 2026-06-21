package controller

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type ModelDetectConfig struct {
	FingerprintEnabled         bool `json:"fingerprint_enabled"`
	FingerprintIntervalMinutes int  `json:"fingerprint_interval_minutes"`
	UptimeEnabled              bool `json:"uptime_enabled"`
	UptimeIntervalMinutes      int  `json:"uptime_interval_minutes"`
}

func detectConfigKey(modelName string) string {
	return fmt.Sprintf("detect_config_%s", modelName)
}

func defaultDetectConfig() ModelDetectConfig {
	return ModelDetectConfig{
		FingerprintEnabled:         false,
		FingerprintIntervalMinutes: 360,
		UptimeEnabled:              false,
		UptimeIntervalMinutes:      30,
	}
}

// GetModelDetectConfig GET /api/admin/model-detect-config?model=xxx
func GetModelDetectConfig(c *gin.Context) {
	modelName := c.Query("model")
	if modelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "model is required"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": buildModelDetectConfigResponse(modelName)})
}

// BatchGetModelDetectConfig GET /api/admin/model-detect-config/batch?models=a,b,c
func BatchGetModelDetectConfig(c *gin.Context) {
	raw := strings.TrimSpace(c.Query("models"))
	if raw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "models is required"})
		return
	}

	out := make(map[string]gin.H)
	for _, part := range strings.Split(raw, ",") {
		modelName := strings.TrimSpace(part)
		if modelName == "" {
			continue
		}
		out[modelName] = buildModelDetectConfigResponse(modelName)
	}
	if len(out) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "models is required"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": out})
}

func buildModelDetectConfigResponse(modelName string) gin.H {
	var opt model.Option
	err := model.DB.Where("key = ?", detectConfigKey(modelName)).First(&opt).Error
	cfg := defaultDetectConfig()
	if err == nil {
		if e := common.Unmarshal([]byte(opt.Value), &cfg); e != nil {
			cfg = defaultDetectConfig()
		}
	}

	return gin.H{
		"fingerprint_enabled":          cfg.FingerprintEnabled,
		"fingerprint_interval_minutes": cfg.FingerprintIntervalMinutes,
		"uptime_enabled":               cfg.UptimeEnabled,
		"uptime_interval_minutes":      cfg.UptimeIntervalMinutes,
		"next_fingerprint_at":          nextDetectAt(modelName, "auto", cfg.FingerprintEnabled, cfg.FingerprintIntervalMinutes),
		"next_uptime_at":               nextDetectAt(modelName, "uptime", cfg.UptimeEnabled, cfg.UptimeIntervalMinutes),
	}
}

// nextDetectAt returns the next predicted detect timestamp (unix sec) for a
// model+source pair. 0 means "feature off". time.Now() means "due immediately".
func nextDetectAt(modelName, source string, enabled bool, intervalMinutes int) int64 {
	if !enabled || intervalMinutes < 1 {
		return 0
	}
	var maxT int64
	model.DB.Model(&model.ChannelDetectLog{}).
		Where("claimed_model = ? AND source = ?", modelName, source).
		Select("COALESCE(MAX(detect_time), 0)").
		Row().Scan(&maxT)
	now := time.Now().Unix()
	if maxT == 0 {
		return now
	}
	next := maxT + int64(intervalMinutes)*60
	if next < now {
		return now
	}
	return next
}

// SaveModelDetectConfig POST /api/admin/model-detect-config
func SaveModelDetectConfig(c *gin.Context) {
	var req struct {
		Model                      string `json:"model"`
		FingerprintEnabled         bool   `json:"fingerprint_enabled"`
		FingerprintIntervalMinutes int    `json:"fingerprint_interval_minutes"`
		UptimeEnabled              bool   `json:"uptime_enabled"`
		UptimeIntervalMinutes      int    `json:"uptime_interval_minutes"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || req.Model == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request"})
		return
	}
	if req.FingerprintIntervalMinutes < 1 {
		req.FingerprintIntervalMinutes = 360
	}
	if req.UptimeIntervalMinutes < 1 {
		req.UptimeIntervalMinutes = 30
	}

	cfg := ModelDetectConfig{
		FingerprintEnabled:         req.FingerprintEnabled,
		FingerprintIntervalMinutes: req.FingerprintIntervalMinutes,
		UptimeEnabled:              req.UptimeEnabled,
		UptimeIntervalMinutes:      req.UptimeIntervalMinutes,
	}
	val, err := common.Marshal(cfg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := model.UpdateOption(detectConfigKey(req.Model), string(val)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
