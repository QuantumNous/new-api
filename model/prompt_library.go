package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm/clause"
)

const (
	PromptLibraryCategoryImage = "image"
	PromptLibraryCategoryVideo = "video"
	PromptLibraryCategoryAudio = "audio"
	PromptLibraryCategoryText  = "text"
	PromptLibraryCategoryAgent = "agent"
)

type PromptLibraryItem struct {
	Id             int    `json:"id"`
	Slug           string `json:"slug" gorm:"size:160;not null;uniqueIndex"`
	Category       string `json:"category" gorm:"size:32;not null;index"`
	Model          string `json:"model" gorm:"size:255;not null;index"`
	Prompt         string `json:"prompt" gorm:"type:text;not null"`
	TitleJSON      string `json:"title_json" gorm:"type:text;not null"`
	SummaryJSON    string `json:"summary_json" gorm:"type:text"`
	TagsJSON       string `json:"tags_json" gorm:"type:text"`
	OutputJSON     string `json:"output_json" gorm:"type:text"`
	ArtifactJSON   string `json:"artifact_json" gorm:"type:text;not null"`
	SourceJSON     string `json:"source_json" gorm:"type:text;not null"`
	SourcePlatform string `json:"source_platform" gorm:"size:64;not null;index"`
	SourceURL      string `json:"source_url" gorm:"type:text;not null"`
	CapturedAt     string `json:"captured_at" gorm:"size:32"`
	CreatedTime    int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime    int64  `json:"updated_time" gorm:"bigint;index"`
}

func IsPromptLibraryCategoryAllowed(category string) bool {
	switch category {
	case PromptLibraryCategoryImage, PromptLibraryCategoryVideo, PromptLibraryCategoryAudio, PromptLibraryCategoryText, PromptLibraryCategoryAgent:
		return true
	default:
		return false
	}
}

func IsPromptLibraryModelAllowed(modelName string) (bool, error) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return false, nil
	}
	var count int64
	if err := DB.Model(&Ability{}).Where("model = ? AND enabled = ?", modelName, true).Count(&count).Error; err != nil {
		return false, err
	}
	if count > 0 {
		return true, nil
	}
	if err := DB.Model(&Model{}).Where("model_name = ?", modelName).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func UpsertPromptLibraryItems(items []PromptLibraryItem) error {
	if len(items) == 0 {
		return nil
	}
	now := common.GetTimestamp()
	for i := range items {
		items[i].CreatedTime = now
		items[i].UpdatedTime = now
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "slug"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"category",
			"model",
			"prompt",
			"title_json",
			"summary_json",
			"tags_json",
			"output_json",
			"artifact_json",
			"source_json",
			"source_platform",
			"source_url",
			"captured_at",
			"updated_time",
		}),
	}).Create(&items).Error
}
