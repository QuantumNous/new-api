package web_search

import (
	"os"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/core/registry"
)

func init() {
	// 从环境变量读取配置
	config := map[string]interface{}{
		"enabled":  os.Getenv("WEB_SEARCH_ENABLED") == "true",
		"api_key":  os.Getenv("WEB_SEARCH_API_KEY"),
		"provider": getEnvOrDefault("WEB_SEARCH_PROVIDER", "google"),
		"priority": 50,
	}
	
	// 创建并注册Hook
	hook := NewWebSearchHook(config)
	
	if err := registry.RegisterHook(hook); err != nil {
		common.SysError("Failed to register web_search hook: " + err.Error())
	} else {
		if hook.Enabled() {
			common.SysLog("Web search hook registered and enabled")
		} else {
			common.SysLog("Web search hook registered but disabled (missing API key or not enabled)")
		}
	}
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

