/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
package enterprise

type enterpriseMemberResponse struct {
	Id             int    `json:"id"`
	UserId         int    `json:"user_id"`
	Username       string `json:"username"`
	DisplayName    string `json:"display_name"`
	Nickname       string `json:"nickname"`
	Remark         string `json:"remark"`
	Quota          int    `json:"quota"`
	ReceivedQuota  int    `json:"received_quota"`
	Role           int    `json:"role"`
	JoinedAt       int64  `json:"joined_at"`
	InvitationId   int    `json:"invitation_id"`
	InvitationName string `json:"invitation_name"`
	InvitationCode string `json:"invitation_code"`
	ReviewedBy     int    `json:"reviewed_by"`
	ReviewedName   string `json:"reviewed_name"`
	ReviewedAt     int64  `json:"reviewed_at"`
	Tags           []Tag  `json:"tags"`
}

type memberRecord struct {
	Member
	Username       string `gorm:"column:username"`
	DisplayName    string `gorm:"column:display_name"`
	Remark         string `gorm:"column:remark"`
	Quota          int    `gorm:"column:quota"`
	InvitationName string `gorm:"column:invitation_name"`
	InvitationCode string `gorm:"column:invitation_code"`
	ReviewedName   string `gorm:"column:reviewed_name"`
}

func (record memberRecord) response(tags []Tag) enterpriseMemberResponse {
	return enterpriseMemberResponse{
		Id: record.Id, UserId: record.UserId, Username: record.Username,
		DisplayName: record.DisplayName, Nickname: record.Nickname, Remark: record.Remark, Quota: record.Quota, ReceivedQuota: record.ReceivedQuota, Role: record.Role,
		JoinedAt: record.JoinedAt, InvitationId: record.InvitationId, InvitationName: record.InvitationName,
		InvitationCode: record.InvitationCode, ReviewedBy: record.ReviewedBy, ReviewedName: record.ReviewedName,
		ReviewedAt: record.ReviewedAt, Tags: tags,
	}
}

type joinRequestResponse struct {
	Id          int    `json:"id"`
	UserId      int    `json:"user_id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Remark      string `json:"remark"`
	CreatedTime int64  `json:"created_time"`
}

type joinRequestRecord struct {
	JoinRequest
	Username    string `gorm:"column:username"`
	DisplayName string `gorm:"column:display_name"`
}

func (record joinRequestRecord) response() joinRequestResponse {
	return joinRequestResponse{
		Id: record.Id, UserId: record.UserId, Username: record.Username,
		DisplayName: record.DisplayName, Remark: record.Remark, CreatedTime: record.CreatedTime,
	}
}

type quotaRecordResponse struct {
	Id                int    `json:"id"`
	AdminUserId       int    `json:"admin_user_id"`
	AdminName         string `json:"admin_name"`
	MemberUserId      int    `json:"member_user_id"`
	MemberName        string `json:"member_name"`
	MemberDisplayName string `json:"member_display_name"`
	Amount            int    `json:"amount"`
	CreatedTime       int64  `json:"created_time"`
}

type quotaRecordRecord struct {
	QuotaRecord
	AdminName         string `gorm:"column:admin_name"`
	MemberName        string `gorm:"column:member_name"`
	MemberDisplayName string `gorm:"column:member_display_name"`
}

func (record quotaRecordRecord) response() quotaRecordResponse {
	return quotaRecordResponse{
		Id: record.Id, AdminUserId: record.AdminUserId, AdminName: record.AdminName,
		MemberUserId: record.MemberUserId, MemberName: record.MemberName,
		MemberDisplayName: record.MemberDisplayName, Amount: record.Amount, CreatedTime: record.CreatedTime,
	}
}

type createEnterpriseRequest struct {
	Name        string `json:"name"`
	AdminUserId int    `json:"admin_user_id"`
}

type updateEnterpriseRequest struct {
	Name   *string `json:"name"`
	Status *int    `json:"status"`
}

type createInvitationRequest struct {
	Name       string `json:"name"`
	MaxUses    int    `json:"max_uses"`
	ExpiredAt  int64  `json:"expired_at"`
	ApproveMode int   `json:"approve_mode"`
}

type joinEnterpriseRequest struct {
	Code   string `json:"code"`
	Remark string `json:"remark"`
}

type createTagRequest struct {
	Name string `json:"name"`
}

type assignTagsRequest struct {
	TagIds []int `json:"tag_ids"`
}

type updateMemberRequest struct {
	Nickname *string `json:"nickname"`
}

type distributeQuotaRequest struct {
	MemberIds []int `json:"member_ids"`
	Amount    int   `json:"amount"`
}

type currentEnterpriseResponse struct {
	Enterprise Enterprise `json:"enterprise"`
	Role       int        `json:"role"`
	Member     Member     `json:"member"`
}
