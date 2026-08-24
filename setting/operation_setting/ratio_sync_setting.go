package operation_setting

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

const (
	DefaultRatioSyncIntervalMinutes  = 1440
	MinRatioSyncIntervalMinutes      = 5
	DefaultRatioSyncThresholdPercent = 100
)

// RatioSyncSetting configures the scheduled upstream pricing sync task
// (system task type "pricing_sync"). It automates the manual
// 模型定价 -> 上游价格同步 flow: fetch pricing from the configured upstreams and
// apply the accepted differences to the global ratio options.
type RatioSyncSetting struct {
	Enabled         bool `json:"enabled"`
	IntervalMinutes int  `json:"interval_minutes"`
	// Upstreams is a JSON array of RatioSyncUpstream. Order matters: when
	// several upstreams disagree on a value, the first one providing a
	// concrete value wins.
	Upstreams string `json:"upstreams"`
	// SyncFields is a JSON array of pricing field names (model_ratio,
	// completion_ratio, ...). Empty means all numeric pricing fields.
	// billing_mode/billing_expr are never synced automatically.
	SyncFields string `json:"sync_fields"`
	// ModelAllowList / ModelBlockList are newline- or comma-separated exact
	// model names. An empty allow list means all models.
	ModelAllowList string `json:"model_allow_list"`
	ModelBlockList string `json:"model_block_list"`
	// IncreaseThresholdPercent skips applying a value that raises an existing
	// local value by more than this percentage (0 blocks any increase);
	// decreases are always applied.
	IncreaseThresholdPercent float64 `json:"increase_threshold_percent"`
	// AddNewModels controls whether models absent from every local pricing
	// map may be added by the sync.
	AddNewModels bool `json:"add_new_models"`
}

var ratioSyncSetting = RatioSyncSetting{
	Enabled:                  false,
	IntervalMinutes:          DefaultRatioSyncIntervalMinutes,
	IncreaseThresholdPercent: DefaultRatioSyncThresholdPercent,
	AddNewModels:             false,
}

func init() {
	config.GlobalConfig.Register("ratio_sync_setting", &ratioSyncSetting)
}

func GetRatioSyncSetting() *RatioSyncSetting {
	return &ratioSyncSetting
}

func (s *RatioSyncSetting) SyncInterval() time.Duration {
	minutes := s.IntervalMinutes
	if minutes <= 0 {
		minutes = DefaultRatioSyncIntervalMinutes
	}
	if minutes < MinRatioSyncIntervalMinutes {
		minutes = MinRatioSyncIntervalMinutes
	}
	return time.Duration(minutes) * time.Minute
}

// RatioSyncUpstream is one entry of the ratio_sync_setting.upstreams JSON
// array. ID is a channel id or one of the preset ids used by the manual
// upstream ratio sync page (-100 official preset, -101 models.dev). Endpoint
// overrides the fetch path for that upstream; empty means the default for
// that upstream kind.
type RatioSyncUpstream struct {
	ID       int    `json:"id"`
	Endpoint string `json:"endpoint,omitempty"`
}

func ParseRatioSyncUpstreams(jsonStr string) ([]RatioSyncUpstream, error) {
	trimmed := strings.TrimSpace(jsonStr)
	if trimmed == "" {
		return nil, nil
	}
	var upstreams []RatioSyncUpstream
	if err := common.UnmarshalJsonStr(trimmed, &upstreams); err != nil {
		return nil, fmt.Errorf("invalid ratio sync upstreams config: %w", err)
	}
	for _, u := range upstreams {
		if u.ID == 0 {
			return nil, fmt.Errorf("invalid ratio sync upstream: channel id must not be 0")
		}
	}
	return upstreams, nil
}
