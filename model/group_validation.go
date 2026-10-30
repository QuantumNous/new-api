package model

import (
	"context"
	"maps"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

var groupOptionMutex sync.Mutex

var groupOptionAliases = map[string]string{
	"group_ratio_setting.group_ratio":                "GroupRatio",
	"group_ratio_setting.group_group_ratio":          "GroupGroupRatio",
	"group_ratio_setting.group_special_usable_group": "GroupSpecialUsableGroup",
}

func canonicalGroupOption(key string) string {
	if canonical, ok := groupOptionAliases[key]; ok {
		return canonical
	}
	switch key {
	case "GroupRatio", "GroupGroupRatio", "GroupSpecialUsableGroup", "UserUsableGroups", "AutoGroups", "TopupGroupRatio", "ModelRequestRateLimitGroup":
		return key
	}
	return ""
}

// ValidateGroupReference preserves empty inheritance and the token-only auto selector.
// It never creates definitions or substitutes a default for a missing name.
func ValidateGroupReference(group string, allowEmpty, allowAuto bool) error {
	if group == "" && allowEmpty || group == "auto" && allowAuto {
		return nil
	}
	if group == "" || group == "auto" || !ratio_setting.ContainsGroupRatio(group) {
		return common.NewMessage("Referenced group does not exist.")
	}
	return nil
}

func ValidateChannelGroups(groups string) error {
	if groups == "" {
		return ValidateGroupReference("default", false, false)
	}
	for group := range strings.SplitSeq(groups, ",") {
		if err := ValidateGroupReference(group, false, false); err != nil {
			return err
		}
	}
	return nil
}

func (token *Token) ValidateGroupReferences() error {
	if err := ValidateGroupReference(token.Group, true, true); err != nil {
		return err
	}
	if token.Group != "auto" {
		return nil
	}
	groups, err := token.GetAutoGroups()
	if err != nil {
		return err
	}
	for _, group := range groups {
		if err := ValidateGroupReference(group, false, false); err != nil {
			return err
		}
	}
	return nil
}

// Group option aliases are persisted together so a later reload cannot resurrect
// a stale definition. Validation runs before any durable or in-memory mutation.
func prepareGroupOptions(values map[string]string) (map[string]string, error) {
	canonical := map[string]string{}
	for key, value := range values {
		kind := canonicalGroupOption(key)
		if kind == "" {
			continue
		}
		if previous, exists := canonical[kind]; exists && previous != value {
			return nil, common.NewMessage("Conflicting group configuration aliases.")
		}
		canonical[kind] = value
	}
	if len(canonical) == 0 {
		return values, nil
	}
	groups := ratio_setting.GetGroupRatioCopy()
	previous := maps.Clone(groups)
	if value, changed := canonical["GroupRatio"]; changed {
		// Unmarshal into a fresh map: omitted keys represent deletions.
		groups = map[string]float64{}
		if common.UnmarshalJsonStr(value, &groups) != nil || groups == nil {
			return nil, common.NewMessage("Invalid group configuration.")
		}
		for name, ratio := range groups {
			if ratio < 0 || (!validMigrationGroupName(name) && !hasGroup(previous, name)) {
				return nil, common.NewMessage("Invalid group configuration.")
			}
		}
	}
	for key, value := range canonical {
		if key == "GroupRatio" {
			continue
		}
		var target any
		switch key {
		case "AutoGroups":
			target = new([]string)
		case "GroupGroupRatio":
			target = new(map[string]map[string]float64)
		case "GroupSpecialUsableGroup":
			target = new(map[string]map[string]string)
		case "UserUsableGroups":
			target = new(map[string]string)
		case "ModelRequestRateLimitGroup":
			target = new(map[string][2]int)
		default:
			target = new(map[string]float64)
		}
		if common.UnmarshalJsonStr(value, target) != nil || strings.TrimSpace(value) == "null" {
			return nil, common.NewMessage("Invalid group configuration.")
		}
		inventory := &GroupReferenceInventory{configuration: map[string]string{}}
		inventory.readConfiguration("configuration", key, key, value)
		if inventory.InvalidRecords > 0 {
			return nil, common.NewMessage("Invalid group configuration.")
		}
		for _, ref := range inventory.References {
			allowAuto := key == "UserUsableGroups" || key == "GroupSpecialUsableGroup" && len(ref.Path) == 3
			if !(ref.Group == "auto" && allowAuto) && !hasGroup(groups, ref.Group) {
				return nil, common.NewMessage("Referenced group does not exist.")
			}
		}
	}
	deleted := map[string]bool{}
	for name := range previous {
		if hasGroup(groups, name) {
			continue
		}
		if name == "default" || name == "auto" {
			return nil, common.NewMessage("Built-in groups cannot be deleted.")
		}
		deleted[name] = true
	}
	if len(deleted) > 0 {
		inventory, err := ReadGroupReferenceInventory(context.Background())
		if err != nil {
			return nil, err
		}
		if inventory.InvalidRecords > 0 {
			return nil, common.NewMessage("Invalid group reference data must be repaired before migration.")
		}
		for _, ref := range inventory.References {
			if !deleted[ref.Group] {
				continue
			}
			if ref.Category == "configuration" || ref.Category == "saved_configuration" {
				kind := canonicalGroupOption(ref.Record)
				if kind == "GroupRatio" {
					continue
				}
				if _, replaced := canonical[kind]; replaced {
					continue
				}
			}
			return nil, common.NewMessage("This group is still referenced. Use Group migration to change its name.")
		}
	}
	result := maps.Clone(values)
	maps.Copy(result, canonical)
	for alias, key := range groupOptionAliases {
		if value, changed := canonical[key]; changed {
			result[alias] = value
		}
	}
	return result, nil
}

func UpdateGroupOptions(values map[string]string) error {
	for key, value := range values {
		if canonicalGroupOption(key) != "" || key == "MaxTokenAutoGroups" {
			continue
		}
		if key == "DefaultUseAutoGroup" && (value == "true" || value == "false") {
			continue
		}
		return common.NewMessage("Invalid group configuration.")
	}
	return UpdateOptionsBulk(values)
}

func hasGroup(groups map[string]float64, name string) bool {
	_, exists := groups[name]
	return exists
}
