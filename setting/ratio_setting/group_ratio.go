package ratio_setting

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/types"
)

var defaultGroupRatio = map[string]float64{
	"default": 1,
	"vip":     1,
	"svip":    1,
}

var groupRatioMap = types.NewRWMap[string, float64]()

var defaultGroupGroupRatio = map[string]map[string]float64{
	"vip": {
		"edit_this": 0.9,
	},
}

var groupGroupRatioMap = types.NewRWMap[string, map[string]float64]()

var defaultGroupSpecialUsableGroup = map[string]map[string]string{}

type GroupRatioSetting struct {
	GroupRatio              *types.RWMap[string, float64]            `json:"group_ratio"`
	GroupGroupRatio         *types.RWMap[string, map[string]float64] `json:"group_group_ratio"`
	GroupSpecialUsableGroup *types.RWMap[string, map[string]string]  `json:"group_special_usable_group"`
}

var groupRatioSetting GroupRatioSetting

func init() {
	groupSpecialUsableGroup := types.NewRWMap[string, map[string]string]()
	groupSpecialUsableGroup.AddAll(defaultGroupSpecialUsableGroup)

	groupRatioMap.AddAll(defaultGroupRatio)
	groupGroupRatioMap.AddAll(defaultGroupGroupRatio)

	groupRatioSetting = GroupRatioSetting{
		GroupSpecialUsableGroup: groupSpecialUsableGroup,
		GroupRatio:              groupRatioMap,
		GroupGroupRatio:         groupGroupRatioMap,
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
	return groupRatioMap.ReadAll()
}

func ContainsGroupRatio(name string) bool {
	_, ok := groupRatioMap.Get(name)
	return ok
}

func GroupRatio2JSONString() string {
	return groupRatioMap.MarshalJSONString()
}

func UpdateGroupRatioByJSONString(jsonStr string) error {
	// Empty object would wipe defaults and break pricing + perf-metrics group
	// filters (summary only returns groups present in this map). Keep defaults.
	trimmed := strings.TrimSpace(jsonStr)
	if trimmed == "" || trimmed == "{}" || trimmed == "null" {
		groupRatioMap.Clear()
		groupRatioMap.AddAll(defaultGroupRatio)
		return nil
	}
	tmp := make(map[string]float64)
	if err := common.Unmarshal([]byte(trimmed), &tmp); err != nil {
		return err
	}
	if len(tmp) == 0 {
		groupRatioMap.Clear()
		groupRatioMap.AddAll(defaultGroupRatio)
		return nil
	}
	// Reject negative ratios before load (same rule as CheckGroupRatio).
	for name, ratio := range tmp {
		if ratio < 0 {
			return errors.New("group ratio must be not less than 0: " + name)
		}
	}
	if err := types.LoadFromJsonString(groupRatioMap, trimmed); err != nil {
		return err
	}
	// Always keep a usable default group so pricing/perf never filter to empty.
	if _, ok := groupRatioMap.Get("default"); !ok {
		groupRatioMap.Set("default", 1)
	}
	return nil
}

func GetGroupRatio(name string) float64 {
	ratio, ok := groupRatioMap.Get(name)
	if !ok {
		common.SysLog("group ratio not found: " + name)
		return 1
	}
	return ratio
}

func GetGroupGroupRatio(userGroup, usingGroup string) (float64, bool) {
	gp, ok := groupGroupRatioMap.Get(userGroup)
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
	return groupGroupRatioMap.MarshalJSONString()
}

func UpdateGroupGroupRatioByJSONString(jsonStr string) error {
	// Empty / null should not wipe nested group-group overrides to a broken state.
	// Unlike GroupRatio, empty here means "no nested overrides" (valid), but still
	// reject null-ish wipe of malformed payloads and negative ratios.
	trimmed := strings.TrimSpace(jsonStr)
	if trimmed == "" || trimmed == "null" {
		groupGroupRatioMap.Clear()
		return nil
	}
	tmp := make(map[string]map[string]float64)
	if err := common.Unmarshal([]byte(trimmed), &tmp); err != nil {
		return err
	}
	for userGroup, nested := range tmp {
		for usingGroup, ratio := range nested {
			if ratio < 0 {
				return errors.New("group_group_ratio must be not less than 0: " + userGroup + " -> " + usingGroup)
			}
		}
	}
	return types.LoadFromJsonString(groupGroupRatioMap, trimmed)
}

func CheckGroupRatio(jsonStr string) error {
	trimmed := strings.TrimSpace(jsonStr)
	if trimmed == "" || trimmed == "{}" || trimmed == "null" {
		// Empty is accepted; UpdateGroupRatioByJSONString restores defaults.
		return nil
	}
	checkGroupRatio := make(map[string]float64)
	err := common.Unmarshal([]byte(trimmed), &checkGroupRatio)
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

// CheckGroupGroupRatio validates nested user→using group ratio maps.
func CheckGroupGroupRatio(jsonStr string) error {
	trimmed := strings.TrimSpace(jsonStr)
	if trimmed == "" || trimmed == "{}" || trimmed == "null" {
		return nil
	}
	check := make(map[string]map[string]float64)
	if err := common.Unmarshal([]byte(trimmed), &check); err != nil {
		return err
	}
	for userGroup, nested := range check {
		for usingGroup, ratio := range nested {
			if ratio < 0 {
				return errors.New("group_group_ratio must be not less than 0: " + userGroup + " -> " + usingGroup)
			}
		}
	}
	return nil
}
