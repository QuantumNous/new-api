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
	"strings"

	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func createEnterprise(c *gin.Context) {
	var request createEnterpriseRequest
	if err := c.ShouldBindJSON(&request); err != nil || strings.TrimSpace(request.Name) == "" || request.AdminUserId <= 0 {
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseNameRequired)
		return
	}
	if len([]rune(request.Name)) > 128 {
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseNameTooLong)
		return
	}
	created := Enterprise{}
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var user model.User
		if err := locked(tx).Select("id", "role").First(&user, request.AdminUserId).Error; err != nil {
			return err
		}
		if user.Role != MemberRoleUser {
			return errEnterpriseAdminMustBeUser
		}
		if _, err := activeMembership(tx, user.Id); err == nil {
			return errUserAlreadyInEnterprise
		} else if err != gorm.ErrRecordNotFound {
			return err
		}
		timestamp := now()
		created = Enterprise{Name: strings.TrimSpace(request.Name), Status: EnterpriseStatusEnabled, AdminUserId: user.Id, CreatedTime: timestamp, UpdatedTime: timestamp}
		if err := tx.Create(&created).Error; err != nil {
			return err
		}
		return tx.Create(&Member{EnterpriseId: created.Id, UserId: user.Id, Role: MemberRoleAdmin, Status: MemberStatusActive, JoinedAt: timestamp}).Error
	})
	if err != nil {
		writeEnterpriseError(c, err)
		return
	}
	success(c, created)
}

func listEnterprises(c *gin.Context) {
	var enterprises []Enterprise
	if err := model.DB.Order("id DESC").Find(&enterprises).Error; err != nil {
		failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseListFailed)
		return
	}
	success(c, enterprises)
}

func updateEnterprise(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	var request updateEnterpriseRequest
	if err := c.ShouldBindJSON(&request); err != nil || (request.Name == nil && request.Status == nil) {
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseNoChange)
		return
	}
	updates := map[string]any{"updated_time": now()}
	if request.Name != nil {
		name := strings.TrimSpace(*request.Name)
		if name == "" || len([]rune(name)) > 128 {
			failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseNameInvalid)
			return
		}
		updates["name"] = name
	}
	if request.Status != nil {
		if *request.Status != EnterpriseStatusEnabled && *request.Status != EnterpriseStatusDisabled {
			failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseStatusInvalid)
			return
		}
		updates["status"] = *request.Status
	}
	result := model.DB.Model(&Enterprise{}).Where("id = ?", id).Updates(updates)
	if result.Error != nil {
		failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseUpdateFailed)
		return
	}
	if result.RowsAffected == 0 {
		failureI18n(c, http.StatusNotFound, i18n.MsgEnterpriseNotFound)
		return
	}
	success(c, gin.H{"id": id})
}

func disableEnterprise(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&Enterprise{}).Where("id = ?", id).Updates(map[string]any{"status": EnterpriseStatusDisabled, "updated_time": now()})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return tx.Model(&Member{}).Where("enterprise_id = ? AND status = ?", id, MemberStatusActive).Updates(map[string]any{"status": MemberStatusRemoved, "removed_at": now()}).Error
	})
	if err != nil {
		writeEnterpriseError(c, err)
		return
	}
	success(c, gin.H{"id": id})
}
