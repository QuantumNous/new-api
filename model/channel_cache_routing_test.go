package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCollectRoutingChannelModelsKeepsOnlyPathCompatibleModels(t *testing.T) {
	models := map[string][]int{"chat-only": {7}, "responses-only": {7}, "other": {8}}
	got := collectRoutingChannelModels(models, "/v1/responses", func(ids []int, path, model string) []int {
		if model == "chat-only" {
			return nil
		}
		return ids
	})
	assert.Equal(t, []string{"responses-only"}, got[7])
	assert.Equal(t, []string{"other"}, got[8])
}
