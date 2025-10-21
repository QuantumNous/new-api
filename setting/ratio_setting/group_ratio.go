package ratio_setting

import (
	"encoding/json"
	"errors"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

var groupRatio = map[string]float64{
	"default": 1,
	"vip":     1,
	"svip":    1,
}
var groupRatioMutex sync.RWMutex

var (
	GroupGroupRatio = map[string]map[string]float64{
		"vip": {
			"edit_this": 0.9,
		},
	}
	groupGroupRatioMutex sync.RWMutex
)

func GetGroupRatioCopy() map[string]float64 {
	groupRatioMutex.RLock()
	defer groupRatioMutex.RUnlock()

	groupRatioCopy := make(map[string]float64)
	for k, v := range groupRatio {
		groupRatioCopy[k] = v
	}
	return groupRatioCopy
}

// GetGroupRatioExtendCopy returns a copy of the group ratio map,
// extended with any overrides for the specified user group.
// when you set a ratio in GroupGroupRatio, it will OVERRIDE the default ratio.
//
// eg.
// group_ratio: {"default": 1, "vip": 1, "vip_plus": 0.8, "vip_pro": 0.6}
// user_group: {"default"}
// group_group_ratio: {"vip": {"vip_plus": 0.5, "vip_pro": 0.4}}
//
// when user.group is default, user will see groups: ["default"]
// when user.group is vip, user will see groups: ["default", "vip_plus", "vip_pro"]
func GetGroupRatioExtendCopy(userGroup string) map[string]float64 {
	groupCopy := GetGroupRatioCopy()

	extendGroup, ok := getGroupGroupRatioCopy(userGroup)
	if !ok {
		return groupCopy
	}

	return groupMerge(groupCopy, extendGroup)
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

func getGroupGroupRatioCopy(userGroup string) (map[string]float64, bool) {
	groupGroupRatioMutex.RLock()
	defer groupGroupRatioMutex.RUnlock()

	gp, ok := GroupGroupRatio[userGroup]
	if !ok {
		return nil, false
	}

	groupRatioCopy := make(map[string]float64)
	for k, v := range gp {
		groupRatioCopy[k] = v
	}
	return groupRatioCopy, true
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

// GroupMerge merges two group ratio maps, with values from groupB overriding exist key in groupA.
func groupMerge(groupA, groupB map[string]float64) map[string]float64 {
	merged := make(map[string]float64, len(groupA))
	for k, v := range groupA {
		merged[k] = v
	}

	for k, v := range groupB {
		if _, ok := groupA[k]; ok {
			groupA[k] = v
		}
	}

	return groupA
}
