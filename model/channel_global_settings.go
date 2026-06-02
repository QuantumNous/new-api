package model

import (
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// ChannelGlobalSetting is a key-value pair with global scope.
// It overrides per-channel settings when the channel has the corresponding
// `use_global_*` flag set in its settings JSON.
//
// Currently supported keys:
//   - strip_cjk (bool) — global override for CJK character stripping in
//     model responses. When this is true, every channel with
//     `use_global_strip_cjk: true` in its settings will strip CJK,
//     regardless of its own strip_cjk value.
type ChannelGlobalSetting struct {
	Key       string `json:"key" gorm:"primaryKey;type:varchar(64)"`
	Value     string `json:"value" gorm:"type:text"`
	UpdatedAt int64  `json:"updated_at" gorm:"bigint"`
}

func (ChannelGlobalSetting) TableName() string {
	return "channel_global_settings"
}

var (
	globalSettingsLock   sync.RWMutex
	globalSettingsCache  = make(map[string]string)
	globalSettingsLoaded time.Time
)

// LoadChannelGlobalSettings refreshes the in-memory cache from the DB.
// Call at startup and after any write. Cheap to call — single SELECT.
func LoadChannelGlobalSettings() error {
	var rows []ChannelGlobalSetting
	if err := DB.Find(&rows).Error; err != nil {
		return err
	}
	globalSettingsLock.Lock()
	defer globalSettingsLock.Unlock()
	globalSettingsCache = make(map[string]string, len(rows))
	for _, r := range rows {
		globalSettingsCache[r.Key] = r.Value
	}
	globalSettingsLoaded = time.Now()
	return nil
}

// GetChannelGlobalSetting returns the cached value for a key, or empty string if absent.
// Refreshes the cache if older than 5 minutes (defensive against missed writes).
func GetChannelGlobalSetting(key string) string {
	globalSettingsLock.RLock()
	if time.Since(globalSettingsLoaded) > 5*time.Minute {
		globalSettingsLock.RUnlock()
		_ = LoadChannelGlobalSettings()
		globalSettingsLock.RLock()
	}
	val := globalSettingsCache[key]
	globalSettingsLock.RUnlock()
	return val
}

// SetChannelGlobalSetting upserts a key and refreshes the cache.
func SetChannelGlobalSetting(key, value string) error {
	now := common.GetTimestamp()
	row := ChannelGlobalSetting{
		Key:       key,
		Value:     value,
		UpdatedAt: now,
	}
	if err := DB.Save(&row).Error; err != nil {
		return err
	}
	globalSettingsLock.Lock()
	globalSettingsCache[key] = value
	globalSettingsLoaded = time.Now()
	globalSettingsLock.Unlock()
	return nil
}

// GlobalStripCJKEnabled returns true if the global strip_cjk key is set to "true".
func GlobalStripCJKEnabled() bool {
	return GetChannelGlobalSetting("strip_cjk") == "true"
}
