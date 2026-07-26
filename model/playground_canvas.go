package model

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"gorm.io/gorm"
)

const (
	// PlaygroundCanvasVersionInterval throttles automatic snapshots (seconds).
	PlaygroundCanvasVersionInterval int64 = 600
	// PlaygroundCanvasVersionLimit caps stored snapshots per project.
	PlaygroundCanvasVersionLimit = 20
)

// PlaygroundCanvasProject stores a user-owned workbench canvas document.
// Doc/Cover are deliberately TEXT/varchar (rather than dialect-specific JSON
// types) so the same schema works on SQLite, MySQL, and PostgreSQL.
// UpdatedAt doubles as the compare-and-swap token for concurrent saves.
type PlaygroundCanvasProject struct {
	Id     int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId int    `json:"-" gorm:"not null;index"`
	Title  string `json:"title" gorm:"type:varchar(255);not null"`
	Doc    string `json:"doc" gorm:"type:text"`
	Cover  string `json:"cover" gorm:"type:varchar(500)"`
	// Legacy inspiration-canvas columns. The table shipped with these as NOT
	// NULL, so the fields stay on the struct to keep inserts valid on every
	// supported database; they are no longer part of the API surface.
	Snapshot              string `json:"-" gorm:"type:text;not null"`
	Revision              int    `json:"-" gorm:"not null"`
	InspirationTemplateId int    `json:"-" gorm:"not null;index"`
	InspirationVersionId  int    `json:"-" gorm:"not null;index"`
	CreatedAt             int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt             int64  `json:"updated_at" gorm:"bigint;index"`
}

func (PlaygroundCanvasProject) TableName() string { return "playground_canvas_projects" }

// PlaygroundCanvasVersion is a periodic snapshot of a canvas document used by
// the version-history UI.
type PlaygroundCanvasVersion struct {
	Id        int    `json:"id" gorm:"primaryKey;autoIncrement"`
	ProjectId int    `json:"project_id" gorm:"not null;index"`
	UserId    int    `json:"-" gorm:"not null;index"`
	Title     string `json:"title" gorm:"type:varchar(255);not null"`
	Doc       string `json:"doc,omitempty" gorm:"type:text"`
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
}

func (PlaygroundCanvasVersion) TableName() string { return "playground_canvas_versions" }

// PlaygroundCanvasShare stores only a one-way digest of the public token.
// A project has at most one active share; rotating replaces its digest.
type PlaygroundCanvasShare struct {
	Id        int    `json:"-" gorm:"primaryKey;autoIncrement"`
	ProjectId int    `json:"project_id" gorm:"not null;uniqueIndex"`
	UserId    int    `json:"-" gorm:"not null;index"`
	TokenHash string `json:"-" gorm:"type:varchar(64);not null;uniqueIndex"`
	ExpiresAt int64  `json:"expires_at" gorm:"bigint;not null"`
	RevokedAt int64  `json:"revoked_at" gorm:"bigint;not null"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;not null"`
	UpdatedAt int64  `json:"updated_at" gorm:"bigint;not null"`
}

func (PlaygroundCanvasShare) TableName() string { return "playground_canvas_shares" }

func PlaygroundCanvasShareTokenHash(token string) string {
	digest := sha256.Sum256([]byte(token))
	return hex.EncodeToString(digest[:])
}

func UpsertPlaygroundCanvasShare(projectId, userId int, tokenHash string, expiresAt int64) (*PlaygroundCanvasShare, error) {
	if _, err := GetPlaygroundCanvasProject(projectId, userId); err != nil {
		return nil, err
	}
	now := time.Now().Unix()
	share := &PlaygroundCanvasShare{ProjectId: projectId, UserId: userId}
	err := DB.Where("project_id = ? AND user_id = ?", projectId, userId).First(share).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		share.TokenHash = tokenHash
		share.ExpiresAt = expiresAt
		share.CreatedAt = now
		share.UpdatedAt = now
		return share, DB.Create(share).Error
	}
	if err != nil {
		return nil, err
	}
	share.TokenHash = tokenHash
	share.ExpiresAt = expiresAt
	share.RevokedAt = 0
	share.UpdatedAt = now
	return share, DB.Save(share).Error
}

func GetPlaygroundCanvasShareStatus(projectId, userId int) (*PlaygroundCanvasShare, error) {
	var share PlaygroundCanvasShare
	err := DB.Where("project_id = ? AND user_id = ?", projectId, userId).First(&share).Error
	return &share, err
}

func GetActivePlaygroundCanvasShare(token string, now int64) (*PlaygroundCanvasShare, *PlaygroundCanvasProject, error) {
	var share PlaygroundCanvasShare
	err := DB.Where("token_hash = ? AND revoked_at = 0 AND (expires_at = 0 OR expires_at > ?)", PlaygroundCanvasShareTokenHash(token), now).First(&share).Error
	if err != nil {
		return nil, nil, err
	}
	var project PlaygroundCanvasProject
	if err := DB.Where("id = ? AND user_id = ?", share.ProjectId, share.UserId).First(&project).Error; err != nil {
		return nil, nil, err
	}
	return &share, &project, nil
}

