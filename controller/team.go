package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// parsePage 解析分页参数，缺省 page=1, pageSize=10。
func parsePage(c *gin.Context) (int, int) {
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 10
	}
	return page, pageSize
}

// ListTeams 分页列出团队。
func ListTeams(c *gin.Context) {
	page, pageSize := parsePage(c)
	keyword := c.Query("keyword")
	items, total, err := model.ListTeams(page, pageSize, keyword)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": items, "total": total})
}

// CreateTeam 创建团队。
func CreateTeam(c *gin.Context) {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		OwnerId     int64  `json:"owner_id"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Name == "" || len(req.Name) > 64 {
		common.ApiErrorMsg(c, "name is required and must be <= 64 characters")
		return
	}
	if req.OwnerId <= 0 {
		common.ApiErrorMsg(c, "owner_id is required")
		return
	}
	t := &model.Team{Name: req.Name, Description: req.Description, OwnerId: req.OwnerId}
	if err := model.CreateTeam(t); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": t.Id})
}

// GetTeam 获取单个团队。
func GetTeam(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	t, err := model.GetTeamById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, t)
}

// UpdateTeam 更新团队。
func UpdateTeam(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	var req struct {
		Description string `json:"description"`
		OwnerId     int64  `json:"owner_id"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateTeam(&model.Team{Id: id, Description: req.Description, OwnerId: req.OwnerId}); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ok": true})
}

// DeleteTeam 删除团队（级联成员与项目）。
func DeleteTeam(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	if err := model.DeleteTeam(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ok": true})
}

// AddTeamMember 添加团队成员。
func AddTeamMember(c *gin.Context) {
	teamId, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid team id")
		return
	}
	var req struct {
		UserId int64  `json:"user_id"`
		Role   string `json:"role"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.UserId <= 0 {
		common.ApiErrorMsg(c, "user_id is required")
		return
	}
	role := req.Role
	if role == "" {
		role = "member"
	}
	if !model.AllowedTeamMemberRoles[role] {
		common.ApiErrorMsg(c, "invalid role (expected admin|member)")
		return
	}
	m := &model.TeamMember{TeamId: teamId, UserId: req.UserId, Role: role}
	if err := model.CreateTeamMember(m); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": m.Id})
}

// ListTeamMembers 分页列出团队成员。
func ListTeamMembers(c *gin.Context) {
	teamId, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid team id")
		return
	}
	page, pageSize := parsePage(c)
	items, total, err := model.ListTeamMembers(teamId, page, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": items, "total": total})
}

// RemoveTeamMember 移除成员。
func RemoveTeamMember(c *gin.Context) {
	teamId, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid team id")
		return
	}
	userId, err := strconv.ParseInt(c.Param("user_id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid user_id")
		return
	}
	if err := model.DeleteTeamMember(teamId, userId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ok": true})
}

// AddTeamProject 添加团队项目。
func AddTeamProject(c *gin.Context) {
	teamId, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid team id")
		return
	}
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Name == "" || len(req.Name) > 64 {
		common.ApiErrorMsg(c, "name is required and must be <= 64 characters")
		return
	}
	p := &model.TeamProject{TeamId: teamId, Name: req.Name, Description: req.Description}
	if err := model.CreateTeamProject(p); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": p.Id})
}

// ListTeamProjects 列出团队项目。
func ListTeamProjects(c *gin.Context) {
	teamId, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid team id")
		return
	}
	items, err := model.ListTeamProjects(teamId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": items})
}

// RemoveTeamProject 删除团队项目。
func RemoveTeamProject(c *gin.Context) {
	teamId, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid team id")
		return
	}
	projectId, err := strconv.ParseInt(c.Param("pid"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid pid")
		return
	}
	if err := model.DeleteTeamProject(teamId, projectId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ok": true})
}

// GetTeamBilling 部门账单汇总。
func GetTeamBilling(c *gin.Context) {
	teamId, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid team id")
		return
	}
	billing, err := model.GetTeamBilling(teamId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, billing)
}
