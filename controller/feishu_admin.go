package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type FeishuBindingItem struct {
	UserID    int    `json:"user_id"`
	UnionID   string `json:"union_id"`
	OpenID    string `json:"open_id,omitempty"`
	GroupName string `json:"group_name,omitempty"`
}

type FeishuImportRequest struct {
	Bindings []FeishuBindingItem `json:"bindings" binding:"required"`
}

type FeishuImportResult struct {
	Total   int      `json:"total"`
	Success int      `json:"success"`
	Skipped int      `json:"skipped"`
	Failed  int      `json:"failed"`
	Errors  []string `json:"errors,omitempty"`
}

func GetFeishuBindings(c *gin.Context) {
	keyword := c.Query("keyword")
	pageInfo := common.GetPageQuery(c)

	var users []model.User
	var total int64

	query := model.DB.Unscoped().Model(&model.User{}).Where("feishu_id != '' AND feishu_id IS NOT NULL")

	if keyword != "" {
		query = query.Where("username LIKE ? OR display_name LIKE ? OR feishu_id LIKE ?",
			"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	if err := query.Order("id desc").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Omit("password").
		Find(&users).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(users)
	common.ApiSuccess(c, pageInfo)
}

func ImportFeishuBindings(c *gin.Context) {
	var req FeishuImportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	result := FeishuImportResult{
		Total:  len(req.Bindings),
		Errors: make([]string, 0),
	}

	for _, item := range req.Bindings {
		if item.UnionID == "" {
			result.Failed++
			result.Errors = append(result.Errors, "union_id is required for user_id="+strconv.Itoa(item.UserID))
			continue
		}

		var user model.User
		if err := model.DB.Where("id = ?", item.UserID).First(&user).Error; err != nil {
			result.Failed++
			result.Errors = append(result.Errors, "user_id="+strconv.Itoa(item.UserID)+" not found: "+err.Error())
			continue
		}

		if user.FeishuId != "" {
			if user.FeishuId == item.UnionID {
				result.Skipped++
			} else {
				result.Failed++
				result.Errors = append(result.Errors, "user_id="+strconv.Itoa(item.UserID)+" already bound to another feishu account")
			}
			continue
		}

		existingUser := model.User{}
		if model.IsFeishuIdAlreadyTaken(item.UnionID) {
			if err := model.DB.Where("feishu_id = ?", item.UnionID).First(&existingUser).Error; err == nil {
				if existingUser.Id != item.UserID {
					result.Failed++
					result.Errors = append(result.Errors, "union_id="+item.UnionID+" already bound to user_id="+strconv.Itoa(existingUser.Id))
					continue
				}
			}
		}

		updates := map[string]interface{}{
			"feishu_id": item.UnionID,
		}

		if err := model.DB.Model(&model.User{}).Where("id = ?", item.UserID).Updates(updates).Error; err != nil {
			result.Failed++
			result.Errors = append(result.Errors, "user_id="+strconv.Itoa(item.UserID)+" update failed: "+err.Error())
			continue
		}

		model.RecordLog(user.Id, model.LogTypeSystem, "管理员导入飞书绑定，union_id="+item.UnionID)
		result.Success++
	}

	common.ApiSuccess(c, result)
}

func AdminSetUserGroup(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid user id"})
		return
	}

	var req struct {
		Group string `json:"group" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	var user model.User
	if err := model.DB.Where("id = ?", id).First(&user).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	if err := model.DB.Model(&model.User{}).Where("id = ?", id).Update("group", req.Group).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	model.RecordLog(user.Id, model.LogTypeSystem, "管理员修改分组: "+user.Group+" -> "+req.Group)
	user.Group = req.Group
	common.ApiSuccess(c, user)
}

type GroupSyncRequest struct {
	GroupName string `json:"group_name"`
	Full      bool   `json:"full"`
}

type GroupSyncResult struct {
	AffectedUsers int      `json:"affected_users"`
	Updated       int      `json:"updated"`
	Errors        []string `json:"errors,omitempty"`
}

func AdminGroupSync(c *gin.Context) {
	var req GroupSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	result := GroupSyncResult{
		Errors: make([]string, 0),
	}

	query := model.DB.Unscoped().Model(&model.User{})
	if !req.Full && req.GroupName != "" {
		query = query.Where("`group` = ?", req.GroupName)
	}

	var users []model.User
	if err := query.Find(&users).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	result.AffectedUsers = len(users)

	for i := range users {
		user := &users[i]
		if user.FeishuId == "" {
			continue
		}

		if user.Group == "" || user.Group == "pending" {
			continue
		}

		result.Updated++
	}

	common.ApiSuccess(c, result)
}
