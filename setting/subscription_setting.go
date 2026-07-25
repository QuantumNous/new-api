package setting

import (
	"fmt"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// FreePlanOnSignupEnabled 控制新用户注册后是否自动发放 Free 免费套餐。
// 默认关闭：不配置时行为与现网一致；纯套餐模式上线时在系统设置打开。
var FreePlanOnSignupEnabled = false

// SubscriptionModelWeights 订阅池模型权重表（全局一张表，所有套餐共用）。
// key = 模型名前缀（最长前缀优先），value = 权重 w（>0）。
// 订阅池/窗口扣量 = list 等值额度 × w；未命中任何前缀时权重为 1.0。
// 空表 = 全部按 1.0 计量（权重功能关闭）。
var subscriptionModelWeights = map[string]float64{}
var subscriptionModelWeightsMutex sync.RWMutex

const defaultSubscriptionModelWeight = 1.0

func SubscriptionModelWeights2JSONString() string {
	subscriptionModelWeightsMutex.RLock()
	defer subscriptionModelWeightsMutex.RUnlock()

	jsonBytes, err := common.Marshal(subscriptionModelWeights)
	if err != nil {
		common.SysLog("error marshalling subscription model weights: " + err.Error())
		return "{}"
	}
	return string(jsonBytes)
}

func UpdateSubscriptionModelWeightsByJSONString(jsonStr string) error {
	next := make(map[string]float64)
	if err := common.UnmarshalJsonStr(jsonStr, &next); err != nil {
		return err
	}
	subscriptionModelWeightsMutex.Lock()
	defer subscriptionModelWeightsMutex.Unlock()
	subscriptionModelWeights = next
	return nil
}

func CheckSubscriptionModelWeights(jsonStr string) error {
	check := make(map[string]float64)
	if err := common.UnmarshalJsonStr(jsonStr, &check); err != nil {
		return err
	}
	for prefix, weight := range check {
		if strings.TrimSpace(prefix) == "" {
			return fmt.Errorf("subscription model weight prefix cannot be empty")
		}
		if weight <= 0 || weight > 100 {
			return fmt.Errorf("subscription model weight for %q must be in (0, 100], got %v", prefix, weight)
		}
	}
	return nil
}

// GetSubscriptionModelWeight 返回模型的订阅池扣量权重（最长前缀匹配，缺省 1.0）。
func GetSubscriptionModelWeight(modelName string) float64 {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return defaultSubscriptionModelWeight
	}
	subscriptionModelWeightsMutex.RLock()
	defer subscriptionModelWeightsMutex.RUnlock()

	weight := defaultSubscriptionModelWeight
	matchedLen := -1
	for prefix, w := range subscriptionModelWeights {
		if strings.HasPrefix(modelName, prefix) && len(prefix) > matchedLen {
			matchedLen = len(prefix)
			weight = w
		}
	}
	return weight
}
