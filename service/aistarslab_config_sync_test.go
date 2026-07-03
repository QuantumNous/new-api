package service

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
)

func TestFlattenAistarsLabSeedanceModels(t *testing.T) {
	durationMin := 4
	durationMax := 15
	configs := []aistarsLabVideoConfig{
		{
			Channel:       "12",
			Title:         "视频-Seedance2.0-720P-推荐1",
			DefaultOption: true,
			Models: []aistarsLabConfigModel{
				{
					Model:        "seedance-2.0-720p-fast",
					Modes:        []string{"text2video", "image2video"},
					AspectRatios: []string{"16:9", "9:16"},
					Duration: aistarsLabDuration{
						Min: &durationMin,
						Max: &durationMax,
					},
					InputImagesMax: 9,
					InputVideosMax: 3,
					InputAudiosMax: 3,
					Qualities: []aistarsLabQuality{
						{
							Quality: "720p",
							Pricing: struct {
								Type    string  `json:"type"`
								Credits float64 `json:"credits"`
							}{
								Type:    "per_second",
								Credits: 44,
							},
						},
					},
				},
				{
					Model: "seedance-2.0-720p",
					Qualities: []aistarsLabQuality{
						{
							Quality: "720p",
							Pricing: struct {
								Type    string  `json:"type"`
								Credits float64 `json:"credits"`
							}{
								Type:    "per_second",
								Credits: 52,
							},
						},
					},
				},
			},
		},
		{
			Channel: "37",
			Models: []aistarsLabConfigModel{
				{
					Model: "seedance-2.0-720p-fast",
					Qualities: []aistarsLabQuality{
						{
							Quality: "720p",
							Pricing: struct {
								Type    string  `json:"type"`
								Credits float64 `json:"credits"`
							}{
								Type:    "fixed_total",
								Credits: 350,
							},
						},
					},
				},
				{
					Model: "seedance-2.0",
					Qualities: []aistarsLabQuality{
						{
							Quality: "4k",
							Pricing: struct {
								Type    string  `json:"type"`
								Credits float64 `json:"credits"`
							}{
								Type:    "per_second",
								Credits: 260,
							},
						},
					},
				},
			},
		},
	}

	models := flattenAistarsLabSeedanceModels(configs, 100, 1.3)

	assert.Len(t, models, 4)
	byName := make(map[string]AistarsLabSeedanceModel)
	for _, item := range models {
		byName[item.PublicModel] = item
	}
	assert.Equal(t, "12:seedance-2.0-720p-fast", byName["seedance-720p-fast-c12"].UpstreamModel)
	assert.Equal(t, ratio_setting.TaskBillingUnitPerSecond, byName["seedance-720p-fast-c12"].BillingUnit)
	assert.Equal(t, 0.57, byName["seedance-720p-fast-c12"].Price)
	assert.Equal(t, 0.68, byName["seedance-720p-c12"].Price)
	assert.Equal(t, ratio_setting.TaskBillingUnitPerItem, byName["seedance-720p-fast-c37"].BillingUnit)
	assert.Equal(t, 4.55, byName["seedance-720p-fast-c37"].Price)
	assert.Equal(t, "37:seedance-2.0", byName["seedance-4k-c37"].UpstreamModel)
	assert.Equal(t, 3.38, byName["seedance-4k-c37"].Price)
	assert.Equal(t, &durationMin, byName["seedance-720p-fast-c12"].DurationMin)
}

func TestBuildAistarsLabSeedanceAlias(t *testing.T) {
	assert.Equal(t, "seedance-720p-fast-c12", buildAistarsLabSeedanceAlias("seedance-2.0-720p-fast", "720p", "12"))
	assert.Equal(t, "seedance-1080p-c30", buildAistarsLabSeedanceAlias("seedance-2.0", "1080p", "30"))
	assert.Equal(t, "seedance-720p-fast-4img-c18", buildAistarsLabSeedanceAlias("seedance-2.0-720p-fast-4img", "720p", "18"))
}

func TestFilterOutAistarsLabSeedanceAliasesRemovesRawModels(t *testing.T) {
	filtered := filterOutAistarsLabSeedanceAliases([]string{
		"grok-video-1.5",
		"seedance-720p-fast-c12",
		"12:seedance-2.0-720p-fast",
		"seedance-2.0-720p",
		"grok-video-1.5",
	})

	assert.Equal(t, []string{"grok-video-1.5"}, filtered)
}
