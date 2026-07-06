package model

import (
	"fmt"
	"sort"

	"github.com/QuantumNous/new-api/common"
)

func MigrateGroupsFromOptions() {
	groupCount, err := GetGroupCount()
	if err != nil {
		common.SysLog("failed to count groups before migration: " + err.Error())
		return
	}
	if groupCount > 0 {
		common.SysLog("groups table already populated, skipping group migration")
		return
	}

	common.OptionMapRWMutex.RLock()
	groupRatioStr := common.OptionMap["GroupRatio"]
	userUsableGroupsStr := common.OptionMap["UserUsableGroups"]
	common.OptionMapRWMutex.RUnlock()

	if groupRatioStr == "" {
		common.SysLog("no GroupRatio found in OptionMap, skipping group migration")
		return
	}

	ratioMap := make(map[string]float64)
	if err := common.Unmarshal([]byte(groupRatioStr), &ratioMap); err != nil {
		common.SysLog("failed to parse GroupRatio: " + err.Error())
		return
	}

	if len(ratioMap) == 0 {
		ratioMap["default"] = 1
		common.SysLog("GroupRatio is empty, creating default group")
	}

	usableMap := make(map[string]string)
	if userUsableGroupsStr != "" {
		if err := common.Unmarshal([]byte(userUsableGroupsStr), &usableMap); err != nil {
			common.SysLog("failed to parse UserUsableGroups: " + err.Error())
		}
	}

	names := make([]string, 0, len(ratioMap))
	for name := range ratioMap {
		names = append(names, name)
	}
	sort.Strings(names)

	migrated := 0
	for sortOrder, name := range names {
		_, selectable := usableMap[name]
		desc := usableMap[name]
		group := Group{
			Name:           name,
			Ratio:          ratioMap[name],
			SortOrder:      sortOrder,
			Category:       "",
			UserSelectable: selectable,
			Description:    desc,
		}
		// FirstOrCreate: skip if already exists, insert if not — safe to retry on partial failure
		result := DB.Where(Group{Name: name}).FirstOrCreate(&group)
		if result.Error != nil {
			common.SysLog("failed to migrate group " + name + ": " + result.Error.Error())
		} else if result.RowsAffected > 0 {
			migrated++
		}
	}

	if migrated > 0 {
		common.SysLog(fmt.Sprintf("migrated groups from options to groups table: %d", migrated))
	}
}
