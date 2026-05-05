package controller

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

type FeishuUserInitItem struct {
	FeishuOpenId string `json:"feishu_open_id" binding:"required"`
	Username     string `json:"username"`
	DisplayName  string `json:"display_name"`
	Password     string `json:"password"`
	Group        string `json:"group"`
	Quota        *int   `json:"quota"`
	Role         *int   `json:"role"`
	Remark       string `json:"remark"`
}

type BatchCreateFeishuUsersRequest struct {
	Users []FeishuUserInitItem `json:"users" binding:"required,dive"`
}

type BatchCreateFeishuUsersResult struct {
	Total   int                        `json:"total"`
	Success int                        `json:"success"`
	Skipped int                        `json:"skipped"`
	Failed  int                        `json:"failed"`
	Results []FeishuUserInitResultItem `json:"results,omitempty"`
	Errors  []string                   `json:"errors,omitempty"`
}

type FeishuUserInitResultItem struct {
	FeishuOpenId string `json:"feishu_open_id"`
	UserId       int    `json:"user_id,omitempty"`
	Username     string `json:"username,omitempty"`
	Action       string `json:"action"`
	Error        string `json:"error,omitempty"`
}

func BatchCreateFeishuUsers(c *gin.Context) {
	var req BatchCreateFeishuUsersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	result := BatchCreateFeishuUsersResult{
		Total:   len(req.Users),
		Results: make([]FeishuUserInitResultItem, 0, len(req.Users)),
		Errors:  make([]string, 0),
	}

	adminRole := c.GetInt("role")

	for _, item := range req.Users {
		openId := strings.TrimSpace(item.FeishuOpenId)
		if openId == "" {
			result.Failed++
			result.Errors = append(result.Errors, "feishu_open_id is required")
			result.Results = append(result.Results, FeishuUserInitResultItem{
				FeishuOpenId: openId,
				Action:       "skipped",
				Error:        "feishu_open_id is empty",
			})
			continue
		}

		existingUser := model.User{}
		err := model.DB.Where("feishu_id = ?", openId).First(&existingUser).Error
		if err == nil && existingUser.Id > 0 {
			result.Skipped++
			result.Results = append(result.Results, FeishuUserInitResultItem{
				FeishuOpenId: openId,
				UserId:       existingUser.Id,
				Username:     existingUser.Username,
				Action:       "skipped_exists",
			})
			continue
		}

		username := strings.TrimSpace(item.Username)
		if username == "" {
			username = "feishu_" + openId
			if len(username) > model.UserNameMaxLength {
				username = username[:model.UserNameMaxLength]
			}
		}

		exist, err := model.CheckUserExistOrDeleted(username, "")
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("open_id=%s: check username failed: %s", openId, err.Error()))
			result.Results = append(result.Results, FeishuUserInitResultItem{
				FeishuOpenId: openId,
				Action:       "failed",
				Error:        "check username failed: " + err.Error(),
			})
			continue
		}
		if exist {
			suffix := 1
			baseUsername := username
			for {
				username = fmt.Sprintf("%s_%d", baseUsername, suffix)
				if len(username) > model.UserNameMaxLength {
					username = fmt.Sprintf("%s%d", baseUsername[:model.UserNameMaxLength-4], suffix)
				}
				exist, _ = model.CheckUserExistOrDeleted(username, "")
				if !exist {
					break
				}
				suffix++
			}
		}

		displayName := strings.TrimSpace(item.DisplayName)
		if displayName == "" {
			displayName = username
		}

		password := item.Password
		if password == "" {
			password = common.GetRandomString(12)
		}

		group := "default"
		if item.Group != "" {
			group = item.Group
		}

		role := common.RoleCommonUser
		if item.Role != nil {
			role = *item.Role
		}
		if role >= adminRole {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("open_id=%s: cannot create user with role >= admin", openId))
			result.Results = append(result.Results, FeishuUserInitResultItem{
				FeishuOpenId: openId,
				Action:       "failed",
				Error:        "cannot create user with role >= admin",
			})
			continue
		}

		newUser := model.User{
			Username:    username,
			Password:    password,
			DisplayName: displayName,
			FeishuId:    openId,
			Role:        role,
			Status:      common.UserStatusEnabled,
			Group:       group,
			Remark:      item.Remark,
		}

		if err := newUser.Insert(0); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("open_id=%s: create user failed: %s", openId, err.Error()))
			result.Results = append(result.Results, FeishuUserInitResultItem{
				FeishuOpenId: openId,
				Action:       "failed",
				Error:        "create user failed: " + err.Error(),
			})
			continue
		}

		if item.Quota != nil {
			if err := model.DB.Model(&model.User{}).Where("id = ?", newUser.Id).Update("quota", *item.Quota).Error; err != nil {
				common.SysError(fmt.Sprintf("failed to set quota for feishu user %d: %s", newUser.Id, err.Error()))
			}
		}

		if group != "" && group != "default" {
			_ = model.SyncUserBindGroupSubscriptions(newUser.Id, "", group)
		}

		model.RecordLog(newUser.Id, model.LogTypeSystem,
			fmt.Sprintf("管理员通过飞书OpenID批量创建用户，open_id=%s，分组=%s", openId, group))

		result.Success++
		result.Results = append(result.Results, FeishuUserInitResultItem{
			FeishuOpenId: openId,
			UserId:       newUser.Id,
			Username:     newUser.Username,
			Action:       "created",
		})
	}

	common.ApiSuccess(c, result)
}

