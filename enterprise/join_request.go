/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
package enterprise

import (
	"errors"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func joinEnterprise(c *gin.Context) {
	var request joinEnterpriseRequest
	if err := c.ShouldBindJSON(&request); err != nil || strings.TrimSpace(request.Code) == "" {
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseInvitationRequired)
		return
	}
	remark := strings.TrimSpace(request.Remark)
	if len([]rune(remark)) > 256 {
		failureI18n(c, http.StatusBadRequest, i18n.MsgInvalidParams)
		return
	}
	userID := c.GetInt("id")
	result := joinResult{}
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var user model.User
		if err := locked(tx).Select("id").First(&user, userID).Error; err != nil {
			return err
		}
		var invitation Invitation
		if err := locked(tx).Where("code = ?", strings.ToUpper(strings.TrimSpace(request.Code))).First(&invitation).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errInvitationUnavailable
			}
			return err
		}
		if invitation.Status != InvitationStatusEnabled || (invitation.ExpiredAt != 0 && invitation.ExpiredAt <= now()) || (invitation.MaxUses != -1 && invitation.UsedCount >= invitation.MaxUses) {
			return errInvitationUnavailable
		}
		if _, err := activeMembership(tx, userID); err == nil {
			return errUserAlreadyInEnterprise
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		// Manual approval requires a pending request; auto approval admits the member directly.
		// Treat a zero value (legacy invitations created before this field existed) as auto.
		// used_count is only consumed when a user actually joins (auto mode now, or manual
		// mode on approval) — submitting a manual request does not consume a use.
		if invitation.ApproveMode == InvitationApproveModeManual {
			var pending int64
			if err := tx.Model(&JoinRequest{}).Where("enterprise_id = ? AND user_id = ? AND status = ?", invitation.EnterpriseId, userID, JoinRequestStatusPending).Count(&pending).Error; err != nil {
				return err
			}
			if pending > 0 {
				return errPendingRequestExists
			}
			created := JoinRequest{EnterpriseId: invitation.EnterpriseId, UserId: userID, InvitationId: invitation.Id, Status: JoinRequestStatusPending, Remark: remark, CreatedTime: now()}
			if err := tx.Create(&created).Error; err != nil {
				return err
			}
			result = joinResult{Request: &created, AutoApproved: false}
			return nil
		}
		member, err := createOrReactivateMember(tx, invitation.EnterpriseId, userID, invitation.Id, 0)
		if err != nil {
			return err
		}
		if err := consumeInvitationUse(tx, invitation.Id); err != nil {
			return err
		}
		result = joinResult{Member: &member, AutoApproved: true}
		return nil
	})
	if err != nil {
		writeEnterpriseError(c, err)
		return
	}
	success(c, result.response())
}

// joinResult captures the outcome of a join attempt: either a pending request
// (manual approval) or an active membership (auto approval).
type joinResult struct {
	Request      *JoinRequest
	Member       *Member
	AutoApproved bool
}

func (r joinResult) response() gin.H {
	if r.AutoApproved && r.Member != nil {
		return gin.H{"auto_approved": true, "member": r.Member}
	}
	if r.Request != nil {
		return gin.H{"auto_approved": false, "request": r.Request}
	}
	return gin.H{"auto_approved": false}
}

func getCurrentEnterprise(c *gin.Context) {
	member, err := activeMembership(model.DB, c.GetInt("id"))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		success(c, nil)
		return
	}
	if err != nil {
		failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseMembershipGetFailed)
		return
	}
	var enterprise Enterprise
	if err := model.DB.First(&enterprise, member.EnterpriseId).Error; err != nil {
		failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseOpFailed)
		return
	}
	success(c, currentEnterpriseResponse{Enterprise: enterprise, Role: member.Role, Member: member})
}

func leaveEnterprise(c *gin.Context) {
	userID := c.GetInt("id")
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var active Member
		if err := locked(tx).Where("user_id = ? AND status = ?", userID, MemberStatusActive).First(&active).Error; err != nil {
			return err
		}
		if active.Role == MemberRoleAdmin {
			return errEnterpriseAdminMustBeUser
		}
		return tx.Model(&Member{}).Where("id = ?", active.Id).Updates(map[string]any{"status": MemberStatusRemoved, "removed_at": now()}).Error
	})
	if err != nil {
		if errors.Is(err, errEnterpriseAdminMustBeUser) {
			failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseAdminCannotLeave)
			return
		}
		writeEnterpriseError(c, err)
		return
	}
	success(c, gin.H{"user_id": userID})
}

func listJoinRequests(c *gin.Context) {
	var records []joinRequestRecord
	if err := model.DB.Table("enterprise_join_requests AS requests").
		Select("requests.id, requests.user_id, requests.remark, requests.created_time, users.username, users.display_name").
		Joins("JOIN users ON users.id = requests.user_id").
		Where("requests.enterprise_id = ? AND requests.status = ?", enterpriseID(c), JoinRequestStatusPending).
		Order("requests.created_time ASC").
		Scan(&records).Error; err != nil {
		failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseRequestListFailed)
		return
	}
	responses := make([]joinRequestResponse, 0, len(records))
	for _, record := range records {
		responses = append(responses, record.response())
	}
	success(c, responses)
}

func approveJoinRequest(c *gin.Context) { reviewJoinRequest(c, JoinRequestStatusApproved) }

func rejectJoinRequest(c *gin.Context) { reviewJoinRequest(c, JoinRequestStatusRejected) }

func reviewJoinRequest(c *gin.Context, targetStatus int) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	adminID := c.GetInt("id")
	enterpriseID := enterpriseID(c)
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var request JoinRequest
		if err := locked(tx).Where("id = ? AND enterprise_id = ?", id, enterpriseID).First(&request).Error; err != nil {
			return err
		}
		if request.Status != JoinRequestStatusPending {
			return errPendingRequestExists
		}
		if targetStatus == JoinRequestStatusApproved {
			var user model.User
			if err := locked(tx).Select("id").First(&user, request.UserId).Error; err != nil {
				return err
			}
			if _, err := activeMembership(tx, request.UserId); err == nil {
				return errUserAlreadyInEnterprise
			} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			// Consume the invitation use now that the join is actually happening.
			// This re-checks the limit, so a request whose invitation was revoked
			// or exhausted between submission and approval is rejected.
			if err := consumeInvitationUse(tx, request.InvitationId); err != nil {
				return err
			}
			if _, err := createOrReactivateMember(tx, enterpriseID, request.UserId, request.InvitationId, adminID); err != nil {
				return err
			}
		}
		return tx.Model(&JoinRequest{}).Where("id = ? AND status = ?", request.Id, JoinRequestStatusPending).Updates(map[string]any{"status": targetStatus, "reviewed_by": adminID, "reviewed_at": now()}).Error
	})
	if err != nil {
		writeEnterpriseError(c, err)
		return
	}
	success(c, gin.H{"id": id, "status": targetStatus})
}
