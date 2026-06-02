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

	AffiliateRegisterMethodPassword = "password"
	AffiliateRegisterMethodOAuth    = "oauth"
	AffiliateRegisterMethodWeChat   = "wechat"
	AffiliateRegisterMethodSMS      = "sms"

	AffiliateScopeNone      = "none"
	AffiliateScopeGlobal    = "global"
	AffiliateScopeAffiliate = "affiliate"

	AffiliateAuditActionCreateProfile  = "create_profile"
	AffiliateAuditActionUpdateProfile  = "update_profile"
	AffiliateAuditActionEnableProfile  = "enable_profile"
	AffiliateAuditActionDisableProfile = "disable_profile"
	AffiliateAuditActionUpdateInviter  = "update_inviter"
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

type AffiliateInviteContextInput struct {
	ModuleEnabled  bool
	InviteCode     string
	RegisterMethod string
	Provider       string
}

type AffiliateInviteContext struct {
	Source         string
	InviterUserId  int
	InviteCode     string
	RegisterMethod string
	Provider       string
}

type AffiliateInviteEventInput struct {
	InviteeUserId      int
	InviterUserId      int
	InviteCode         string
	InviteSource       string
	RegisterMethod     string
	Provider           string
	RuleSetId          int
	InitialQuota       int64
	InitialAmountCents int64
	InitialQuotaRule   string
	Metadata           string
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

func ResolveInviteContext(db *gorm.DB, input AffiliateInviteContextInput) (*AffiliateInviteContext, error) {
	ctx := &AffiliateInviteContext{
		Source:         AffiliateInviteSourceNone,
		InviteCode:     strings.TrimSpace(input.InviteCode),
		RegisterMethod: strings.TrimSpace(input.RegisterMethod),
		Provider:       strings.TrimSpace(input.Provider),
	}
	if db == nil {
		return nil, errors.New("nil db")
	}
	if ctx.InviteCode == "" {
		return ctx, nil
	}

	var inviter model.User
	err := db.Select("id").Where("aff_code = ?", ctx.InviteCode).First(&inviter).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ctx, nil
	}
	if err != nil {
		return nil, err
	}

	var profile model.AffiliateProfile
	err = db.
		Where("user_id = ? AND status = ?", inviter.Id, model.AffiliateProfileStatusActive).
		First(&profile).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	resolution := ResolveAffiliateInviteSource(AffiliateInviteInput{
		ModuleEnabled:          input.ModuleEnabled,
		InviteCode:             ctx.InviteCode,
		InviterUserId:          inviter.Id,
		InviterAffiliateStatus: profile.Status,
		InviterAffiliateLevel:  profile.Level,
	})
	ctx.Source = resolution.Source
	ctx.InviterUserId = resolution.InviterUserId
	ctx.InviteCode = resolution.InviteCode
	return ctx, nil
}