type AdminCreateTokenByFeishuRequest struct {
	FeishuOpenId       string `json:"feishu_open_id" binding:"required"`
	Name               string `json:"name"`
	RemainQuota        *int   `json:"remain_quota"`
	UnlimitedQuota     *bool  `json:"unlimited_quota"`
	ExpiredTime        *int64 `json:"expired_time"`
	ModelLimitsEnabled *bool  `json:"model_limits_enabled"`
	ModelLimits        string `json:"model_limits"`
	AllowIps           string `json:"allow_ips"`
	Group              string `json:"group"`
	CrossGroupRetry    *bool  `json:"cross_group_retry"`
}

type AdminCreateTokenByFeishuResult struct {
	FeishuOpenId string `json:"feishu_open_id"`
	UserId       int    `json:"user_id"`
	TokenId      int    `json:"token_id"`
	TokenName    string `json:"token_name"`
	Key          string `json:"key"`
}

func AdminCreateTokenByFeishu(c *gin.Context) {
	var req AdminCreateTokenByFeishuRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	openId := strings.TrimSpace(req.FeishuOpenId)
	if openId == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "feishu_open_id is required"})
		return
	}

	var user model.User
	if err := model.DB.Where("feishu_id = ?", openId).First(&user).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": fmt.Sprintf("飞书OpenID %s 对应用户不存在，请先创建用户", openId),
		})
		return
	}

	maxTokens := operation_setting.GetMaxUserTokens()
	count, err := model.CountUserTokens(user.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if int(count) >= maxTokens {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": fmt.Sprintf("用户 %s 已达到最大令牌数量限制 (%d)", user.Username, maxTokens),
		})
		return
	}

	tokenName := req.Name
	if tokenName == "" {
		tokenName = "admin-created"
	}

	key, err := common.GenerateKey()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	remainQuota := 0
	if req.RemainQuota != nil {
		remainQuota = *req.RemainQuota
	}

	unlimitedQuota := true
	if req.UnlimitedQuota != nil {
		unlimitedQuota = *req.UnlimitedQuota
	}

	expiredTime := int64(-1)
	if req.ExpiredTime != nil {
		expiredTime = *req.ExpiredTime
	}

	modelLimitsEnabled := false
	if req.ModelLimitsEnabled != nil {
		modelLimitsEnabled = *req.ModelLimitsEnabled
	}

	var allowIps *string
	if req.AllowIps != "" {
		allowIps = &req.AllowIps
	}

	crossGroupRetry := false
	if req.CrossGroupRetry != nil {
		crossGroupRetry = *req.CrossGroupRetry
	}

	token := model.Token{
		UserId:             user.Id,
		Name:               tokenName,
		Key:                key,
		CreatedTime:        common.GetTimestamp(),
		AccessedTime:       common.GetTimestamp(),
		ExpiredTime:        expiredTime,
		RemainQuota:        remainQuota,
		UnlimitedQuota:     unlimitedQuota,
		ModelLimitsEnabled: modelLimitsEnabled,
		ModelLimits:        req.ModelLimits,
		AllowIps:           allowIps,
		Group:              req.Group,
		CrossGroupRetry:    crossGroupRetry,
	}

	if err := token.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}

	adminId := c.GetInt("id")
	model.RecordLog(user.Id, model.LogTypeSystem,
		fmt.Sprintf("管理员(id=%d)通过飞书OpenID为用户创建令牌，open_id=%s，令牌名=%s", adminId, openId, tokenName))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": AdminCreateTokenByFeishuResult{
			FeishuOpenId: openId,
			UserId:       user.Id,
			TokenId:      token.Id,
			TokenName:    tokenName,
			Key:          key,
		},
	})
}

