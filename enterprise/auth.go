/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
package enterprise

import (
	"net/http"

	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const enterpriseIDContextKey = "enterprise_id"

func EnterpriseAdminAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetInt("id")
		var member Member
		if err := model.DB.Where("user_id = ? AND role = ? AND status = ?", userID, MemberRoleAdmin, MemberStatusActive).First(&member).Error; err != nil {
			failureI18n(c, http.StatusForbidden, i18n.MsgEnterpriseAccessRequired)
			c.Abort()
			return
		}
		var enterprise Enterprise
		if err := model.DB.Where("id = ? AND status = ?", member.EnterpriseId, EnterpriseStatusEnabled).First(&enterprise).Error; err != nil {
			failureI18n(c, http.StatusForbidden, i18n.MsgEnterpriseUnavailable)
			c.Abort()
			return
		}
		c.Set(enterpriseIDContextKey, member.EnterpriseId)
		c.Next()
	}
}

func enterpriseID(c *gin.Context) int {
	id, _ := c.Get(enterpriseIDContextKey)
	value, _ := id.(int)
	return value
}
