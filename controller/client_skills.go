package controller

import (
	"encoding/json"
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ClientSkill struct {
	ID              int      `json:"id"`
	Name            string   `json:"name"`
	DisplayName     string   `json:"display_name,omitempty"`
	DisplayNameZh   string   `json:"display_name_zh,omitempty"`
	Description     string   `json:"description"`
	DescriptionZh   string   `json:"description_zh,omitempty"`
	Category        string   `json:"category"`
	Tags            []string `json:"tags"`
	Source          string   `json:"source"`
	SourcePlatform  string   `json:"source_platform,omitempty"`
	SourceSkillID   string   `json:"source_skill_id,omitempty"`
	SourceSlug      string   `json:"source_slug,omitempty"`
	SourceUpdatedAt int64    `json:"source_updated_at,omitempty"`
	URL             string   `json:"url"`
	DownloadURL     string   `json:"download_url,omitempty"`
	Author          string   `json:"author,omitempty"`
	Version         string   `json:"version,omitempty"`
	Downloads       int      `json:"downloads,omitempty"`
	Enabled         bool     `json:"enabled"`
	IsPublic        bool     `json:"is_public"`
	SortOrder       int      `json:"sort_order"`
}

var defaultClientPublicSkills = []ClientSkill{
	{
		ID:          1,
		Name:        "self-improving-agent",
		Description: "A self-improving coding and workflow agent from SkillHub, proxied through New API for myclaw.",
		Category:    "开发技术",
		Tags:        []string{"agent", "coding", "automation", "skillhub"},
		Source:      "community",
		URL:         "https://skillhub.cn/skills/self-improving-agent",
		DownloadURL: "https://api.skillhub.cn/api/v1/download?slug=self-improving-agent",
		Author:      "SkillHub",
		Version:     "3.0.6",
		Downloads:   0,
		Enabled:     true,
		IsPublic:    true,
	},
}

func toClientSkill(item *model.ClientSkillMarketItem) ClientSkill {
	return ClientSkill{
		ID:              item.Id,
		Name:            item.Name,
		DisplayName:     item.DisplayName,
		DisplayNameZh:   item.DisplayNameZh,
		Description:     item.Description,
		DescriptionZh:   item.DescriptionZh,
		Category:        item.Category,
		Tags:            item.TagList(),
		Source:          item.Source,
		SourcePlatform:  item.SourcePlatform,
		SourceSkillID:   item.SourceSkillID,
		SourceSlug:      item.SourceSlug,
		SourceUpdatedAt: item.SourceUpdatedAt,
		URL:             item.URL,
		DownloadURL:     item.DownloadURL,
		Author:          item.Author,
		Version:         item.Version,
		Downloads:       item.Downloads,
		Enabled:         item.Enabled,
		IsPublic:        item.IsPublic,
		SortOrder:       item.SortOrder,
	}
}

type AdminUpsertClientSkillRequest struct {
	Skill ClientSkill `json:"skill"`
}

type AdminUpdateClientSkillStatusRequest struct {
	Enabled  *bool `json:"enabled"`
	IsPublic *bool `json:"is_public"`
}

func tagsToJSON(tags []string) (model.JSONValue, error) {
	if tags == nil {
		tags = []string{}
	}
	tagBytes, err := json.Marshal(tags)
	if err != nil {
		return nil, err
	}
	return model.JSONValue(tagBytes), nil
}

func normalizeClientSkillInput(skill ClientSkill) (*model.ClientSkillMarketItem, error) {
	name := strings.TrimSpace(skill.Name)
	if name == "" {
		return nil, errors.New("技能原始名称不能为空")
	}

	tags, err := tagsToJSON(skill.Tags)
	if err != nil {
		return nil, err
	}

	source := strings.TrimSpace(skill.Source)
	if source == "" {
		source = "community"
	}

	sourcePlatform := strings.TrimSpace(skill.SourcePlatform)
	if sourcePlatform == "" {
		sourcePlatform = "manual"
	}

	return &model.ClientSkillMarketItem{
		Name:            name,
		DisplayName:     strings.TrimSpace(skill.DisplayName),
		DisplayNameZh:   strings.TrimSpace(skill.DisplayNameZh),
		Description:     strings.TrimSpace(skill.Description),
		DescriptionZh:   strings.TrimSpace(skill.DescriptionZh),
		Category:        strings.TrimSpace(skill.Category),
		Tags:            tags,
		Source:          source,
		SourcePlatform:  sourcePlatform,
		SourceSkillID:   strings.TrimSpace(skill.SourceSkillID),
		SourceSlug:      strings.TrimSpace(skill.SourceSlug),
		SourceUpdatedAt: skill.SourceUpdatedAt,
		URL:             strings.TrimSpace(skill.URL),
		DownloadURL:     strings.TrimSpace(skill.DownloadURL),
		Author:          strings.TrimSpace(skill.Author),
		Version:         strings.TrimSpace(skill.Version),
		Downloads:       skill.Downloads,
		Enabled:         skill.Enabled,
		IsPublic:        skill.IsPublic,
		SortOrder:       skill.SortOrder,
	}, nil
}

func loadClientPublicSkills() []ClientSkill {
	items, err := model.ListPublicClientSkillMarketItems()
	if err != nil {
		common.SysError("load client public skills from db failed: " + err.Error())
		return defaultClientPublicSkills
	}
	if len(items) == 0 {
		return defaultClientPublicSkills
	}

	skills := make([]ClientSkill, 0, len(items))
	for _, item := range items {
		skills = append(skills, toClientSkill(item))
	}
	return skills
}

func ClientListPublicSkills(c *gin.Context) {
	common.ApiSuccess(c, loadClientPublicSkills())
}

func ClientGetPublicSkill(c *gin.Context) {
	id, err := strconv.Atoi(strings.TrimSpace(c.Param("id")))
	if err != nil {
		common.ApiErrorMsg(c, "无效的技能 ID")
		return
	}

	item, err := model.GetPublicClientSkillMarketItemByID(id)
	if err == nil {
		common.ApiSuccess(c, toClientSkill(item))
		return
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		common.SysError("get client public skill from db failed: " + err.Error())
	}

	for _, skill := range defaultClientPublicSkills {
		if skill.ID == id {
			common.ApiSuccess(c, skill)
			return
		}
	}

	common.ApiErrorMsg(c, "技能不存在")
}

func ClientRecordSkillDownload(c *gin.Context) {
	id, err := strconv.Atoi(strings.TrimSpace(c.Param("id")))
	if err != nil {
		common.ApiErrorMsg(c, "无效的技能 ID")
		return
	}

	if err = model.IncrementClientSkillMarketDownload(id); err == nil {
		common.ApiSuccess(c, gin.H{"recorded": true})
		return
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		common.SysError("increment client public skill download failed: " + err.Error())
	}

	for _, skill := range defaultClientPublicSkills {
		if skill.ID == id {
			common.ApiSuccess(c, gin.H{"recorded": true})
			return
		}
	}

	common.ApiErrorMsg(c, "技能不存在")
}

func AdminListClientSkills(c *gin.Context) {
	items, err := model.ListClientSkillMarketItems()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	skills := make([]ClientSkill, 0, len(items))
	for _, item := range items {
		skills = append(skills, toClientSkill(item))
	}
	common.ApiSuccess(c, skills)
}

func AdminGetClientSkill(c *gin.Context) {
	id, err := strconv.Atoi(strings.TrimSpace(c.Param("id")))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的技能 ID")
		return
	}

	item, err := model.GetClientSkillMarketItemByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "技能不存在")
			return
		}
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, toClientSkill(item))
}

