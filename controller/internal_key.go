package controller

import (
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func GetAllInternalKeys(c *gin.Context) {
	keys, err := model.GetAllInternalKeys()
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

func AddInternalKey(c *gin.Context) {
	internalKey := model.InternalKey{}
	if err := c.ShouldBindJSON(&internalKey); err != nil {
		common.ApiError(c, err)
		return
	}
	internalKey.KeyId = strings.TrimSpace(internalKey.KeyId)
	internalKey.Name = strings.TrimSpace(internalKey.Name)
	customKey := strings.TrimSpace(internalKey.Key)
	if !model.ValidateInternalKeyKeyId(internalKey.KeyId) {
		common.ApiErrorI18n(c, i18n.MsgInternalKeyKeyIdInvalid)
		return
	}
	if !validateInternalKeyName(internalKey.Name) {
		common.ApiErrorI18n(c, i18n.MsgInternalKeyNameTooLong)
		return
	}
	switch {
	case customKey == "":
		customKey = common.GetRandomString(model.InternalKeySecretLength)
	case len(customKey) < model.InternalKeySecretMinLength || len(customKey) > model.InternalKeySecretMaxLength:
		common.ApiErrorI18n(c, i18n.MsgInternalKeyKeyInvalid)
		return
	}
	exists, err := model.InternalKeyKeyIdExists(internalKey.KeyId)
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
	internalKey.Status = common.InternalKeyStatusEnabled
	internalKey.CreatedTime = common.GetTimestamp()
	if err := internalKey.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "internal_key.create", map[string]interface{}{
		"key_id": internalKey.KeyId,
		"name":   internalKey.Name,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    internalKey,
	})
}

func UpdateInternalKey(c *gin.Context) {
	internalKey := model.InternalKey{}
	if err := c.ShouldBindJSON(&internalKey); err != nil {
		common.ApiError(c, err)
		return
	}
	cleanKey, err := model.GetInternalKeyById(internalKey.Id)
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
	if newKey != "" && (len(newKey) < model.InternalKeySecretMinLength || len(newKey) > model.InternalKeySecretMaxLength) {
		common.ApiErrorI18n(c, i18n.MsgInternalKeyKeyInvalid)
		return
	}
	cleanKey.Name = name
	// 0 表示请求未携带状态，保持原状态不变；合法值为启用/禁用两种。
	if internalKey.Status == common.InternalKeyStatusEnabled || internalKey.Status == common.InternalKeyStatusDisabled {
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
	recordManageAudit(c, "internal_key.update", map[string]interface{}{
		"key_id":      cleanKey.KeyId,
		"name":        cleanKey.Name,
		"status":      cleanKey.Status,
		"key_rotated": newKey != "",
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    cleanKey,
	})
}

func DeleteInternalKey(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	keyId := c.Query("key_id")
	if err := model.DeleteInternalKeyById(id); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "internal_key.delete", map[string]interface{}{
		"id":     id,
		"key_id": keyId,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

// InternalAuthCheck is a lightweight endpoint protected by InternalAuth, so
// internal systems can verify their key pair and administrators can confirm a
// pair works.
func InternalAuthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"key_id": c.GetString("internal_key_id"),
			"name":   c.GetString("internal_key_name"),
		},
	})
}
