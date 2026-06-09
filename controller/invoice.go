package controller

import (
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

var invoiceEmailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

type invoiceProfileRequest struct {
	model.InvoiceProfileFields
}

func validateInvoiceProfile(fields model.InvoiceProfileFields) (model.InvoiceProfileFields, error) {
	fields = model.NormalizeInvoiceProfileFields(fields)
	if fields.CompanyName == "" {
		return fields, errInvoiceProfile("公司抬头不能为空")
	}
	if fields.BillingEmail == "" || !invoiceEmailPattern.MatchString(fields.BillingEmail) {
		return fields, errInvoiceProfile("开票邮箱无效")
	}
	if fields.Country == "" {
		return fields, errInvoiceProfile("国家不能为空")
	}
	if fields.AddressLine1 == "" {
		return fields, errInvoiceProfile("地址不能为空")
	}
	return fields, nil
}

type invoiceProfileError string

func (err invoiceProfileError) Error() string {
	return string(err)
}

func errInvoiceProfile(msg string) error {
	return invoiceProfileError(msg)
}

func GetSelfInvoiceProfile(c *gin.Context) {
	userId := c.GetInt("id")
	profile, err := model.GetUserInvoiceProfile(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, profile)
}

func UpdateSelfInvoiceProfile(c *gin.Context) {
	saveInvoiceProfile(c, c.GetInt("id"))
}

func AdminGetUserInvoiceProfile(c *gin.Context) {
	userId := parseUserIDParam(c)
	if userId <= 0 {
		return
	}
	profile, err := model.GetUserInvoiceProfile(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, profile)
}

func AdminUpdateUserInvoiceProfile(c *gin.Context) {
	userId := parseUserIDParam(c)
	if userId <= 0 {
		return
	}
	saveInvoiceProfile(c, userId)
}

func parseUserIDParam(c *gin.Context) int {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的用户ID"})
		return 0
	}
	return id
}

func saveInvoiceProfile(c *gin.Context, userId int) {
	var req invoiceProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	fields, err := validateInvoiceProfile(req.InvoiceProfileFields)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	profile := &model.UserInvoiceProfile{
		UserId:               userId,
		InvoiceProfileFields: fields,
	}
	if err := model.SaveUserInvoiceProfile(profile); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, profile)
}

func buildInvoiceProfileFromRequest(fields model.InvoiceProfileFields) model.InvoiceProfileFields {
	fields = model.NormalizeInvoiceProfileFields(fields)
	fields.TaxIDType = strings.ToLower(fields.TaxIDType)
	fields.Country = strings.ToUpper(fields.Country)
	return fields
}
