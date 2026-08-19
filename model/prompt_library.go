package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
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
	Enabled        bool   `json:"enabled" gorm:"default:true"`
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
		items[i].Enabled = true
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

func ListPromptLibraryItems(category string, keyword string, enabledOnly bool, startIdx int, num int) ([]PromptLibraryItem, int64, error) {
	items := make([]PromptLibraryItem, 0)
	query := DB.Model(&PromptLibraryItem{})
	category = strings.TrimSpace(category)
	if category != "" {
		query = query.Where("category = ?", category)
	}
	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("prompt LIKE ? OR title_json LIKE ?", like, like)
	}
	if enabledOnly {
		query = query.Where("enabled = ?", true)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if num <= 0 || num > 100 {
		num = 100
	}
	err := query.Order("updated_time DESC").Order("id DESC").Offset(startIdx).Limit(num).Find(&items).Error
	return items, total, err
}

func GetPromptLibraryItemBySlug(slug string) (*PromptLibraryItem, error) {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return nil, nil
	}
	var item PromptLibraryItem
	err := DB.Where("slug = ?", slug).First(&item).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &item, nil
}

func GetPromptLibraryItemById(id int) (*PromptLibraryItem, error) {
	var item PromptLibraryItem
	err := DB.First(&item, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &item, nil
}

func CreatePromptLibraryItem(item *PromptLibraryItem) error {
	now := common.GetTimestamp()
	item.CreatedTime = now
	item.UpdatedTime = now
	// gorm 对带 default:true 的零值 bool，Create 时会改用默认值并写回结构体，
	// 因此必须在 Create 前捕获调用者意图，事后显式落盘 false。
	// Create + 修正 Update 放在同一事务里，避免中途崩溃留下一条被错误置为
	// enabled 的行。
	enabled := item.Enabled
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(item).Error; err != nil {
			return err
		}
		if !enabled {
			item.Enabled = false
			return tx.Model(item).Update("enabled", false).Error
		}
		return nil
	})
}

// SetPromptLibraryItemEnabled flips only the enabled column (map form so the
// zero-value false is not skipped by GORM). Returns rows affected so callers
// can distinguish "not found".
func SetPromptLibraryItemEnabled(id int, enabled bool) (int64, error) {
	res := DB.Model(&PromptLibraryItem{}).Where("id = ?", id).Updates(map[string]any{
		"enabled":      enabled,
		"updated_time": common.GetTimestamp(),
	})
	return res.RowsAffected, res.Error
}

func (item *PromptLibraryItem) Update() error {
	item.UpdatedTime = common.GetTimestamp()
	// Select 全列（含 zero-value 的 enabled=false），否则 GORM 默认跳过零值字段
	return DB.Model(item).Select("*").Omit("id", "created_time").Updates(item).Error
}

func DeletePromptLibraryItemById(id int) error {
	return DB.Delete(&PromptLibraryItem{}, "id = ?", id).Error
}
