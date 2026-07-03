package controller

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// mediaStoreStatsResponse admin 后台整体用量视图返回结构（设计 §12.6）。
type mediaStoreStatsResponse struct {
	Enabled        bool                   `json:"enabled"`
	Bucket         string                 `json:"bucket"`
	SnapshotAt     int64                  `json:"snapshot_at"`
	TotalBytes     int64                  `json:"total_bytes"`
	TotalBytesH    string                 `json:"total_bytes_h"`
	TotalObjects   int64                  `json:"total_objects"`
	Growth24hBytes int64                  `json:"growth_24h_bytes"`
	Growth24hH     string                 `json:"growth_24h_h"`
	AlertLevel     string                 `json:"alert_level"`
	Thresholds     map[string]float64     `json:"thresholds"`
	Trend7d        []mediaStoreTrendPoint `json:"trend_7d"`
	LastAlertAt    int64                  `json:"last_alert_at"`
	LastAlertLevel string                 `json:"last_alert_level"`
}

type mediaStoreTrendPoint struct {
	At      int64 `json:"at"`
	Bytes   int64 `json:"bytes"`
	Objects int64 `json:"objects"`
}

// GetMediaStoreStats 返回最新快照 + 7 天趋势 + 阈值 + 最近告警（root 权限）。
func GetMediaStoreStats(c *gin.Context) {
	s := system_setting.GetMediaStorageSettings()
	resp := mediaStoreStatsResponse{
		Enabled: s.Enabled,
		Bucket:  s.Bucket,
		Thresholds: map[string]float64{
			"warn":     s.BucketWarnThresholdTB,
			"critical": s.BucketCriticalThresholdTB,
		},
		Trend7d: []mediaStoreTrendPoint{},
	}

	latest, err := model.GetLatestMediaStorageStats()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if latest != nil {
		resp.SnapshotAt = latest.SnapshotAt
		resp.TotalBytes = latest.TotalBytes
		resp.TotalBytesH = service.HumanizeBytes(latest.TotalBytes)
		resp.TotalObjects = latest.TotalObjects
		resp.Growth24hBytes = latest.Growth24hBytes
		resp.Growth24hH = service.HumanizeBytes(latest.Growth24hBytes)
		resp.AlertLevel = latest.AlertLevel
	}

	sevenDaysAgo := time.Now().Unix() - 7*24*3600
	trend, err := model.GetMediaStorageStatsSince(sevenDaysAgo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	for _, t := range trend {
		resp.Trend7d = append(resp.Trend7d, mediaStoreTrendPoint{
			At:      t.SnapshotAt,
			Bytes:   t.TotalBytes,
			Objects: t.TotalObjects,
		})
	}

	// 最近一次非 ok 告警（warn 或 critical 取较新的一条）。
	if last := latestNonOKAlert(); last != nil {
		resp.LastAlertAt = last.SnapshotAt
		resp.LastAlertLevel = last.AlertLevel
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": resp})
}

// RefreshMediaStoreStats 立即采集一次桶用量快照（root 权限，不依赖 cron 周期）。
func RefreshMediaStoreStats(c *gin.Context) {
	if !system_setting.GetMediaStorageSettings().Enabled {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "媒体存储未启用"})
		return
	}
	stat, err := service.RunMediaStorageSnapshot(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "刷新快照失败：" + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": stat})
}

// latestNonOKAlert 取 warn / critical 中较新的一条告警快照。
func latestNonOKAlert() *model.MediaStorageStats {
	warn, _ := model.GetLatestMediaStorageAlert("warn")
	crit, _ := model.GetLatestMediaStorageAlert("critical")
	switch {
	case warn == nil:
		return crit
	case crit == nil:
		return warn
	case crit.SnapshotAt >= warn.SnapshotAt:
		return crit
	default:
		return warn
	}
}