type AdminBatchCreateTokensRequest struct {
	Items []AdminCreateTokenByFeishuRequest `json:"items" binding:"required,dive"`
}

type AdminBatchCreateTokensResult struct {
	Total   int                               `json:"total"`
	Success int                               `json:"success"`
	Failed  int                               `json:"failed"`
	Results []AdminBatchCreateTokenResultItem `json:"results,omitempty"`
}

type AdminBatchCreateTokenResultItem struct {
	FeishuOpenId string `json:"feishu_open_id"`
	UserId       int    `json:"user_id,omitempty"`
	TokenId      int    `json:"token_id,omitempty"`
	Key          string `json:"key,omitempty"`
	Error        string `json:"error,omitempty"`
}

func AdminBatchCreateTokensByFeishu(c *gin.Context) {
	var req AdminBatchCreateTokensRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	result := AdminBatchCreateTokensResult{
		Total:   len(req.Items),
		Results: make([]AdminBatchCreateTokenResultItem, 0, len(req.Items)),
	}

	for _, item := range req.Items {
		openId := strings.TrimSpace(item.FeishuOpenId)
		if openId == "" {
			result.Failed++
			result.Results = append(result.Results, AdminBatchCreateTokenResultItem{
				FeishuOpenId: openId,
				Error:        "feishu_open_id is empty",
			})
			continue
		}

		var user model.User
		if err := model.DB.Where("feishu_id = ?", openId).First(&user).Error; err != nil {
			result.Failed++
			result.Results = append(result.Results, AdminBatchCreateTokenResultItem{
				FeishuOpenId: openId,
				Error:        fmt.Sprintf("用户不存在: %s", err.Error()),
			})
			continue
		}

		maxTokens := operation_setting.GetMaxUserTokens()
		count, err := model.CountUserTokens(user.Id)
		if err != nil {
			result.Failed++
			result.Results = append(result.Results, AdminBatchCreateTokenResultItem{
				FeishuOpenId: openId,
				UserId:       user.Id,
				Error:        "查询令牌数量失败",
			})
			continue
		}
		if int(count) >= maxTokens {
			result.Failed++
			result.Results = append(result.Results, AdminBatchCreateTokenResultItem{
				FeishuOpenId: openId,
				UserId:       user.Id,
				Error:        fmt.Sprintf("已达到最大令牌数量限制 (%d)", maxTokens),
			})
			continue
		}

		tokenName := item.Name
		if tokenName == "" {
			tokenName = "admin-batch-created"
		}

		key, err := common.GenerateKey()
		if err != nil {
			result.Failed++
			result.Results = append(result.Results, AdminBatchCreateTokenResultItem{
				FeishuOpenId: openId,
				UserId:       user.Id,
				Error:        "生成密钥失败",
			})
			continue
		}

		remainQuota := 0
		if item.RemainQuota != nil {
			remainQuota = *item.RemainQuota
		}
		unlimitedQuota := true
		if item.UnlimitedQuota != nil {
			unlimitedQuota = *item.UnlimitedQuota
		}
		expiredTime := int64(-1)
		if item.ExpiredTime != nil {
			expiredTime = *item.ExpiredTime
		}
		modelLimitsEnabled := false
		if item.ModelLimitsEnabled != nil {
			modelLimitsEnabled = *item.ModelLimitsEnabled
		}
		var allowIps *string
		if item.AllowIps != "" {
			allowIps = &item.AllowIps
		}
		crossGroupRetry := false
		if item.CrossGroupRetry != nil {
			crossGroupRetry = *item.CrossGroupRetry
		}

		token := model.Token{
			UserId:             user.Id,
			Name:               tokenName,
			Key:                key,
			CreatedTime:        common.GetTimestamp(),
			AccessedTime:       common.GetTimestamp(),
			ExpiredTime:        expiredTime,
			RemainQuota:        remainQuota,
			UnlimitedQuota:     unlimitedQuota,
			ModelLimitsEnabled: modelLimitsEnabled,
			ModelLimits:        item.ModelLimits,
			AllowIps:           allowIps,
			Group:              item.Group,
			CrossGroupRetry:    crossGroupRetry,
		}

		if err := token.Insert(); err != nil {
			result.Failed++
			result.Results = append(result.Results, AdminBatchCreateTokenResultItem{
				FeishuOpenId: openId,
				UserId:       user.Id,
				Error:        "创建令牌失败: " + err.Error(),
			})
			continue
		}

		result.Success++
		result.Results = append(result.Results, AdminBatchCreateTokenResultItem{
			FeishuOpenId: openId,
			UserId:       user.Id,
			TokenId:      token.Id,
			Key:          key,
		})
	}

	common.ApiSuccess(c, result)
}

