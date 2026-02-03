package setting

import (
	"encoding/json"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// GroupLimitEnabled 是否启用用户组限制功能
var GroupLimitEnabled = false

// GroupLimitConfig 用户组限制配置
type GroupLimitConfig struct {
	Concurrency int   `json:"concurrency"` // 并发数限制，0 表示不限制
	RPM         int   `json:"rpm"`         // 每分钟请求数限制，0 表示不限制
	RPD         int   `json:"rpd"`         // 每日请求数限制，0 表示不限制
	TPM         int64 `json:"tpm"`         // 每分钟令牌数限制，0 表示不限制
	TPD         int64 `json:"tpd"`         // 每日令牌数限制，0 表示不限制
}

// DefaultGroupLimitConfig 默认配置（不限制）
var DefaultGroupLimitConfig = GroupLimitConfig{
	Concurrency: 0,
	RPM:         0,
	RPD:         0,
	TPM:         0,
	TPD:         0,
}

// groupLimitConfigs 存储各用户组的限制配置
// key: 用户组名称, value: 限制配置
var groupLimitConfigs = map[string]GroupLimitConfig{}
var groupLimitConfigsMutex sync.RWMutex

// GetGroupLimitConfig 获取指定用户组的限制配置
// 如果用户组不存在配置，返回默认配置（不限制）
func GetGroupLimitConfig(group string) GroupLimitConfig {
	groupLimitConfigsMutex.RLock()
	defer groupLimitConfigsMutex.RUnlock()

	if config, ok := groupLimitConfigs[group]; ok {
		return config
	}
	return DefaultGroupLimitConfig
}

// SetGroupLimitConfig 设置指定用户组的限制配置
func SetGroupLimitConfig(group string, config GroupLimitConfig) {
	groupLimitConfigsMutex.Lock()
	defer groupLimitConfigsMutex.Unlock()

	groupLimitConfigs[group] = config
}

// GetAllGroupLimitConfigs 获取所有用户组的限制配置
func GetAllGroupLimitConfigs() map[string]GroupLimitConfig {
	groupLimitConfigsMutex.RLock()
	defer groupLimitConfigsMutex.RUnlock()

	result := make(map[string]GroupLimitConfig)
	for k, v := range groupLimitConfigs {
		result[k] = v
	}
	return result
}

// GroupLimitConfigs2JSONString 将配置转换为 JSON 字符串
func GroupLimitConfigs2JSONString() string {
	groupLimitConfigsMutex.RLock()
	defer groupLimitConfigsMutex.RUnlock()

	jsonBytes, err := json.Marshal(groupLimitConfigs)
	if err != nil {
		common.SysLog("error marshalling group limit configs: " + err.Error())
		return "{}"
	}
	return string(jsonBytes)
}

// UpdateGroupLimitConfigsByJSONString 从 JSON 字符串更新配置
func UpdateGroupLimitConfigsByJSONString(jsonStr string) error {
	groupLimitConfigsMutex.Lock()
	defer groupLimitConfigsMutex.Unlock()

	newConfigs := make(map[string]GroupLimitConfig)
	err := json.Unmarshal([]byte(jsonStr), &newConfigs)
	if err != nil {
		return err
	}
	groupLimitConfigs = newConfigs
	return nil
}

// ValidateGroupLimitConfigsJSON 验证 JSON 配置是否有效
func ValidateGroupLimitConfigsJSON(jsonStr string) error {
	var configs map[string]GroupLimitConfig
	return json.Unmarshal([]byte(jsonStr), &configs)
}
