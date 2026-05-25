package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var (
	errInviteCodeRequired = errors.New("invite code required")
	errInviteCodeInvalid  = errors.New("invite code invalid")
)

func getInviterIdForRegistrationWithTx(tx *gorm.DB, inviteCode string) (int, error) {
	inviteCode = strings.TrimSpace(inviteCode)
	if inviteCode == "" {
		if common.InviteOnlyRegisterEnabled {
			return 0, errInviteCodeRequired
		}
		return 0, nil
	}

	inviterId, _, err := model.GetInviterIdByRegistrationInviteCodeWithTx(tx, inviteCode)
	if err != nil || inviterId == 0 {
		return 0, errInviteCodeInvalid
	}
	return inviterId, nil
}

func getRegistrationInviteCodeFromUser(user model.User) string {
	if strings.TrimSpace(user.InviteCode) != "" {
		return user.InviteCode
	}
	return user.AffCode
}

func getRegistrationInviteCodeFromSession(session sessions.Session) string {
	inviteCode, _ := session.Get("invite_code").(string)
	if strings.TrimSpace(inviteCode) != "" {
		return inviteCode
	}
	affCode, _ := session.Get("aff").(string)
	return affCode
}

func createUserWithRegistrationInviteCode(user *model.User, inviteCode string) (int, error) {
	inviterId := 0
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var err error
		inviterId, err = getInviterIdForRegistrationWithTx(tx, inviteCode)
		if err != nil {
			return err
		}
		if err := user.InsertWithTx(tx, inviterId); err != nil {
			return err
		}
		return model.ConsumeRegistrationInviteCodeWithTx(tx, inviteCode, user.Id)
	})
	if err != nil {
		return 0, err
	}
	user.FinalizeOAuthUserCreation(inviterId)
	return inviterId, nil
}

func respondInviteCodeError(c *gin.Context, err error) bool {
	switch {
	case errors.Is(err, errInviteCodeRequired):
		common.ApiErrorI18n(c, i18n.MsgUserInviteCodeRequired)
		return true
	case errors.Is(err, errInviteCodeInvalid):
		common.ApiErrorI18n(c, i18n.MsgUserInviteCodeInvalid)
		return true
	default:
		return false
	}
}

type inviteCodeCreateRequest struct {
	Name        string `json:"name"`
	Count       int    `json:"count"`
	InviterId   int    `json:"inviter_id"`
	MaxUses     int    `json:"max_uses"`
	ExpiredTime int64  `json:"expired_time"`
}

type inviteCodeUpdateRequest struct {
	Id          int    `json:"id"`
	Name        string `json:"name"`
	Status      int    `json:"status"`
	MaxUses     int    `json:"max_uses"`
	ExpiredTime int64  `json:"expired_time"`
}

func buildInviteCodeCreateParams(c *gin.Context, req inviteCodeCreateRequest, adminMode bool) (model.InviteCodeCreateParams, bool) {
	if req.Count <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return model.InviteCodeCreateParams{}, false
	}
	if req.Count > 100 {
		common.ApiErrorI18n(c, i18n.MsgBatchTooMany, map[string]any{"Max": 100})
		return model.InviteCodeCreateParams{}, false
	}

	creatorId := c.GetInt("id")
	inviterId := creatorId
	if adminMode && req.InviterId > 0 {
		if _, err := model.GetUserById(req.InviterId, false); err != nil {
			common.ApiErrorI18n(c, i18n.MsgUserNotExists)
			return model.InviteCodeCreateParams{}, false
		}
		inviterId = req.InviterId
	}
	if req.MaxUses <= 0 {
		req.MaxUses = 1
	}
	if req.ExpiredTime != 0 && req.ExpiredTime < common.GetTimestamp() {
		common.ApiErrorI18n(c, i18n.MsgRedemptionExpireTimeInvalid)
		return model.InviteCodeCreateParams{}, false
	}

	role := c.GetInt("role")
	if role < common.RoleAdminUser {
		createdToday, err := model.CountInviteCodesCreatedToday(creatorId)
		if err != nil {
			common.ApiError(c, err)
			return model.InviteCodeCreateParams{}, false
		}
		remaining := common.InviteCodeDailyLimit - int(createdToday)
		if remaining <= 0 || req.Count > remaining {
			common.ApiErrorI18n(c, i18n.MsgUserInviteCodeDailyLimit)
			return model.InviteCodeCreateParams{}, false
		}
	}

	return model.InviteCodeCreateParams{
		Name:        req.Name,
		Count:       req.Count,
		CreatorId:   creatorId,
		InviterId:   inviterId,
		MaxUses:     req.MaxUses,
		ExpiredTime: req.ExpiredTime,
	}, true
}

func CreateSelfInviteCodes(c *gin.Context) {
	var req inviteCodeCreateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	params, ok := buildInviteCodeCreateParams(c, req, false)
	if !ok {
		return
	}
	codes, err := model.CreateInviteCodes(params)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, codes)
}

func GetSelfInviteCodes(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	codes, total, err := model.GetInviteCodes(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(codes)
	common.ApiSuccess(c, pageInfo)
}

func GetAllInviteCodes(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	codes, total, err := model.GetInviteCodes(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(codes)
	common.ApiSuccess(c, pageInfo)
}

func SearchInviteCodes(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	codes, total, err := model.SearchInviteCodes(c.Query("keyword"), pageInfo.GetStartIdx(), pageInfo.GetPageSize(), 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(codes)
	common.ApiSuccess(c, pageInfo)
}

func CreateInviteCodes(c *gin.Context) {
	var req inviteCodeCreateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	params, ok := buildInviteCodeCreateParams(c, req, true)
	if !ok {
		return
	}
	codes, err := model.CreateInviteCodes(params)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, codes)
}

func UpdateInviteCode(c *gin.Context) {
	statusOnly := c.Query("status_only")
	var req inviteCodeUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || req.Id == 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	inviteCode, err := model.GetInviteCodeById(req.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if statusOnly == "" {
		if req.ExpiredTime != 0 && req.ExpiredTime < common.GetTimestamp() {
			common.ApiErrorI18n(c, i18n.MsgRedemptionExpireTimeInvalid)
			return
		}
		inviteCode.Name = req.Name
		inviteCode.MaxUses = req.MaxUses
		inviteCode.ExpiredTime = req.ExpiredTime
	}
	if statusOnly != "" {
		inviteCode.Status = req.Status
	}
	if inviteCode.MaxUses <= 0 {
		inviteCode.MaxUses = 1
	}
	if err := model.UpdateInviteCode(inviteCode); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    inviteCode,
	})
}

func DeleteInviteCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if err := model.DeleteInviteCodeById(id, c.GetInt("id"), c.GetInt("role")); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
