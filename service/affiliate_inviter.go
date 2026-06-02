package service

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type AffiliateInviterCandidateSearchInput struct {
	Keyword  string
	StartIdx int
	PageSize int
}

type AffiliateInviterChangeInput struct {
	TargetUserId     int
	NewInviterUserId int
	ActorUserId      int
	Reason           string
	PreviewOnly      bool
}

type AffiliateInviterChangePreview struct {
	TargetUserId              int    `json:"target_user_id"`
	TargetUsername            string `json:"target_username"`
	CurrentInviterUserId      int    `json:"current_inviter_user_id"`
	CurrentInviterUsername    string `json:"current_inviter_username"`
	NewInviterUserId          int    `json:"new_inviter_user_id"`
	NewInviterUsername        string `json:"new_inviter_username"`
	CurrentPathUserIds        []int  `json:"current_path_user_ids"`
	NewPathUserIds            []int  `json:"new_path_user_ids"`
	AffectedDescendantUserIds []int  `json:"affected_descendant_user_ids"`
}

func SearchAffiliateInviterCandidates(db *gorm.DB, input AffiliateInviterCandidateSearchInput) ([]model.User, int64, error) {
	if db == nil {
		return nil, 0, errors.New("nil db")
	}
	keyword := strings.TrimSpace(input.Keyword)
	tx := db.Model(&model.User{}).Omit("password", "access_token")
	if keyword != "" {
		like := "%" + keyword + "%"
		if id, err := strconv.Atoi(keyword); err == nil {
			tx = tx.Where("id = ? OR username LIKE ? OR display_name LIKE ? OR email LIKE ?", id, like, like, like)
		} else {
			tx = tx.Where("username LIKE ? OR display_name LIKE ? OR email LIKE ?", like, like, like)
		}
	}

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var users []model.User
	if err := tx.
		Order("id desc").
		Offset(normalizeAffiliateFinanceStartIdx(input.StartIdx)).
		Limit(normalizeAffiliateFinancePageSize(input.PageSize)).
		Find(&users).Error; err != nil {
		return nil, 0, err
	}
	return users, total, nil
}

func PreviewAffiliateInviterChange(db *gorm.DB, input AffiliateInviterChangeInput) (AffiliateInviterChangePreview, error) {
	if db == nil {
		return AffiliateInviterChangePreview{}, errors.New("nil db")
	}
	if input.TargetUserId <= 0 {
		return AffiliateInviterChangePreview{}, errors.New("invalid target user id")
	}
	if err := validateAffiliateInviterChange(db, input.TargetUserId, input.NewInviterUserId); err != nil {
		return AffiliateInviterChangePreview{}, err
	}

	target, err := getAffiliateInviterUser(db, input.TargetUserId)
	if err != nil {
		return AffiliateInviterChangePreview{}, err
	}
	preview := AffiliateInviterChangePreview{
		TargetUserId:              target.Id,
		TargetUsername:            target.Username,
		CurrentInviterUserId:      target.InviterId,
		NewInviterUserId:          input.NewInviterUserId,
		CurrentPathUserIds:        affiliateInviterPath(db, target.InviterId),
		NewPathUserIds:            affiliateInviterPath(db, input.NewInviterUserId),
		AffectedDescendantUserIds: []int{target.Id},
	}
	if target.InviterId > 0 {
		if current, err := getAffiliateInviterUser(db, target.InviterId); err == nil {
			preview.CurrentInviterUsername = current.Username
		}
	}
	if input.NewInviterUserId > 0 {
		newInviter, err := getAffiliateInviterUser(db, input.NewInviterUserId)
		if err != nil {
			return AffiliateInviterChangePreview{}, err
		}
		preview.NewInviterUsername = newInviter.Username
	}
	return preview, nil
}