func RecordAffiliateInviteEvent(db *gorm.DB, input AffiliateInviteEventInput) (*model.AffiliateInviteEvent, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if input.InviteeUserId <= 0 {
		return nil, errors.New("invalid invitee user id")
	}

	source := strings.TrimSpace(input.InviteSource)
	if source == "" {
		source = AffiliateInviteSourceNone
	}
	event := &model.AffiliateInviteEvent{
		InviteeUserId:      input.InviteeUserId,
		InviterUserId:      input.InviterUserId,
		InviteCode:         strings.TrimSpace(input.InviteCode),
		InviteSource:       source,
		RegisterMethod:     strings.TrimSpace(input.RegisterMethod),
		Provider:           strings.TrimSpace(input.Provider),
		RuleSetId:          input.RuleSetId,
		InitialQuota:       input.InitialQuota,
		InitialAmountCents: input.InitialAmountCents,
		InitialQuotaRule:   strings.TrimSpace(input.InitialQuotaRule),
		Status:             model.AffiliateEventStatusReady,
		Metadata:           input.Metadata,
	}
	if err := db.Create(event).Error; err != nil {
		return nil, err
	}
	return event, nil
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

type AffiliateVisibleUserIds struct {
	Global  bool
	UserIds []int
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

func ListAffiliateVisibleUserIds(db *gorm.DB, scope AffiliateScope) (AffiliateVisibleUserIds, error) {
	if scope.Kind == AffiliateScopeGlobal {
		return AffiliateVisibleUserIds{Global: true}, nil
	}
	if scope.Kind != AffiliateScopeAffiliate {
		return AffiliateVisibleUserIds{}, errors.New("affiliate scope unavailable")
	}
	if db == nil {
		return AffiliateVisibleUserIds{}, errors.New("nil db")
	}
	if scope.UserId <= 0 || scope.MaxDepth <= 0 {
		return AffiliateVisibleUserIds{}, errors.New("invalid affiliate scope")
	}

	var relations []model.AffiliateRelation
	if err := db.
		Select("descendant_user_id").
		Where(
			"ancestor_user_id = ? AND status = ? AND depth >= ? AND depth <= ?",
			scope.UserId,
			model.AffiliateProfileStatusActive,
			1,
			scope.MaxDepth,
		).
		Order("depth asc, descendant_user_id asc").
		Find(&relations).Error; err != nil {
		return AffiliateVisibleUserIds{}, err
	}

	seen := make(map[int]bool, len(relations))
	userIds := make([]int, 0, len(relations))
	for _, relation := range relations {
		if relation.DescendantUserId <= 0 || seen[relation.DescendantUserId] {
			continue
		}
		seen[relation.DescendantUserId] = true
		userIds = append(userIds, relation.DescendantUserId)
	}

	return AffiliateVisibleUserIds{UserIds: userIds}, nil
}

type AffiliateProfileCreateInput struct {
	UserId       int
	Level        int
	ParentUserId int
	InviteCode   string
	ActorUserId  int
	Reason       string
}

type AffiliateProfileSetInput struct {
	UserId       int
	Level        int
	ParentUserId int
	InviteCode   string
	ActorUserId  int
	Reason       string
}

type AffiliateProfileStatusInput struct {
	UserId      int
	ActorUserId int
	Reason      string
}

type AffiliateProfileListInput struct {
	UserId   int
	Level    int
	Status   string
	StartIdx int
	PageSize int
}

func ListAffiliateProfiles(db *gorm.DB, input AffiliateProfileListInput) ([]model.AffiliateProfile, int64, error) {
	if db == nil {
		return nil, 0, errors.New("nil db")
	}

	tx := db.Model(&model.AffiliateProfile{})
	if input.UserId > 0 {
		tx = tx.Where("user_id = ?", input.UserId)
	}
	if input.Level == 1 || input.Level == 2 {
		tx = tx.Where("level = ?", input.Level)
	}
	switch strings.ToLower(strings.TrimSpace(input.Status)) {
	case model.AffiliateProfileStatusActive, model.AffiliateProfileStatusDisabled:
		tx = tx.Where("status = ?", strings.ToLower(strings.TrimSpace(input.Status)))
	}

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	pageSize := input.PageSize
	if pageSize <= 0 {
		pageSize = common.ItemsPerPage
	}
	if pageSize > 100 {
		pageSize = 100
	}
	startIdx := input.StartIdx
	if startIdx < 0 {
		startIdx = 0
	}

	var profiles []model.AffiliateProfile
	if err := tx.
		Order("updated_at desc, id desc").
		Offset(startIdx).
		Limit(pageSize).
		Find(&profiles).Error; err != nil {
		return nil, 0, err
	}
	return profiles, total, nil
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
	if err := validateAffiliateProfileHierarchy(db, input.UserId, input.Level, input.ParentUserId); err != nil {
		return nil, err
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

func SetAffiliateProfile(db *gorm.DB, input AffiliateProfileSetInput) (*model.AffiliateProfile, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if input.UserId <= 0 {
		return nil, errors.New("invalid affiliate user id")
	}
	if input.Level != 1 && input.Level != 2 {
		return nil, errors.New("invalid affiliate level")
	}
	if err := validateAffiliateProfileHierarchy(db, input.UserId, input.Level, input.ParentUserId); err != nil {
		return nil, err
	}

	var saved model.AffiliateProfile
	err := db.Transaction(func(tx *gorm.DB) error {
		var existing model.AffiliateProfile
		err := tx.Where("user_id = ?", input.UserId).First(&existing).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			created, err := CreateAffiliateProfile(tx, AffiliateProfileCreateInput(input))
			if err != nil {
				return err
			}
			saved = *created
			return nil
		}

		before := common.GetJsonString(map[string]interface{}{
			"user_id":        existing.UserId,
			"level":          existing.Level,
			"status":         existing.Status,
			"parent_user_id": existing.ParentUserId,
			"invite_code":    existing.InviteCode,
		})

		now := common.GetTimestamp()
		existing.Level = input.Level
		existing.ParentUserId = input.ParentUserId
		existing.InviteCode = strings.TrimSpace(input.InviteCode)
		existing.Status = model.AffiliateProfileStatusActive
		existing.DisabledAt = 0
		if existing.ActivatedAt == 0 {
			existing.ActivatedAt = now
		}

		if err := tx.Save(&existing).Error; err != nil {
			return err
		}
		saved = existing
		return RecordAffiliateAuditLog(tx, AffiliateAuditInput{
			ActorUserId:    input.ActorUserId,
			TargetUserId:   input.UserId,
			TargetType:     "profile",
			TargetId:       existing.Id,
			Action:         AffiliateAuditActionUpdateProfile,
			BeforeSnapshot: before,
			AfterSnapshot: common.GetJsonString(map[string]interface{}{
				"user_id":        existing.UserId,
				"level":          existing.Level,
				"status":         existing.Status,
				"parent_user_id": existing.ParentUserId,
				"invite_code":    existing.InviteCode,
			}),
			Reason: input.Reason,
		})
	})
	if err != nil {
		return nil, err
	}
	return &saved, nil
}

func validateAffiliateProfileHierarchy(db *gorm.DB, userId int, level int, parentUserId int) error {
	if level == 1 {
		if parentUserId != 0 {
			return errors.New("level one affiliate cannot have parent")
		}
		return nil
	}
	if parentUserId <= 0 {
		return errors.New("level two affiliate requires level one parent")
	}
	if parentUserId == userId {
		return errors.New("affiliate parent cannot point to self")
	}

	var parent model.AffiliateProfile
	err := db.
		Where("user_id = ? AND level = ? AND status = ?", parentUserId, 1, model.AffiliateProfileStatusActive).
		First(&parent).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return errors.New("level two affiliate requires active level one parent")
	}
	return err
}

func DisableAffiliateProfile(db *gorm.DB, input AffiliateProfileStatusInput) error {
	if db == nil {
		return errors.New("nil db")
	}
	if input.UserId <= 0 {
		return errors.New("invalid affiliate user id")
	}

	return db.Transaction(func(tx *gorm.DB) error {
		var profile model.AffiliateProfile
		if err := tx.Where("user_id = ?", input.UserId).First(&profile).Error; err != nil {
			return err
		}

		before := common.GetJsonString(map[string]interface{}{
			"user_id":        profile.UserId,
			"level":          profile.Level,
			"status":         profile.Status,
			"parent_user_id": profile.ParentUserId,
		})

		now := common.GetTimestamp()
		profile.Status = model.AffiliateProfileStatusDisabled
		profile.DisabledAt = now
		if err := tx.Save(&profile).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.AffiliateRelation{}).
			Where(
				"(ancestor_user_id = ? OR descendant_user_id = ?) AND status = ?",
				input.UserId,
				input.UserId,
				model.AffiliateProfileStatusActive,
			).
			Updates(map[string]interface{}{
				"status":     model.AffiliateProfileStatusDisabled,
				"ended_at":   now,
				"updated_at": now,
			}).Error; err != nil {
			return err
		}

		return RecordAffiliateAuditLog(tx, AffiliateAuditInput{
			ActorUserId:    input.ActorUserId,
			TargetUserId:   input.UserId,
			TargetType:     "profile",
			TargetId:       profile.Id,
			Action:         AffiliateAuditActionDisableProfile,
			BeforeSnapshot: before,
			AfterSnapshot: common.GetJsonString(map[string]interface{}{
				"user_id":        profile.UserId,
				"level":          profile.Level,
				"status":         profile.Status,
				"parent_user_id": profile.ParentUserId,
			}),
			Reason: input.Reason,
		})
	})
}

func EnableAffiliateProfile(db *gorm.DB, input AffiliateProfileStatusInput) (*model.AffiliateProfile, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if input.UserId <= 0 {
		return nil, errors.New("invalid affiliate user id")
	}

	var saved model.AffiliateProfile
	err := db.Transaction(func(tx *gorm.DB) error {
		var profile model.AffiliateProfile
		if err := tx.Where("user_id = ?", input.UserId).First(&profile).Error; err != nil {
			return err
		}

		before := common.GetJsonString(map[string]interface{}{
			"user_id":        profile.UserId,
			"level":          profile.Level,
			"status":         profile.Status,
			"parent_user_id": profile.ParentUserId,
		})

		now := common.GetTimestamp()
		profile.Status = model.AffiliateProfileStatusActive
		profile.DisabledAt = 0
		if profile.ActivatedAt == 0 {
			profile.ActivatedAt = now
		}
		if err := tx.Save(&profile).Error; err != nil {
			return err
		}
		saved = profile
		return RecordAffiliateAuditLog(tx, AffiliateAuditInput{
			ActorUserId:    input.ActorUserId,
			TargetUserId:   input.UserId,
			TargetType:     "profile",
			TargetId:       profile.Id,
			Action:         AffiliateAuditActionEnableProfile,
			BeforeSnapshot: before,
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
	return &saved, nil
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
