package service

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	AffiliateInviteSourceNone      = "none"
	AffiliateInviteSourceNormal    = "normal"
	AffiliateInviteSourceAffiliate = "affiliate"

	AffiliateScopeNone      = "none"
	AffiliateScopeGlobal    = "global"
	AffiliateScopeAffiliate = "affiliate"

	AffiliateAuditActionCreateProfile = "create_profile"
)

type AffiliateInviteInput struct {
	ModuleEnabled          bool
	InviteCode             string
	InviterUserId          int
	InviterAffiliateStatus string
	InviterAffiliateLevel  int
}

type AffiliateInviteResolution struct {
	Source        string
	InviterUserId int
	InviteCode    string
}

func ResolveAffiliateInviteSource(input AffiliateInviteInput) AffiliateInviteResolution {
	inviteCode := strings.TrimSpace(input.InviteCode)
	if inviteCode == "" || input.InviterUserId <= 0 {
		return AffiliateInviteResolution{Source: AffiliateInviteSourceNone}
	}

	resolution := AffiliateInviteResolution{
		Source:        AffiliateInviteSourceNormal,
		InviterUserId: input.InviterUserId,
		InviteCode:    inviteCode,
	}

	if !input.ModuleEnabled {
		return resolution
	}

	if input.InviterAffiliateStatus != model.AffiliateProfileStatusActive {
		return resolution
	}

	if input.InviterAffiliateLevel != 1 && input.InviterAffiliateLevel != 2 {
		return resolution
	}

	resolution.Source = AffiliateInviteSourceAffiliate
	return resolution
}

type AffiliateScopeInput struct {
	UserId        int
	Role          int
	ProfileStatus string
	ProfileLevel  int
}

type AffiliateScope struct {
	Kind           string
	UserId         int
	AffiliateLevel int
	MaxDepth       int
}

func ResolveAffiliateAccessScope(input AffiliateScopeInput) AffiliateScope {
	if input.Role == common.RoleRootUser || input.Role == common.RoleAdminUser {
		return AffiliateScope{
			Kind:   AffiliateScopeGlobal,
			UserId: input.UserId,
		}
	}

	scope := AffiliateScope{
		Kind:   AffiliateScopeNone,
		UserId: input.UserId,
	}

	if input.ProfileStatus != model.AffiliateProfileStatusActive {
		return scope
	}

	switch input.ProfileLevel {
	case 1:
		scope.Kind = AffiliateScopeAffiliate
		scope.AffiliateLevel = 1
		scope.MaxDepth = 2
	case 2:
		scope.Kind = AffiliateScopeAffiliate
		scope.AffiliateLevel = 2
		scope.MaxDepth = 1
	}

	return scope
}

type AffiliateProfileCreateInput struct {
	UserId       int
	Level        int
	ParentUserId int
	InviteCode   string
	ActorUserId  int
	Reason       string
}

func CreateAffiliateProfile(db *gorm.DB, input AffiliateProfileCreateInput) (*model.AffiliateProfile, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if input.UserId <= 0 {
		return nil, errors.New("invalid affiliate user id")
	}
	if input.Level != 1 && input.Level != 2 {
		return nil, errors.New("invalid affiliate level")
	}

	now := common.GetTimestamp()
	profile := &model.AffiliateProfile{
		UserId:       input.UserId,
		Level:        input.Level,
		ParentUserId: input.ParentUserId,
		InviteCode:   strings.TrimSpace(input.InviteCode),
		Status:       model.AffiliateProfileStatusActive,
		ActivatedAt:  now,
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(profile).Error; err != nil {
			return err
		}
		return RecordAffiliateAuditLog(tx, AffiliateAuditInput{
			ActorUserId:  input.ActorUserId,
			TargetUserId: input.UserId,
			TargetType:   "profile",
			TargetId:     profile.Id,
			Action:       AffiliateAuditActionCreateProfile,
			AfterSnapshot: common.GetJsonString(map[string]interface{}{
				"user_id":        profile.UserId,
				"level":          profile.Level,
				"status":         profile.Status,
				"parent_user_id": profile.ParentUserId,
			}),
			Reason: input.Reason,
		})
	})
	if err != nil {
		return nil, err
	}

	return profile, nil
}

