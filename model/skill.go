package model

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// SkillCoreFeature 技能核心特性
type SkillCoreFeature struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

// Skill 技能元数据模型
type Skill struct {
	Id               int                 `json:"id" gorm:"primaryKey;autoIncrement"`
	Slug             string              `json:"slug" gorm:"uniqueIndex;type:varchar(128);not null"`
	Title            string              `json:"title" gorm:"type:varchar(255);not null"`
	Description      string              `json:"description" gorm:"type:text"`
	AvatarUrl        *string             `json:"avatar_url" gorm:"type:varchar(512)"`
	CategoryId       int                 `json:"category_id" gorm:"type:int;default:0"`
	CategoryAvatarUrl string             `json:"category_avatar_url" gorm:"type:varchar(512);default:''"`
	Version          string              `json:"version" gorm:"type:varchar(32);default:'1.0.0'"`
	ActualUrl        string              `json:"actual_url" gorm:"type:varchar(512)"`
	Tag              string              `json:"tag" gorm:"type:varchar(128);index"`
	Downloads        int                 `json:"downloads" gorm:"type:int;default:0"`
	Stars            int                 `json:"stars" gorm:"type:int;default:0"`
	CoreFeatures     []SkillCoreFeature  `json:"core_features" gorm:"type:text;serializer:json"`
	UseCases         []string            `json:"use_cases" gorm:"type:text;serializer:json"`
	IsActive         bool                `json:"is_active" gorm:"default:true"`
	CreatedAt        time.Time           `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        time.Time           `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt        gorm.DeletedAt      `json:"-" gorm:"index"`
}

// TableName 指定表名
func (Skill) TableName() string {
	return "skills"
}

// CreateSkill 创建技能
func CreateSkill(skill *Skill) error {
	return DB.Create(skill).Error
}

// UpdateSkill 更新技能
func UpdateSkill(skill *Skill) error {
	return DB.Save(skill).Error
}

// DeleteSkill 删除技能（软删除）
func DeleteSkill(id int) error {
	return DB.Delete(&Skill{}, id).Error
}

// GetSkillById 根据 ID 获取技能
func GetSkillById(id int) (*Skill, error) {
	var skill Skill
	err := DB.First(&skill, id).Error
	if err != nil {
		return nil, err
	}
	return &skill, nil
}

// GetSkillBySlug 根据 Slug 获取技能
func GetSkillBySlug(slug string) (*Skill, error) {
	var skill Skill
	err := DB.Where("slug = ?", slug).First(&skill).Error
	if err != nil {
		return nil, err
	}
	return &skill, nil
}

// GetAllSkills 获取所有技能（支持分页和 tag 过滤）
func GetAllSkills(startIdx, pageSize int, tag string) ([]*Skill, error) {
	var skills []*Skill
	query := DB.Model(&Skill{}).Where("is_active = ?", true)

	if tag != "" {
		query = query.Where("tag = ?", tag)
	}

	err := query.Order("id DESC").Offset(startIdx).Limit(pageSize).Find(&skills).Error
	return skills, err
}

// CountSkills 统计技能数量（支持 tag 过滤）
func CountSkills(tag string) (int64, error) {
	var total int64
	query := DB.Model(&Skill{}).Where("is_active = ?", true)

	if tag != "" {
		query = query.Where("tag = ?", tag)
	}

	err := query.Count(&total).Error
	return total, err
}

// IncrementDownloads 增加下载次数
func IncrementDownloads(id int) error {
	return DB.Model(&Skill{}).Where("id = ?", id).
		UpdateColumn("downloads", DB.Raw("downloads + 1")).Error
}

// IncrementStars 增加星标数
func IncrementStars(id int, delta int) error {
	return DB.Model(&Skill{}).Where("id = ?", id).
		UpdateColumn("stars", DB.Raw("stars + ?", delta)).Error
}

// SearchSkills 搜索技能
func SearchSkills(keyword string, startIdx, pageSize int) ([]*Skill, int64, error) {
	var skills []*Skill
	var total int64

	query := DB.Model(&Skill{}).Where("is_active = ?", true)
	searchPattern := "%" + keyword + "%"

	query = query.Where("title LIKE ? OR description LIKE ? OR tag LIKE ?",
		searchPattern, searchPattern, searchPattern)

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Order("id DESC").Offset(startIdx).Limit(pageSize).Find(&skills).Error
	return skills, total, err
}

// GetAllSkillTags 获取所有标签（去重）
func GetAllSkillTags() ([]string, error) {
	var tags []string
	err := DB.Model(&Skill{}).
		Where("is_active = ? AND tag != ''", true).
		Distinct("tag").
		Pluck("tag", &tags).Error
	return tags, err
}

// InitSkillTable 初始化技能表（自动迁移）
func InitSkillTable() {
	err := DB.AutoMigrate(&Skill{})
	if err != nil {
		common.SysLog("Failed to migrate skill table: " + err.Error())
	}
}
