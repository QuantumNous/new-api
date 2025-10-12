package content_filter

import (
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/core/registry"
)

func init() {
	// 从环境变量读取配置
	config := map[string]interface{}{
		"enabled":          os.Getenv("CONTENT_FILTER_ENABLED") == "true",
		"priority":         100,
		"filter_nsfw":      os.Getenv("CONTENT_FILTER_NSFW") != "false",
		"filter_political": os.Getenv("CONTENT_FILTER_POLITICAL") == "true",
	}
	
	// 读取敏感词列表
	if wordsEnv := os.Getenv("CONTENT_FILTER_WORDS"); wordsEnv != "" {
		words := strings.Split(wordsEnv, ",")
		config["sensitive_words"] = words
	}
	
	// 创建并注册Hook
	hook := NewContentFilterHook(config)
	
	if err := registry.RegisterHook(hook); err != nil {
		common.SysError("Failed to register content_filter hook: " + err.Error())
	} else {
		if hook.Enabled() {
			common.SysLog("Content filter hook registered and enabled")
		} else {
			common.SysLog("Content filter hook registered but disabled")
		}
	}
}

