package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// GetAllSkills 获取技能列表（支持分页和 tag 过滤）
func GetAllSkills(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	tag := c.Query("tag")

	skills, err := model.GetAllSkills(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), tag)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	total, err := model.CountSkills(tag)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(skills)
	common.ApiSuccess(c, pageInfo)
}

// GetSkill 获取单个技能详情
func GetSkill(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorMsg(c, "Invalid skill ID")
		return
	}

	skill, err := model.GetSkillById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, skill)
}

// CreateSkillRequest 创建技能请求结构
type CreateSkillRequest struct {
	Slug             string                  `json:"slug" binding:"required"`
	Title            string                  `json:"title" binding:"required"`
	Description      string                  `json:"description"`
	AvatarUrl        *string                 `json:"avatar_url"`
	CategoryId       int                     `json:"category_id"`
	CategoryAvatarUrl string                  `json:"category_avatar_url"`
	Version          string                  `json:"version"`
	ActualUrl        string                  `json:"actual_url"`
	Tag              string                  `json:"tag"`
	Downloads        int                     `json:"downloads"`
	Stars            int                     `json:"stars"`
	CoreFeatures     []model.SkillCoreFeature `json:"core_features"`
	UseCases         []string                `json:"use_cases"`
	IsActive         bool                    `json:"is_active"`
}

// AddSkill 创建技能
func AddSkill(c *gin.Context) {
	var req CreateSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	skill := &model.Skill{
		Slug:             req.Slug,
		Title:            req.Title,
		Description:      req.Description,
		AvatarUrl:        req.AvatarUrl,
		CategoryId:       req.CategoryId,
		CategoryAvatarUrl: req.CategoryAvatarUrl,
		Version:          req.Version,
		ActualUrl:        req.ActualUrl,
		Tag:              req.Tag,
		Downloads:        req.Downloads,
		Stars:            req.Stars,
		CoreFeatures:     req.CoreFeatures,
		UseCases:         req.UseCases,
		IsActive:         req.IsActive,
	}

	if err := model.CreateSkill(skill); err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, skill)
}

// UpdateSkillRequest 更新技能请求结构
type UpdateSkillRequest struct {
	Slug             string                  `json:"slug"`
	Title            string                  `json:"title"`
	Description      string                  `json:"description"`
	AvatarUrl        *string                 `json:"avatar_url"`
	CategoryId       int                     `json:"category_id"`
	CategoryAvatarUrl string                  `json:"category_avatar_url"`
	Version          string                  `json:"version"`
	ActualUrl        string                  `json:"actual_url"`
	Tag              string                  `json:"tag"`
	Downloads        int                     `json:"downloads"`
	Stars            int                     `json:"stars"`
	CoreFeatures     []model.SkillCoreFeature `json:"core_features"`
	UseCases         []string                `json:"use_cases"`
	IsActive         bool                    `json:"is_active"`
}

// UpdateSkill 更新技能
func UpdateSkill(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorMsg(c, "Invalid skill ID")
		return
	}

	skill, err := model.GetSkillById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var req UpdateSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	// 更新字段（只更新非零值）
	if req.Slug != "" {
		skill.Slug = req.Slug
	}
	if req.Title != "" {
		skill.Title = req.Title
	}
	if req.Description != "" {
		skill.Description = req.Description
	}
	if req.AvatarUrl != nil {
		skill.AvatarUrl = req.AvatarUrl
	}
	if req.CategoryId != 0 {
		skill.CategoryId = req.CategoryId
	}
	skill.CategoryAvatarUrl = req.CategoryAvatarUrl
	if req.Version != "" {
		skill.Version = req.Version
	}
	if req.ActualUrl != "" {
		skill.ActualUrl = req.ActualUrl
	}
	if req.Tag != "" {
		skill.Tag = req.Tag
	}
	skill.Downloads = req.Downloads
	skill.Stars = req.Stars
	if req.CoreFeatures != nil {
		skill.CoreFeatures = req.CoreFeatures
	}
	if req.UseCases != nil {
		skill.UseCases = req.UseCases
	}
	skill.IsActive = req.IsActive

	if err := model.UpdateSkill(skill); err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, skill)
}

// DeleteSkill 删除技能
func DeleteSkill(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorMsg(c, "Invalid skill ID")
		return
	}

	if err := model.DeleteSkill(id); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Skill deleted successfully",
	})
}

// SearchSkills 搜索技能
func SearchSkills(c *gin.Context) {
	keyword := c.Query("keyword")
	pageInfo := common.GetPageQuery(c)

	skills, total, err := model.SearchSkills(keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(skills)
	common.ApiSuccess(c, pageInfo)
}

// GetAllSkillTags 获取所有标签
func GetAllSkillTags(c *gin.Context) {
	tags, err := model.GetAllSkillTags()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, gin.H{
		"tags": tags,
	})
}

// DownloadSkill 下载技能文件并增加下载计数
func DownloadSkill(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorMsg(c, "Invalid skill ID")
		return
	}

	skill, err := model.GetSkillById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 增加下载计数
	_ = model.IncrementDownloads(id)

	// 返回下载 URL
	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"download_url": skill.ActualUrl,
		"skill":      skill,
	})
}