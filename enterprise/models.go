/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
package enterprise

const (
	EnterpriseStatusEnabled  = 1
	EnterpriseStatusDisabled = 2

	MemberRoleUser  = 1
	MemberRoleAdmin = 10

	MemberStatusActive  = 1
	MemberStatusRemoved = 2

	InvitationStatusEnabled = 1
	InvitationStatusDisabled = 2
	InvitationStatusRevoked = 3

	InvitationApproveModeAuto   = 1
	InvitationApproveModeManual = 2

	JoinRequestStatusPending  = 1
	JoinRequestStatusApproved = 2
	JoinRequestStatusRejected = 3
)

type Enterprise struct {
	Id          int    `json:"id"`
	Name        string `json:"name" gorm:"size:128;not null"`
	Status      int    `json:"status" gorm:"index;not null"`
	AdminUserId int    `json:"admin_user_id" gorm:"index;not null"`
	CreatedTime int64  `json:"created_time" gorm:"not null"`
	UpdatedTime int64  `json:"updated_time" gorm:"not null"`
}

func (Enterprise) TableName() string { return "enterprises" }

type Member struct {
	Id           int   `json:"id"`
	EnterpriseId int   `json:"enterprise_id" gorm:"uniqueIndex:idx_enterprise_member;index;not null"`
	UserId       int   `json:"user_id" gorm:"uniqueIndex:idx_enterprise_member;index;not null"`
	Role         int   `json:"role" gorm:"not null"`
	Status       int   `json:"status" gorm:"index;not null"`
	JoinedAt     int64 `json:"joined_at" gorm:"not null"`
	RemovedAt    int64 `json:"removed_at" gorm:"not null"`
	InvitationId int   `json:"invitation_id" gorm:"index"`
	ReviewedBy   int   `json:"reviewed_by" gorm:"index"`
	ReviewedAt   int64 `json:"reviewed_at"`
}

func (Member) TableName() string { return "enterprise_members" }

type Invitation struct {
	Id           int    `json:"id"`
	EnterpriseId int    `json:"enterprise_id" gorm:"index;not null"`
	Code         string `json:"code" gorm:"size:32;uniqueIndex;not null"`
	Name         string `json:"name" gorm:"size:128"`
	Status       int    `json:"status" gorm:"index;not null"`
	ApproveMode  int    `json:"approve_mode"`
	MaxUses      int    `json:"max_uses" gorm:"not null"`
	UsedCount    int    `json:"used_count" gorm:"not null"`
	ExpiredAt    int64  `json:"expired_at" gorm:"not null"`
	CreatedBy    int    `json:"created_by" gorm:"not null"`
	CreatedTime  int64  `json:"created_time" gorm:"not null"`
}

func (Invitation) TableName() string { return "enterprise_invitations" }

type JoinRequest struct {
	Id           int    `json:"id"`
	EnterpriseId int    `json:"enterprise_id" gorm:"index;not null"`
	UserId       int    `json:"user_id" gorm:"index;not null"`
	InvitationId int    `json:"invitation_id" gorm:"not null"`
	Status       int    `json:"status" gorm:"index;not null"`
	ReviewedBy   int    `json:"reviewed_by" gorm:"index;not null"`
	ReviewedAt   int64  `json:"reviewed_at" gorm:"not null"`
	CreatedTime  int64  `json:"created_time" gorm:"not null"`
	Remark       string `json:"remark" gorm:"size:256"`
}

func (JoinRequest) TableName() string { return "enterprise_join_requests" }

type Tag struct {
	Id           int    `json:"id"`
	EnterpriseId int    `json:"enterprise_id" gorm:"uniqueIndex:idx_enterprise_tag;index;not null"`
	Name         string `json:"name" gorm:"size:64;uniqueIndex:idx_enterprise_tag;not null"`
	CreatedTime  int64  `json:"created_time" gorm:"not null"`
}

func (Tag) TableName() string { return "enterprise_tags" }

type MemberTag struct {
	Id          int   `json:"id"`
	MemberId    int   `json:"member_id" gorm:"uniqueIndex:idx_member_tag;index;not null"`
	TagId       int   `json:"tag_id" gorm:"uniqueIndex:idx_member_tag;index;not null"`
	CreatedTime int64 `json:"created_time" gorm:"not null"`
}

func (MemberTag) TableName() string { return "enterprise_member_tags" }
