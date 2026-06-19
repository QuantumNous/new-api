package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

func buildMaskedTokenResponse(token *model.Token) *model.Token {
	if token == nil {
		return nil
	}
	maskedToken := *token
	maskedToken.Key = token.GetMaskedKey()
	return &maskedToken
}

func buildMaskedTokenResponses(tokens []*model.Token) []*model.Token {
	maskedTokens := make([]*model.Token, 0, len(tokens))
	for _, token := range tokens {
		maskedTokens = append(maskedTokens, buildMaskedTokenResponse(token))
	}
	return maskedTokens
}

// tokenReadScope 统一描述令牌「只读」类接口（列表/搜索/详情/取 key）的有效查询范围。
//   - 普通用户：ownerUserId=自己，boundIds=nil（不过滤），isSubAccount=false；
//   - 子账户：ownerUserId=企业主账户 id，boundIds=该子账户绑定的 token id 集合。
//
// 绑定 key 的 tokens.user_id 始终留在企业主身上（绑定只是查看授权），故子账户的所有
// 令牌读接口都必须切到「父 id + 绑定集合」口径——否则按子账户自身 id 查恒为空。
// 关键安全约束同 selfDataScope：子账户 boundIds 为空集合时必须短路返回空 / 拒绝，
// 绝不能把空集合当作「不过滤」下发给 model 层。
type tokenReadScope struct {
	ownerUserId  int
	boundIds     []int
	isSubAccount bool
}

func (s tokenReadScope) emptyForSubAccount() bool {
	return s.isSubAccount && len(s.boundIds) == 0
}

func (s tokenReadScope) isBound(tokenId int) bool {
	for _, id := range s.boundIds {
		if id == tokenId {
			return true
		}
	}
	return false
}

func resolveTokenReadScope(c *gin.Context) (tokenReadScope, error) {
	userId := c.GetInt("id")
	cache, err := model.GetUserCache(userId)
	if err != nil {
		return tokenReadScope{}, err
	}
	if cache.ParentUserId <= 0 {
		return tokenReadScope{ownerUserId: userId}, nil
	}
	boundIds, err := model.GetBoundTokenIdsBySubUser(userId)
	if err != nil {
		return tokenReadScope{}, err
	}
	return tokenReadScope{ownerUserId: cache.ParentUserId, boundIds: boundIds, isSubAccount: true}, nil
}

