package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type tokenAutoGroupsInput struct {
	Set    bool
	Groups []string
}

func (input *tokenAutoGroupsInput) UnmarshalJSON(data []byte) error {
	input.Set = true
	if strings.TrimSpace(string(data)) == "null" {
		input.Groups = nil
		return nil
	}
	return common.Unmarshal(data, &input.Groups)
}

type tokenRequest struct {
	model.Token
	AutoGroups tokenAutoGroupsInput `json:"auto_groups"`
}

type tokenResponse struct {
	*model.Token
	AutoGroups []string `json:"auto_groups"`
}

func maxTokenQuota() int {
	quota, err := common.WalletQuotaFromDecimalStrict(
		decimal.NewFromInt(1_000_000_000).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
	)
	if err != nil {
		return common.MaxWalletQuota
	}
	return quota
}

func buildMaskedTokenResponse(token *model.Token) *tokenResponse {
	if token == nil {
		return nil
	}
	maskedToken := *token
	maskedToken.Key = token.GetMaskedKey()
	autoGroups, err := token.GetAutoGroups()
	if err != nil {
		common.SysError(fmt.Sprintf("failed to parse auto groups for token %d: %v", token.Id, err))
		autoGroups = nil
	}
	if len(autoGroups) == 0 {
		autoGroups = nil
	}
	return &tokenResponse{Token: &maskedToken, AutoGroups: autoGroups}
}

func buildMaskedTokenResponses(tokens []*model.Token) []*tokenResponse {
	maskedTokens := make([]*tokenResponse, 0, len(tokens))
	for _, token := range tokens {
		maskedTokens = append(maskedTokens, buildMaskedTokenResponse(token))
	}
	return maskedTokens
}

func getTokenRequestUserGroup(c *gin.Context) (string, error) {
	if userGroup := common.GetContextKeyString(c, constant.ContextKeyUserGroup); userGroup != "" {
		return userGroup, nil
	}
	if userGroup := c.GetString("group"); userGroup != "" {
		return userGroup, nil
	}
	return model.GetUserGroup(c.GetInt("id"), false)
}

// setTokenAutoGroups 验证并设置令牌的 auto_groups 列表。groups 为空时清空该字段；
// targetUserGroup 用于跨用户操作时按目标用户的可选组做校验，为空则回退到请求者。
func setTokenAutoGroups(c *gin.Context, token *model.Token, groups []string, targetUserGroup string) bool {
	if len(groups) == 0 {
		if err := token.SetAutoGroups(nil); err != nil {
			common.ApiError(c, err)
			return false
		}
		return true
	}

	maxCount := setting.GetMaxTokenAutoGroups()
	if len(groups) > maxCount {
		common.ApiErrorI18n(c, i18n.MsgTokenAutoGroupsTooMany, map[string]any{"Max": maxCount})
		return false
	}

	// 跨用户操作时传入目标用户的组做校验；未指定时回退到请求者的组
	var userGroup string
	var err error
	if targetUserGroup != "" {
		userGroup = targetUserGroup
	} else {
		userGroup, err = getTokenRequestUserGroup(c)
		if err != nil {
			common.ApiError(c, err)
			return false
		}
	}
	seen := make(map[string]struct{}, len(groups))
	for _, group := range groups {
		if _, ok := seen[group]; ok {
			common.ApiErrorI18n(c, i18n.MsgTokenAutoGroupsDuplicate, map[string]any{"Group": group})
			return false
		}
		seen[group] = struct{}{}
		if !service.IsUserSelectableGroup(userGroup, group) {
			common.ApiErrorI18n(c, i18n.MsgTokenAutoGroupsInvalid, map[string]any{"Group": group})
			return false
		}
	}

	if err := token.SetAutoGroups(groups); err != nil {
		common.ApiError(c, err)
		return false
	}
	return true
}

// getQueryUserId 解析可选的 user_id 查询参数，解析失败返回 0（表示不按用户筛选）。
func getQueryUserId(c *gin.Context) int {
	userId, err := strconv.Atoi(c.Query("user_id"))
	if err != nil {
		return 0
	}
	return userId
}

