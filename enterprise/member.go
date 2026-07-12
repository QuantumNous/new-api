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
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func listMembers(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	query := model.DB.Table("enterprise_members AS members").
		Select("members.*, users.username, users.display_name, users.remark, users.quota, invitations.name AS invitation_name, invitations.code AS invitation_code, reviewers.username AS reviewed_name").
		Joins("JOIN users ON users.id = members.user_id").
		Joins("LEFT JOIN enterprise_invitations AS invitations ON invitations.id = members.invitation_id").
		Joins("LEFT JOIN users AS reviewers ON reviewers.id = members.reviewed_by").
		Where("members.enterprise_id = ? AND members.status = ?", enterpriseID(c), MemberStatusActive)
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		query = query.Where("users.username LIKE ? OR users.display_name LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	if tagIDs, ok := parseTagIDs(c); !ok {
		return
	} else if len(tagIDs) > 0 {
		if len(tagIDs) == 1 {
			query = query.Joins("JOIN enterprise_member_tags AS member_tags ON member_tags.member_id = members.id").Where("member_tags.tag_id = ?", tagIDs[0])
		} else {
			query = query.Where("members.id IN (?)",
				model.DB.Table("enterprise_member_tags").
					Select("member_id").
					Where("tag_id IN ?", tagIDs).
					Group("member_id").
					Having("COUNT(DISTINCT tag_id) = ?", len(tagIDs)),
			)
		}
	}
	if invitationIDs, ok := parseIDList(c, "invitation_ids"); !ok {
		return
	} else if len(invitationIDs) > 0 {
		query = query.Where("members.invitation_id IN ?", invitationIDs)
	}
	if reviewerIDs, ok := parseIDList(c, "reviewed_by"); !ok {
		return
	} else if len(reviewerIDs) > 0 {
		query = query.Where("members.reviewed_by IN ?", reviewerIDs)
	}
	if joinedFrom, err := optionalInt64(c, "joined_from"); err != nil {
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseInvalidJoinDate)
		return
	} else if joinedFrom != nil {
		query = query.Where("members.joined_at >= ?", *joinedFrom)
	}
	if joinedTo, err := optionalInt64(c, "joined_to"); err != nil {
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseInvalidJoinDate)
		return
	} else if joinedTo != nil {
		query = query.Where("members.joined_at <= ?", *joinedTo)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseMemberListFailed)
		return
	}
	var records []memberRecord
	if err := query.Order("members.joined_at DESC").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Scan(&records).Error; err != nil {
		failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseMemberListFailed)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(memberResponses(records))
	common.ApiSuccess(c, pageInfo)
}

func getMember(c *gin.Context) {
	userID, ok := parseID(c, "uid")
	if !ok {
		return
	}
	record, err := activeMemberRecord(c, userID)
	if err != nil {
		writeEnterpriseError(c, err)
		return
	}
	success(c, record.response(memberTags(record.Id)))
}

func removeMember(c *gin.Context) {
	userID, ok := parseID(c, "uid")
	if !ok {
		return
	}
	if userID == c.GetInt("id") {
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseAdminCannotRemoveSelf)
		return
	}
	result := model.DB.Model(&Member{}).Where("enterprise_id = ? AND user_id = ? AND status = ? AND role = ?", enterpriseID(c), userID, MemberStatusActive, MemberRoleUser).Updates(map[string]any{"status": MemberStatusRemoved, "removed_at": now()})
	if result.Error != nil {
		failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseMemberRemoveFailed)
		return
	}
	if result.RowsAffected == 0 {
		failureI18n(c, http.StatusNotFound, i18n.MsgEnterpriseMemberNotFound)
		return
	}
	success(c, gin.H{"user_id": userID})
}

func updateMember(c *gin.Context) {
	userID, ok := parseID(c, "uid")
	if !ok {
		return
	}
	var request updateMemberRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseInvalidMember)
		return
	}
	// nil nickname = not provided (no-op); empty string clears it. Either way,
	// the member must exist before we touch it, so resolve the row first.
	member, err := memberForUser(model.DB, enterpriseID(c), userID)
	if err != nil {
		failureI18n(c, http.StatusNotFound, i18n.MsgEnterpriseMemberNotFound)
		return
	}
	if request.Nickname != nil {
		trimmed := strings.TrimSpace(*request.Nickname)
		if len([]rune(trimmed)) > 32 {
			failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseNicknameTooLong)
			return
		}
		// Update by primary key so the change only affects the resolved member.
		if err := model.DB.Model(&member).Update("nickname", trimmed).Error; err != nil {
			failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseMemberUpdateFailed)
			return
		}
	}
	record, err := activeMemberRecord(c, userID)
	if err != nil {
		writeEnterpriseError(c, err)
		return
	}
	success(c, record.response(memberTags(record.Id)))
}