func GetAllTokens(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	scope, err := resolveTokenReadScope(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 子账户：令牌页只读，返回「绑定的 key 列表」（脱敏；余额可见 D12；完整 key 走
	// GetTokenKey 的子账户分支按绑定授权取回 D11）。key 始终归属企业主（user_id 不变）。
	if scope.isSubAccount {
		if scope.emptyForSubAccount() {
			pageInfo.SetTotal(0)
			pageInfo.SetItems([]*model.Token{})
			common.ApiSuccess(c, pageInfo)
			return
		}
		tokens, err := model.GetTokensByIdsAndUser(scope.boundIds, scope.ownerUserId)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		// 维持分页契约：total 为全量绑定数，items 按页内存切片（绑定数通常很小）。
		// GetPageQuery 不钳位负数 p（GORM Offset/Limit 容忍负值所以上游没炸），
		// 内存切片必须自防越界 panic。
		total := len(tokens)
		startIdx := pageInfo.GetStartIdx()
		pageSize := pageInfo.GetPageSize()
		if startIdx < 0 {
			startIdx = 0
		}
		if pageSize < 0 {
			pageSize = 0
		}
		endIdx := startIdx + pageSize
		if startIdx > total {
			startIdx = total
		}
		if endIdx > total {
			endIdx = total
		}
		pageInfo.SetTotal(total)
		pageInfo.SetItems(buildMaskedTokenResponses(tokens[startIdx:endIdx]))
		common.ApiSuccess(c, pageInfo)
		return
	}

	tokens, err := model.GetAllUserTokens(scope.ownerUserId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	total, _ := model.CountUserTokens(scope.ownerUserId)
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(buildMaskedTokenResponses(tokens))
	common.ApiSuccess(c, pageInfo)
}

func SearchTokens(c *gin.Context) {
	keyword := c.Query("keyword")
	token := c.Query("token")
	pageInfo := common.GetPageQuery(c)

	scope, err := resolveTokenReadScope(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// 子账户无绑定 → 返回空，不查库（防空集合被当成不过滤而搜出企业全量令牌）。
	if scope.emptyForSubAccount() {
		pageInfo.SetTotal(0)
		pageInfo.SetItems([]*model.Token{})
		common.ApiSuccess(c, pageInfo)
		return
	}
	// 子账户：在「父 id + 绑定集合」内搜索；普通用户 boundIds=nil 不过滤。
	tokens, total, err := model.SearchUserTokens(scope.ownerUserId, keyword, token, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), scope.boundIds)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(buildMaskedTokenResponses(tokens))
	common.ApiSuccess(c, pageInfo)
}

func GetToken(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	scope, err := resolveTokenReadScope(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// 子账户：仅允许查看绑定给自己的令牌，按企业主属主取回（未绑定一律拒绝，防越权）。
	if scope.isSubAccount && !scope.isBound(id) {
		common.ApiErrorMsg(c, "无权查看该令牌")
		return
	}
	token, err := model.GetTokenByIds(id, scope.ownerUserId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, buildMaskedTokenResponse(token))
}

func GetTokenKey(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	scope, err := resolveTokenReadScope(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// 子账户：仅允许取回绑定给自己的 key 全文（D11），按企业主属主查询；未绑定拒绝。
	if scope.isSubAccount && !scope.isBound(id) {
		common.ApiErrorMsg(c, "无权查看该令牌")
		return
	}
	token, err := model.GetTokenByIds(id, scope.ownerUserId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"key": token.GetFullKey(),
	})
}

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

// validateTokenModelLimits 确保 token.ModelLimits 中的每个模型都在 token.Group
// 所对应的可用模型集合内。空 group 与 auth.go 对齐——视为单一 user.Group；
// auto 视为自动分组并集；具体分组必须在用户可用分组集合内。
// 返回 nil 表示通过；非 nil 错误用于直接回写给客户端。
func validateTokenModelLimits(userId int, token *model.Token) error {
	if !token.ModelLimitsEnabled || strings.TrimSpace(token.ModelLimits) == "" {
		return nil
	}
	user, err := model.GetUserCache(userId)
	if err != nil {
		return err
	}
	usable := service.GetUserUsableGroups(user.Group)

	var targetGroups []string
	switch token.Group {
	case "":
		targetGroups = []string{user.Group}
	case "auto":
		targetGroups = service.GetUserAutoGroup(user.Group)
	default:
		if _, ok := usable[token.Group]; !ok {
			return fmt.Errorf("分组 %s 不在可用分组列表中", token.Group)
		}
		targetGroups = []string{token.Group}
	}

	available := make(map[string]bool)
	for _, g := range targetGroups {
		for _, m := range model.GetGroupEnabledModels(g) {
			available[m] = true
		}
	}

	var invalid []string
	for _, m := range strings.Split(token.ModelLimits, ",") {
		m = strings.TrimSpace(m)
		if m == "" {
			continue
		}
		if !available[m] {
			if groups := model.GetModelEnableGroups(m); len(groups) > 0 {
				invalid = append(invalid, fmt.Sprintf("%s（可用分组：%s）", m, strings.Join(groups, ", ")))
			} else {
				invalid = append(invalid, m)
			}
		}
	}
	if len(invalid) > 0 {
		groupName := token.Group
		if groupName == "" {
			groupName = "默认分组"
		}
		return fmt.Errorf("以下模型不在令牌分组 %s 的可用模型范围内：%s", groupName, strings.Join(invalid, "; "))
	}
	return nil
}

func AddToken(c *gin.Context) {
	token := model.Token{}
	err := c.ShouldBindJSON(&token)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if len(token.Name) > 50 {
		common.ApiErrorI18n(c, i18n.MsgTokenNameTooLong)
		return
	}
	// 同账户令牌名称去重（便于企业子账户按名识别绑定令牌）
	if dup, err := model.IsTokenNameDuplicated(c.GetInt("id"), token.Name, 0); err != nil {
		common.ApiError(c, err)
		return
	} else if dup {
		common.ApiErrorMsg(c, "令牌名称已存在，请使用不同的名称")
		return
	}
	// 非无限额度时，检查额度值是否超出有效范围
	if !token.UnlimitedQuota {
		if token.RemainQuota < 0 {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaNegative)
			return
		}
		maxQuotaValue := int((1000000000 * common.QuotaPerUnit))
		if token.RemainQuota > maxQuotaValue {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaExceedMax, map[string]any{"Max": maxQuotaValue})
			return
		}
	}
	// 检查用户令牌数量是否已达上限
	maxTokens := operation_setting.GetMaxUserTokens()
	count, err := model.CountUserTokens(c.GetInt("id"))
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
	if err := validateTokenModelLimits(c.GetInt("id"), &token); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	key, err := common.GenerateKey()
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgTokenGenerateFailed)
		common.SysLog("failed to generate token key: " + err.Error())
		return
	}
	cleanToken := model.Token{
		UserId:             c.GetInt("id"),
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
	}
	err = cleanToken.Insert()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func DeleteToken(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	userId := c.GetInt("id")
	// 绑定保护：已绑定子账户的令牌禁止删除，须先解绑（设计 §4.3）。
	// 仅当绑定属于当前用户时给出提示，避免泄漏他人令牌的绑定信息。
	if binding, bErr := model.GetBindingByTokenId(id); bErr == nil && binding != nil && binding.ParentUserId == userId {
		subName := ""
		if sub, e := model.GetUserById(binding.SubUserId, false); e == nil {
			subName = sub.Username
		}
		common.ApiErrorMsg(c, fmt.Sprintf("该令牌已绑定子账户 %s，请先解除绑定后再删除", subName))
		return
	}
	err := model.DeleteTokenById(id, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func UpdateToken(c *gin.Context) {
	userId := c.GetInt("id")
	statusOnly := c.Query("status_only")
	token := model.Token{}
	err := c.ShouldBindJSON(&token)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if len(token.Name) > 50 {
		common.ApiErrorI18n(c, i18n.MsgTokenNameTooLong)
		return
	}
	if !token.UnlimitedQuota {
		if token.RemainQuota < 0 {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaNegative)
			return
		}
		maxQuotaValue := int((1000000000 * common.QuotaPerUnit))
		if token.RemainQuota > maxQuotaValue {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaExceedMax, map[string]any{"Max": maxQuotaValue})
			return
		}
	}
	cleanToken, err := model.GetTokenByIds(token.Id, userId)
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
		if err := validateTokenModelLimits(userId, &token); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
		// 仅当名称变化时校验同账户去重，避免历史重名令牌改其它字段时被误拦
		if token.Name != cleanToken.Name {
			if dup, err := model.IsTokenNameDuplicated(userId, token.Name, cleanToken.Id); err != nil {
				common.ApiError(c, err)
				return
			} else if dup {
				common.ApiErrorMsg(c, "令牌名称已存在，请使用不同的名称")
				return
			}
		}
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
	}
	err = cleanToken.Update()
	if err != nil {
		common.ApiError(c, err)
		return
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

func DeleteTokenBatch(c *gin.Context) {
	tokenBatch := TokenBatch{}
	if err := c.ShouldBindJSON(&tokenBatch); err != nil || len(tokenBatch.Ids) == 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	userId := c.GetInt("id")
	// 绑定保护：批量删除中若有令牌已绑定子账户，整批拒绝并提示数量（交互更清晰）。
	if bindings, bErr := model.GetBindingsByTokenIds(tokenBatch.Ids); bErr == nil {
		boundCount := 0
		for _, b := range bindings {
			if b.ParentUserId == userId {
				boundCount++
			}
		}
		if boundCount > 0 {
			common.ApiErrorMsg(c, fmt.Sprintf("选中的令牌中有 %d 个已绑定子账户，请先解除绑定后再删除", boundCount))
			return
		}
	}
	count, err := model.BatchDeleteTokens(tokenBatch.Ids, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    count,
	})
}

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
	scope, err := resolveTokenReadScope(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	ids := tokenBatch.Ids
	if scope.isSubAccount {
		// 子账户：按企业主属主取 key，且仅返回绑定给自己的令牌（D11）；未绑定 id 剔除，空绑定 → 空结果（§9.7-2）。
		bound := make([]int, 0, len(ids))
		for _, id := range ids {
			if scope.isBound(id) {
				bound = append(bound, id)
			}
		}
		ids = bound
	}
	tokens, err := model.GetTokenKeysByIds(ids, scope.ownerUserId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	keysMap := make(map[int]string)
	for _, t := range tokens {
		keysMap[t.Id] = t.GetFullKey()
	}
	common.ApiSuccess(c, gin.H{"keys": keysMap})
}
