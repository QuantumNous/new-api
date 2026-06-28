package skillmodel

import "gorm.io/gorm"

func MigrateUserSavedSkills(db *gorm.DB) error {
	if err := db.AutoMigrate(&UserSavedSkill{}); err != nil {
		return err
	}
	return nil
}
