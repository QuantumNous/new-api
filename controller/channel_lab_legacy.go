package controller

import (
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/modellab"
)

// legacyChannelDTO preserves the legacy Channel JSON shape while exposing the
// same server-resolved Lab metadata as the Vue admin DTO. The embedded model
// remains the source of truth for all existing fields and actions.
type legacyChannelDTO struct {
	*model.Channel
	LabGroupSlug  string                `json:"lab_group_slug"`
	LabGroupName  string                `json:"lab_group_name"`
	LabMatches    []modellab.LabMatch   `json:"lab_matches"`
	LabModels     []modellab.ModelMatch `json:"lab_models"`
	LabUnresolved int                   `json:"lab_unresolved_count"`
	LabCatalog    string                `json:"lab_catalog_version"`
}

func buildLegacyChannelDTO(channel *model.Channel) legacyChannelDTO {
	resolution := modellab.Resolve(channel.Models, channel.GetModelMapping())
	return legacyChannelDTO{
		Channel:       channel,
		LabGroupSlug:  resolution.GroupSlug,
		LabGroupName:  labGroupName(resolution),
		LabMatches:    resolution.Labs,
		LabModels:     resolution.Models,
		LabUnresolved: resolution.UnresolvedCount,
		LabCatalog:    resolution.CatalogVersion,
	}
}

func buildLegacyChannelDTOs(channels []*model.Channel) []legacyChannelDTO {
	items := make([]legacyChannelDTO, 0, len(channels))
	for _, channel := range channels {
		if channel != nil {
			items = append(items, buildLegacyChannelDTO(channel))
		}
	}
	return items
}
