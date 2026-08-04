package model

import (
	"sort"
	"strings"
)

// ModelCatalogChannel is a key-free projection used to audit whether models
// configured on channels can reach the user-facing model catalog.
type ModelCatalogChannel struct {
	ID     int
	Type   int
	Status int
	Models []string
	Groups []string
}

// ModelCatalogAbility keeps disabled rows and disabled channels visible to the
// catalog audit. The normal model-access query intentionally filters both out.
type ModelCatalogAbility struct {
	GroupName     string
	Model         string
	ChannelID     int
	ChannelType   int
	ChannelStatus int
	Enabled       bool
}

// GetModelCatalogChannels loads only non-secret channel fields and normalizes
// the comma-separated model/group declarations used by the channel editor.
func GetModelCatalogChannels() ([]ModelCatalogChannel, error) {
	var rows []struct {
		ID        int
		Type      int
		Status    int
		Models    string
		GroupName string
	}
	if err := DB.Model(&Channel{}).
		Select("id", "type", "status", "models", commonGroupCol+" AS group_name").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	channels := make([]ModelCatalogChannel, 0, len(rows))
	for _, row := range rows {
		models := splitCatalogValues(row.Models)
		groups := splitCatalogValues(row.GroupName)
		if len(models) == 0 || len(groups) == 0 {
			continue
		}
		channels = append(channels, ModelCatalogChannel{
			ID: row.ID, Type: row.Type, Status: row.Status, Models: models, Groups: groups,
		})
	}
	sort.Slice(channels, func(i, j int) bool { return channels[i].ID < channels[j].ID })
	return channels, nil
}

// GetModelCatalogAbilitiesForGroup returns every ability row for a group,
// including disabled abilities and rows attached to disabled channels.
func GetModelCatalogAbilitiesForGroup(group string) ([]ModelCatalogAbility, error) {
	group = strings.TrimSpace(group)
	if group == "" {
		return []ModelCatalogAbility{}, nil
	}

	var rows []ModelCatalogAbility
	err := DB.Table("abilities").
		Select("abilities."+commonGroupCol+" AS group_name, abilities.model AS model, abilities.channel_id AS channel_id, abilities.enabled AS enabled, channels.type AS channel_type, channels.status AS channel_status").
		Joins("JOIN channels ON channels.id = abilities.channel_id").
		Where("abilities."+commonGroupCol+" = ?", group).
		Order("abilities.model ASC").
		Order("abilities.channel_id ASC").
		Scan(&rows).Error
	return rows, err
}

func splitCatalogValues(value string) []string {
	seen := make(map[string]struct{})
	values := make([]string, 0)
	for _, item := range strings.Split(value, ",") {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		values = append(values, item)
	}
	sort.Strings(values)
	return values
}
