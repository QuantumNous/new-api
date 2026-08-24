package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type registrationDomainReleaseRequest struct {
	RestoreUsers     bool `json:"restore_users"`
	AddTrustedDomain bool `json:"add_trusted_domain"`
}

func GetRegistrationDomainBlocks(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	blocks, total, err := model.GetRegistrationDomainBlocks(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(blocks)
	common.ApiSuccess(c, pageInfo)
}

func GetRegistrationDomainBlock(c *gin.Context) {
	blockID, err := strconv.Atoi(c.Param("id"))
	if err != nil || blockID <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	pageInfo := common.GetPageQuery(c)
	page := pageInfo.GetPage()
	if page < 1 {
		page = 1
	}
	pageSize := pageInfo.GetPageSize()
	if pageSize < 1 {
		pageSize = common.ItemsPerPage
	}
	detail, err := model.GetRegistrationDomainBlockDetail(blockID, (page-1)*pageSize, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, detail)
}

func ReleaseRegistrationDomainBlock(c *gin.Context) {
	blockID, err := strconv.Atoi(c.Param("id"))
	if err != nil || blockID <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	request := registrationDomainReleaseRequest{}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	if request.AddTrustedDomain {
		block, err := model.GetRegistrationDomainBlock(blockID)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		result, err := model.ReleaseRegistrationDomainBlockWithTrustedDomain(
			blockID,
			c.GetInt("id"),
			request.RestoreUsers,
			common.GetTimestamp(),
			block.Domain,
		)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		common.ApiSuccess(c, result)
		return
	}

	result, err := model.ReleaseRegistrationDomainBlock(blockID, c.GetInt("id"), request.RestoreUsers, common.GetTimestamp())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}
