package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type invitationCodeCreateRequest struct {
	Name        string `json:"name"`
	Count       int    `json:"count"`
	ExpiredTime int64  `json:"expired_time"`
}

type invitationCodeUpdateRequest struct {
	Id          int    `json:"id"`
	Name        string `json:"name"`
	Status      int    `json:"status"`
	ExpiredTime int64  `json:"expired_time"`
}

func GetAllInvitationCodes(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	codes, total, err := model.GetAllInvitationCodes(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(codes)
	common.ApiSuccess(c, pageInfo)
}

func SearchInvitationCodes(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	codes, total, err := model.SearchInvitationCodes(
		c.Query("keyword"),
		c.Query("status"),
		pageInfo.GetStartIdx(),
		pageInfo.GetPageSize(),
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(codes)
	common.ApiSuccess(c, pageInfo)
}

func GetInvitationCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidId)
		return
	}
	code, err := model.GetInvitationCodeById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, code)
}

func AddInvitationCodes(c *gin.Context) {
	request := invitationCodeCreateRequest{}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	request.Name = strings.TrimSpace(request.Name)
	if utf8.RuneCountInString(request.Name) == 0 || utf8.RuneCountInString(request.Name) > 20 {
		common.ApiErrorI18n(c, i18n.MsgInvitationNameLength)
		return
	}
	if request.Count <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvitationCountPositive)
		return
	}
	if request.Count > 100 {
		common.ApiErrorI18n(c, i18n.MsgInvitationCountMax)
		return
	}
	if request.ExpiredTime != 0 && request.ExpiredTime <= common.GetTimestamp() {
		common.ApiErrorI18n(c, i18n.MsgInvitationExpireTimeInvalid)
		return
	}

	codes, err := model.CreateInvitationCodes(request.Name, request.Count, c.GetInt("id"), request.ExpiredTime)
	if err != nil {
		common.SysError("failed to create invitation codes: " + err.Error())
		common.ApiErrorI18n(c, i18n.MsgInvitationCreateFailed)
		return
	}
	recordManageAudit(c, "invitation.create", map[string]interface{}{
		"name":  request.Name,
		"count": request.Count,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    codes,
	})
}

func UpdateInvitationCode(c *gin.Context) {
	request := invitationCodeUpdateRequest{}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if request.Id <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidId)
		return
	}
	statusOnly := c.Query("status_only") != ""
	if statusOnly {
		if request.Status != common.InvitationCodeStatusEnabled && request.Status != common.InvitationCodeStatusDisabled {
			common.ApiErrorI18n(c, i18n.MsgInvitationStatusInvalid)
			return
		}
	} else {
		request.Name = strings.TrimSpace(request.Name)
		if utf8.RuneCountInString(request.Name) == 0 || utf8.RuneCountInString(request.Name) > 20 {
			common.ApiErrorI18n(c, i18n.MsgInvitationNameLength)
			return
		}
		if request.ExpiredTime != 0 && request.ExpiredTime <= common.GetTimestamp() {
			common.ApiErrorI18n(c, i18n.MsgInvitationExpireTimeInvalid)
			return
		}
	}

	code, err := model.UpdateInvitationCode(request.Id, request.Name, request.Status, request.ExpiredTime, statusOnly)
	if errors.Is(err, model.ErrInvitationCodeUsed) {
		common.ApiErrorI18n(c, i18n.MsgInvitationUsedCannotUpdate)
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	action := "invitation.update"
	params := map[string]interface{}{"id": request.Id}
	if statusOnly {
		action = "invitation.status_update"
		params["status"] = request.Status
	}
	recordManageAudit(c, action, params)
	common.ApiSuccess(c, code)
}

func DeleteInvitationCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidId)
		return
	}
	if err := model.DeleteInvitationCodeById(id); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "invitation.delete", map[string]interface{}{"id": id})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func DeleteUsedInvitationCodes(c *gin.Context) {
	rows, err := model.DeleteUsedInvitationCodes()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "invitation.delete_used", map[string]interface{}{"count": rows})
	common.ApiSuccess(c, rows)
}
