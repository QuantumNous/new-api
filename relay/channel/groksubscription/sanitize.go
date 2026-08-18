package groksubscription

import (
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// compactStrippedKeys 是 compact 请求发往上游前必须从顶层删除的工具配置键（设计 §9）。
var compactStrippedKeys = []string{
	"tools",
	"tool_choice",
	"parallel_tool_calls",
	"max_tool_calls",
	"tool_resources",
}

// SanitizeCompactRequest 删除顶层工具配置，保证不发往上游。
// 幂等：param override 可能重新引入这些键，故 override 之后必须再调一次仍正确。
func SanitizeCompactRequest(jsonData []byte) ([]byte, error) {
	var err error
	for _, key := range compactStrippedKeys {
		jsonData, err = sjson.DeleteBytes(jsonData, key)
		if err != nil {
			return nil, err
		}
	}
	return jsonData, nil
}

// hasTopLevelKey 判断 jsonData 顶层是否存在 key。key 为简单键名（非路径）。
func hasTopLevelKey(jsonData []byte, key string) bool {
	return gjson.GetBytes(jsonData, gjson.Escape(key)).Exists()
}