func UpdateAffiliateInviter(db *gorm.DB, input AffiliateInviterChangeInput) (AffiliateInviterChangePreview, error) {
	if db == nil {
		return AffiliateInviterChangePreview{}, errors.New("nil db")
	}
	if input.TargetUserId <= 0 {
		return AffiliateInviterChangePreview{}, errors.New("invalid target user id")
	}

	var preview AffiliateInviterChangePreview
	err := db.Transaction(func(tx *gorm.DB) error {
		before, err := PreviewAffiliateInviterChange(tx, input)
		if err != nil {
			return err
		}
		if before.CurrentInviterUserId == input.NewInviterUserId {
			preview = before
			return nil
		}

		if err := tx.Model(&model.User{}).Where("id = ?", input.TargetUserId).Update("inviter_id", input.NewInviterUserId).Error; err != nil {
			return err
		}
		if err := disableAffiliateInviteRelationsForUser(tx, input.TargetUserId); err != nil {
			return err
		}
		if err := upsertAffiliateInviteAttributionForUser(tx, input.TargetUserId, input.NewInviterUserId); err != nil {
			return err
		}
		after, err := PreviewAffiliateInviterChange(tx, input)
		if err != nil {
			return err
		}
		preview = before
		if err := RecordAffiliateAuditLog(tx, AffiliateAuditInput{
			ActorUserId:  input.ActorUserId,
			TargetUserId: input.TargetUserId,
			TargetType:   "user_inviter",
			TargetId:     input.TargetUserId,
			Action:       AffiliateAuditActionUpdateInviter,
			BeforeSnapshot: common.GetJsonString(map[string]interface{}{
				"inviter_id": before.CurrentInviterUserId,
				"path":       before.CurrentPathUserIds,
			}),
			AfterSnapshot: common.GetJsonString(map[string]interface{}{
				"inviter_id": after.NewInviterUserId,
				"path":       after.NewPathUserIds,
			}),
			Reason: input.Reason,
		}); err != nil {
			return err
		}
		return model.InvalidateUserCache(input.TargetUserId)
	})
	return preview, err
}

func validateAffiliateInviterChange(db *gorm.DB, targetUserId int, newInviterUserId int) error {
	if newInviterUserId == 0 {
		return nil
	}
	if targetUserId == newInviterUserId {
		return errors.New("inviter cannot point to self")
	}
	if _, err := getAffiliateInviterUser(db, targetUserId); err != nil {
		return err
	}
	if _, err := getAffiliateInviterUser(db, newInviterUserId); err != nil {
		return err
	}
	if containsInt(affiliateInviterPath(db, newInviterUserId), targetUserId) {
		return errors.New("inviter change would create a cycle")
	}
	var relationCount int64
	if err := db.Model(&model.AffiliateRelation{}).
		Where("ancestor_user_id = ? AND descendant_user_id = ? AND status = ?", targetUserId, newInviterUserId, model.AffiliateProfileStatusActive).
		Count(&relationCount).Error; err != nil {
		return err
	}
	if relationCount > 0 {
		return errors.New("inviter change would create a cycle")
	}
	return nil
}

func getAffiliateInviterUser(db *gorm.DB, userId int) (model.User, error) {
	var user model.User
	err := db.Omit("password", "access_token").First(&user, userId).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.User{}, errors.New("user not found")
	}
	return user, err
}

func affiliateInviterPath(db *gorm.DB, inviterUserId int) []int {
	path := make([]int, 0)
	seen := map[int]bool{}
	current := inviterUserId
	for current > 0 && !seen[current] {
		seen[current] = true
		path = append(path, current)
		var user model.User
		if err := db.Select("id", "inviter_id").First(&user, current).Error; err != nil {
			break
		}
		current = user.InviterId
	}
	return path
}

func disableAffiliateInviteRelationsForUser(db *gorm.DB, userId int) error {
	now := common.GetTimestamp()
	return db.Model(&model.AffiliateRelation{}).
		Where("descendant_user_id = ? AND status = ?", userId, model.AffiliateProfileStatusActive).
		Updates(map[string]interface{}{
			"status":     model.AffiliateProfileStatusDisabled,
			"ended_at":   now,
			"updated_at": now,
		}).Error
}