func AdminGetTokensByFeishu(c *gin.Context) {
	openId := strings.TrimSpace(c.Query("feishu_open_id"))
	if openId == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "feishu_open_id query parameter is required"})
		return
	}

	var user model.User
	if err := model.DB.Where("feishu_id = ?", openId).First(&user).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": fmt.Sprintf("飞书OpenID %s 对应用户不存在", openId),
		})
		return
	}

	pageInfo := common.GetPageQuery(c)
	tokens, err := model.GetAllUserTokens(user.Id, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	total, _ := model.CountUserTokens(user.Id)
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(tokens)
	common.ApiSuccess(c, pageInfo)
}

type FeishuUserUpdateItem struct {
	FeishuOpenId string `json:"feishu_open_id" binding:"required"`
	DisplayName  string `json:"display_name"`
	Password     string `json:"password"`
	Group        string `json:"group"`
	Quota        *int   `json:"quota"`
	Status       *int   `json:"status"`
	Remark       string `json:"remark"`
}

type BatchUpdateFeishuUsersRequest struct {
	Users []FeishuUserUpdateItem `json:"users" binding:"required,dive"`
}

type BatchUpdateFeishuUsersResult struct {
	Total   int                          `json:"total"`
	Success int                          `json:"success"`
	Failed  int                          `json:"failed"`
	Skipped int                          `json:"skipped"`
	Results []FeishuUserUpdateResultItem `json:"results,omitempty"`
	Errors  []string                     `json:"errors,omitempty"`
}

type FeishuUserUpdateResultItem struct {
	FeishuOpenId string `json:"feishu_open_id"`
	UserId       int    `json:"user_id,omitempty"`
	Username     string `json:"username,omitempty"`
	OldGroup     string `json:"old_group,omitempty"`
	NewGroup     string `json:"new_group,omitempty"`
	SubSynced    bool   `json:"sub_synced,omitempty"`
	Action       string `json:"action"`
	Error        string `json:"error,omitempty"`
}

