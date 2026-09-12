package internal

import (
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"

	"github.com/gin-gonic/gin"
)

func getAllInternalKeys(c *gin.Context) {
	keys, err := GetAllInternalKeys()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    keys,
	})
}

func validateInternalKeyName(name string) bool {
	return utf8.RuneCountInString(name) <= 128
}

func addInternalKey(c *gin.Context) {
	internalKey := InternalKey{}
	if err := c.ShouldBindJSON(&internalKey); err != nil {
		common.ApiError(c, err)
		return
	}
	internalKey.KeyId = strings.TrimSpace(internalKey.KeyId)
	internalKey.Name = strings.TrimSpace(internalKey.Name)
	customKey := strings.TrimSpace(internalKey.Key)
	// 密钥 ID 留空则自动生成，名称作为人工配置的标识。
	if internalKey.KeyId == "" {
		internalKey.KeyId = "key-" + common.GetRandomString(12)
	}
	if !ValidateInternalKeyKeyId(internalKey.KeyId) {
		common.ApiErrorI18n(c, i18n.MsgInternalKeyKeyIdInvalid)
		return
	}
	if !validateInternalKeyName(internalKey.Name) {
		common.ApiErrorI18n(c, i18n.MsgInternalKeyNameTooLong)
		return
	}
	switch {
	case customKey == "":
		customKey = common.GetRandomString(internalKeySecretLength)
	case len(customKey) < internalKeySecretMinLength || len(customKey) > internalKeySecretMaxLength:
		common.ApiErrorI18n(c, i18n.MsgInternalKeyKeyInvalid)
		return
	}
	exists, err := InternalKeyKeyIdExists(internalKey.KeyId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if exists {
		common.ApiErrorI18n(c, i18n.MsgInternalKeyKeyIdDuplicate)
		return
	}
	internalKey.Key = customKey
	internalKey.Id = 0
	internalKey.Status = InternalKeyStatusEnabled
	internalKey.CreatedTime = common.GetTimestamp()
	if err := internalKey.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    internalKey,
	})
}

func updateInternalKey(c *gin.Context) {
	internalKey := InternalKey{}
	if err := c.ShouldBindJSON(&internalKey); err != nil {
		common.ApiError(c, err)
		return
	}
	cleanKey, err := GetInternalKeyById(internalKey.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	name := strings.TrimSpace(internalKey.Name)
	if !validateInternalKeyName(name) {
		common.ApiErrorI18n(c, i18n.MsgInternalKeyNameTooLong)
		return
	}
	newKey := strings.TrimSpace(internalKey.Key)
	if newKey != "" && (len(newKey) < internalKeySecretMinLength || len(newKey) > internalKeySecretMaxLength) {
		common.ApiErrorI18n(c, i18n.MsgInternalKeyKeyInvalid)
		return
	}
	cleanKey.Name = name
	// 0 表示请求未携带状态，保持原状态不变；合法值为启用/禁用两种。
	if internalKey.Status == InternalKeyStatusEnabled || internalKey.Status == InternalKeyStatusDisabled {
		cleanKey.Status = internalKey.Status
	}
	fields := []string{"name", "status"}
	if newKey != "" {
		cleanKey.Key = newKey
		fields = append(fields, "key")
	}
	if err := cleanKey.Update(fields...); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    cleanKey,
	})
}

func deleteInternalKey(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := DeleteInternalKeyById(id); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

// internalAuthCheck is a lightweight endpoint protected by InternalAuth, so
// internal systems can verify their key pair and administrators can confirm a
// pair works.
func internalAuthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"key_id": c.GetString("internal_key_id"),
			"name":   c.GetString("internal_key_name"),
		},
	})
}
