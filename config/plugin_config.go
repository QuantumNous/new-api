package config

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/core/interfaces"
	"gopkg.in/yaml.v3"
)

// PluginConfig 插件配置结构
type PluginConfig struct {
	Channels    map[string]interfaces.ChannelConfig    `yaml:"channels"`
	Middlewares []interfaces.MiddlewareConfig          `yaml:"middlewares"`
	Hooks       HooksConfig                            `yaml:"hooks"`
}

// HooksConfig Hook配置
type HooksConfig struct {
	Relay []interfaces.HookConfig `yaml:"relay"`
}

var (
	// 全局配置实例
	globalPluginConfig *PluginConfig
)

// LoadPluginConfig 加载插件配置
func LoadPluginConfig(configPath string) (*PluginConfig, error) {
	// 如果没有指定配置文件路径，使用默认路径
	if configPath == "" {
		configPath = "config/plugins.yaml"
	}
	
	// 检查文件是否存在
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		common.SysLog(fmt.Sprintf("Plugin config file not found: %s, using default configuration", configPath))
		return getDefaultConfig(), nil
	}
	
	// 读取配置文件
	data, err := ioutil.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read plugin config: %w", err)
	}
	
	// 解析YAML
	var config PluginConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse plugin config: %w", err)
	}
	
	// 环境变量替换
	expandEnvVars(&config)
	
	common.SysLog(fmt.Sprintf("Loaded plugin config from: %s", configPath))
	
	return &config, nil
}

// getDefaultConfig 返回默认配置
func getDefaultConfig() *PluginConfig {
	return &PluginConfig{
		Channels:    make(map[string]interfaces.ChannelConfig),
		Middlewares: make([]interfaces.MiddlewareConfig, 0),
		Hooks: HooksConfig{
			Relay: make([]interfaces.HookConfig, 0),
		},
	}
}

// expandEnvVars 展开环境变量
func expandEnvVars(config *PluginConfig) {
	// 展开Hook配置中的环境变量
	for i := range config.Hooks.Relay {
		for key, value := range config.Hooks.Relay[i].Config {
			if strValue, ok := value.(string); ok {
				config.Hooks.Relay[i].Config[key] = os.ExpandEnv(strValue)
			}
		}
	}
	
	// 展开Middleware配置中的环境变量
	for i := range config.Middlewares {
		for key, value := range config.Middlewares[i].Config {
			if strValue, ok := value.(string); ok {
				config.Middlewares[i].Config[key] = os.ExpandEnv(strValue)
			}
		}
	}
}

// GetGlobalPluginConfig 获取全局配置
func GetGlobalPluginConfig() *PluginConfig {
	if globalPluginConfig == nil {
		configPath := os.Getenv("PLUGIN_CONFIG_PATH")
		if configPath == "" {
			configPath = "config/plugins.yaml"
		}
		
		config, err := LoadPluginConfig(configPath)
		if err != nil {
			common.SysError(fmt.Sprintf("Failed to load plugin config: %v", err))
			config = getDefaultConfig()
		}
		
		globalPluginConfig = config
	}
	
	return globalPluginConfig
}

// SavePluginConfig 保存插件配置
func SavePluginConfig(config *PluginConfig, configPath string) error {
	if configPath == "" {
		configPath = "config/plugins.yaml"
	}
	
	// 确保目录存在
	dir := filepath.Dir(configPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}
	
	// 序列化为YAML
	data, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}
	
	// 写入文件
	if err := ioutil.WriteFile(configPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}
	
	common.SysLog(fmt.Sprintf("Saved plugin config to: %s", configPath))
	
	return nil
}

// ReloadPluginConfig 重新加载配置
func ReloadPluginConfig() error {
	configPath := os.Getenv("PLUGIN_CONFIG_PATH")
	if configPath == "" {
		configPath = "config/plugins.yaml"
	}
	
	config, err := LoadPluginConfig(configPath)
	if err != nil {
		return err
	}
	
	globalPluginConfig = config
	common.SysLog("Plugin config reloaded")
	
	return nil
}

