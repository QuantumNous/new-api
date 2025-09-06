package common

import (
	"encoding/json"
	"sync"
)

var TopupGroupRatio = map[string]float64{
	"default": 1,
	"vip":     1,
	"svip":    1,
}

var topupGroupRatioMutex sync.RWMutex

func GetTopupGroupRatioCopy() map[string]float64 {
	topupGroupRatioMutex.RLock()
	defer topupGroupRatioMutex.RUnlock()
	cp := make(map[string]float64, len(TopupGroupRatio))
	for k, v := range TopupGroupRatio {
		cp[k] = v
	}
	return cp
}

func TopupGroupRatio2JSONString() string {
	topupGroupRatioMutex.RLock()
	defer topupGroupRatioMutex.RUnlock()
	jsonBytes, err := json.Marshal(TopupGroupRatio)
	if err != nil {
		SysError("error marshalling model ratio: " + err.Error())
	}
	return string(jsonBytes)
}

func UpdateTopupGroupRatioByJSONString(jsonStr string) error {
	var tmp map[string]float64
	if err := json.Unmarshal([]byte(jsonStr), &tmp); err != nil {
		return err
	}
	topupGroupRatioMutex.Lock()
	TopupGroupRatio = tmp
	topupGroupRatioMutex.Unlock()
	return nil
}

func GetTopupGroupRatio(name string) float64 {
	topupGroupRatioMutex.RLock()
	ratio, ok := TopupGroupRatio[name]
	topupGroupRatioMutex.RUnlock()
	if !ok {
		SysError("topup group ratio not found: " + name)
		return 1
	}
	return ratio
}
