package controller

import (
	"errors"
	"net/http"
	"strconv"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// apiErrorRegistrationCode maps registration code sentinel errors to i18n responses.
func apiErrorRegistrationCode(c *gin.Context, err error) {
	switch {
	case errors.Is(err, model.ErrRegistrationCodeUsed):
		common.ApiErrorI18n(c, i18n.MsgRegistrationCodeUsed)
	case errors.Is(err, model.ErrRegistrationCodeExpired):
		common.ApiErrorI18n(c, i18n.MsgRegistrationCodeExpired)
	case errors.Is(err, model.ErrRegistrationCodeInvalid):
		common.ApiErrorI18n(c, i18n.MsgRegistrationCodeInvalid)
	default:
		common.ApiError(c, err)
	}
}

func GetAllRegistrationCodes(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	codes, total, err := model.GetAllRegistrationCodes(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(codes)
	common.ApiSuccess(c, pageInfo)
}

func SearchRegistrationCodes(c *gin.Context) {
	keyword := c.Query("keyword")
	status := c.Query("status")
	pageInfo := common.GetPageQuery(c)
	codes, total, err := model.SearchRegistrationCodes(keyword, status, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(codes)
	common.ApiSuccess(c, pageInfo)
}

func GetRegistrationCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	code, err := model.GetRegistrationCodeById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    code,
	})
}

func AddRegistrationCode(c *gin.Context) {
	code := model.RegistrationCode{}
	err := c.ShouldBindJSON(&code)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if utf8.RuneCountInString(code.Name) == 0 || utf8.RuneCountInString(code.Name) > 20 {
		common.ApiErrorI18n(c, i18n.MsgRegistrationCodeNameLength)
		return
	}
	if code.Count <= 0 {
		common.ApiErrorI18n(c, i18n.MsgRegistrationCodeCountPositive)
		return
	}
	if code.Count > 100 {
		common.ApiErrorI18n(c, i18n.MsgRegistrationCodeCountMax)
		return
	}
	if code.ExpiredTime != 0 && code.ExpiredTime < common.GetTimestamp() {
		common.ApiErrorI18n(c, i18n.MsgRegistrationCodeExpireTimeInvalid)
		return
	}
	var keys []string
	for i := 0; i < code.Count; i++ {
		key := common.GetUUID()
		cleanCode := model.RegistrationCode{
			Name:        code.Name,
			Key:         key,
			Status:      common.RegistrationCodeStatusUnused,
			CreatedTime: common.GetTimestamp(),
			ExpiredTime: code.ExpiredTime,
		}
		err = cleanCode.Insert()
		if err != nil {
			common.SysError("failed to insert registration code: " + err.Error())
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": i18n.T(c, i18n.MsgRegistrationCodeCreateFailed),
				"data":    keys,
			})
			return
		}
		keys = append(keys, key)
	}
	recordManageAudit(c, "registration_code.create", map[string]interface{}{
		"name":  code.Name,
		"count": code.Count,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    keys,
	})
}

func UpdateRegistrationCode(c *gin.Context) {
	code := model.RegistrationCode{}
	err := c.ShouldBindJSON(&code)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	cleanCode, err := model.GetRegistrationCodeById(code.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if utf8.RuneCountInString(code.Name) == 0 || utf8.RuneCountInString(code.Name) > 20 {
		common.ApiErrorI18n(c, i18n.MsgRegistrationCodeNameLength)
		return
	}
	if code.ExpiredTime != 0 && code.ExpiredTime < common.GetTimestamp() {
		common.ApiErrorI18n(c, i18n.MsgRegistrationCodeExpireTimeInvalid)
		return
	}
	// If you add more fields, please also update RegistrationCode.Update()
	cleanCode.Name = code.Name
	cleanCode.ExpiredTime = code.ExpiredTime
	err = cleanCode.Update()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    cleanCode,
	})
}

func DeleteRegistrationCode(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	err := model.DeleteRegistrationCodeById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func DeleteInvalidRegistrationCode(c *gin.Context) {
	rows, err := model.DeleteInvalidRegistrationCodes()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rows,
	})
}
