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

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func listQuotaRecords(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	query := model.DB.Table("enterprise_quota_records AS records").
		Select("records.*, admins.username AS admin_name, members.username AS member_name, members.display_name AS member_display_name").
		Joins("JOIN users AS admins ON admins.id = records.admin_user_id").
		Joins("JOIN users AS members ON members.id = records.member_user_id").
		Where("records.enterprise_id = ?", enterpriseID(c))
	if memberUserID, err := optionalInt(c, "member_user_id"); err != nil {
		failureI18n(c, http.StatusBadRequest, i18n.MsgInvalidId)
		return
	} else if memberUserID != nil && *memberUserID > 0 {
		query = query.Where("records.member_user_id = ?", *memberUserID)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseQuotaRecordListFailed)
		return
	}
	var records []quotaRecordRecord
	if err := query.Order("records.id DESC").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Scan(&records).Error; err != nil {
		failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseQuotaRecordListFailed)
		return
	}
	responses := make([]quotaRecordResponse, 0, len(records))
	for _, record := range records {
		responses = append(responses, record.response())
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(responses)
	common.ApiSuccess(c, pageInfo)
}
