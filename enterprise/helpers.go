/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
package enterprise

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func success(c *gin.Context, data any) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": nonNilSlice(data)})
}

// failureI18n responds with an error message translated according to the request language.
func failureI18n(c *gin.Context, status int, key string, args ...map[string]any) {
	c.JSON(status, gin.H{"success": false, "message": i18n.T(c, key, args...)})
}

// nonNilSlice replaces nil slices and arrays with an empty slice of the same
// element type so list endpoints always serialize as `[]` instead of `null`.
// Non-slice values pass through unchanged.
func nonNilSlice(data any) any {
	value := reflect.ValueOf(data)
	switch value.Kind() {
	case reflect.Slice, reflect.Array:
		if value.IsNil() {
			return reflect.MakeSlice(value.Type(), 0, 0).Interface()
		}
	}
	return data
}

func now() int64 { return common.GetTimestamp() }

func locked(tx *gorm.DB) *gorm.DB {
	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		return tx
	}
	return tx.Clauses(clause.Locking{Strength: "UPDATE"})
}

func activeMembership(tx *gorm.DB, userID int) (Member, error) {
	var member Member
	err := tx.Where("user_id = ? AND status = ?", userID, MemberStatusActive).First(&member).Error
	return member, err
}

func memberForUser(tx *gorm.DB, enterpriseID, userID int) (Member, error) {
	var member Member
	err := tx.Where("enterprise_id = ? AND user_id = ? AND status = ?", enterpriseID, userID, MemberStatusActive).First(&member).Error
	return member, err
}

// createOrReactivateMember creates a new active member or reactivates a previously
// removed one. reviewerID is 0 for auto-approved joins (no reviewer); for admin-
// approved joins it is the reviewer's user ID.
func createOrReactivateMember(tx *gorm.DB, enterpriseID, userID, invitationID, reviewerID int) (Member, error) {
	timestamp := now()
	var member Member
	err := locked(tx).Where("enterprise_id = ? AND user_id = ?", enterpriseID, userID).First(&member).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		member = Member{EnterpriseId: enterpriseID, UserId: userID, Role: MemberRoleUser, Status: MemberStatusActive, JoinedAt: timestamp, InvitationId: invitationID, ReviewedBy: reviewerID, ReviewedAt: timestamp}
		if err := tx.Create(&member).Error; err != nil {
			return Member{}, err
		}
		return member, nil
	}
	if err != nil {
		return Member{}, err
	}
	if err := tx.Model(&member).Updates(map[string]any{"role": MemberRoleUser, "status": MemberStatusActive, "joined_at": timestamp, "removed_at": 0, "invitation_id": invitationID, "reviewed_by": reviewerID, "reviewed_at": timestamp}).Error; err != nil {
		return Member{}, err
	}
	// Re-read so the returned member reflects the updates just applied.
	if err := tx.Where("id = ?", member.Id).First(&member).Error; err != nil {
		return Member{}, err
	}
	return member, nil
}

// consumeInvitationUse atomically increments used_count while re-checking the
// limit, so a manual request whose invitation hit its cap between submission
// and approval is rejected instead of exceeding MaxUses. Returns
// errInvitationUnavailable when the invitation is exhausted.
func consumeInvitationUse(tx *gorm.DB, invitationID int) error {
	result := tx.Model(&Invitation{}).
		Where("id = ?", invitationID).
		Where("max_uses = -1 OR used_count < max_uses").
		UpdateColumn("used_count", gorm.Expr("used_count + 1"))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errInvitationUnavailable
	}
	return nil
}

func parseID(c *gin.Context, name string) (int, bool) {
	var id int
	if _, err := fmt.Sscanf(c.Param(name), "%d", &id); err != nil || id <= 0 {
		failureI18n(c, http.StatusBadRequest, i18n.MsgInvalidId)
		return 0, false
	}
	return id, true
}

func invitationCode() (string, error) {
	bytes := make([]byte, 10)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return strings.ToUpper(hex.EncodeToString(bytes)), nil
}

// Sentinel errors for sortedUniqueIDs; writeEnterpriseError translates them.
var (
	errSelectMember    = errors.New("select at least one member")
	errInvalidMember   = errors.New("invalid member identifier")
	errDuplicateMember = errors.New("duplicate member identifier")
)

func sortedUniqueIDs(ids []int) ([]int, error) {
	if len(ids) == 0 {
		return nil, errSelectMember
	}
	seen := make(map[int]struct{}, len(ids))
	unique := make([]int, 0, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return nil, errInvalidMember
		}
		if _, exists := seen[id]; exists {
			return nil, errDuplicateMember
		}
		seen[id] = struct{}{}
		unique = append(unique, id)
	}
	sort.Ints(unique)
	return unique, nil
}

// memberIDError translates a sortedUniqueIDs error into an i18n response.
// Returns true if the error was handled (caller should return).
func memberIDError(c *gin.Context, err error) bool {
	switch {
	case errors.Is(err, errSelectMember):
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseSelectMember)
	case errors.Is(err, errInvalidMember):
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseInvalidMember)
	case errors.Is(err, errDuplicateMember):
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseDuplicateMember)
	default:
		return false
	}
	return true
}
