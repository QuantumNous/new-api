package model

import (
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	SkillHubStatusDraft     = 0
	SkillHubStatusPublished = 1
)

var skillHubIDPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)

type SkillHubSkill struct {
	Id                  int            `json:"-" gorm:"primaryKey"`
	SkillID             string         `json:"id" gorm:"column:skill_id;size:128;not null;uniqueIndex:uk_skill_hub_skill_id_delete_at,priority:1"`
	Name                string         `json:"name" gorm:"size:160;not null"`
	Description         string         `json:"description,omitempty" gorm:"type:text"`
	Version             string         `json:"version" gorm:"size:64;not null"`
	Author              string         `json:"author,omitempty" gorm:"size:128"`
	Icon                string         `json:"icon,omitempty" gorm:"type:text"`
	Tags                string         `json:"-" gorm:"type:text"`
	Verified            bool           `json:"verified" gorm:"default:false"`
	Recommended         bool           `json:"recommended" gorm:"default:false"`
	Status              int            `json:"status" gorm:"default:0;index"`
	Sort                int            `json:"sort" gorm:"default:0;index"`
	ConnectorMinVersion string         `json:"-" gorm:"size:64"`
	Platforms           string         `json:"-" gorm:"type:text"`
	Permissions         string         `json:"-" gorm:"type:text"`
	ManifestEntry       string         `json:"-" gorm:"size:128;default:SKILL.md"`
	ManifestPermissions string         `json:"-" gorm:"type:text"`
	ManifestTools       string         `json:"-" gorm:"type:text"`
	SourceType          string         `json:"-" gorm:"size:32;not null"`
	SourceURL           string         `json:"-" gorm:"type:text"`
	SourceRef           string         `json:"-" gorm:"type:text"`
	SourceChecksum      string         `json:"-" gorm:"size:128"`
	Changelog           string         `json:"changelog,omitempty" gorm:"type:text"`
	CreatedTime         int64          `json:"createdTime" gorm:"bigint"`
	UpdatedTime         int64          `json:"updatedTime" gorm:"bigint"`
	DeletedAt           gorm.DeletedAt `json:"-" gorm:"index;uniqueIndex:uk_skill_hub_skill_id_delete_at,priority:2"`
}

type SkillHubCompatibility struct {
	ConnectorMinVersion string   `json:"connectorMinVersion,omitempty"`
	Platforms           []string `json:"platforms,omitempty"`
}

type SkillHubManifest struct {
	Entry       string   `json:"entry,omitempty"`
	Permissions []string `json:"permissions,omitempty"`
	Tools       []string `json:"tools,omitempty"`
}

type SkillHubSource struct {
	Type     string `json:"type"`
	URL      string `json:"url,omitempty"`
	Ref      string `json:"ref,omitempty"`
	Checksum string `json:"checksum,omitempty"`
}

type SkillHubSkillResponse struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	Version     string         `json:"version"`
	Icon        string         `json:"icon,omitempty"`
	Tags        []string       `json:"tags,omitempty"`
	Verified    bool           `json:"verified"`
	Published   bool           `json:"published,omitempty"`
	Status      int            `json:"status,omitempty"`
	Sort        int            `json:"sort,omitempty"`
	UpdatedAt   string         `json:"updatedAt,omitempty"`
	Source      SkillHubSource `json:"source,omitempty"`
}

type SkillHubListResponse struct {
	Items []SkillHubSkillResponse `json:"items"`
	Total int64                   `json:"total"`
}

func (s *SkillHubSkill) BeforeSave(tx *gorm.DB) error {
	s.SkillID = strings.TrimSpace(s.SkillID)
	s.Name = strings.TrimSpace(s.Name)
	s.Version = strings.TrimSpace(s.Version)
	s.Icon = strings.TrimSpace(s.Icon)
	s.ManifestEntry = strings.TrimSpace(s.ManifestEntry)
	if s.ManifestEntry == "" {
		s.ManifestEntry = "SKILL.md"
	}
	s.SourceType = strings.ToLower(strings.TrimSpace(s.SourceType))
	s.SourceURL = strings.TrimSpace(s.SourceURL)
	s.SourceChecksum = strings.TrimSpace(s.SourceChecksum)
	if err := ValidateSkillHubSkill(s); err != nil {
		return err
	}
	now := common.GetTimestamp()
	if s.CreatedTime == 0 {
		s.CreatedTime = now
	}
	s.UpdatedTime = now
	return nil
}

func ValidateSkillHubSkill(s *SkillHubSkill) error {
	if !skillHubIDPattern.MatchString(s.SkillID) {
		return errors.New("skill id must use letters, numbers, dots, underscores, or dashes")
	}
	if s.Name == "" {
		return errors.New("skill name is required")
	}
	if s.Version == "" {
		return errors.New("skill version is required")
	}
	switch s.SourceType {
	case "zip":
	default:
		return errors.New("skill source type must be zip")
	}
	if s.SourceURL == "" {
		return errors.New("skill source url is required")
	}
	if !isAllowedSkillHubZipURL(s.SourceURL) {
		return errors.New("skill zip url must use https, except localhost during development")
	}
	if !isAllowedSkillHubIconURL(s.Icon) {
		return errors.New("skill icon must be uploaded to the configured OSS icon bucket")
	}
	return nil
}

