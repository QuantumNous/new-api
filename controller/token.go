package controller

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/go-fuego/fuego"
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

func GetAllTokens(c fuego.ContextNoBody) (*dto.Response[dto.PageData[*model.Token]], error) {
	page := dto.PageInfo(c)
	tokens, err := model.GetAllUserTokens(dto.UserID(c), page.GetStartIdx(), page.GetPageSize())
	if err != nil {
		return dto.FailPage[*model.Token](err.Error())
	}
	total, _ := model.CountUserTokens(dto.UserID(c))
	return dto.OkPage(page, buildMaskedTokenResponses(tokens), int(total))
}

func SearchTokens(c fuego.ContextWithParams[dto.SearchTokensParams]) (*dto.Response[dto.PageData[*model.Token]], error) {
	p, _ := dto.ParseParams[dto.SearchTokensParams](c)
	page := dto.PageInfo(c)

	tokens, total, err := model.SearchUserTokens(dto.UserID(c), p.Keyword, p.Token, page.GetStartIdx(), page.GetPageSize())
	if err != nil {
		return dto.FailPage[*model.Token](err.Error())
	}
	return dto.OkPage(page, buildMaskedTokenResponses(tokens), int(total))
}

func GetToken(c fuego.ContextNoBody) (*dto.Response[model.Token], error) {
	id, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.Fail[model.Token](err.Error())
	}
	token, err := model.GetTokenByIds(id, dto.UserID(c))
	if err != nil {
		return dto.Fail[model.Token](err.Error())
	}
	return dto.Ok(*buildMaskedTokenResponse(token))
}

