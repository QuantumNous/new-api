package model

import (
	"errors"
	"net"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	SkillHubStatusDraft     = 0
	SkillHubStatusPublished = 1
	skillHubKeywordMaxRunes = 128
)

var skillHubIDPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)

const (
	skillHubSkillOrder          = "CASE WHEN sort = 0 THEN 1 ELSE 0 END ASC, sort ASC, updated_time DESC, id DESC"
	skillHubQualifiedSkillOrder = "CASE WHEN skill_hub_skills.sort = 0 THEN 1 ELSE 0 END ASC, skill_hub_skills.sort ASC, skill_hub_skills.updated_time DESC, skill_hub_skills.id DESC"
)

type SkillHubSkill struct {
	Id                  int            `json:"-" gorm:"primaryKey"`
	SkillID             string         `json:"id" gorm:"column:skill_id;size:128;not null;uniqueIndex:uk_skill_hub_skill_id_delete_at,priority:1"`
	Name                string         `json:"name" gorm:"size:160;not null"`
	Description         string         `json:"description,omitempty" gorm:"type:text"`
	Version             string         `json:"version" gorm:"size:64;not null"`
	Author              string         `json:"author,omitempty" gorm:"size:128"`
	Origin              string         `json:"origin,omitempty" gorm:"size:64"`
	OriginURL           string         `json:"originUrl,omitempty" gorm:"type:text"`
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
	Author      string         `json:"author,omitempty"`
	Origin      string         `json:"origin,omitempty"`
	OriginURL   string         `json:"originUrl,omitempty"`
	Icon        string         `json:"icon,omitempty"`
	Tags        []string       `json:"tags,omitempty"`
	Verified    bool           `json:"verified"`
	Recommended bool           `json:"recommended"`
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

type SkillHubTag struct {
	Id          int            `json:"-" gorm:"primaryKey"`
	Name        string         `json:"name" gorm:"size:64;not null;uniqueIndex:uk_skill_hub_tag_name_delete_at,priority:1"`
	Sort        int            `json:"sort" gorm:"default:0;index"`
	CreatedTime int64          `json:"createdTime" gorm:"bigint"`
	UpdatedTime int64          `json:"updatedTime" gorm:"bigint"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index;uniqueIndex:uk_skill_hub_tag_name_delete_at,priority:2"`
}

type SkillHubSkillTag struct {
	Id          int   `json:"-" gorm:"primaryKey"`
	SkillID     int   `json:"-" gorm:"column:skill_id;not null;uniqueIndex:uk_skill_hub_skill_tag,priority:1;index:idx_skill_hub_skill_tag_skill_id"`
	TagID       int   `json:"-" gorm:"column:tag_id;not null;uniqueIndex:uk_skill_hub_skill_tag,priority:2;index:idx_skill_hub_skill_tag_tag_id"`
	CreatedTime int64 `json:"-" gorm:"bigint"`
}

type SkillHubTagResponse struct {
	ID         int    `json:"id"`
	Name       string `json:"name"`
	Sort       int    `json:"sort,omitempty"`
	UsageCount int64  `json:"usageCount"`
	CreatedAt  string `json:"createdAt,omitempty"`
	UpdatedAt  string `json:"updatedAt,omitempty"`
}

type SkillHubTagListResponse struct {
	Items []SkillHubTagResponse `json:"items"`
	Total int64                 `json:"total"`
}

func (s *SkillHubSkill) BeforeSave(tx *gorm.DB) error {
	s.SkillID = strings.TrimSpace(s.SkillID)
	s.Name = strings.TrimSpace(s.Name)
	s.Version = strings.TrimSpace(s.Version)
	s.Origin = strings.TrimSpace(s.Origin)
	s.OriginURL = strings.TrimSpace(s.OriginURL)
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

func (t *SkillHubTag) BeforeSave(tx *gorm.DB) error {
	t.Name = strings.TrimSpace(t.Name)
	if err := ValidateSkillHubTag(t); err != nil {
		return err
	}
	now := common.GetTimestamp()
	if t.CreatedTime == 0 {
		t.CreatedTime = now
	}
	t.UpdatedTime = now
	return nil
}

func (t *SkillHubSkillTag) BeforeCreate(tx *gorm.DB) error {
	if t.CreatedTime == 0 {
		t.CreatedTime = common.GetTimestamp()
	}
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
	if len([]rune(s.Origin)) > 64 {
		return errors.New("skill origin must be 64 characters or fewer")
	}
	if len(s.OriginURL) > 2048 {
		return errors.New("skill origin url must be 2048 characters or fewer")
	}
	if !isAllowedSkillHubOriginURL(s.OriginURL) {
		return errors.New("skill origin url must be an absolute http or https url")
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
		return errors.New("skill zip url must use https, except localhost or private network hosts during development")
	}
	if !isAllowedSkillHubIconURL(s.Icon) {
		return errors.New("skill icon must be uploaded to the configured OSS icon bucket")
	}
	return nil
}

func isAllowedSkillHubOriginURL(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return true
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Host == "" || parsed.User != nil {
		return false
	}
	return parsed.Scheme == "http" || parsed.Scheme == "https"
}

func ValidateSkillHubTag(t *SkillHubTag) error {
	if t.Name == "" {
		return errors.New("tag name is required")
	}
	if len([]rune(t.Name)) > 40 {
		return errors.New("tag name must be 40 characters or fewer")
	}
	if strings.ContainsAny(t.Name, `/\`) {
		return errors.New("tag name cannot contain slashes")
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
	return isLocalSkillHubHTTPHost(host)
}

func isLocalSkillHubHTTPHost(host string) bool {
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast()
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
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(s).Error; err != nil {
			return err
		}
		tags := stringListFromJSON(s.Tags)
		if err := upsertSkillHubTagsTx(tx, tags); err != nil {
			return err
		}
		return replaceSkillHubSkillTagsTx(tx, s.Id, tags)
	})
}

func (s *SkillHubSkill) Update() error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(s).Error; err != nil {
			return err
		}
		tags := stringListFromJSON(s.Tags)
		if err := upsertSkillHubTagsTx(tx, tags); err != nil {
			return err
		}
		return replaceSkillHubSkillTagsTx(tx, s.Id, tags)
	})
}

func (s *SkillHubSkill) UpdateReturningPreviousObjects() (string, string, error) {
	var oldSourceRef string
	var oldIcon string
	err := DB.Transaction(func(tx *gorm.DB) error {
		var current SkillHubSkill
		query := tx
		if !common.UsingSQLite {
			query = query.Clauses(clause.Locking{Strength: "UPDATE"})
		}
		if err := query.Where("id = ?", s.Id).First(&current).Error; err != nil {
			return err
		}
		oldSourceRef = current.SourceRef
		oldIcon = current.Icon
		s.CreatedTime = current.CreatedTime
		if err := tx.Save(s).Error; err != nil {
			return err
		}
		tags := stringListFromJSON(s.Tags)
		if err := upsertSkillHubTagsTx(tx, tags); err != nil {
			return err
		}
		return replaceSkillHubSkillTagsTx(tx, s.Id, tags)
	})
	return oldSourceRef, oldIcon, err
}

func DeleteSkillHubSkill(skill *SkillHubSkill) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("skill_id = ?", skill.Id).Delete(&SkillHubSkillTag{}).Error; err != nil {
			return err
		}
		return tx.Delete(skill).Error
	})
}

func GetSkillHubSkillsBySkillIDs(skillIDs []string) ([]*SkillHubSkill, error) {
	if len(skillIDs) == 0 {
		return []*SkillHubSkill{}, nil
	}
	var skills []*SkillHubSkill
	err := DB.Where("skill_id IN ?", skillIDs).Order("skill_id ASC").Find(&skills).Error
	return skills, err
}

func DeleteSkillHubSkills(skills []*SkillHubSkill) error {
	if len(skills) == 0 {
		return nil
	}
	ids := make([]int, 0, len(skills))
	for _, skill := range skills {
		ids = append(ids, skill.Id)
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("skill_id IN ?", ids).Delete(&SkillHubSkillTag{}).Error; err != nil {
			return err
		}
		return tx.Delete(&SkillHubSkill{}, ids).Error
	})
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

func SearchSkillHubSkills(keyword string, admin bool, offset int, limit int, recommendedOnly ...bool) ([]*SkillHubSkill, int64, error) {
	db := DB.Model(&SkillHubSkill{})
	if !admin {
		db = db.Where("status = ?", SkillHubStatusPublished)
	}
	if len(recommendedOnly) > 0 && recommendedOnly[0] {
		db = db.Where("recommended = ?", true)
	}
	like, err := skillHubContainsLikePattern(keyword)
	if err != nil {
		return nil, 0, err
	}
	if like != "" {
		db = db.Where(
			"(skill_id LIKE ? ESCAPE '!' OR name LIKE ? ESCAPE '!' OR description LIKE ? ESCAPE '!' OR tags LIKE ? ESCAPE '!' OR origin LIKE ? ESCAPE '!' OR origin_url LIKE ? ESCAPE '!')",
			like,
			like,
			like,
			like,
			like,
			like,
		)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var skills []*SkillHubSkill
	err = db.Order(skillHubSkillOrder).Offset(offset).Limit(limit).Find(&skills).Error
	return skills, total, err
}

func SearchRecommendedSkillHubSkills(limit int) ([]*SkillHubSkill, int64, error) {
	if limit <= 0 {
		return []*SkillHubSkill{}, 0, nil
	}
	db := DB.Model(&SkillHubSkill{}).
		Where("status = ? AND recommended = ?", SkillHubStatusPublished, true)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	randomOrder := "RANDOM()"
	if common.UsingMySQL {
		randomOrder = "RAND()"
	}

	var skills []*SkillHubSkill
	err := db.Order(randomOrder).Limit(limit).Find(&skills).Error
	return skills, total, err
}

func SearchSkillHubSkillsByTagIDs(tagIDs []int, keyword string, admin bool, offset int, limit int, recommendedOnly ...bool) ([]*SkillHubSkill, int64, error) {
	tags, err := GetSkillHubTagsByIDs(tagIDs)
	if err != nil {
		return nil, 0, err
	}
	if len(tags) == 0 {
		return []*SkillHubSkill{}, 0, nil
	}

	cleanTagIDs := make([]int, 0, len(tags))
	for _, tag := range tags {
		if tag.Id > 0 {
			cleanTagIDs = append(cleanTagIDs, tag.Id)
		}
	}
	if len(cleanTagIDs) == 0 {
		return []*SkillHubSkill{}, 0, nil
	}

	db := DB.Model(&SkillHubSkill{}).
		Joins("JOIN skill_hub_skill_tags ON skill_hub_skill_tags.skill_id = skill_hub_skills.id").
		Where("skill_hub_skill_tags.tag_id IN ?", cleanTagIDs)
	if !admin {
		db = db.Where("status = ?", SkillHubStatusPublished)
	}
	if len(recommendedOnly) > 0 && recommendedOnly[0] {
		db = db.Where("skill_hub_skills.recommended = ?", true)
	}
	keywordLike, err := skillHubContainsLikePattern(keyword)
	if err != nil {
		return nil, 0, err
	}
	if keywordLike != "" {
		db = db.Where(
			"(skill_hub_skills.skill_id LIKE ? ESCAPE '!' OR skill_hub_skills.name LIKE ? ESCAPE '!' OR skill_hub_skills.description LIKE ? ESCAPE '!' OR skill_hub_skills.tags LIKE ? ESCAPE '!' OR skill_hub_skills.origin LIKE ? ESCAPE '!' OR skill_hub_skills.origin_url LIKE ? ESCAPE '!')",
			keywordLike,
			keywordLike,
			keywordLike,
			keywordLike,
			keywordLike,
			keywordLike,
		)
	}

	var total int64
	if err := db.Distinct("skill_hub_skills.id").Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var skills []*SkillHubSkill
	err = db.Distinct("skill_hub_skills.*").
		Order(skillHubQualifiedSkillOrder).
		Offset(offset).
		Limit(limit).
		Find(&skills).Error
	return skills, total, err
}

func SkillHubSkillsToResponses(skills []*SkillHubSkill, admin bool) []SkillHubSkillResponse {
	responses := make([]SkillHubSkillResponse, 0, len(skills))
	for _, skill := range skills {
		responses = append(responses, skill.ToResponse(admin))
	}
	return responses
}

func CreateSkillHubTag(name string, sort int) (*SkillHubTag, error) {
	tag := &SkillHubTag{
		Name: strings.TrimSpace(name),
		Sort: sort,
	}
	if err := ValidateSkillHubTag(tag); err != nil {
		return nil, err
	}

	var existing SkillHubTag
	err := DB.Where("LOWER(name) = ?", strings.ToLower(tag.Name)).First(&existing).Error
	if err == nil {
		return nil, errors.New("tag already exists")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if err := DB.Create(tag).Error; err != nil {
		return nil, err
	}
	return tag, nil
}

func SearchSkillHubTags(keyword string, publishedOnly bool, offset int, limit int) ([]*SkillHubTag, int64, error) {
	return searchSkillHubTags(keyword, publishedOnly, false, offset, limit)
}

func SearchSkillHubTagsWithSync(keyword string, publishedOnly bool, offset int, limit int) ([]*SkillHubTag, int64, error) {
	return searchSkillHubTags(keyword, publishedOnly, true, offset, limit)
}

func searchSkillHubTags(keyword string, publishedOnly bool, syncBeforeSearch bool, offset int, limit int) ([]*SkillHubTag, int64, error) {
	if syncBeforeSearch {
		if err := SyncSkillHubTagsFromSkills(); err != nil {
			return nil, 0, err
		}
	}

	db := DB.Model(&SkillHubTag{})
	if publishedOnly {
		db = db.
			Joins("JOIN skill_hub_skill_tags ON skill_hub_skill_tags.tag_id = skill_hub_tags.id").
			Joins("JOIN skill_hub_skills ON skill_hub_skills.id = skill_hub_skill_tags.skill_id AND skill_hub_skills.deleted_at IS NULL").
			Where("skill_hub_skills.status = ?", SkillHubStatusPublished)
	}
	like, err := skillHubContainsLikePattern(keyword)
	if err != nil {
		return nil, 0, err
	}
	if like != "" {
		db = db.Where("skill_hub_tags.name LIKE ? ESCAPE '!'", like)
	}
	var total int64
	if publishedOnly {
		if err := db.Distinct("skill_hub_tags.id").Count(&total).Error; err != nil {
			return nil, 0, err
		}
		var tags []*SkillHubTag
		err = db.Distinct("skill_hub_tags.*").
			Order("skill_hub_tags.sort DESC, skill_hub_tags.name ASC, skill_hub_tags.id DESC").
			Offset(offset).
			Limit(limit).
			Find(&tags).Error
		return tags, total, err
	}
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var tags []*SkillHubTag
	err = db.Order("skill_hub_tags.sort DESC, skill_hub_tags.name ASC, skill_hub_tags.id DESC").Offset(offset).Limit(limit).Find(&tags).Error
	return tags, total, err
}

func GetSkillHubTagsByIDs(ids []int) ([]*SkillHubTag, error) {
	cleanIDs := make([]int, 0, len(ids))
	seen := map[int]struct{}{}
	for _, id := range ids {
		if id <= 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		cleanIDs = append(cleanIDs, id)
	}
	if len(cleanIDs) == 0 {
		return []*SkillHubTag{}, nil
	}
	var tags []*SkillHubTag
	err := DB.Where("id IN ?", cleanIDs).Find(&tags).Error
	return tags, err
}

func DeleteSkillHubTag(name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return errors.New("tag name is required")
	}
	var tag SkillHubTag
	if err := DB.Where("name = ?", name).First(&tag).Error; err != nil {
		return err
	}
	counts, err := SkillHubTagUsageCounts([]string{tag.Name})
	if err != nil {
		return err
	}
	if counts[tag.Name] > 0 {
		return errors.New("tag is still used by skills")
	}
	return DB.Delete(&tag).Error
}

func SkillHubTagsToResponses(tags []*SkillHubTag, publishedOnly bool) ([]SkillHubTagResponse, error) {
	names := make([]string, 0, len(tags))
	for _, tag := range tags {
		names = append(names, tag.Name)
	}
	counts, err := SkillHubTagUsageCounts(names, publishedOnly)
	if err != nil {
		return nil, err
	}

	responses := make([]SkillHubTagResponse, 0, len(tags))
	for _, tag := range tags {
		responses = append(responses, tag.ToResponse(counts[tag.Name], !publishedOnly))
	}
	return responses, nil
}

func (t *SkillHubTag) ToResponse(usageCount int64, admin bool) SkillHubTagResponse {
	response := SkillHubTagResponse{
		ID:         t.Id,
		Name:       t.Name,
		UsageCount: usageCount,
	}
	if !admin {
		return response
	}
	response.Sort = t.Sort
	if t.CreatedTime > 0 {
		response.CreatedAt = time.Unix(t.CreatedTime, 0).UTC().Format(time.RFC3339)
	}
	if t.UpdatedTime > 0 {
		response.UpdatedAt = time.Unix(t.UpdatedTime, 0).UTC().Format(time.RFC3339)
	}
	return response
}

func SyncSkillHubTagsFromSkills() error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var skills []SkillHubSkill
		if err := tx.Select("id", "tags").Find(&skills).Error; err != nil {
			return err
		}
		seen := map[string]string{}
		for _, skill := range skills {
			for _, tag := range stringListFromJSON(skill.Tags) {
				value := strings.TrimSpace(tag)
				key := strings.ToLower(value)
				if value == "" || seen[key] != "" {
					continue
				}
				seen[key] = value
			}
		}
		tags := make([]string, 0, len(seen))
		for _, tag := range seen {
			tags = append(tags, tag)
		}
		if err := upsertSkillHubTagsTx(tx, tags); err != nil {
			return err
		}
		if err := tx.Where("skill_id > ?", 0).Delete(&SkillHubSkillTag{}).Error; err != nil {
			return err
		}
		for _, skill := range skills {
			if err := insertSkillHubSkillTagsTx(tx, skill.Id, stringListFromJSON(skill.Tags)); err != nil {
				return err
			}
		}
		return nil
	})
}

func SkillHubTagUsageCounts(names []string, publishedOnly ...bool) (map[string]int64, error) {
	counts := make(map[string]int64, len(names))
	cleanNames := make([]string, 0, len(names))
	seen := map[string]struct{}{}
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		counts[name] = 0
		cleanNames = append(cleanNames, name)
	}
	if len(cleanNames) == 0 {
		return counts, nil
	}

	type tagUsageRow struct {
		Name  string
		Count int64
	}
	query := DB.Model(&SkillHubTag{}).
		Select("skill_hub_tags.name AS name, COUNT(DISTINCT skill_hub_skill_tags.skill_id) AS count").
		Joins("JOIN skill_hub_skill_tags ON skill_hub_skill_tags.tag_id = skill_hub_tags.id").
		Joins("JOIN skill_hub_skills ON skill_hub_skills.id = skill_hub_skill_tags.skill_id AND skill_hub_skills.deleted_at IS NULL").
		Where("skill_hub_tags.name IN ?", cleanNames)
	if len(publishedOnly) > 0 && publishedOnly[0] {
		query = query.Where("skill_hub_skills.status = ?", SkillHubStatusPublished)
	}
	var rows []tagUsageRow
	if err := query.Group("skill_hub_tags.name").Scan(&rows).Error; err != nil {
		return counts, err
	}
	for _, row := range rows {
		counts[row.Name] = row.Count
	}
	return counts, nil
}

func skillHubContainsLikePattern(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", nil
	}
	if len([]rune(value)) > skillHubKeywordMaxRunes {
		return "", errors.New("keyword is too long")
	}
	value = strings.ReplaceAll(value, "!", "!!")
	value = strings.ReplaceAll(value, "%", "!%")
	value = strings.ReplaceAll(value, "_", "!_")
	return "%" + value + "%", nil
}

func upsertSkillHubTagsTx(tx *gorm.DB, tags []string) error {
	for _, tag := range cleanSkillHubTagNames(tags) {
		var existing SkillHubTag
		err := tx.Where("LOWER(name) = ?", strings.ToLower(tag)).First(&existing).Error
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err := tx.Create(&SkillHubTag{Name: tag}).Error; err != nil {
			return err
		}
	}
	return nil
}

func replaceSkillHubSkillTagsTx(tx *gorm.DB, skillID int, tags []string) error {
	if err := tx.Where("skill_id = ?", skillID).Delete(&SkillHubSkillTag{}).Error; err != nil {
		return err
	}
	return insertSkillHubSkillTagsTx(tx, skillID, tags)
}

func insertSkillHubSkillTagsTx(tx *gorm.DB, skillID int, tags []string) error {
	if skillID <= 0 {
		return nil
	}
	tagNames := cleanSkillHubTagNames(tags)
	if len(tagNames) == 0 {
		return nil
	}
	lowerNames := make([]string, 0, len(tagNames))
	for _, name := range tagNames {
		lowerNames = append(lowerNames, strings.ToLower(name))
	}
	var tagRows []SkillHubTag
	if err := tx.Where("LOWER(name) IN ?", lowerNames).Find(&tagRows).Error; err != nil {
		return err
	}
	tagByKey := make(map[string]SkillHubTag, len(tagRows))
	for _, tag := range tagRows {
		tagByKey[strings.ToLower(strings.TrimSpace(tag.Name))] = tag
	}
	relations := make([]SkillHubSkillTag, 0, len(tagNames))
	seenTagIDs := map[int]struct{}{}
	for _, name := range tagNames {
		tag, ok := tagByKey[strings.ToLower(name)]
		if !ok || tag.Id <= 0 {
			continue
		}
		if _, ok := seenTagIDs[tag.Id]; ok {
			continue
		}
		seenTagIDs[tag.Id] = struct{}{}
		relations = append(relations, SkillHubSkillTag{
			SkillID: skillID,
			TagID:   tag.Id,
		})
	}
	if len(relations) == 0 {
		return nil
	}
	return tx.Create(&relations).Error
}

func cleanSkillHubTagNames(tags []string) []string {
	clean := make([]string, 0, len(tags))
	seen := map[string]struct{}{}
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		key := strings.ToLower(tag)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		clean = append(clean, tag)
	}
	return clean
}

func (s *SkillHubSkill) ToResponse(admin bool) SkillHubSkillResponse {
	response := SkillHubSkillResponse{
		ID:          s.SkillID,
		Name:        s.Name,
		Description: s.Description,
		Version:     s.Version,
		Author:      s.Author,
		Origin:      s.Origin,
		OriginURL:   s.OriginURL,
		Icon:        s.Icon,
		Tags:        stringListFromJSON(s.Tags),
		Verified:    s.Verified,
		Recommended: s.Recommended,
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
	content, _ := common.Marshal(clean)
	return string(content)
}

func stringListFromJSON(value string) []string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	var result []string
	if err := common.Unmarshal([]byte(value), &result); err != nil {
		return nil
	}
	return result
}

func StringListFromJSON(value string) []string {
	return stringListFromJSON(value)
}
