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

const invoiceAccountEmailRequired = "Account email is required for invoices"

func validateInvoiceProfile(fields model.InvoiceProfileFields) (model.InvoiceProfileFields, error) {
	fields = normalizeInvoiceProfileForRequest(fields)
	fields.BillingEmail = ""
	if fields.CompanyName == "" {
		return fields, errInvoiceProfile("Company name is required")
	}
	if fields.Country == "" {
		return fields, errInvoiceProfile("Country is required")
	}
	if fields.AddressLine1 == "" {
		return fields, errInvoiceProfile("Address is required")
	}
	return fields, nil
}

func stripeInvoiceProfileForUser(fields model.InvoiceProfileFields, user *model.User) (model.InvoiceProfileFields, error) {
	fields, err := validateInvoiceProfile(fields)
	if err != nil {
		return fields, err
	}
	email, err := userInvoiceEmail(user)
	if err != nil {
		return fields, err
	}
	fields.BillingEmail = email
	return fields, nil
}

func userInvoiceEmail(user *model.User) (string, error) {
	if user == nil {
		return "", errInvoiceProfile(invoiceAccountEmailRequired)
	}
	email := strings.TrimSpace(user.Email)
	if email == "" || !invoiceEmailPattern.MatchString(email) {
		return "", errInvoiceProfile(invoiceAccountEmailRequired)
	}
	return email, nil
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
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid user ID"})
		return 0
	}
	return id
}

func saveInvoiceProfile(c *gin.Context, userId int) {
	var req model.InvoiceProfileFields
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid request parameters")
		return
	}

	fields, err := validateInvoiceProfile(req)
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

func normalizeInvoiceProfileForRequest(fields model.InvoiceProfileFields) model.InvoiceProfileFields {
	fields = model.NormalizeInvoiceProfileFields(fields)
	fields.TaxIDType = strings.ToLower(fields.TaxIDType)
	fields.Country = strings.ToUpper(fields.Country)
	return fields
}
