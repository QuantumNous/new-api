package model

import (
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// ModelAccessRow is the strict, enabled Ability-to-Channel projection used by
// model-access resolution. It intentionally excludes channel names and keys.
type ModelAccessRow struct {
	GroupName   string `json:"group_name"`
	Model       string `json:"model"`
	ChannelType int    `json:"channel_type"`
}

// PublicModelMetadata contains only metadata that is safe to expose to users.
type PublicModelMetadata struct {
	ModelName   string
	Description string
	Endpoints   string
	Vendor      *Vendor
}

// GetModelAccessRowsForGroups loads all enabled group/model/channel-type rows
// for the supplied groups in one query.
func GetModelAccessRowsForGroups(groups []string) ([]ModelAccessRow, error) {
	groups = normalizeLookupValues(groups)
	if len(groups) == 0 {
		return []ModelAccessRow{}, nil
	}

	var rows []ModelAccessRow
	err := DB.Table("abilities").
		Select("abilities."+commonGroupCol+" as group_name, abilities.model as model, channels.type as channel_type").
		Joins("JOIN channels ON channels.id = abilities.channel_id").
		Where("abilities.enabled = ? AND channels.status = ?", true, common.ChannelStatusEnabled).
		Where("abilities."+commonGroupCol+" IN ?", groups).
		Distinct().
		Order("abilities." + commonGroupCol + " ASC").
		Order("abilities.model ASC").
		Order("channels.type ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}

// GetPublicModelMetadataMap loads ModelMeta rules and their referenced Vendors
// in two batched queries, then applies the same exact/prefix/suffix/contains
// precedence used by pricing metadata resolution.
func GetPublicModelMetadataMap(modelNames []string) (map[string]PublicModelMetadata, error) {
	modelNames = normalizeLookupValues(modelNames)
	result := make(map[string]PublicModelMetadata, len(modelNames))
	if len(modelNames) == 0 {
		return result, nil
	}

	var metadata []Model
	if err := DB.
		Where("model_name IN ? OR name_rule <> ?", modelNames, NameRuleExact).
		Order("id ASC").
		Find(&metadata).Error; err != nil {
		return nil, err
	}

	vendorIDs := make([]int, 0)
	seenVendorIDs := make(map[int]struct{})
	for _, item := range metadata {
		if item.VendorID == 0 {
			continue
		}
		if _, ok := seenVendorIDs[item.VendorID]; ok {
			continue
		}
		seenVendorIDs[item.VendorID] = struct{}{}
		vendorIDs = append(vendorIDs, item.VendorID)
	}

	vendorsByID := make(map[int]*Vendor, len(vendorIDs))
	if len(vendorIDs) > 0 {
		var vendors []Vendor
		if err := DB.Where("id IN ?", vendorIDs).Find(&vendors).Error; err != nil {
			return nil, err
		}
		for i := range vendors {
			vendor := vendors[i]
			vendorsByID[vendor.Id] = &vendor
		}
	}

	exact := make(map[string]Model)
	rules := make(map[int][]Model)
	for _, item := range metadata {
		if item.NameRule == NameRuleExact {
			exact[item.ModelName] = item
			continue
		}
		rules[item.NameRule] = append(rules[item.NameRule], item)
	}

	sort.Strings(modelNames)
	for _, modelName := range modelNames {
		item, ok := exact[modelName]
		if !ok {
			item, ok = matchPublicModelMetadataRule(modelName, rules)
		}
		if !ok {
			continue
		}
		var vendor *Vendor
		if matched, exists := vendorsByID[item.VendorID]; exists {
			copy := *matched
			vendor = &copy
		}
		result[modelName] = PublicModelMetadata{
			ModelName:   modelName,
			Description: item.Description,
			Endpoints:   item.Endpoints,
			Vendor:      vendor,
		}
	}
	return result, nil
}

func matchPublicModelMetadataRule(modelName string, rules map[int][]Model) (Model, bool) {
	orderedRules := []int{NameRulePrefix, NameRuleSuffix, NameRuleContains}
	for _, rule := range orderedRules {
		for _, item := range rules[rule] {
			pattern := strings.TrimSpace(item.ModelName)
			if pattern == "" {
				continue
			}
			matched := false
			switch rule {
			case NameRulePrefix:
				matched = strings.HasPrefix(modelName, pattern)
			case NameRuleSuffix:
				matched = strings.HasSuffix(modelName, pattern)
			case NameRuleContains:
				matched = strings.Contains(modelName, pattern)
			}
			if matched {
				return item, true
			}
		}
	}
	return Model{}, false
}
