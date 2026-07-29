package savings_setting

import (
	"fmt"
	"net/url"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

const OptionKey = "SavingsEstimateSetting"

type OfficialPrice struct {
	QuotaType            int      `json:"quota_type,omitempty"`
	ModelRatio           *float64 `json:"model_ratio,omitempty"`
	ModelPrice           *float64 `json:"model_price,omitempty"`
	CompletionRatio      *float64 `json:"completion_ratio,omitempty"`
	CacheRatio           *float64 `json:"cache_ratio,omitempty"`
	CreateCacheRatio     *float64 `json:"create_cache_ratio,omitempty"`
	CacheCreation5mRatio *float64 `json:"cache_creation_ratio_5m,omitempty"`
	CacheCreation1hRatio *float64 `json:"cache_creation_ratio_1h,omitempty"`
	ImageRatio           *float64 `json:"image_ratio,omitempty"`
	AudioRatio           *float64 `json:"audio_ratio,omitempty"`
	AudioCompletionRatio *float64 `json:"audio_completion_ratio,omitempty"`
	BillingMode          string   `json:"billing_mode,omitempty"`
	BillingExpr          string   `json:"billing_expr,omitempty"`
	Source               string   `json:"source,omitempty"`
	SourceURL            string   `json:"source_url,omitempty"`
	SourceUpdatedAt      int64    `json:"source_updated_at,omitempty"`
	PriceSnapshotAt      int64    `json:"price_snapshot_at,omitempty"`
	PriceFingerprint     string   `json:"price_fingerprint,omitempty"`
	OfficialConfirmed    bool     `json:"official_confirmed,omitempty"`
	ConfirmedAt          int64    `json:"confirmed_at,omitempty"`
	ConfirmedBy          string   `json:"confirmed_by,omitempty"`
}

type Setting struct {
	Enabled                       bool                     `json:"enabled"`
	ShowOnDashboard               bool                     `json:"show_on_dashboard"`
	ShowOnUsageLogs               bool                     `json:"show_on_usage_logs"`
	LocalPricingOfficialConfirmed bool                     `json:"local_pricing_official_confirmed"`
	RebuildLegacyLogs             bool                     `json:"rebuild_legacy_logs"`
	RequireOfficialConfirmation   bool                     `json:"require_official_confirmation"`
	OfficialPriceStaleDays        int                      `json:"official_price_stale_days"`
	MaxSummaryDays                int                      `json:"max_summary_days"`
	MaxSummaryLogRows             int                      `json:"max_summary_log_rows"`
	LifetimeEnabled               bool                     `json:"lifetime_enabled"`
	LifetimeBackfillBatchSize     int                      `json:"lifetime_backfill_batch_size"`
	LifetimeShowOnDashboard       bool                     `json:"lifetime_show_on_dashboard"`
	LifetimeShowOnWallet          bool                     `json:"lifetime_show_on_wallet"`
	UpdatedAt                     int64                    `json:"updated_at"`
	OfficialPrices                map[string]OfficialPrice `json:"official_prices,omitempty"`
}

const (
	defaultOfficialPriceStaleDays = 90
	defaultMaxSummaryDays         = 31
	defaultMaxSummaryLogRows      = 50000
	defaultLifetimeBatchSize      = 1000
	maxSummaryDaysLimit           = 31
	maxSummaryLogRowsLimit        = 50000
	minLifetimeBatchSize          = 500
	maxLifetimeBatchSize          = 5000
)

var (
	settingMu sync.RWMutex
	setting   = defaultSetting()
)

func defaultSetting() Setting {
	return Setting{
		Enabled:                       false,
		ShowOnDashboard:               true,
		ShowOnUsageLogs:               true,
		LocalPricingOfficialConfirmed: true,
		RebuildLegacyLogs:             true,
		RequireOfficialConfirmation:   true,
		OfficialPriceStaleDays:        defaultOfficialPriceStaleDays,
		MaxSummaryDays:                defaultMaxSummaryDays,
		MaxSummaryLogRows:             defaultMaxSummaryLogRows,
		LifetimeEnabled:               false,
		LifetimeBackfillBatchSize:     defaultLifetimeBatchSize,
		LifetimeShowOnDashboard:       true,
		LifetimeShowOnWallet:          false,
		OfficialPrices:                map[string]OfficialPrice{},
	}
}

func GetSetting() Setting {
	settingMu.RLock()
	defer settingMu.RUnlock()
	return copySetting(setting)
}

func IsEnabled() bool {
	settingMu.RLock()
	defer settingMu.RUnlock()
	return setting.Enabled
}

func ShowOnDashboard() bool {
	settingMu.RLock()
	defer settingMu.RUnlock()
	return setting.Enabled && setting.ShowOnDashboard
}

func ShowOnUsageLogs() bool {
	settingMu.RLock()
	defer settingMu.RUnlock()
	return setting.Enabled && setting.ShowOnUsageLogs
}

func MaxSummaryDays() int {
	settingMu.RLock()
	defer settingMu.RUnlock()
	if setting.MaxSummaryDays <= 0 || setting.MaxSummaryDays > maxSummaryDaysLimit {
		return defaultMaxSummaryDays
	}
	return setting.MaxSummaryDays
}

func MaxSummaryLogRows() int {
	settingMu.RLock()
	defer settingMu.RUnlock()
	if setting.MaxSummaryLogRows <= 0 || setting.MaxSummaryLogRows > maxSummaryLogRowsLimit {
		return defaultMaxSummaryLogRows
	}
	return setting.MaxSummaryLogRows
}

func OfficialPriceStaleDays() int {
	settingMu.RLock()
	defer settingMu.RUnlock()
	if setting.OfficialPriceStaleDays <= 0 {
		return defaultOfficialPriceStaleDays
	}
	return setting.OfficialPriceStaleDays
}

func LifetimeEnabled() bool {
	settingMu.RLock()
	defer settingMu.RUnlock()
	return setting.Enabled && setting.LifetimeEnabled
}

func LifetimeBackfillBatchSize() int {
	settingMu.RLock()
	defer settingMu.RUnlock()
	if setting.LifetimeBackfillBatchSize < minLifetimeBatchSize || setting.LifetimeBackfillBatchSize > maxLifetimeBatchSize {
		return defaultLifetimeBatchSize
	}
	return setting.LifetimeBackfillBatchSize
}

func ShowLifetimeOnDashboard() bool {
	settingMu.RLock()
	defer settingMu.RUnlock()
	return setting.Enabled && setting.LifetimeEnabled && setting.LifetimeShowOnDashboard
}

func ShowLifetimeOnWallet() bool {
	settingMu.RLock()
	defer settingMu.RUnlock()
	return setting.Enabled && setting.LifetimeEnabled && setting.LifetimeShowOnWallet
}

func GetOfficialPrice(model string) (OfficialPrice, bool) {
	settingMu.RLock()
	defer settingMu.RUnlock()
	price, ok := setting.OfficialPrices[model]
	return price, ok
}

func Setting2JSONString() string {
	settingMu.RLock()
	defer settingMu.RUnlock()
	jsonBytes, err := common.Marshal(setting)
	if err != nil {
		common.SysError("error marshalling savings estimate setting: " + err.Error())
		return "{}"
	}
	return string(jsonBytes)
}

func UpdateSettingByJSONString(jsonStr string) error {
	next := defaultSetting()
	if strings.TrimSpace(jsonStr) != "" {
		if err := common.UnmarshalJsonStr(jsonStr, &next); err != nil {
			return err
		}
	}
	if err := normalizeSetting(&next); err != nil {
		return err
	}

	settingMu.Lock()
	setting = next
	settingMu.Unlock()
	return nil
}

func ValidateSettingJSONString(jsonStr string) error {
	next := defaultSetting()
	if strings.TrimSpace(jsonStr) != "" {
		if err := common.UnmarshalJsonStr(jsonStr, &next); err != nil {
			return err
		}
	}
	return normalizeSetting(&next)
}

func copySetting(src Setting) Setting {
	dst := src
	dst.OfficialPrices = make(map[string]OfficialPrice, len(src.OfficialPrices))
	for model, price := range src.OfficialPrices {
		dst.OfficialPrices[model] = price
	}
	return dst
}

func normalizeSetting(s *Setting) error {
	if s.OfficialPriceStaleDays <= 0 {
		s.OfficialPriceStaleDays = defaultOfficialPriceStaleDays
	}
	if s.MaxSummaryDays <= 0 {
		s.MaxSummaryDays = defaultMaxSummaryDays
	}
	if s.MaxSummaryDays > maxSummaryDaysLimit {
		return fmt.Errorf("max_summary_days must not exceed %d", maxSummaryDaysLimit)
	}
	if s.MaxSummaryLogRows <= 0 {
		s.MaxSummaryLogRows = defaultMaxSummaryLogRows
	}
	if s.MaxSummaryLogRows > maxSummaryLogRowsLimit {
		return fmt.Errorf("max_summary_log_rows must not exceed %d", maxSummaryLogRowsLimit)
	}
	if s.LifetimeBackfillBatchSize <= 0 {
		s.LifetimeBackfillBatchSize = defaultLifetimeBatchSize
	}
	if s.LifetimeBackfillBatchSize < minLifetimeBatchSize || s.LifetimeBackfillBatchSize > maxLifetimeBatchSize {
		return fmt.Errorf("lifetime_backfill_batch_size must be between %d and %d", minLifetimeBatchSize, maxLifetimeBatchSize)
	}
	if s.OfficialPrices == nil {
		s.OfficialPrices = map[string]OfficialPrice{}
		return nil
	}
	normalizedPrices := make(map[string]OfficialPrice, len(s.OfficialPrices))
	for rawModel, price := range s.OfficialPrices {
		model := strings.TrimSpace(rawModel)
		if model == "" {
			continue
		}
		if _, exists := normalizedPrices[model]; exists {
			return fmt.Errorf("duplicate official price model after normalization: %q", model)
		}
		price.SourceURL = publicSourceURL(price.SourceURL)
		price.Source = strings.TrimSpace(price.Source)
		price.BillingMode = strings.TrimSpace(price.BillingMode)
		normalizedPrices[model] = price
	}
	s.OfficialPrices = normalizedPrices
	return nil
}

func publicSourceURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return ""
	}
	u.User = nil
	u.Fragment = ""
	query := u.Query()
	for key := range query {
		lower := strings.ToLower(key)
		if strings.Contains(lower, "token") ||
			strings.Contains(lower, "key") ||
			strings.Contains(lower, "secret") ||
			strings.Contains(lower, "sign") ||
			strings.Contains(lower, "signature") {
			query.Del(key)
		}
	}
	u.RawQuery = query.Encode()
	return u.String()
}
