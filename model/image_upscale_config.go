package model

import (
	"crypto/rand"
	"encoding/base64"
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	gormlogger "gorm.io/gorm/logger"
)

// Create once, never overwrite an existing credential (including an explicit
// empty value used to disable workers). Secret values are excluded from SQL logs.
func InitImageUpscaleWorkerToken() error {
	db := DB.Session(&gorm.Session{Logger: gormlogger.Default.LogMode(gormlogger.Silent)})
	var existing Option
	if err := db.Where(&Option{Key: "ImageUpscaleWorkerToken"}).Limit(1).Find(&existing).Error; err != nil {
		return errors.New("unable to read upscale worker configuration")
	}
	if existing.Key == "" {
		secret := make([]byte, 32)
		if _, err := rand.Read(secret); err != nil {
			return errors.New("unable to create worker credential")
		}
		candidate := Option{Key: "ImageUpscaleWorkerToken", Value: base64.RawURLEncoding.EncodeToString(secret)}
		if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&candidate).Error; err != nil {
			return errors.New("unable to save worker credential")
		}
		if err := db.Where(&Option{Key: candidate.Key}).First(&existing).Error; err != nil {
			return errors.New("unable to load worker credential")
		}
	}
	common.OptionMapRWMutex.Lock()
	common.OptionMap[existing.Key] = existing.Value
	common.OptionMapRWMutex.Unlock()
	return nil
}
