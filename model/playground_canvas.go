package model

import (
	"time"

	"gorm.io/gorm"
)

// PlaygroundCanvasProject stores a user-owned, revisioned Canvas document.
// Snapshot is deliberately TEXT (rather than a dialect-specific JSON type) so
// the same schema works on SQLite, MySQL, and PostgreSQL.
type PlaygroundCanvasProject struct {
	Id                    int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId                int    `json:"-" gorm:"not null;index"`
	Title                 string `json:"title" gorm:"type:varchar(255);not null"`
	Snapshot              string `json:"-" gorm:"type:text;not null"`
	Revision              int    `json:"revision" gorm:"not null"`
	InspirationTemplateId int    `json:"inspiration_template_id" gorm:"not null;index"`
	InspirationVersionId  int    `json:"inspiration_version_id" gorm:"not null;index"`
	CreatedAt             int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt             int64  `json:"updated_at" gorm:"bigint;index"`
}

func (PlaygroundCanvasProject) TableName() string { return "playground_canvas_projects" }

func CreatePlaygroundCanvasProject(project *PlaygroundCanvasProject) error {
	now := time.Now().Unix()
	project.Revision = 1
	project.CreatedAt = now
	project.UpdatedAt = now
	return DB.Create(project).Error
}

func ListPlaygroundCanvasProjects(userId int) ([]PlaygroundCanvasProject, error) {
	var projects []PlaygroundCanvasProject
	err := DB.Where("user_id = ?", userId).Order("updated_at DESC, id DESC").Find(&projects).Error
	return projects, err
}

func GetPlaygroundCanvasProject(id, userId int) (*PlaygroundCanvasProject, error) {
	var project PlaygroundCanvasProject
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(&project).Error
	return &project, err
}

func UpdatePlaygroundCanvasProjectCAS(id, userId, revision int, title, snapshot string) (int, int64, error) {
	nextRevision := revision + 1
	updatedAt := time.Now().Unix()
	result := DB.Model(&PlaygroundCanvasProject{}).
		Where("id = ? AND user_id = ? AND revision = ?", id, userId, revision).
		Updates(map[string]any{"title": title, "snapshot": snapshot, "revision": nextRevision, "updated_at": updatedAt})
	if result.Error != nil {
		return 0, 0, result.Error
	}
	if result.RowsAffected == 0 {
		return 0, 0, gorm.ErrRecordNotFound
	}
	return nextRevision, updatedAt, nil
}

func DeletePlaygroundCanvasProject(id, userId int) error {
	result := DB.Where("id = ? AND user_id = ?", id, userId).Delete(&PlaygroundCanvasProject{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
