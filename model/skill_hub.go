package model

import (
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
	skillHubKeywordMaxRunes = 128
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

type SkillHubTag struct {
	Id          int            `json:"-" gorm:"primaryKey"`
	Name        string         `json:"name" gorm:"size:64;not null;uniqueIndex:uk_skill_hub_tag_name_delete_at,priority:1"`
	Sort        int            `json:"sort" gorm:"default:0;index"`
	CreatedTime int64          `json:"createdTime" gorm:"bigint"`
	UpdatedTime int64          `json:"updatedTime" gorm:"bigint"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index;uniqueIndex:uk_skill_hub_tag_name_delete_at,priority:2"`
}

type SkillHubTagResponse struct {
	ID         int    `json:"id"`
	Name       string `json:"name"`
	Sort       int    `json:"sort"`
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

func ValidateSkillHubTag(t *SkillHubTag) error {
	if t.Name == "" {
		return errors.New("tag name is required")
	}
	if len([]rune(t.Name)) > 32 {
		return errors.New("tag name must be 32 characters or fewer")
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
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(s).Error; err != nil {
			return err
		}
		return upsertSkillHubTagsTx(tx, stringListFromJSON(s.Tags))
	})
}

func (s *SkillHubSkill) Update() error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(s).Error; err != nil {
			return err
		}
		return upsertSkillHubTagsTx(tx, stringListFromJSON(s.Tags))
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

func SearchSkillHubSkills(keyword string, admin bool, offset int, limit int) ([]*SkillHubSkill, int64, error) {
	db := DB.Model(&SkillHubSkill{})
	if !admin {
		db = db.Where("status = ?", SkillHubStatusPublished)
	}
	like, err := skillHubContainsLikePattern(keyword)
	if err != nil {
		return nil, 0, err
	}
	if like != "" {
		db = db.Where(
			"(skill_id LIKE ? ESCAPE '!' OR name LIKE ? ESCAPE '!' OR description LIKE ? ESCAPE '!' OR tags LIKE ? ESCAPE '!')",
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
	err = db.Order("sort DESC, updated_time DESC, id DESC").Offset(offset).Limit(limit).Find(&skills).Error
	return skills, total, err
}

func SearchSkillHubSkillsByTagIDs(tagIDs []int, keyword string, admin bool, offset int, limit int) ([]*SkillHubSkill, int64, error) {
	tags, err := GetSkillHubTagsByIDs(tagIDs)
	if err != nil {
		return nil, 0, err
	}
	if len(tags) == 0 {
		return []*SkillHubSkill{}, 0, nil
	}

	wantedTags := make(map[string]struct{}, len(tags))
	conditions := make([]string, 0, len(tags))
	args := make([]any, 0, len(tags))
	for _, tag := range tags {
		name := strings.TrimSpace(tag.Name)
		if name == "" {
			continue
		}
		wantedTags[strings.ToLower(name)] = struct{}{}
		like, err := skillHubContainsLikePattern(name)
		if err != nil {
			return nil, 0, err
		}
		conditions = append(conditions, "tags LIKE ? ESCAPE '!'")
		args = append(args, like)
	}
	if len(wantedTags) == 0 {
		return []*SkillHubSkill{}, 0, nil
	}

	db := DB.Model(&SkillHubSkill{})
	if !admin {
		db = db.Where("status = ?", SkillHubStatusPublished)
	}
	if len(conditions) > 0 {
		db = db.Where("("+strings.Join(conditions, " OR ")+")", args...)
	}
	keywordLike, err := skillHubContainsLikePattern(keyword)
	if err != nil {
		return nil, 0, err
	}
	if keywordLike != "" {
		db = db.Where(
			"(skill_id LIKE ? ESCAPE '!' OR name LIKE ? ESCAPE '!' OR description LIKE ? ESCAPE '!' OR tags LIKE ? ESCAPE '!')",
			keywordLike,
			keywordLike,
			keywordLike,
			keywordLike,
		)
	}

	var candidates []*SkillHubSkill
	if err := db.Order("sort DESC, updated_time DESC, id DESC").Find(&candidates).Error; err != nil {
		return nil, 0, err
	}

	filtered := make([]*SkillHubSkill, 0, len(candidates))
	for _, skill := range candidates {
		if skillHubSkillHasAnyTag(skill, wantedTags) {
			filtered = append(filtered, skill)
		}
	}

	total := int64(len(filtered))
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = len(filtered)
	}
	if offset >= len(filtered) {
		return []*SkillHubSkill{}, total, nil
	}
	end := offset + limit
	if end > len(filtered) {
		end = len(filtered)
	}
	return filtered[offset:end], total, nil
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
	if err := SyncSkillHubTagsFromSkills(); err != nil {
		return nil, 0, err
	}

	db := DB.Model(&SkillHubTag{})
	like, err := skillHubContainsLikePattern(keyword)
	if err != nil {
		return nil, 0, err
	}
	if like != "" {
		db = db.Where("name LIKE ? ESCAPE '!'", like)
	}
	if publishedOnly {
		var allTags []*SkillHubTag
		if err := db.Order("sort DESC, name ASC, id DESC").Find(&allTags).Error; err != nil {
			return nil, 0, err
		}
		names := make([]string, 0, len(allTags))
		for _, tag := range allTags {
			names = append(names, tag.Name)
		}
		counts, err := SkillHubTagUsageCounts(names, true)
		if err != nil {
			return nil, 0, err
		}
		usedTags := make([]*SkillHubTag, 0, len(allTags))
		for _, tag := range allTags {
			if counts[tag.Name] > 0 {
				usedTags = append(usedTags, tag)
			}
		}
		total := int64(len(usedTags))
		if offset < 0 {
			offset = 0
		}
		if limit <= 0 {
			limit = len(usedTags)
		}
		if offset >= len(usedTags) {
			return []*SkillHubTag{}, total, nil
		}
		end := offset + limit
		if end > len(usedTags) {
			end = len(usedTags)
		}
		return usedTags[offset:end], total, nil
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var tags []*SkillHubTag
	err = db.Order("sort DESC, name ASC, id DESC").Offset(offset).Limit(limit).Find(&tags).Error
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
		responses = append(responses, tag.ToResponse(counts[tag.Name]))
	}
	return responses, nil
}

func (t *SkillHubTag) ToResponse(usageCount int64) SkillHubTagResponse {
	response := SkillHubTagResponse{
		ID:         t.Id,
		Name:       t.Name,
		Sort:       t.Sort,
		UsageCount: usageCount,
	}
	if t.CreatedTime > 0 {
		response.CreatedAt = time.Unix(t.CreatedTime, 0).UTC().Format(time.RFC3339)
	}
	if t.UpdatedTime > 0 {
		response.UpdatedAt = time.Unix(t.UpdatedTime, 0).UTC().Format(time.RFC3339)
	}
	return response
}

func SyncSkillHubTagsFromSkills() error {
	var skills []SkillHubSkill
	if err := DB.Select("tags").Find(&skills).Error; err != nil {
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
	return upsertSkillHubTagsTx(DB, tags)
}

func SkillHubTagUsageCounts(names []string, publishedOnly ...bool) (map[string]int64, error) {
	counts := make(map[string]int64, len(names))
	nameByKey := map[string]string{}
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		counts[name] = 0
		nameByKey[strings.ToLower(name)] = name
	}
	if len(nameByKey) == 0 {
		return counts, nil
	}

	var skills []SkillHubSkill
	query := DB.Select("tags")
	if len(publishedOnly) > 0 && publishedOnly[0] {
		query = query.Where("status = ?", SkillHubStatusPublished)
	}
	if err := query.Find(&skills).Error; err != nil {
		return counts, err
	}
	for _, skill := range skills {
		usedInSkill := map[string]struct{}{}
		for _, tag := range stringListFromJSON(skill.Tags) {
			if name, ok := nameByKey[strings.ToLower(strings.TrimSpace(tag))]; ok {
				usedInSkill[name] = struct{}{}
			}
		}
		for name := range usedInSkill {
			counts[name]++
		}
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

func skillHubSkillHasAnyTag(skill *SkillHubSkill, wantedTags map[string]struct{}) bool {
	for _, tag := range stringListFromJSON(skill.Tags) {
		if _, ok := wantedTags[strings.ToLower(strings.TrimSpace(tag))]; ok {
			return true
		}
	}
	return false
}

func upsertSkillHubTagsTx(tx *gorm.DB, tags []string) error {
	for _, tag := range stringListFromJSON(StringListToJSON(tags)) {
		item := SkillHubTag{Name: tag}
		if err := tx.Where("name = ?", tag).FirstOrCreate(&item).Error; err != nil {
			return err
		}
	}
	return nil
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
