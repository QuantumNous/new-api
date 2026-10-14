package service

import (
	"strings"

	"github.com/QuantumNous/new-api/model"
)

type UpstreamRouteOverview struct {
	model.UpstreamManagedRoute
	EffectiveModels []string `json:"effective_models"`
}

func ListUpstreamRouteOverviews() ([]UpstreamRouteOverview, error) {
	routes, err := model.ListUpstreamManagedRoutes()
	if err != nil {
		return nil, err
	}
	overviews := make([]UpstreamRouteOverview, len(routes))
	channelIDs := make([]int, 0, len(routes))
	seenChannelIDs := make(map[int]struct{}, len(routes))
	for i, route := range routes {
		overviews[i].UpstreamManagedRoute = route
		if route.ChannelID <= 0 {
			continue
		}
		if _, exists := seenChannelIDs[route.ChannelID]; exists {
			continue
		}
		seenChannelIDs[route.ChannelID] = struct{}{}
		channelIDs = append(channelIDs, route.ChannelID)
	}
	if len(channelIDs) == 0 {
		return overviews, nil
	}

	var channels []struct {
		ID     int
		Models string
	}
	if err := model.DB.Model(&model.Channel{}).
		Select("id", "models").
		Where("id IN ?", channelIDs).
		Find(&channels).Error; err != nil {
		return nil, err
	}
	modelsByChannelID := make(map[int][]string, len(channels))
	for _, channel := range channels {
		models := make([]string, 0)
		seenModels := make(map[string]struct{})
		for modelName := range strings.SplitSeq(channel.Models, ",") {
			modelName = strings.TrimSpace(modelName)
			if modelName == "" {
				continue
			}
			if _, exists := seenModels[modelName]; exists {
				continue
			}
			seenModels[modelName] = struct{}{}
			models = append(models, modelName)
		}
		modelsByChannelID[channel.ID] = models
	}
	for i := range overviews {
		if models, ok := modelsByChannelID[overviews[i].ChannelID]; ok {
			overviews[i].EffectiveModels = models
		}
	}
	return overviews, nil
}