// GetAllTokens 列出令牌。Root 可查全部或按 user_id 筛选，普通用户仅显示自己的。
func GetAllTokens(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	// Root 可不传 user_id 查全部，也可传 ?user_id=X 筛选
	if c.GetInt("role") == common.RoleRootUser {
		targetUserId := getQueryUserId(c)
		tokens, err := model.GetAllTokensAdmin(targetUserId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
		if err != nil {
			common.ApiError(c, err)
			return
		}
		total, err := model.CountTokensAdmin(targetUserId)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		pageInfo.SetTotal(int(total))
		pageInfo.SetItems(buildMaskedTokenResponses(tokens))
	} else {
		tokens, err := model.GetAllUserTokens(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
		if err != nil {
			common.ApiError(c, err)
			return
		}
		total, _ := model.CountUserTokens(userId)
		pageInfo.SetTotal(int(total))
		pageInfo.SetItems(buildMaskedTokenResponses(tokens))
	}
	common.ApiSuccess(c, pageInfo)
}

// SearchTokens 按关键字搜索令牌，权限与 GetAllTokens 一致。
func SearchTokens(c *gin.Context) {
	userId := c.GetInt("id")
	keyword := c.Query("keyword")
	token := c.Query("token")

	pageInfo := common.GetPageQuery(c)

	// Root 可不传 user_id 搜全部，也可传 ?user_id=X 筛选
	if c.GetInt("role") == common.RoleRootUser {
		targetUserId := getQueryUserId(c)
		tokens, total, err := model.SearchTokensAdmin(targetUserId, keyword, token, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
		if err != nil {
			common.ApiError(c, err)
			return
		}
		pageInfo.SetTotal(int(total))
		pageInfo.SetItems(buildMaskedTokenResponses(tokens))
	} else {
		tokens, total, err := model.SearchUserTokens(userId, keyword, token, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
		if err != nil {
			common.ApiError(c, err)
			return
		}
		pageInfo.SetTotal(int(total))
		pageInfo.SetItems(buildMaskedTokenResponses(tokens))
	}
	common.ApiSuccess(c, pageInfo)
}

// GetToken 获取单个令牌详情，Root 可查看任意用户令牌，非 Root 仅限自己的。
func GetToken(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	userId := c.GetInt("id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// Root 可查看任意用户的令牌，非 Root 仅限自己的
	var token *model.Token
	if c.GetInt("role") == common.RoleRootUser {
		token, err = model.GetTokenById(id)
		if err == nil {
			if user, uErr := model.GetUserCache(token.UserId); uErr == nil {
				token.Username = user.Username
			}
		}
	} else {
		token, err = model.GetTokenByIds(id, userId)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, buildMaskedTokenResponse(token))
}

func GetTokenAutoGroups(c *gin.Context) {
	userGroup, err := getTokenRequestUserGroup(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"groups":    service.GetUserAutoGroup(userGroup),
		"max_count": setting.GetMaxTokenAutoGroups(),
	})
}

// GetTokenKey 获取令牌明文 Key。Root 查看他人令牌 Key 时写入一条管理审计日志。
func GetTokenKey(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	userId := c.GetInt("id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// Root 可查看任意令牌的 Key，非 Root 仅限自己的
	var token *model.Token
	if c.GetInt("role") == common.RoleRootUser {
		token, err = model.GetTokenById(id)
	} else {
		token, err = model.GetTokenByIds(id, userId)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// Root 查看其他用户的令牌 Key 时，记录一条管理审计日志（查看自己的不记）
	if c.GetInt("role") == common.RoleRootUser && token.UserId != userId {
		// 审计记录不能被用户缓存查询结果门控：缓存失败时仍须记录管理操作
		targetUsername := ""
		if targetUser, tErr := model.GetUserCache(token.UserId); tErr == nil && targetUser != nil {
			targetUsername = targetUser.Username
		}
		recordManageAuditFor(c, token.UserId, "token.admin_key_view", map[string]interface{}{
			"target_user_id":  token.UserId,
			"target_username": targetUsername,
			"token_id":        token.Id,
			"token_name":      token.Name,
		})
	}
	common.ApiSuccess(c, gin.H{
		"key": token.GetFullKey(),
	})
}

// GetTokenStatus 返回令牌的额度与过期时间。
func GetTokenStatus(c *gin.Context) {
	tokenId := c.GetInt("token_id")
	userId := c.GetInt("id")
	token, err := model.GetTokenByIds(tokenId, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	expiredAt := token.ExpiredTime
	if expiredAt == -1 {
		expiredAt = 0
	}
	c.JSON(http.StatusOK, gin.H{
		"object":          "credit_summary",
		"total_granted":   token.RemainQuota,
		"total_used":      0, // not supported currently
		"total_available": token.RemainQuota,
		"expires_at":      expiredAt * 1000,
	})
}

// GetTokenUsage 通过 Authorization 头返回令牌用量信息。
func GetTokenUsage(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "No Authorization header",
		})
		return
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Invalid Bearer token",
		})
		return
	}
	tokenKey := parts[1]

	token, err := model.GetTokenByKey(strings.TrimPrefix(tokenKey, "sk-"), false)
	if err != nil {
		common.SysError("failed to get token by key: " + err.Error())
		common.ApiErrorI18n(c, i18n.MsgTokenGetInfoFailed)
		return
	}

	expiredAt := token.ExpiredTime
	if expiredAt == -1 {
		expiredAt = 0
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    true,
		"message": "ok",
		"data": gin.H{
			"object":               "token_usage",
			"name":                 token.Name,
			"total_granted":        token.RemainQuota + token.UsedQuota,
			"total_used":           token.UsedQuota,
			"total_available":      token.RemainQuota,
			"unlimited_quota":      token.UnlimitedQuota,
			"model_limits":         token.GetModelLimitsMap(),
			"model_limits_enabled": token.ModelLimitsEnabled,
			"expires_at":           expiredAt,
		},
	})
}

// AddToken 创建令牌。Root 可通过 user_id 为其他用户创建，普通用户仅给自己。
func AddToken(c *gin.Context) {
	request := tokenRequest{}
	err := c.ShouldBindJSON(&request)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	token := request.Token
	userId := c.GetInt("id")

	var targetUser *model.UserBase
	// Root 可通过 user_id 为其他用户创建令牌；省略 user_id 时默认给自己创建
	if c.GetInt("role") == common.RoleRootUser {
		if token.UserId == 0 {
			token.UserId = userId
		}
		var err error
		targetUser, err = model.GetUserCache(token.UserId)
		if err != nil {
			common.ApiErrorI18n(c, i18n.MsgInvalidParams)
			return
		}
	} else {
		token.UserId = userId
	}

	if len(token.Name) > 50 {
		common.ApiErrorI18n(c, i18n.MsgTokenNameTooLong)
		return
	}
	// 非无限额度时，检查额度值是否超出有效范围
	if !token.UnlimitedQuota {
		if token.RemainQuota < 0 {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaNegative)
			return
		}
		maxQuotaValue := maxTokenQuota()
		if token.RemainQuota > maxQuotaValue {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaExceedMax, map[string]any{"Max": maxQuotaValue})
			return
		}
	}
	// 检查用户令牌数量是否已达上限
	maxTokens := operation_setting.GetMaxUserTokens()
	count, err := model.CountUserTokens(token.UserId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if int(count) >= maxTokens {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": fmt.Sprintf("已达到最大令牌数量限制 (%d)", maxTokens),
		})
		return
	}
	if token.Group == "auto" {
		// Root 为其他用户创建令牌时，按目标用户的组校验 auto_groups 可选项
		targetGroup := ""
		if targetUser != nil {
			targetGroup = targetUser.Group
		}
		if !setTokenAutoGroups(c, &token, request.AutoGroups.Groups, targetGroup) {
			return
		}
	} else {
		token.CrossGroupRetry = false
		_ = token.SetAutoGroups(nil)
	}
	key, err := common.GenerateKey()
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgTokenGenerateFailed)
		common.SysLog("failed to generate token key: " + err.Error())
		return
	}
	cleanToken := model.Token{
		UserId:             token.UserId,
		Name:               token.Name,
		Key:                key,
		CreatedTime:        common.GetTimestamp(),
		AccessedTime:       common.GetTimestamp(),
		ExpiredTime:        token.ExpiredTime,
		RemainQuota:        token.RemainQuota,
		UnlimitedQuota:     token.UnlimitedQuota,
		ModelLimitsEnabled: token.ModelLimitsEnabled,
		ModelLimits:        token.ModelLimits,
		AllowIps:           token.AllowIps,
		Group:              token.Group,
		CrossGroupRetry:    token.CrossGroupRetry,
		AutoGroups:         token.AutoGroups,
	}
	err = cleanToken.Insert()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// Root 为其他用户创建令牌时，记录一条管理审计日志
	if token.UserId != userId && targetUser != nil {
		recordManageAuditFor(c, token.UserId, "token.admin_create", map[string]interface{}{
			"target_user_id":  token.UserId,
			"target_username": targetUser.Username,
			"token_id":        cleanToken.Id,
			"token_name":      cleanToken.Name,
		})
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

// DeleteToken 删除令牌。Root 可删除任意用户令牌，非 Root 仅限自己的。
func DeleteToken(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	userId := c.GetInt("id")
	// Root 可删除任意用户的令牌，非 Root 仅限自己的
	var err error
	if c.GetInt("role") == common.RoleRootUser {
		token, tErr := model.GetTokenById(id)
		if tErr != nil {
			common.ApiError(c, tErr)
			return
		}
		err = token.Delete()
		// 仅在删除成功且跨用户时记录审计，避免审计日志记录未发生的操作
		if err == nil && token.UserId != userId {
			// 审计记录不能被用户缓存查询结果门控：缓存失败时仍须记录管理操作
			targetUsername := ""
			if targetUser, cErr := model.GetUserCache(token.UserId); cErr == nil && targetUser != nil {
				targetUsername = targetUser.Username
			}
			recordManageAuditFor(c, token.UserId, "token.admin_delete", map[string]interface{}{
				"target_user_id":  token.UserId,
				"target_username": targetUsername,
				"token_id":        token.Id,
				"token_name":      token.Name,
			})
		}
	} else {
		err = model.DeleteTokenById(id, userId)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

// UpdateToken 更新令牌。Root 可更新任意用户令牌，非 Root 仅限自己的。
func UpdateToken(c *gin.Context) {
	userId := c.GetInt("id")
	statusOnly := c.Query("status_only")
	request := tokenRequest{}
	err := c.ShouldBindJSON(&request)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	token := request.Token
	if len(token.Name) > 50 {
		common.ApiErrorI18n(c, i18n.MsgTokenNameTooLong)
		return
	}
	if !token.UnlimitedQuota {
		if token.RemainQuota < 0 {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaNegative)
			return
		}
		maxQuotaValue := maxTokenQuota()
		if token.RemainQuota > maxQuotaValue {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaExceedMax, map[string]any{"Max": maxQuotaValue})
			return
		}
	}
	// Root 可更新任意用户的令牌，非 Root 仅限自己的
	var cleanToken *model.Token
	if c.GetInt("role") == common.RoleRootUser {
		cleanToken, err = model.GetTokenById(token.Id)
	} else {
		cleanToken, err = model.GetTokenByIds(token.Id, userId)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if token.Status == common.TokenStatusEnabled {
		if cleanToken.Status == common.TokenStatusExpired && cleanToken.ExpiredTime <= common.GetTimestamp() && cleanToken.ExpiredTime != -1 {
			common.ApiErrorI18n(c, i18n.MsgTokenExpiredCannotEnable)
			return
		}
		if cleanToken.Status == common.TokenStatusExhausted && cleanToken.RemainQuota <= 0 && !cleanToken.UnlimitedQuota {
			common.ApiErrorI18n(c, i18n.MsgTokenExhaustedCannotEable)
			return
		}
	}
	if statusOnly != "" {
		cleanToken.Status = token.Status
	} else {
		// If you add more fields, please also update token.Update()
		cleanToken.Name = token.Name
		cleanToken.ExpiredTime = token.ExpiredTime
		cleanToken.RemainQuota = token.RemainQuota
		cleanToken.UnlimitedQuota = token.UnlimitedQuota
		cleanToken.ModelLimitsEnabled = token.ModelLimitsEnabled
		cleanToken.ModelLimits = token.ModelLimits
		cleanToken.AllowIps = token.AllowIps
		cleanToken.Group = token.Group
		cleanToken.CrossGroupRetry = token.CrossGroupRetry
		if token.Group != "auto" {
			cleanToken.CrossGroupRetry = false
			_ = cleanToken.SetAutoGroups(nil)
		} else if request.AutoGroups.Set {
			// Root 更新其他用户的令牌时，按令牌所有者的组校验 auto_groups 可选项
			targetGroup := ""
			if c.GetInt("role") == common.RoleRootUser && cleanToken.UserId != userId {
				if g, gErr := model.GetUserGroup(cleanToken.UserId, false); gErr == nil {
					targetGroup = g
				}
			}
			if !setTokenAutoGroups(c, cleanToken, request.AutoGroups.Groups, targetGroup) {
				return
			}
		}
	}
	err = cleanToken.Update()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// Root 更新其他用户的令牌时，记录一条管理审计日志（更新自己的令牌不记）
	if cleanToken.UserId != userId {
		// 审计记录不能被用户缓存查询结果门控：缓存失败时仍须记录管理操作
		targetUsername := ""
		if targetUser, tErr := model.GetUserCache(cleanToken.UserId); tErr == nil && targetUser != nil {
			targetUsername = targetUser.Username
		}
		recordManageAuditFor(c, cleanToken.UserId, "token.admin_update", map[string]interface{}{
			"target_user_id":  cleanToken.UserId,
			"target_username": targetUsername,
			"token_id":        cleanToken.Id,
			"token_name":      cleanToken.Name,
		})
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    buildMaskedTokenResponse(cleanToken),
	})
}

type TokenBatch struct {
	Ids []int `json:"ids"`
}

// DeleteTokenBatch 批量删除令牌。Root 可批量删除任意用户令牌，非 Root 仅限自己的。
func DeleteTokenBatch(c *gin.Context) {
	tokenBatch := TokenBatch{}
	if err := c.ShouldBindJSON(&tokenBatch); err != nil || len(tokenBatch.Ids) == 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	userId := c.GetInt("id")
	var count int
	var err error
	// Root 可批量删除任意用户的令牌，非 Root 仅限自己的
	if c.GetInt("role") == common.RoleRootUser {
		count, err = model.BatchDeleteTokensAdmin(tokenBatch.Ids)
	} else {
		count, err = model.BatchDeleteTokens(tokenBatch.Ids, userId)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// Root 批量删除其他用户的令牌时，记录一条审计日志
	if c.GetInt("role") == common.RoleRootUser && count > 0 {
		idStrs := make([]string, len(tokenBatch.Ids))
		for i, id := range tokenBatch.Ids {
			idStrs[i] = strconv.Itoa(id)
		}
		recordManageAudit(c, "token.admin_batch_delete", map[string]interface{}{
			"count":     count,
			"token_ids": strings.Join(idStrs, ","),
		})
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    count,
	})
}

// GetTokenKeysBatch 批量获取令牌。Root 可批量获取任意用户令牌，非 Root 仅限自己的。
func GetTokenKeysBatch(c *gin.Context) {
	tokenBatch := TokenBatch{}
	if err := c.ShouldBindJSON(&tokenBatch); err != nil || len(tokenBatch.Ids) == 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if len(tokenBatch.Ids) > 100 {
		common.ApiErrorI18n(c, i18n.MsgBatchTooMany, map[string]any{"Max": 100})
		return
	}
	userId := c.GetInt("id")
	var tokens []model.Token
	var err error
	// Root 可批量获取任意令牌的 Key，非 Root 仅限自己的
	if c.GetInt("role") == common.RoleRootUser {
		tokens, err = model.GetTokenKeysByIdsAdmin(tokenBatch.Ids)
	} else {
		tokens, err = model.GetTokenKeysByIds(tokenBatch.Ids, userId)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// Root 批量查看其他用户的令牌 Key 时，记录一条管理审计日志（查看自己的不记）
	if c.GetInt("role") == common.RoleRootUser && len(tokens) > 0 {
		crossIds := make([]string, 0, len(tokens))
		for _, t := range tokens {
			if t.UserId != userId {
				crossIds = append(crossIds, strconv.Itoa(t.Id))
			}
		}
		if len(crossIds) > 0 {
			recordManageAudit(c, "token.admin_key_view_batch", map[string]interface{}{
				"count":     len(crossIds),
				"token_ids": strings.Join(crossIds, ","),
			})
		}
	}
	keysMap := make(map[int]string)
	for _, t := range tokens {
		keysMap[t.Id] = t.GetFullKey()
	}
	common.ApiSuccess(c, gin.H{"keys": keysMap})
}
