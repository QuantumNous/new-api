package model

import (
	"strconv"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const subscriptionRecommendedPlanKey = "SubscriptionRecommendedPlanId"

// A single primary-keyed option stores the selection across all instances.
// Read it directly so an old plan or option cache cannot restore a recommendation.
func GetRecommendedSubscriptionPlanID() (int, error) {
	var option Option
	if err := DB.Where(&Option{Key: subscriptionRecommendedPlanKey}).Find(&option).Error; err != nil {
		return 0, err
	}
	id, _ := strconv.Atoi(option.Value)
	return max(id, 0), nil
}

// SetSubscriptionPlanRecommendation belongs in the transaction saving the plan.
func SetSubscriptionPlanRecommendation(tx *gorm.DB, planID int, recommended bool) error {
	value := strconv.Itoa(planID)
	if !recommended {
		// An old edit of another plan must not clear the current selection.
		return tx.Model(&Option{}).Where(&Option{Key: subscriptionRecommendedPlanKey, Value: value}).Update("value", "0").Error
	}
	var plan SubscriptionPlan
	if err := tx.Select("id").First(&plan, planID).Error; err != nil {
		return err
	}
	return tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value"}),
	}).Create(&Option{Key: subscriptionRecommendedPlanKey, Value: value}).Error
}