func RevokePlaygroundCanvasShare(projectId, userId int) error {
	result := DB.Model(&PlaygroundCanvasShare{}).
		Where("project_id = ? AND user_id = ?", projectId, userId).
		Updates(map[string]any{"revoked_at": time.Now().Unix(), "updated_at": time.Now().Unix()})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func CreatePlaygroundCanvasProject(project *PlaygroundCanvasProject) error {
	now := time.Now().Unix()
	project.CreatedAt = now
	project.UpdatedAt = now
	return DB.Create(project).Error
}

// ListPlaygroundCanvasProjects returns project metadata (no document payload)
// for the workbench project grid. Legacy inspiration-canvas rows, which never
// carry a doc, are excluded.
func ListPlaygroundCanvasProjects(userId, offset, limit int) ([]PlaygroundCanvasProject, int64, error) {
	base := DB.Model(&PlaygroundCanvasProject{}).
		Where("user_id = ? AND doc IS NOT NULL AND doc <> ''", userId)
	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var projects []PlaygroundCanvasProject
	err := base.
		Select("id", "title", "cover", "created_at", "updated_at").
		Order("updated_at DESC, id DESC").
		Offset(offset).Limit(limit).
		Find(&projects).Error
	return projects, total, err
}

func GetPlaygroundCanvasProject(id, userId int) (*PlaygroundCanvasProject, error) {
	var project PlaygroundCanvasProject
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(&project).Error
	return &project, err
}

// UpdatePlaygroundCanvasProject applies updates only when the stored
// updated_at still equals baseUpdatedAt, and always advances the token even
// for same-second saves. gorm.ErrRecordNotFound signals either a missing row
// or a lost CAS race; callers disambiguate with a follow-up read.
func UpdatePlaygroundCanvasProject(id, userId int, baseUpdatedAt int64, updates map[string]any) (int64, error) {
	newUpdatedAt := time.Now().Unix()
	if newUpdatedAt <= baseUpdatedAt {
		newUpdatedAt = baseUpdatedAt + 1
	}
	updates["updated_at"] = newUpdatedAt
	result := DB.Model(&PlaygroundCanvasProject{}).
		Where("id = ? AND user_id = ? AND updated_at = ?", id, userId, baseUpdatedAt).
		Updates(updates)
	if result.Error != nil {
		return 0, result.Error
	}
	if result.RowsAffected == 0 {
		return 0, gorm.ErrRecordNotFound
	}
	return newUpdatedAt, nil
}

func DeletePlaygroundCanvasProject(id, userId int) error {
	result := DB.Where("id = ? AND user_id = ?", id, userId).Delete(&PlaygroundCanvasProject{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	if err := DB.Where("project_id = ?", id).Delete(&PlaygroundCanvasVersion{}).Error; err != nil {
		return err
	}
	return DB.Where("project_id = ?", id).Delete(&PlaygroundCanvasShare{}).Error
}

// SnapshotPlaygroundCanvasProject stores the project's current document as a
// version, throttled to one snapshot per interval, and prunes old snapshots
// beyond the per-project limit.
func SnapshotPlaygroundCanvasProject(project *PlaygroundCanvasProject) error {
	now := time.Now().Unix()
	var newest PlaygroundCanvasVersion
	err := DB.
		Where("project_id = ? AND user_id = ?", project.Id, project.UserId).
		Order("created_at DESC, id DESC").
		First(&newest).Error
	if err == nil && now-newest.CreatedAt < PlaygroundCanvasVersionInterval {
		return nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	version := &PlaygroundCanvasVersion{
		ProjectId: project.Id,
		UserId:    project.UserId,
		Title:     project.Title,
		Doc:       project.Doc,
		CreatedAt: now,
	}
	if err := DB.Create(version).Error; err != nil {
		return err
	}
	return prunePlaygroundCanvasVersions(project.Id)
}

func prunePlaygroundCanvasVersions(projectId int) error {
	var keepIds []int
	err := DB.Model(&PlaygroundCanvasVersion{}).
		Where("project_id = ?", projectId).
		Order("created_at DESC, id DESC").
		Limit(PlaygroundCanvasVersionLimit).
		Pluck("id", &keepIds).Error
	if err != nil {
		return err
	}
	if len(keepIds) < PlaygroundCanvasVersionLimit {
		return nil
	}
	return DB.Where("project_id = ? AND id NOT IN ?", projectId, keepIds).
		Delete(&PlaygroundCanvasVersion{}).Error
}

// ListPlaygroundCanvasVersions returns version metadata without document
// payloads; use GetPlaygroundCanvasVersion for the full snapshot.
func ListPlaygroundCanvasVersions(projectId, userId int) ([]PlaygroundCanvasVersion, error) {
	var versions []PlaygroundCanvasVersion
	err := DB.Model(&PlaygroundCanvasVersion{}).
		Where("project_id = ? AND user_id = ?", projectId, userId).
		Select("id", "project_id", "title", "created_at").
		Order("created_at DESC, id DESC").
		Find(&versions).Error
	return versions, err
}

func GetPlaygroundCanvasVersion(versionId, projectId, userId int) (*PlaygroundCanvasVersion, error) {
	var version PlaygroundCanvasVersion
	err := DB.
		Where("id = ? AND project_id = ? AND user_id = ?", versionId, projectId, userId).
		First(&version).Error
	return &version, err
}