func GetTokenKey(c fuego.ContextNoBody) (*dto.Response[map[string]string], error) {
	id, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.Fail[map[string]string](err.Error())
	}
	token, err := model.GetTokenByIds(id, dto.UserID(c))
	if err != nil {
		return dto.Fail[map[string]string](err.Error())
	}
	return dto.Ok(map[string]string{
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
	c.JSON(200, dto.CreditSummary{
		Object:         "credit_summary",
		TotalGranted:   token.RemainQuota,
		TotalUsed:      0,
		TotalAvailable: token.RemainQuota,
		ExpiresAt:      expiredAt * 1000,
	})
}

func GetTokenUsage(c fuego.ContextNoBody) (*dto.Response[dto.TokenUsageData], error) {
	authHeader := c.Header("Authorization")
	if authHeader == "" {
		return dto.Fail[dto.TokenUsageData]("No Authorization header")
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return dto.Fail[dto.TokenUsageData]("Invalid Bearer token")
	}
	tokenKey := parts[1]

	token, err := model.GetTokenByKey(strings.TrimPrefix(tokenKey, "sk-"), false)
	if err != nil {
		common.SysError("failed to get token by key: " + err.Error())
		return dto.Fail[dto.TokenUsageData](common.TranslateMessage(dto.GinCtx(c), i18n.MsgTokenGetInfoFailed))
	}

	expiredAt := token.ExpiredTime
	if expiredAt == -1 {
		expiredAt = 0
	}

	return dto.Ok(dto.TokenUsageData{
		Object:             "token_usage",
		Name:               token.Name,
		TotalGranted:       token.RemainQuota + token.UsedQuota,
		TotalUsed:          token.UsedQuota,
		TotalAvailable:     token.RemainQuota,
		UnlimitedQuota:     token.UnlimitedQuota,
		ModelLimits:        token.GetModelLimitsMap(),
		ModelLimitsEnabled: token.ModelLimitsEnabled,
		ExpiresAt:          expiredAt,
	})
}

func AddToken(c fuego.ContextWithBody[model.Token]) (dto.MessageResponse, error) {
	token, err := c.Body()
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	if len(token.Name) > 50 {
		return dto.FailMsg(common.TranslateMessage(dto.GinCtx(c), i18n.MsgTokenNameTooLong))
	}
	if !token.UnlimitedQuota {
		if token.RemainQuota < 0 {
			return dto.FailMsg(common.TranslateMessage(dto.GinCtx(c), i18n.MsgTokenQuotaNegative))
		}
		maxQuotaValue := int((1000000000 * common.QuotaPerUnit))
		if token.RemainQuota > maxQuotaValue {
			return dto.FailMsg(common.TranslateMessage(dto.GinCtx(c), i18n.MsgTokenQuotaExceedMax, map[string]any{"Max": maxQuotaValue}))
		}
	}
	maxTokens := operation_setting.GetMaxUserTokens()
	count, err := model.CountUserTokens(dto.UserID(c))
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	if int(count) >= maxTokens {
		return dto.FailMsg(fmt.Sprintf("已达到最大令牌数量限制 (%d)", maxTokens))
	}
	key, err := common.GenerateKey()
	if err != nil {
		common.SysLog("failed to generate token key: " + err.Error())
		return dto.FailMsg(common.TranslateMessage(dto.GinCtx(c), i18n.MsgTokenGenerateFailed))
	}
	cleanToken := model.Token{
		UserId:             dto.UserID(c),
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
		return dto.FailMsg(err.Error())
	}
	return dto.Msg("")
}

func DeleteToken(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	id := c.PathParamInt("id")
	err := model.DeleteTokenById(id, dto.UserID(c))
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	return dto.Msg("")
}

func UpdateToken(c fuego.Context[model.Token, dto.StatusOnlyParams]) (*dto.Response[model.Token], error) {
	p, _ := dto.ParseParams[dto.StatusOnlyParams](c)
	token, err := c.Body()
	if err != nil {
		return dto.Fail[model.Token](err.Error())
	}
	if len(token.Name) > 50 {
		return dto.Fail[model.Token](common.TranslateMessage(dto.GinCtx(c), i18n.MsgTokenNameTooLong))
	}
	if !token.UnlimitedQuota {
		if token.RemainQuota < 0 {
			return dto.Fail[model.Token](common.TranslateMessage(dto.GinCtx(c), i18n.MsgTokenQuotaNegative))
		}
		maxQuotaValue := int((1000000000 * common.QuotaPerUnit))
		if token.RemainQuota > maxQuotaValue {
			return dto.Fail[model.Token](common.TranslateMessage(dto.GinCtx(c), i18n.MsgTokenQuotaExceedMax, map[string]any{"Max": maxQuotaValue}))
		}
	}
	cleanToken, err := model.GetTokenByIds(token.Id, dto.UserID(c))
	if err != nil {
		return dto.Fail[model.Token](err.Error())
	}
	if token.Status == common.TokenStatusEnabled {
		if cleanToken.Status == common.TokenStatusExpired && cleanToken.ExpiredTime <= common.GetTimestamp() && cleanToken.ExpiredTime != -1 {
			return dto.Fail[model.Token](common.TranslateMessage(dto.GinCtx(c), i18n.MsgTokenExpiredCannotEnable))
		}
		if cleanToken.Status == common.TokenStatusExhausted && cleanToken.RemainQuota <= 0 && !cleanToken.UnlimitedQuota {
			return dto.Fail[model.Token](common.TranslateMessage(dto.GinCtx(c), i18n.MsgTokenExhaustedCannotEable))
		}
	}
	if p.StatusOnly != "" {
		cleanToken.Status = token.Status
	} else {
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
		return dto.Fail[model.Token](err.Error())
	}
	return dto.Ok(*buildMaskedTokenResponse(cleanToken))
}

func DeleteTokenBatch(c fuego.ContextWithBody[dto.TokenBatch]) (*dto.Response[int], error) {
	tokenBatch, err := c.Body()
	if err != nil || len(tokenBatch.Ids) == 0 {
		return dto.Fail[int](common.TranslateMessage(dto.GinCtx(c), i18n.MsgInvalidParams))
	}
	count, err := model.BatchDeleteTokens(tokenBatch.Ids, dto.UserID(c))
	if err != nil {
		return dto.Fail[int](err.Error())
	}
	return dto.Ok(count)
}
