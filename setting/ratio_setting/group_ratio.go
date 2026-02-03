package ratio_setting

import (
	"encoding/json"
	"errors"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/types"
)

var groupRatio = map[string]float64{
	"default": 1,
	"vip":     1,
	"svip":    1,
}

var groupRatioMutex sync.RWMutex

// 分组描述，与分组倍率关联
var groupDescription = map[string]string{
	"default": "默认分组",
	"vip":     "VIP分组",
	"svip":    "SVIP分组",
}

var groupDescriptionMutex sync.RWMutex

var (
	GroupGroupRatio = map[string]map[string]float64{
		"vip": {
			"edit_this": 0.9,
		},
	}
	groupGroupRatioMutex sync.RWMutex
)

var defaultGroupSpecialUsableGroup = map[string]map[string]string{
	"vip": {
		"append_1":   "vip_special_group_1",
		"-:remove_1": "vip_removed_group_1",
	},
}

type GroupRatioSetting struct {
	GroupRatio              map[string]float64                      `json:"group_ratio"`
	GroupGroupRatio         map[string]map[string]float64           `json:"group_group_ratio"`
	GroupSpecialUsableGroup *types.RWMap[string, map[string]string] `json:"group_special_usable_group"`
}

var groupRatioSetting GroupRatioSetting

func init() {
	groupSpecialUsableGroup := types.NewRWMap[string, map[string]string]()
	groupSpecialUsableGroup.AddAll(defaultGroupSpecialUsableGroup)

	groupRatioSetting = GroupRatioSetting{
		GroupSpecialUsableGroup: groupSpecialUsableGroup,
		GroupRatio:              groupRatio,
		GroupGroupRatio:         GroupGroupRatio,
	}

	config.GlobalConfig.Register("group_ratio_setting", &groupRatioSetting)
}

func GetGroupRatioSetting() *GroupRatioSetting {
	if groupRatioSetting.GroupSpecialUsableGroup == nil {
		groupRatioSetting.GroupSpecialUsableGroup = types.NewRWMap[string, map[string]string]()
		groupRatioSetting.GroupSpecialUsableGroup.AddAll(defaultGroupSpecialUsableGroup)
	}
	return &groupRatioSetting
}

func GetGroupRatioCopy() map[string]float64 {
	groupRatioMutex.RLock()
	defer groupRatioMutex.RUnlock()

	groupRatioCopy := make(map[string]float64)
	for k, v := range groupRatio {
		groupRatioCopy[k] = v
	}
	return groupRatioCopy
}

func ContainsGroupRatio(name string) bool {
	groupRatioMutex.RLock()
	defer groupRatioMutex.RUnlock()

	_, ok := groupRatio[name]
	return ok
}

func GroupRatio2JSONString() string {
	groupRatioMutex.RLock()
	defer groupRatioMutex.RUnlock()

	jsonBytes, err := json.Marshal(groupRatio)
	if err != nil {
		common.SysLog("error marshalling model ratio: " + err.Error())
	}
	return string(jsonBytes)
}

func UpdateGroupRatioByJSONString(jsonStr string) error {
	groupRatioMutex.Lock()
	defer groupRatioMutex.Unlock()

	groupRatio = make(map[string]float64)
	return json.Unmarshal([]byte(jsonStr), &groupRatio)
}

func GetGroupRatio(name string) float64 {
	groupRatioMutex.RLock()
	defer groupRatioMutex.RUnlock()

	ratio, ok := groupRatio[name]
	if !ok {
		common.SysLog("group ratio not found: " + name)
		return 1
	}
	return ratio
}

// GetGroupDescription 获取分组描述
func GetGroupDescription(name string) string {
	groupDescriptionMutex.RLock()
	defer groupDescriptionMutex.RUnlock()

	desc, ok := groupDescription[name]
	if !ok {
		return name // 如果没有描述，返回分组名
	}
	return desc
}

// GetGroupDescriptionCopy 获取分组描述的副本
func GetGroupDescriptionCopy() map[string]string {
	groupDescriptionMutex.RLock()
	defer groupDescriptionMutex.RUnlock()

	descCopy := make(map[string]string)
	for k, v := range groupDescription {
		descCopy[k] = v
	}
	return descCopy
}

// GroupDescription2JSONString 将分组描述转换为JSON字符串
func GroupDescription2JSONString() string {
	groupDescriptionMutex.RLock()
	defer groupDescriptionMutex.RUnlock()

	jsonBytes, err := json.Marshal(groupDescription)
	if err != nil {
		common.SysLog("error marshalling group description: " + err.Error())
	}
	return string(jsonBytes)
}

// UpdateGroupDescriptionByJSONString 通过JSON字符串更新分组描述
func UpdateGroupDescriptionByJSONString(jsonStr string) error {
	groupDescriptionMutex.Lock()
	defer groupDescriptionMutex.Unlock()

	groupDescription = make(map[string]string)
	return json.Unmarshal([]byte(jsonStr), &groupDescription)
}

func GetGroupGroupRatio(userGroup, usingGroup string) (float64, bool) {
	groupGroupRatioMutex.RLock()
	defer groupGroupRatioMutex.RUnlock()

	gp, ok := GroupGroupRatio[userGroup]
	if !ok {
		return -1, false
	}
	ratio, ok := gp[usingGroup]
	if !ok {
		return -1, false
	}
	return ratio, true
}

func GroupGroupRatio2JSONString() string {
	groupGroupRatioMutex.RLock()
	defer groupGroupRatioMutex.RUnlock()

	jsonBytes, err := json.Marshal(GroupGroupRatio)
	if err != nil {
		common.SysLog("error marshalling group-group ratio: " + err.Error())
	}
	return string(jsonBytes)
}

func UpdateGroupGroupRatioByJSONString(jsonStr string) error {
	groupGroupRatioMutex.Lock()
	defer groupGroupRatioMutex.Unlock()

	GroupGroupRatio = make(map[string]map[string]float64)
	return json.Unmarshal([]byte(jsonStr), &GroupGroupRatio)
}

func CheckGroupRatio(jsonStr string) error {
	checkGroupRatio := make(map[string]float64)
	err := json.Unmarshal([]byte(jsonStr), &checkGroupRatio)
	if err != nil {
		return err
	}
	for name, ratio := range checkGroupRatio {
		if ratio < 0 {
			return errors.New("group ratio must be not less than 0: " + name)
		}
	}
	return nil
}