func isAllowedSkillHubZipURL(value string) bool {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil {
		return false
	}
	if parsed.Scheme == "https" && parsed.Host != "" {
		return true
	}
	if parsed.Scheme != "http" {
		return false
	}
	if !common.GetEnvOrDefaultBool("SKILL_HUB_ALLOW_LOCAL_HTTP", false) && !common.DebugEnabled {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}

func isAllowedSkillHubIconURL(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return true
	}
	baseValue := strings.TrimRight(strings.TrimSpace(os.Getenv("SKILL_HUB_OSS_ICON_PUBLIC_BASE_URL")), "/")
	if baseValue == "" {
		return false
	}
	base, err := url.Parse(baseValue)
	if err != nil || base.Scheme != "https" || base.Host == "" || base.User != nil {
		return false
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return false
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return false
	}
	if !strings.EqualFold(parsed.Host, base.Host) {
		return false
	}
	basePath := strings.TrimRight(base.EscapedPath(), "/")
	iconPrefix := strings.Trim(strings.TrimSpace(os.Getenv("SKILL_HUB_OSS_ICON_PREFIX")), "/")
	if iconPrefix == "" {
		iconPrefix = "skill-hub/icons"
	}
	allowedPath := "/" + iconPrefix
	if basePath != "" {
		allowedPath = basePath + allowedPath
	}
	targetPath := strings.TrimRight(parsed.EscapedPath(), "/")
	if targetPath != allowedPath && !strings.HasPrefix(targetPath, allowedPath+"/") {
		return false
	}
	lowerPath := strings.ToLower(targetPath)
	return strings.HasSuffix(lowerPath, ".png") ||
		strings.HasSuffix(lowerPath, ".jpg") ||
		strings.HasSuffix(lowerPath, ".jpeg") ||
		strings.HasSuffix(lowerPath, ".webp")
}

func (s *SkillHubSkill) Insert() error {
	return DB.Create(s).Error
}

func (s *SkillHubSkill) Update() error {
	return DB.Save(s).Error
}

func GetSkillHubSkillBySkillID(skillID string) (*SkillHubSkill, error) {
	var skill SkillHubSkill
	err := DB.Where("skill_id = ?", strings.TrimSpace(skillID)).First(&skill).Error
	if err != nil {
		return nil, err
	}
	return &skill, nil
}

func IsSkillHubSkillIDDuplicated(id int, skillID string) (bool, error) {
	var count int64
	err := DB.Model(&SkillHubSkill{}).Where("skill_id = ? AND id <> ?", strings.TrimSpace(skillID), id).Count(&count).Error
	return count > 0, err
}

func SearchSkillHubSkills(keyword string, admin bool, offset int, limit int) ([]*SkillHubSkill, int64, error) {
	db := DB.Model(&SkillHubSkill{})
	if !admin {
		db = db.Where("status = ?", SkillHubStatusPublished)
	}
	if strings.TrimSpace(keyword) != "" {
		like := "%" + strings.TrimSpace(keyword) + "%"
		db = db.Where("skill_id LIKE ? OR name LIKE ? OR description LIKE ? OR tags LIKE ?", like, like, like, like)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var skills []*SkillHubSkill
	err := db.Order("sort DESC, updated_time DESC, id DESC").Offset(offset).Limit(limit).Find(&skills).Error
	return skills, total, err
}

func SkillHubSkillsToResponses(skills []*SkillHubSkill, admin bool) []SkillHubSkillResponse {
	responses := make([]SkillHubSkillResponse, 0, len(skills))
	for _, skill := range skills {
		responses = append(responses, skill.ToResponse(admin))
	}
	return responses
}

func (s *SkillHubSkill) ToResponse(admin bool) SkillHubSkillResponse {
	response := SkillHubSkillResponse{
		ID:          s.SkillID,
		Name:        s.Name,
		Description: s.Description,
		Version:     s.Version,
		Icon:        s.Icon,
		Tags:        stringListFromJSON(s.Tags),
		Verified:    s.Verified,
		Published:   s.Status == SkillHubStatusPublished,
		Status:      s.Status,
		Sort:        s.Sort,
		UpdatedAt:   time.Unix(s.UpdatedTime, 0).UTC().Format(time.RFC3339),
		Source: SkillHubSource{
			Type:     s.SourceType,
			URL:      s.SourceURL,
			Ref:      s.SourceRef,
			Checksum: s.SourceChecksum,
		},
	}
	if !admin {
		response.Published = false
		response.Status = 0
		response.Sort = 0
		response.Source.Ref = ""
	}
	return response
}

func StringListToJSON(values []string) string {
	clean := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		clean = append(clean, value)
	}
	content, _ := json.Marshal(clean)
	return string(content)
}

func stringListFromJSON(value string) []string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	var result []string
	if err := json.Unmarshal([]byte(value), &result); err != nil {
		return nil
	}
	return result
}