func upsertAffiliateInviteAttributionForUser(db *gorm.DB, targetUserId int, inviterUserId int) error {
	source := AffiliateInviteSourceNone
	inviteCode := ""
	if inviterUserId > 0 {
		inviter, err := getAffiliateInviterUser(db, inviterUserId)
		if err != nil {
			return err
		}
		inviteCode = inviter.AffCode
		source = AffiliateInviteSourceNormal
		if profile, err := getActiveAffiliateProfileForInviter(db, inviterUserId); err != nil {
			return err
		} else if profile != nil {
			source = AffiliateInviteSourceAffiliate
		}
	}

	var event model.AffiliateInviteEvent
	err := db.Where("invitee_user_id = ?", targetUserId).First(&event).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		event = model.AffiliateInviteEvent{
			InviteeUserId:  targetUserId,
			InviterUserId:  inviterUserId,
			InviteCode:     inviteCode,
			InviteSource:   source,
			RegisterMethod: AffiliateRegisterMethodPassword,
			Status:         model.AffiliateEventStatusReady,
			Metadata:       common.GetJsonString(map[string]interface{}{"source": "admin_inviter_change"}),
		}
		if err := db.Create(&event).Error; err != nil {
			return err
		}
	} else if err != nil {
		return err
	} else {
		event.InviterUserId = inviterUserId
		event.InviteCode = inviteCode
		event.InviteSource = source
		event.Status = model.AffiliateEventStatusReady
		event.Metadata = common.GetJsonString(map[string]interface{}{"source": "admin_inviter_change"})
		if err := db.Save(&event).Error; err != nil {
			return err
		}
	}

	if inviterUserId > 0 && source == AffiliateInviteSourceAffiliate {
		return upsertAffiliateInviteRelations(db, AffiliateRelationCreateInput{
			InviterUserId: inviterUserId,
			InviteeUserId: targetUserId,
			InviteEventId: event.Id,
			Source:        source,
			EffectiveAt:   common.GetTimestamp(),
		})
	}
	return nil
}

func getActiveAffiliateProfileForInviter(db *gorm.DB, userId int) (*model.AffiliateProfile, error) {
	var profile model.AffiliateProfile
	err := db.Where("user_id = ? AND status = ?", userId, model.AffiliateProfileStatusActive).First(&profile).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &profile, nil
}

func upsertAffiliateInviteRelations(db *gorm.DB, input AffiliateRelationCreateInput) error {
	if db == nil {
		return errors.New("nil db")
	}
	if input.InviterUserId <= 0 || input.InviteeUserId <= 0 {
		return errors.New("invalid affiliate relation users")
	}
	effectiveAt := input.EffectiveAt
	if effectiveAt == 0 {
		effectiveAt = common.GetTimestamp()
	}
	source := strings.TrimSpace(input.Source)
	if source == "" {
		source = AffiliateInviteSourceAffiliate
	}

	direct := model.AffiliateRelation{
		AncestorUserId:   input.InviterUserId,
		DescendantUserId: input.InviteeUserId,
		Depth:            1,
		DirectInviterId:  input.InviterUserId,
		InviteEventId:    input.InviteEventId,
		Status:           model.AffiliateProfileStatusActive,
		Source:           source,
		EffectiveAt:      effectiveAt,
		EndedAt:          0,
	}
	if err := upsertAffiliateRelationPath(db, direct); err != nil {
		return err
	}

	var ancestors []model.AffiliateRelation
	if err := db.Where(
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
			EndedAt:          0,
		}
		if err := upsertAffiliateRelationPath(db, relation); err != nil {
			return err
		}
	}
	return nil
}

func upsertAffiliateRelationPath(db *gorm.DB, relation model.AffiliateRelation) error {
	var existing model.AffiliateRelation
	err := db.
		Where("ancestor_user_id = ? AND descendant_user_id = ? AND depth = ?", relation.AncestorUserId, relation.DescendantUserId, relation.Depth).
		First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return db.Create(&relation).Error
	}
	if err != nil {
		return err
	}
	existing.DirectInviterId = relation.DirectInviterId
	existing.InviteEventId = relation.InviteEventId
	existing.Status = relation.Status
	existing.Source = relation.Source
	existing.EffectiveAt = relation.EffectiveAt
	existing.EndedAt = relation.EndedAt
	return db.Save(&existing).Error
}
