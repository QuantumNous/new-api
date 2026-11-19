package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetThirdPartySites(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	sites, total, err := model.GetThirdPartySites(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(sites)
	common.ApiSuccess(c, pageInfo)
}

func CreateThirdPartySite(c *gin.Context) {
	var input model.ThirdPartySiteInput
	if err := common.DecodeJson(c.Request.Body, &input); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	site, err := model.CreateThirdPartySite(input)
	if err != nil {
		respondThirdPartySiteError(c, err)
		return
	}
	common.ApiSuccess(c, site)
}

func UpdateThirdPartySite(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid ID")
		return
	}
	var input model.ThirdPartySiteInput
	if err := common.DecodeJson(c.Request.Body, &input); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	site, err := model.UpdateThirdPartySite(id, input)
	if err != nil {
		respondThirdPartySiteError(c, err)
		return
	}
	common.ApiSuccess(c, site)
}

func DeleteThirdPartySite(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid ID")
		return
	}
	if err := model.DeleteThirdPartySite(id); err != nil {
		respondThirdPartySiteError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// respondThirdPartySiteError answers a validation failure with the offending
// field, a missing site as "Site does not exist", and any other error as a
// plain API error. It never echoes the request.
func respondThirdPartySiteError(c *gin.Context, err error) {
	var fieldErr *model.ThirdPartySiteFieldError
	if errors.As(err, &fieldErr) {
		common.ApiErrorStatus(c, http.StatusOK, common.NewMessage(fieldErr.Message), gin.H{"field": fieldErr.Field})
		return
	}
	if errors.Is(err, model.ErrThirdPartySiteNotFound) {
		common.ApiErrorT(c, "Site does not exist")
		return
	}
	common.ApiError(c, err)
}
