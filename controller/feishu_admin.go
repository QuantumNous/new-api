package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

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

	query := model.DB.Unscoped().Model(&model.User{}).Where("(feishu_id != '' AND feishu_id IS NOT NULL) OR (feishu_union_id != '' AND feishu_union_id IS NOT NULL)")

	if keyword != "" {
		query = query.Where("username LIKE ? OR display_name LIKE ? OR feishu_id LIKE ? OR feishu_union_id LIKE ?",
			"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
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
		openID := strings.TrimSpace(item.OpenID)
		unionID := strings.TrimSpace(item.UnionID)
		if openID == "" && unionID == "" {
			result.Failed++
			result.Errors = append(result.Errors, "open_id or union_id is required for user_id="+strconv.Itoa(item.UserID))
			continue
		}

		var user model.User
		if err := model.DB.Where("id = ?", item.UserID).First(&user).Error; err != nil {
			result.Failed++
			result.Errors = append(result.Errors, "user_id="+strconv.Itoa(item.UserID)+" not found: "+err.Error())
			continue
		}

		updates := map[string]interface{}{}
		if openID != "" {
			existingUser := model.User{}
			if model.IsFeishuIdAlreadyTaken(openID) {
				if err := model.DB.Where("feishu_id = ?", openID).First(&existingUser).Error; err == nil && existingUser.Id != item.UserID {
					result.Failed++
					result.Errors = append(result.Errors, "open_id="+openID+" already bound to user_id="+strconv.Itoa(existingUser.Id))
					continue
				}
			}
			updates["feishu_id"] = openID
		}
		if unionID != "" {
			existingUser := model.User{}
			if model.IsFeishuUnionIdAlreadyTaken(unionID) {
				if err := model.DB.Where("feishu_union_id = ?", unionID).First(&existingUser).Error; err == nil && existingUser.Id != item.UserID {
					result.Failed++
					result.Errors = append(result.Errors, "union_id="+unionID+" already bound to user_id="+strconv.Itoa(existingUser.Id))
					continue
				}
			}
			updates["feishu_union_id"] = unionID
		}

		if err := model.DB.Model(&model.User{}).Where("id = ?", item.UserID).Updates(updates).Error; err != nil {
			result.Failed++
			result.Errors = append(result.Errors, "user_id="+strconv.Itoa(item.UserID)+" update failed: "+err.Error())
			continue
		}

		model.RecordLog(user.Id, model.LogTypeSystem, "管理员导入飞书绑定，open_id="+openID+" union_id="+unionID)
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

	oldGroup := user.Group
	if err := model.DB.Model(&model.User{}).Where("id = ?", id).Update("group", req.Group).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	model.RecordLog(user.Id, model.LogTypeSystem, "管理员修改分组: "+oldGroup+" -> "+req.Group)
	if oldGroup != req.Group {
		_ = model.SyncUserBindGroupSubscriptions(id, oldGroup, req.Group)
	}
	user.Group = req.Group
	_ = model.InvalidateUserCache(user.Id)
	common.ApiSuccess(c, user)
}

type GroupSyncRequest struct {
	GroupName   string `json:"group_name"`
	Full        bool   `json:"full"`
	OnlyMissing *bool  `json:"only_missing"`
}

type GroupSyncResult struct {
	AffectedUsers int      `json:"affected_users"`
	Updated       int      `json:"updated"`
	Skipped       int      `json:"skipped"`
	Errors        []string `json:"errors,omitempty"`
}

func hasActiveBindGroupSubscriptions(userId int, planIDs []int) (bool, error) {
	if userId <= 0 || len(planIDs) == 0 {
		return false, nil
	}
	now := common.GetTimestamp()
	var count int64
	err := model.DB.Model(&model.UserSubscription{}).
		Where("user_id = ? AND source = ? AND plan_id IN ? AND status = ? AND (end_time = 0 OR end_time > ?)",
			userId, "bind_group", planIDs, "active", now).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return int(count) >= len(planIDs), nil
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
	onlyMissing := true
	if req.OnlyMissing != nil {
		onlyMissing = *req.OnlyMissing
	}

	query := model.DB.Unscoped().Model(&model.User{})
	if !req.Full && req.GroupName != "" {
		query = query.Where(fmt.Sprintf("%s = ?", model.CommonGroupColumnName()), req.GroupName)
	}

	var users []model.User
	if err := query.Find(&users).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	result.AffectedUsers = len(users)

	for i := range users {
		user := &users[i]
		groupName := strings.TrimSpace(user.Group)
		if groupName == "" || groupName == "pending" {
			result.Skipped++
			continue
		}

		var plans []model.SubscriptionPlan
		if err := model.DB.Where("bind_group = ? AND enabled = ?", groupName, true).Find(&plans).Error; err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("user_id=%d query plans failed: %s", user.Id, err.Error()))
			continue
		}
		if len(plans) == 0 {
			result.Skipped++
			continue
		}

		planIDs := make([]int, 0, len(plans))
		for _, p := range plans {
			planIDs = append(planIDs, p.Id)
		}
		if onlyMissing {
			ok, err := hasActiveBindGroupSubscriptions(user.Id, planIDs)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("user_id=%d check existing failed: %s", user.Id, err.Error()))
				continue
			}
			if ok {
				result.Skipped++
				continue
			}
		}

		if err := model.SyncUserBindGroupSubscriptions(user.Id, "", groupName); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("user_id=%d sync failed: %s", user.Id, err.Error()))
			continue
		}
		result.Updated++
	}

	common.ApiSuccess(c, result)
}
