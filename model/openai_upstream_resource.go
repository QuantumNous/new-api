package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	OpenAIUpstreamResourceTypeFile  = "file"
	OpenAIUpstreamResourceTypeBatch = "batch"
)

func IsOpenAIUpstreamResourcePath(requestPath string) bool {
	return requestPath == "/v1/files" || strings.HasPrefix(requestPath, "/v1/files/") ||
		requestPath == "/v1/batches" || strings.HasPrefix(requestPath, "/v1/batches/")
}

// OpenAIUpstreamResource keeps asynchronous OpenAI resources on the channel
// where they were created. Resource IDs are scoped by user to prevent one
// account from resolving another account's upstream resources.
type OpenAIUpstreamResource struct {
	Id                    int64  `json:"id" gorm:"primaryKey"`
	UserId                int    `json:"user_id" gorm:"not null;uniqueIndex:idx_openai_upstream_resource_owner,priority:1"`
	ResourceType          string `json:"resource_type" gorm:"type:varchar(16);not null;uniqueIndex:idx_openai_upstream_resource_owner,priority:2"`
	ResourceId            string `json:"resource_id" gorm:"type:varchar(191);not null;uniqueIndex:idx_openai_upstream_resource_owner,priority:3"`
	ChannelId             int    `json:"channel_id" gorm:"not null;index"`
	ChannelKeyIndex       int    `json:"channel_key_index" gorm:"not null"`
	ChannelKeyFingerprint string `json:"-" gorm:"type:varchar(40);not null"`
	Model                 string `json:"model" gorm:"type:varchar(191);not null"`
	CreatedAt             int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt             int64  `json:"updated_at" gorm:"bigint"`
}

func (OpenAIUpstreamResource) TableName() string {
	return "openai_upstream_resources"
}

func (resource *OpenAIUpstreamResource) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if resource.CreatedAt == 0 {
		resource.CreatedAt = now
	}
	resource.UpdatedAt = now
	return nil
}

func SaveOpenAIUpstreamResources(resources []OpenAIUpstreamResource) error {
	if len(resources) == 0 {
		return nil
	}
	for i := range resources {
		resources[i].ResourceType = strings.TrimSpace(resources[i].ResourceType)
		resources[i].ResourceId = strings.TrimSpace(resources[i].ResourceId)
		resources[i].Model = strings.TrimSpace(resources[i].Model)
		if resources[i].UserId <= 0 || resources[i].ChannelId <= 0 || resources[i].ResourceType == "" || resources[i].ResourceId == "" || resources[i].Model == "" {
			return errors.New("invalid OpenAI upstream resource")
		}
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		for i := range resources {
			if err := tx.Clauses(clause.OnConflict{
				Columns: []clause.Column{
					{Name: "user_id"},
					{Name: "resource_type"},
					{Name: "resource_id"},
				},
				DoNothing: true,
			}).Create(&resources[i]).Error; err != nil {
				return err
			}

			var stored OpenAIUpstreamResource
			if err := tx.Where(
				"user_id = ? AND resource_type = ? AND resource_id = ?",
				resources[i].UserId,
				resources[i].ResourceType,
				resources[i].ResourceId,
			).First(&stored).Error; err != nil {
				return err
			}
			if stored.ChannelId != resources[i].ChannelId ||
				stored.ChannelKeyIndex != resources[i].ChannelKeyIndex ||
				stored.ChannelKeyFingerprint != resources[i].ChannelKeyFingerprint ||
				stored.Model != resources[i].Model {
				return errors.New("OpenAI upstream resource already belongs to another channel or key")
			}
		}
		return nil
	})
}

func GetOpenAIUpstreamResource(userId int, resourceType string, resourceId string) (*OpenAIUpstreamResource, bool, error) {
	var resource OpenAIUpstreamResource
	err := DB.Where(
		"user_id = ? AND resource_type = ? AND resource_id = ?",
		userId,
		strings.TrimSpace(resourceType),
		strings.TrimSpace(resourceId),
	).First(&resource).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return &resource, true, nil
}

func DeleteOpenAIUpstreamResource(userId int, resourceType string, resourceId string) error {
	return DB.Where(
		"user_id = ? AND resource_type = ? AND resource_id = ?",
		userId,
		strings.TrimSpace(resourceType),
		strings.TrimSpace(resourceId),
	).Delete(&OpenAIUpstreamResource{}).Error
}
