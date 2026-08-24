package perf_metrics_setting

import (
	"sync"

	"github.com/QuantumNous/new-api/setting/config"
)

type PerfMetricsSetting struct {
	Enabled       bool   `json:"enabled"`
	FlushInterval int    `json:"flush_interval"`
	BucketTime    string `json:"bucket_time"`
	RetentionDays int    `json:"retention_days"`
}

var perfMetricsSetting = PerfMetricsSetting{
	Enabled:       true,
	FlushInterval: 5,
	BucketTime:    "hour",
	RetentionDays: 0,
}

var perfMetricsSettingMu sync.RWMutex

func init() {
	config.GlobalConfig.Register("perf_metrics_setting", &perfMetricsSetting)
	config.GlobalConfig.RegisterUpdateLock("perf_metrics_setting", &perfMetricsSettingMu)
}

func GetSetting() PerfMetricsSetting {
	perfMetricsSettingMu.RLock()
	defer perfMetricsSettingMu.RUnlock()
	return perfMetricsSetting
}

func GetBucketSeconds() int64 {
	perfMetricsSettingMu.RLock()
	defer perfMetricsSettingMu.RUnlock()
	switch perfMetricsSetting.BucketTime {
	case "minute":
		return 60
	case "5min":
		return 300
	case "hour":
		return 3600
	default:
		return 3600
	}
}

func GetFlushIntervalMinutes() int {
	perfMetricsSettingMu.RLock()
	defer perfMetricsSettingMu.RUnlock()
	if perfMetricsSetting.FlushInterval < 1 {
		return 1
	}
	return perfMetricsSetting.FlushInterval
}