type AffiliateRelationCreateInput struct {
	InviterUserId int
	InviteeUserId int
	InviteEventId int
	Source        string
	EffectiveAt   int64
}

func BuildAffiliateInviteRelations(db *gorm.DB, input AffiliateRelationCreateInput) error {
	if db == nil {
		return errors.New("nil db")
	}
	if input.InviterUserId <= 0 || input.InviteeUserId <= 0 {
		return errors.New("invalid affiliate relation users")
	}
	if input.InviterUserId == input.InviteeUserId {
		return errors.New("affiliate relation cannot point to self")
	}

	effectiveAt := input.EffectiveAt
	if effectiveAt == 0 {
		effectiveAt = common.GetTimestamp()
	}
	source := strings.TrimSpace(input.Source)
	if source == "" {
		source = AffiliateInviteSourceNormal
	}

	return db.Transaction(func(tx *gorm.DB) error {
		direct := model.AffiliateRelation{
			AncestorUserId:   input.InviterUserId,
			DescendantUserId: input.InviteeUserId,
			Depth:            1,
			DirectInviterId:  input.InviterUserId,
			InviteEventId:    input.InviteEventId,
			Status:           model.AffiliateProfileStatusActive,
			Source:           source,
			EffectiveAt:      effectiveAt,
		}
		if err := createAffiliateRelationIfMissing(tx, direct); err != nil {
			return err
		}

		var ancestors []model.AffiliateRelation
		if err := tx.Where(
			"descendant_user_id = ? AND status = ? AND depth < ?",
			input.InviterUserId,
			model.AffiliateProfileStatusActive,
			2,
		).Order("depth asc").Find(&ancestors).Error; err != nil {
			return err
		}

		for _, ancestor := range ancestors {
			depth := ancestor.Depth + 1
			if depth > 2 {
				continue
			}
			relation := model.AffiliateRelation{
				AncestorUserId:   ancestor.AncestorUserId,
				DescendantUserId: input.InviteeUserId,
				Depth:            depth,
				DirectInviterId:  input.InviterUserId,
				InviteEventId:    input.InviteEventId,
				Status:           model.AffiliateProfileStatusActive,
				Source:           source,
				EffectiveAt:      effectiveAt,
			}
			if err := createAffiliateRelationIfMissing(tx, relation); err != nil {
				return err
			}
		}

		return nil
	})
}

func createAffiliateRelationIfMissing(db *gorm.DB, relation model.AffiliateRelation) error {
	return db.Clauses(clause.OnConflict{DoNothing: true}).Create(&relation).Error
}

type AffiliateAuditInput struct {
	ActorUserId    int
	TargetUserId   int
	TargetType     string
	TargetId       int
	Action         string
	BeforeSnapshot string
	AfterSnapshot  string
	Reason         string
	RequestId      string
	Ip             string
}

func RecordAffiliateAuditLog(db *gorm.DB, input AffiliateAuditInput) error {
	if db == nil {
		return errors.New("nil db")
	}
	if strings.TrimSpace(input.Action) == "" {
		return errors.New("empty affiliate audit action")
	}

	audit := model.AffiliateAuditLog{
		ActorUserId:    input.ActorUserId,
		TargetUserId:   input.TargetUserId,
		TargetType:     strings.TrimSpace(input.TargetType),
		TargetId:       input.TargetId,
		Action:         strings.TrimSpace(input.Action),
		BeforeSnapshot: input.BeforeSnapshot,
		AfterSnapshot:  input.AfterSnapshot,
		Reason:         strings.TrimSpace(input.Reason),
		RequestId:      strings.TrimSpace(input.RequestId),
		Ip:             strings.TrimSpace(input.Ip),
		CreatedAt:      common.GetTimestamp(),
	}
	return db.Create(&audit).Error
}
