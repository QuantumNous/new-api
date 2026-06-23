package common

import (
	"encoding/json"
	"sort"
	"sync"
)

var topupGroupRatio = map[string]float64{
	"default": 1,
	"vip":     1,
	"svip":    1,
}
var topupGroupRatioMutex sync.RWMutex

func TopupGroupRatio2JSONString() string {
	topupGroupRatioMutex.RLock()
	defer topupGroupRatioMutex.RUnlock()
	jsonBytes, err := json.Marshal(topupGroupRatio)
	if err != nil {
		SysError("error marshalling topup group ratio: " + err.Error())
	}
	return string(jsonBytes)
}

func UpdateTopupGroupRatioByJSONString(jsonStr string) error {
	topupGroupRatioMutex.Lock()
	defer topupGroupRatioMutex.Unlock()
	topupGroupRatio = make(map[string]float64)
	return json.Unmarshal([]byte(jsonStr), &topupGroupRatio)
}

func GetTopupGroupRatio(name string) float64 {
	topupGroupRatioMutex.RLock()
	defer topupGroupRatioMutex.RUnlock()
	ratio, ok := topupGroupRatio[name]
	if !ok {
		SysError("topup group ratio not found: " + name)
		return 1
	}
	return ratio
}

// GetTopupGroupRatioKeys 返回所有充值分组比例中配置的分组名称。
// 用户身份分组(user.Group)的合法取值以充值分组比例为权威来源。
func GetTopupGroupRatioKeys() []string {
	topupGroupRatioMutex.RLock()
	defer topupGroupRatioMutex.RUnlock()
	keys := make([]string, 0, len(topupGroupRatio))
	for name := range topupGroupRatio {
		keys = append(keys, name)
	}
	sort.Strings(keys)
	return keys
}