// activeMemberRecord loads a single active member of the current enterprise
// along with its joined user / invitation / reviewer fields.
func activeMemberRecord(c *gin.Context, userID int) (memberRecord, error) {
	var record memberRecord
	err := model.DB.Table("enterprise_members AS members").
		Select("members.*, users.username, users.display_name, users.remark, users.quota, invitations.name AS invitation_name, invitations.code AS invitation_code, reviewers.username AS reviewed_name").
		Joins("JOIN users ON users.id = members.user_id").
		Joins("LEFT JOIN enterprise_invitations AS invitations ON invitations.id = members.invitation_id").
		Joins("LEFT JOIN users AS reviewers ON reviewers.id = members.reviewed_by").
		Where("members.enterprise_id = ? AND members.user_id = ? AND members.status = ?", enterpriseID(c), userID, MemberStatusActive).
		First(&record).Error
	return record, err
}

func memberResponses(records []memberRecord) []enterpriseMemberResponse {
	if len(records) == 0 {
		return []enterpriseMemberResponse{}
	}
	memberIDs := make([]int, 0, len(records))
	for _, record := range records {
		memberIDs = append(memberIDs, record.Id)
	}
	var bindings []MemberTag
	model.DB.Where("member_id IN ?", memberIDs).Find(&bindings)
	tagIDs := make([]int, 0, len(bindings))
	for _, binding := range bindings {
		tagIDs = append(tagIDs, binding.TagId)
	}
	var tags []Tag
	if len(tagIDs) > 0 {
		model.DB.Where("id IN ?", tagIDs).Find(&tags)
	}
	tagsByID := make(map[int]Tag, len(tags))
	for _, tag := range tags {
		tagsByID[tag.Id] = tag
	}
	tagsByMember := make(map[int][]Tag, len(records))
	for _, binding := range bindings {
		if tag, found := tagsByID[binding.TagId]; found {
			tagsByMember[binding.MemberId] = append(tagsByMember[binding.MemberId], tag)
		}
	}
	responses := make([]enterpriseMemberResponse, 0, len(records))
	for _, record := range records {
		responses = append(responses, record.response(tagsForMember(tagsByMember, record.Id)))
	}
	return responses
}

func memberTags(memberID int) []Tag {
	var tags []Tag
	model.DB.Table("enterprise_tags AS tags").Select("tags.*").Joins("JOIN enterprise_member_tags AS bindings ON bindings.tag_id = tags.id").Where("bindings.member_id = ?", memberID).Order("tags.name ASC").Find(&tags)
	return tags
}

// tagsForMember returns a member's tags from a precomputed index, guaranteeing
// a non-nil slice so the JSON response always emits an empty array (`[]`) rather
// than `null`, which the frontend renders with `.map`.
func tagsForMember(index map[int][]Tag, memberID int) []Tag {
	if tags := index[memberID]; tags != nil {
		return tags
	}
	return []Tag{}
}

func optionalInt(c *gin.Context, key string) (*int, error) {
	raw := c.Query(key)
	if raw == "" {
		return nil, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return nil, err
	}
	return &value, nil
}

func optionalInt64(c *gin.Context, key string) (*int64, error) {
	raw := c.Query(key)
	if raw == "" {
		return nil, nil
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value < 0 {
		return nil, strconv.ErrSyntax
	}
	return &value, nil
}

// parseTagIDs resolves tag filter parameters: "tag_ids" (comma-separated, intersection)
// takes precedence; the legacy single "tag_id" is still accepted. Returns false on bad input.
func parseTagIDs(c *gin.Context) ([]int, bool) {
	if legacy := strings.TrimSpace(c.Query("tag_id")); legacy != "" && c.Query("tag_ids") == "" {
		id, err := strconv.Atoi(legacy)
		if err != nil || id <= 0 {
			failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseInvalidTag)
			return nil, false
		}
		return []int{id}, true
	}
	return parseIDList(c, "tag_ids")
}

// parseIDList parses a comma-separated list of positive integer IDs from the
// given query key. Returns (nil, false) on invalid input (after writing an
// error response). Empty or absent values yield (nil, true).
func parseIDList(c *gin.Context, key string) ([]int, bool) {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return nil, true
	}
	seen := make(map[int]struct{})
	ids := make([]int, 0, 2)
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		id, err := strconv.Atoi(part)
		if err != nil || id <= 0 {
			failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseInvalidTag)
			return nil, false
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	return ids, true
}
