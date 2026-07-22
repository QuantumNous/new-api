package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SkillHubFavorite struct {
	Id          int   `json:"-" gorm:"primaryKey"`
	UserID      int   `json:"-" gorm:"column:user_id;not null;uniqueIndex:uk_skill_hub_favorite_user_skill,priority:1;index:idx_skill_hub_favorite_user"`
	SkillID     int   `json:"-" gorm:"column:skill_id;not null;uniqueIndex:uk_skill_hub_favorite_user_skill,priority:2;index:idx_skill_hub_favorite_skill"`
	CreatedTime int64 `json:"-" gorm:"bigint"`
}

func (f *SkillHubFavorite) BeforeCreate(tx *gorm.DB) error {
	if f.UserID <= 0 || f.SkillID <= 0 {
		return errors.New("invalid skill favorite")
	}
	if f.CreatedTime == 0 {
		f.CreatedTime = common.GetTimestamp()
	}
	return nil
}

func FavoriteSkillHubSkill(userID int, skillID int) error {
	if userID <= 0 || skillID <= 0 {
		return errors.New("invalid skill favorite")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var skill SkillHubSkill
		query := tx
		if tx.Dialector.Name() != "sqlite" {
			query = query.Clauses(clause.Locking{Strength: "UPDATE"})
		}
		if err := query.Where("id = ? AND status = ?", skillID, SkillHubStatusPublished).First(&skill).Error; err != nil {
			return err
		}
		favorite := &SkillHubFavorite{UserID: userID, SkillID: skillID}
		return tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "skill_id"}},
			DoNothing: true,
		}).Create(favorite).Error
	})
}

func UnfavoriteSkillHubSkill(userID int, skillID int) error {
	if userID <= 0 || skillID <= 0 {
		return errors.New("invalid skill favorite")
	}
	return DB.Where("user_id = ? AND skill_id = ?", userID, skillID).
		Delete(&SkillHubFavorite{}).Error
}

func SearchFavoriteSkillHubSkills(userID int, tagIDs []int, keyword string, offset int, limit int) ([]*SkillHubSkill, int64, error) {
	if userID <= 0 {
		return nil, 0, errors.New("invalid user id")
	}

	favoriteSkillIDs := DB.Model(&SkillHubFavorite{}).
		Select("skill_id").
		Where("user_id = ?", userID)
	db := skillHubSummaryQuery(DB.Model(&SkillHubSkill{})).
		Where("skill_hub_skills.status = ?", SkillHubStatusPublished).
		Where("skill_hub_skills.id IN (?)", favoriteSkillIDs)

	if len(tagIDs) > 0 {
		tags, err := GetSkillHubTagsByIDs(tagIDs)
		if err != nil {
			return nil, 0, err
		}
		cleanTagIDs := make([]int, 0, len(tags))
		for _, tag := range tags {
			if tag.Id > 0 {
				cleanTagIDs = append(cleanTagIDs, tag.Id)
			}
		}
		if len(cleanTagIDs) == 0 {
			return []*SkillHubSkill{}, 0, nil
		}
		taggedSkillIDs := DB.Model(&SkillHubSkillTag{}).
			Select("skill_id").
			Where("tag_id IN ?", cleanTagIDs)
		db = db.Where("skill_hub_skills.id IN (?)", taggedSkillIDs)
	}

	keywordLike, err := skillHubContainsLikePattern(keyword)
	if err != nil {
		return nil, 0, err
	}
	if keywordLike != "" {
		db = db.Where(
			"(skill_hub_skills.skill_id LIKE ? ESCAPE '!' OR skill_hub_skills.name LIKE ? ESCAPE '!' OR skill_hub_skills.description LIKE ? ESCAPE '!' OR skill_hub_skills.tags LIKE ? ESCAPE '!' OR skill_hub_skills.origin LIKE ? ESCAPE '!' OR skill_hub_skills.origin_url LIKE ? ESCAPE '!')",
			keywordLike,
			keywordLike,
			keywordLike,
			keywordLike,
			keywordLike,
			keywordLike,
		)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var skills []*SkillHubSkill
	err = db.Order(skillHubQualifiedSkillOrder).Offset(offset).Limit(limit).Find(&skills).Error
	return skills, total, err
}

func SkillHubSkillsToResponsesForUser(skills []*SkillHubSkill, admin bool, userID int) ([]SkillHubSkillResponse, error) {
	responses := SkillHubSkillsToResponses(skills, admin)
	if userID <= 0 || len(skills) == 0 {
		return responses, nil
	}

	internalIDs := make([]int, 0, len(skills))
	for _, skill := range skills {
		if skill != nil && skill.Id > 0 {
			internalIDs = append(internalIDs, skill.Id)
		}
	}
	if len(internalIDs) == 0 {
		return responses, nil
	}

	var favoriteSkillIDs []int
	err := DB.Model(&SkillHubFavorite{}).
		Where("user_id = ? AND skill_id IN ?", userID, internalIDs).
		Pluck("skill_id", &favoriteSkillIDs).Error
	if err != nil {
		return nil, err
	}
	favorited := make(map[int]struct{}, len(favoriteSkillIDs))
	for _, skillID := range favoriteSkillIDs {
		favorited[skillID] = struct{}{}
	}
	for index, skill := range skills {
		if skill == nil || index >= len(responses) {
			continue
		}
		if _, ok := favorited[skill.Id]; ok {
			responses[index].Favorited = true
		}
	}
	return responses, nil
}
