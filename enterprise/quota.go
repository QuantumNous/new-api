/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
package enterprise

import (
	"fmt"
	"math"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func distributeQuota(c *gin.Context) {
	var request distributeQuotaRequest
	if err := c.ShouldBindJSON(&request); err != nil || request.Amount <= 0 {
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseQuotaPositiveRequired)
		return
	}
	memberIDs, err := sortedUniqueIDs(request.MemberIds)
	if err != nil {
		memberIDError(c, err)
		return
	}
	adminID := c.GetInt("id")
	for _, id := range memberIDs {
		if id == adminID {
			failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseCannotDistributeToSelf)
			return
		}
	}
	if int64(request.Amount) > math.MaxInt32 || int64(request.Amount)*int64(len(memberIDs)) > math.MaxInt32 {
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseQuotaExceedsRange)
		return
	}
	enterpriseID := enterpriseID(c)
	total := int64(request.Amount) * int64(len(memberIDs))
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		var members []Member
		if err := locked(tx).Where("enterprise_id = ? AND user_id IN ? AND status = ? AND role = ?", enterpriseID, memberIDs, MemberStatusActive, MemberRoleUser).Order("user_id ASC").Find(&members).Error; err != nil {
			return err
		}
		if len(members) != len(memberIDs) {
			return gorm.ErrRecordNotFound
		}
		userIDs := append(append([]int{}, memberIDs...), adminID)
		var users []model.User
		if err := locked(tx).Select("id", "quota").Where("id IN ?", userIDs).Order("id ASC").Find(&users).Error; err != nil {
			return err
		}
		if len(users) != len(memberIDs)+1 {
			return gorm.ErrRecordNotFound
		}
		var adminQuota int
		for _, user := range users {
			if user.Id == adminID {
				adminQuota = user.Quota
				continue
			}
			if user.Quota > math.MaxInt32-request.Amount {
				return errQuotaOverflow
			}
		}
		if int64(adminQuota) < total {
			return errInsufficientQuota
		}
		// Debit the source (admin) first, then credit recipients, so the funds
		// flow matches the sufficiency check above and stays auditable.
		if err := tx.Model(&model.User{}).Where("id = ?", adminID).Update("quota", gorm.Expr("quota - ?", total)).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.User{}).Where("id IN ?", memberIDs).Update("quota", gorm.Expr("quota + ?", request.Amount)).Error; err != nil {
			return err
		}
		// Accumulate each recipient's lifetime received quota on the member row,
		// so the member list can show the historical total without an extra query.
		if err := tx.Model(&Member{}).Where("enterprise_id = ? AND user_id IN ? AND status = ?", enterpriseID, memberIDs, MemberStatusActive).Update("received_quota", gorm.Expr("received_quota + ?", request.Amount)).Error; err != nil {
			return err
		}
		// Write one record per recipient for per-user and enterprise-wide history.
		timestamp := now()
		records := make([]QuotaRecord, 0, len(memberIDs))
		for _, uid := range memberIDs {
			records = append(records, QuotaRecord{EnterpriseId: enterpriseID, AdminUserId: adminID, MemberUserId: uid, Amount: request.Amount, CreatedTime: timestamp})
		}
		return tx.Create(&records).Error
	})
	if err != nil {
		writeEnterpriseError(c, err)
		return
	}
	for _, userID := range append(memberIDs, adminID) {
		if err := model.InvalidateUserCache(userID); err != nil {
			common.SysError(fmt.Sprintf("enterprise quota distribution cache invalidation failed for user %d: %v", userID, err))
		}
	}
	model.RecordLogWithAdminInfo(adminID, model.LogTypeManage, fmt.Sprintf("Distributed %d quota to %d enterprise members (total %d)", request.Amount, len(memberIDs), total), map[string]interface{}{"enterprise_id": enterpriseID, "member_ids": memberIDs, "amount": request.Amount, "total": total})
	for _, userID := range memberIDs {
		model.RecordLog(userID, model.LogTypeTopup, fmt.Sprintf("Received %d quota from enterprise %d", request.Amount, enterpriseID))
	}
	success(c, gin.H{"success": memberIDs, "amount": request.Amount, "total": total})
}
