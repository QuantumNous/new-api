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

func createInvitation(c *gin.Context) {
	var request createInvitationRequest
	if err := c.ShouldBindJSON(&request); err != nil || request.MaxUses == 0 || request.MaxUses < -1 || (request.ExpiredAt != 0 && request.ExpiredAt <= now()) {
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseInvitationInvalid)
		return
	}
	// Treat zero (omitted) as auto approval; reject anything outside the two modes.
	approveMode := request.ApproveMode
	if approveMode == 0 {
		approveMode = InvitationApproveModeAuto
	}
	if approveMode != InvitationApproveModeAuto && approveMode != InvitationApproveModeManual {
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseInvitationInvalid)
		return
	}
	name := strings.TrimSpace(request.Name)
	if name == "" {
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseInvitationNameRequired)
		return
	}
	if len([]rune(name)) > 128 {
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseInvitationNameTooLong)
		return
	}
	eid := enterpriseID(c)
	// Pre-check name uniqueness so we return a specific error instead of
	// colliding on the code-retry loop (which would mask the name conflict).
	var existing int64
	if err := model.DB.Model(&Invitation{}).Where("enterprise_id = ? AND name = ?", eid, name).Count(&existing).Error; err != nil {
		failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseInvitationCreateFailed)
		return
	}
	if existing > 0 {
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseInvitationNameExists)
		return
	}
	invitation := Invitation{EnterpriseId: eid, Name: name, Status: InvitationStatusEnabled, ApproveMode: approveMode, MaxUses: request.MaxUses, ExpiredAt: request.ExpiredAt, CreatedBy: c.GetInt("id"), CreatedTime: now()}
	for attempts := 0; attempts < 4; attempts++ {
		code, err := invitationCode()
		if err != nil {
			failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseInvitationCreateFailed)
			return
		}
		invitation.Code = code
		if err := model.DB.Create(&invitation).Error; err == nil {
			success(c, invitation)
			return
		} else if !isDuplicateError(err) {
			failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseInvitationCreateFailed)
			return
		}
		// Duplicate on Create can only be a code collision now (name pre-checked); retry.
	}
	failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseInvitationCreateFailed)
}

func listInvitations(c *gin.Context) {
	var invitations []Invitation
	query := model.DB.Where("enterprise_id = ?", enterpriseID(c))
	if c.Query("status") != "all" {
		query = query.Where("status = ?", InvitationStatusEnabled)
	}
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		query = query.Where("name LIKE ? OR code LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	if err := query.Order("id DESC").Find(&invitations).Error; err != nil {
		failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseInvitationListFailed)
		return
	}
	success(c, invitations)
}

func revokeInvitation(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	result := model.DB.Model(&Invitation{}).Where("id = ? AND enterprise_id = ?", id, enterpriseID(c)).Update("status", InvitationStatusRevoked)
	if result.Error != nil {
		failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseInvitationRevokeFailed)
		return
	}
	if result.RowsAffected == 0 {
		failureI18n(c, http.StatusNotFound, i18n.MsgEnterpriseInvitationNotFound)
		return
	}
	success(c, gin.H{"id": id})
}

func isDuplicateError(err error) bool {
	return err != nil && (gorm.ErrDuplicatedKey == err || containsDuplicateMessage(err.Error()))
}