func AdminCreateClientSkill(c *gin.Context) {
	var req AdminUpsertClientSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	item, err := normalizeClientSkillInput(req.Skill)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	if err := model.DB.Create(item).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, toClientSkill(item))
}

func AdminUpdateClientSkill(c *gin.Context) {
	id, err := strconv.Atoi(strings.TrimSpace(c.Param("id")))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的技能 ID")
		return
	}

	var req AdminUpsertClientSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	item, err := normalizeClientSkillInput(req.Skill)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	updateMap := map[string]any{
		"name":              item.Name,
		"display_name":      item.DisplayName,
		"display_name_zh":   item.DisplayNameZh,
		"description":       item.Description,
		"description_zh":    item.DescriptionZh,
		"category":          item.Category,
		"tags":              item.Tags,
		"source":            item.Source,
		"source_platform":   item.SourcePlatform,
		"source_skill_id":   item.SourceSkillID,
		"source_slug":       item.SourceSlug,
		"source_updated_at": item.SourceUpdatedAt,
		"url":               item.URL,
		"download_url":      item.DownloadURL,
		"author":            item.Author,
		"version":           item.Version,
		"downloads":         item.Downloads,
		"enabled":           item.Enabled,
		"is_public":         item.IsPublic,
		"sort_order":        item.SortOrder,
		"updated_time":      common.GetTimestamp(),
	}

	result := model.DB.Model(&model.ClientSkillMarketItem{}).Where("id = ?", id).Updates(updateMap)
	if result.Error != nil {
		common.ApiError(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		common.ApiErrorMsg(c, "技能不存在")
		return
	}

	updated, err := model.GetClientSkillMarketItemByID(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, toClientSkill(updated))
}

func AdminUpdateClientSkillStatus(c *gin.Context) {
	id, err := strconv.Atoi(strings.TrimSpace(c.Param("id")))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的技能 ID")
		return
	}

	var req AdminUpdateClientSkillStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if req.Enabled == nil && req.IsPublic == nil {
		common.ApiErrorMsg(c, "至少提供一个状态字段")
		return
	}

	updateMap := map[string]any{
		"updated_time": common.GetTimestamp(),
	}
	if req.Enabled != nil {
		updateMap["enabled"] = *req.Enabled
	}
	if req.IsPublic != nil {
		updateMap["is_public"] = *req.IsPublic
	}

	result := model.DB.Model(&model.ClientSkillMarketItem{}).Where("id = ?", id).Updates(updateMap)
	if result.Error != nil {
		common.ApiError(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		common.ApiErrorMsg(c, "技能不存在")
		return
	}

	updated, err := model.GetClientSkillMarketItemByID(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, toClientSkill(updated))
}