func BatchUpdateFeishuUsers(c *gin.Context) {
	var req BatchUpdateFeishuUsersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	result := BatchUpdateFeishuUsersResult{
		Total:   len(req.Users),
		Results: make([]FeishuUserUpdateResultItem, 0, len(req.Users)),
		Errors:  make([]string, 0),
	}

	adminId := c.GetInt("id")

	for _, item := range req.Users {
		openId := strings.TrimSpace(item.FeishuOpenId)
		if openId == "" {
			result.Failed++
			result.Errors = append(result.Errors, "feishu_open_id is required")
			result.Results = append(result.Results, FeishuUserUpdateResultItem{
				FeishuOpenId: openId,
				Action:       "failed",
				Error:        "feishu_open_id is empty",
			})
			continue
		}

		var user model.User
		if err := model.DB.Where("feishu_id = ?", openId).First(&user).Error; err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("open_id=%s: user not found", openId))
			result.Results = append(result.Results, FeishuUserUpdateResultItem{
				FeishuOpenId: openId,
				Action:       "failed",
				Error:        "用户不存在",
			})
			continue
		}

		updates := map[string]interface{}{}
		resultItem := FeishuUserUpdateResultItem{
			FeishuOpenId: openId,
			UserId:       user.Id,
			Username:     user.Username,
			OldGroup:     user.Group,
			Action:       "updated",
		}

		if item.DisplayName != "" {
			updates["display_name"] = item.DisplayName
		}

		if item.Password != "" {
			hashedPassword, err := common.Password2Hash(item.Password)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("open_id=%s: password hash failed: %s", openId, err.Error()))
				result.Results = append(result.Results, FeishuUserUpdateResultItem{
					FeishuOpenId: openId,
					UserId:       user.Id,
					Username:     user.Username,
					Action:       "failed",
					Error:        "密码哈希失败",
				})
				continue
			}
			updates["password"] = hashedPassword
		}

		if item.Group != "" {
			updates["group"] = item.Group
			resultItem.NewGroup = item.Group
		}

		if item.Quota != nil {
			updates["quota"] = *item.Quota
		}

		if item.Status != nil {
			if *item.Status == common.UserStatusEnabled || *item.Status == common.UserStatusDisabled {
				updates["status"] = *item.Status
			}
		}

		if item.Remark != "" {
			updates["remark"] = item.Remark
		}

		if len(updates) == 0 {
			result.Skipped++
			result.Results = append(result.Results, FeishuUserUpdateResultItem{
				FeishuOpenId: openId,
				UserId:       user.Id,
				Username:     user.Username,
				Action:       "skipped_no_changes",
			})
			continue
		}

		if err := model.DB.Model(&model.User{}).Where("id = ?", user.Id).Updates(updates).Error; err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("open_id=%s: update failed: %s", openId, err.Error()))
			result.Results = append(result.Results, FeishuUserUpdateResultItem{
				FeishuOpenId: openId,
				UserId:       user.Id,
				Username:     user.Username,
				Action:       "failed",
				Error:        "更新失败: " + err.Error(),
			})
			continue
		}

		if newGroup, ok := updates["group"]; ok {
			newGroupStr := newGroup.(string)
			oldGroup := user.Group
			if oldGroup != newGroupStr {
				_ = model.SyncUserBindGroupSubscriptions(user.Id, oldGroup, newGroupStr)
				resultItem.SubSynced = true
			}
			_ = model.InvalidateUserCache(user.Id)
		}

		model.RecordLog(user.Id, model.LogTypeManage,
			fmt.Sprintf("管理员(id=%d)通过飞书OpenID批量更新用户信息，open_id=%s", adminId, openId))

		result.Success++
		result.Results = append(result.Results, resultItem)
	}

	common.ApiSuccess(c, result)
}
