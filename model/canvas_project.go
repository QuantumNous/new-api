package model

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

// CanvasProject 画布项目服务端持久化。Data 为项目 JSON(素材以 asset_id 引用,
// 不含大二进制);列省略 type 标签走方言默认映射(MySQL longtext / PG text / SQLite text)。
// (user_id, project_id) 唯一;version/updated_at 做乐观并发。
type CanvasProject struct {
	Id        int64  `gorm:"primaryKey" json:"id"`
	UserId    int    `gorm:"uniqueIndex:idx_canvas_project_user_pid;not null" json:"user_id"`
	ProjectId string `gorm:"size:64;uniqueIndex:idx_canvas_project_user_pid;not null" json:"project_id"`
	Title     string `gorm:"size:255" json:"title"`
	Data      string `gorm:"not null" json:"data"`
	Version   int    `gorm:"not null;default:1" json:"version"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `gorm:"index" json:"updated_at"`
}

func GetCanvasProjectsByUser(userId int) ([]*CanvasProject, error) {
	var projects []*CanvasProject
	err := DB.Where("user_id = ?", userId).Order("updated_at desc").Find(&projects).Error
	return projects, err
}

func GetCanvasProject(userId int, projectId string) (*CanvasProject, error) {
	var project CanvasProject
	err := DB.Where("user_id = ? AND project_id = ?", userId, projectId).First(&project).Error
	if err != nil {
		return nil, err
	}
	return &project, nil
}

var ErrCanvasProjectConflict = errors.New("canvas project version conflict")

// UpsertCanvasProject 创建或覆盖保存。clientVersion 为客户端已知的服务端版本;
// 已存在且 clientVersion < 当前版本时返回 ErrCanvasProjectConflict(调用方回 409 与服务端版本)。
func UpsertCanvasProject(userId int, projectId, title, data string, clientVersion int, updatedAt int64) (*CanvasProject, error) {
	now := time.Now().Unix()
	if updatedAt <= 0 {
		updatedAt = now
	}
	var result *CanvasProject
	err := DB.Transaction(func(tx *gorm.DB) error {
		var existing CanvasProject
		err := tx.Where("user_id = ? AND project_id = ?", userId, projectId).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			result = &CanvasProject{
				UserId:    userId,
				ProjectId: projectId,
				Title:     title,
				Data:      data,
				Version:   1,
				CreatedAt: now,
				UpdatedAt: updatedAt,
			}
			return tx.Create(result).Error
		}
		if err != nil {
			return err
		}
		if clientVersion < existing.Version {
			result = &existing
			return ErrCanvasProjectConflict
		}
		existing.Title = title
		existing.Data = data
		existing.Version = existing.Version + 1
		existing.UpdatedAt = updatedAt
		result = &existing
		return tx.Model(&CanvasProject{}).Where("id = ?", existing.Id).
			Updates(map[string]interface{}{
				"title":      existing.Title,
				"data":       existing.Data,
				"version":    existing.Version,
				"updated_at": existing.UpdatedAt,
			}).Error
	})
	if err != nil && !errors.Is(err, ErrCanvasProjectConflict) {
		return nil, err
	}
	return result, err
}

func DeleteCanvasProject(userId int, projectId string) error {
	return DB.Where("user_id = ? AND project_id = ?", userId, projectId).Delete(&CanvasProject{}).Error
}
