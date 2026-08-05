package setting

import (
	"fmt"
	"strconv"
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
)

const DefaultMaxTokenAutoGroups = 5

// autoGroups 自动分组列表。
//
// 配置热更新每个同步周期都会重建它，而分组选择在中继请求路径上读取它
// （service/channel_select.go、middleware/distributor.go 经 GetRequestAutoGroups 走到这里）。
// 先解析到本地切片、成功后再整体发布，避免读者看到清空后尚未填充的中间态。
var autoGroups atomic.Pointer[[]string]

var DefaultUseAutoGroup = false

var maxTokenAutoGroups atomic.Int64

func init() {
	defaults := []string{"default"}
	autoGroups.Store(&defaults)
	maxTokenAutoGroups.Store(DefaultMaxTokenAutoGroups)
}

func ContainsAutoGroup(group string) bool {
	for _, autoGroup := range GetAutoGroups() {
		if autoGroup == group {
			return true
		}
	}
	return false
}

func UpdateAutoGroupsByJsonString(jsonString string) error {
	groups := make([]string, 0)
	if err := common.Unmarshal([]byte(jsonString), &groups); err != nil {
		return err
	}
	autoGroups.Store(&groups)
	return nil
}

func AutoGroups2JsonString() string {
	jsonBytes, err := common.Marshal(GetAutoGroups())
	if err != nil {
		return "[]"
	}
	return string(jsonBytes)
}

// GetAutoGroups 返回当前自动分组列表。返回的切片不得被调用方修改。
func GetAutoGroups() []string {
	return *autoGroups.Load()
}

func GetMaxTokenAutoGroups() int {
	return int(maxTokenAutoGroups.Load())
}

func ValidateMaxTokenAutoGroups(value string) error {
	maxCount, err := strconv.Atoi(value)
	if err != nil || maxCount <= 0 {
		return fmt.Errorf("MaxTokenAutoGroups must be a positive integer")
	}
	return nil
}

func UpdateMaxTokenAutoGroups(value string) error {
	if err := ValidateMaxTokenAutoGroups(value); err != nil {
		return err
	}
	maxCount, _ := strconv.Atoi(value)
	maxTokenAutoGroups.Store(int64(maxCount))
	return nil
}
