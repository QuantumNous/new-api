package operation_setting

import (
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/setting/config"
)

// StatusPageGroupConfig 状态页展示的单个分组配置
type StatusPageGroupConfig struct {
	Group        string `json:"group"`
	Enabled      bool   `json:"enabled"`
	DisplayName  string `json:"display_name"`
	Provider     string `json:"provider"`
	DisplayModel string `json:"display_model"`
}

// StatusPageSetting 状态页整体配置：刷新间隔、降级阈值、展示分组
type StatusPageSetting struct {
	// Enabled 状态页整体开关，前端顶部导航「服务状态」入口据此显示
	Enabled bool `json:"enabled"`
	// RefreshSeconds 前端自动轮询秒数
	RefreshSeconds int `json:"refresh_seconds"`
	// DegradedLatencyMs 当业务延迟 >= 该阈值时判为 degraded
	DegradedLatencyMs int `json:"degraded_latency_ms"`
	// EnablePingProbe 是否在渠道测试前对 BaseURL 做一次短超时 HEAD 探测
	EnablePingProbe bool `json:"enable_ping_probe"`
	// PingProbeTimeoutMs HEAD 探测超时（毫秒），默认 3000
	PingProbeTimeoutMs int `json:"ping_probe_timeout_ms"`
	// Groups 需要在状态页展示的分组列表（顺序即展示顺序）
	Groups []StatusPageGroupConfig `json:"groups"`
}

const (
	StatusPageDefaultRefreshSeconds     = 60
	StatusPageDefaultDegradedLatencyMs  = 5000
	StatusPageDefaultPingProbeTimeoutMs = 3000
	StatusPageMinRefreshSeconds         = 10
	StatusPageMaxRefreshSeconds         = 600
)

var (
	statusPageSetting = StatusPageSetting{
		Enabled:            false,
		RefreshSeconds:     StatusPageDefaultRefreshSeconds,
		DegradedLatencyMs:  StatusPageDefaultDegradedLatencyMs,
		EnablePingProbe:    true,
		PingProbeTimeoutMs: StatusPageDefaultPingProbeTimeoutMs,
		Groups:             []StatusPageGroupConfig{},
	}
	statusPageSettingMutex sync.RWMutex
)

func init() {
	config.GlobalConfig.Register("status_page", &statusPageSetting)
}

// GetStatusPageSetting 返回配置的深拷贝，避免调用方直接修改并绕过锁
func GetStatusPageSetting() StatusPageSetting {
	statusPageSettingMutex.RLock()
	defer statusPageSettingMutex.RUnlock()

	groups := make([]StatusPageGroupConfig, len(statusPageSetting.Groups))
	copy(groups, statusPageSetting.Groups)
	return StatusPageSetting{
		Enabled:            statusPageSetting.Enabled,
		RefreshSeconds:     statusPageSetting.RefreshSeconds,
		DegradedLatencyMs:  statusPageSetting.DegradedLatencyMs,
		EnablePingProbe:    statusPageSetting.EnablePingProbe,
		PingProbeTimeoutMs: statusPageSetting.PingProbeTimeoutMs,
		Groups:             groups,
	}
}

// SetStatusPageSetting 覆盖内存中的状态页配置，写库由调用方通过 option 机制完成
func SetStatusPageSetting(next StatusPageSetting) {
	statusPageSettingMutex.Lock()
	defer statusPageSettingMutex.Unlock()

	statusPageSetting.Enabled = next.Enabled
	statusPageSetting.RefreshSeconds = normalizeRefreshSeconds(next.RefreshSeconds)
	statusPageSetting.DegradedLatencyMs = normalizeDegradedLatency(next.DegradedLatencyMs)
	statusPageSetting.EnablePingProbe = next.EnablePingProbe
	statusPageSetting.PingProbeTimeoutMs = normalizePingTimeout(next.PingProbeTimeoutMs)
	statusPageSetting.Groups = sanitizeGroups(next.Groups)
}

// IsStatusPageGroupEnabled 快速判断某个 group 是否被启用（供 probe hook 决定是否记录）
func IsStatusPageGroupEnabled(group string) bool {
	group = strings.TrimSpace(group)
	if group == "" {
		return false
	}
	statusPageSettingMutex.RLock()
	defer statusPageSettingMutex.RUnlock()
	for _, g := range statusPageSetting.Groups {
		if g.Enabled && strings.EqualFold(strings.TrimSpace(g.Group), group) {
			return true
		}
	}
	return false
}

// IsAnyStatusPageGroupEnabled 是否存在至少一个启用的分组
func IsAnyStatusPageGroupEnabled() bool {
	statusPageSettingMutex.RLock()
	defer statusPageSettingMutex.RUnlock()
	for _, g := range statusPageSetting.Groups {
		if g.Enabled {
			return true
		}
	}
	return false
}

func normalizeRefreshSeconds(v int) int {
	if v <= 0 {
		return StatusPageDefaultRefreshSeconds
	}
	if v < StatusPageMinRefreshSeconds {
		return StatusPageMinRefreshSeconds
	}
	if v > StatusPageMaxRefreshSeconds {
		return StatusPageMaxRefreshSeconds
	}
	return v
}

func normalizeDegradedLatency(v int) int {
	if v <= 0 {
		return StatusPageDefaultDegradedLatencyMs
	}
	return v
}

func normalizePingTimeout(v int) int {
	if v <= 0 {
		return StatusPageDefaultPingProbeTimeoutMs
	}
	if v < 500 {
		return 500
	}
	if v > 15000 {
		return 15000
	}
	return v
}

func sanitizeGroups(groups []StatusPageGroupConfig) []StatusPageGroupConfig {
	if len(groups) == 0 {
		return []StatusPageGroupConfig{}
	}
	seen := make(map[string]struct{}, len(groups))
	result := make([]StatusPageGroupConfig, 0, len(groups))
	for _, g := range groups {
		name := strings.TrimSpace(g.Group)
		if name == "" {
			continue
		}
		key := strings.ToLower(name)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, StatusPageGroupConfig{
			Group:        name,
			Enabled:      g.Enabled,
			DisplayName:  strings.TrimSpace(g.DisplayName),
			Provider:     strings.TrimSpace(g.Provider),
			DisplayModel: strings.TrimSpace(g.DisplayModel),
		})
	}
	return result
}
