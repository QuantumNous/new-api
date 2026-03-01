package controller

import (
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/go-fuego/fuego"

	"github.com/gin-gonic/gin"
)

func GetAllRedemptions(c fuego.ContextNoBody) (*dto.Response[dto.PageData[*model.Redemption]], error) {
	pageInfo := dto.PageInfo(c)
	redemptions, total, err := model.GetAllRedemptions(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		return dto.FailPage[*model.Redemption](err.Error())
	}
	return dto.OkPage(pageInfo, redemptions, int(total))
}

func SearchRedemptions(c fuego.ContextWithParams[dto.SearchRedemptionsParams]) (*dto.Response[dto.PageData[*model.Redemption]], error) {
	p, _ := dto.ParseParams[dto.SearchRedemptionsParams](c)
	pageInfo := dto.PageInfo(c)
	redemptions, total, err := model.SearchRedemptions(p.Keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		return dto.FailPage[*model.Redemption](err.Error())
	}
	return dto.OkPage(pageInfo, redemptions, int(total))
}

func GetRedemption(c fuego.ContextNoBody) (*dto.Response[model.Redemption], error) {
	id, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.Fail[model.Redemption](err.Error())
	}
	redemption, err := model.GetRedemptionById(id)
	if err != nil {
		return dto.Fail[model.Redemption](err.Error())
	}
	return dto.Ok(*redemption)
}

func AddRedemption(c fuego.ContextWithBody[model.Redemption]) (*dto.Response[[]string], error) {
	ginCtx := dto.GinCtx(c)
	redemption, err := c.Body()
	if err != nil {
		return dto.Fail[[]string](err.Error())
	}
	if utf8.RuneCountInString(redemption.Name) == 0 || utf8.RuneCountInString(redemption.Name) > 20 {
		return dto.Fail[[]string](common.TranslateMessage(ginCtx, i18n.MsgRedemptionNameLength))
	}
	if redemption.Count <= 0 {
		return dto.Fail[[]string](common.TranslateMessage(ginCtx, i18n.MsgRedemptionCountPositive))
	}
	if redemption.Count > 100 {
		return dto.Fail[[]string](common.TranslateMessage(ginCtx, i18n.MsgRedemptionCountMax))
	}
	if valid, msg := validateExpiredTime(ginCtx, redemption.ExpiredTime); !valid {
		return dto.Fail[[]string](msg)
	}
	var keys []string
	for i := 0; i < redemption.Count; i++ {
		key := common.GetUUID()
		cleanRedemption := model.Redemption{
			UserId:      dto.UserID(c),
			Name:        redemption.Name,
			Key:         key,
			CreatedTime: common.GetTimestamp(),
			Quota:       redemption.Quota,
			ExpiredTime: redemption.ExpiredTime,
		}
		err := cleanRedemption.Insert()
		if err != nil {
			common.SysError("failed to insert redemption: " + err.Error())
			return &dto.Response[[]string]{
				Message: common.TranslateMessage(ginCtx, i18n.MsgRedemptionCreateFailed),
				Data:    keys,
			}, nil
		}
		keys = append(keys, key)
	}
	return dto.Ok(keys)
}

func DeleteRedemption(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	id := c.PathParamInt("id")
	err := model.DeleteRedemptionById(id)
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	return dto.Msg("")
}

func UpdateRedemption(c fuego.Context[model.Redemption, dto.StatusOnlyParams]) (*dto.Response[model.Redemption], error) {
	ginCtx := dto.GinCtx(c)
	p, _ := dto.ParseParams[dto.StatusOnlyParams](c)
	redemption, err := c.Body()
	if err != nil {
		return dto.Fail[model.Redemption](err.Error())
	}
	cleanRedemption, err := model.GetRedemptionById(redemption.Id)
	if err != nil {
		return dto.Fail[model.Redemption](err.Error())
	}
	if p.StatusOnly == "" {
		if valid, msg := validateExpiredTime(ginCtx, redemption.ExpiredTime); !valid {
			return dto.Fail[model.Redemption](msg)
		}
		// If you add more fields, please also update redemption.Update()
		cleanRedemption.Name = redemption.Name
		cleanRedemption.Quota = redemption.Quota
		cleanRedemption.ExpiredTime = redemption.ExpiredTime
	}
	if p.StatusOnly != "" {
		cleanRedemption.Status = redemption.Status
	}
	err = cleanRedemption.Update()
	if err != nil {
		return dto.Fail[model.Redemption](err.Error())
	}
	return dto.Ok(*cleanRedemption)
}

func DeleteInvalidRedemption(c fuego.ContextNoBody) (*dto.Response[int64], error) {
	rows, err := model.DeleteInvalidRedemptions()
	if err != nil {
		return dto.Fail[int64](err.Error())
	}
	return dto.Ok(rows)
}

func validateExpiredTime(c *gin.Context, expired int64) (bool, string) {
	if expired != 0 && expired < common.GetTimestamp() {
		return false, common.TranslateMessage(c, i18n.MsgRedemptionExpireTimeInvalid)
	}
	return true, ""
}
