package model

import (
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

type LargeText string

func (LargeText) GormDataType() string {
	return "text"
}

func (LargeText) GormDBDataType(db *gorm.DB, _ *schema.Field) string {
	switch db.Dialector.Name() {
	case "mysql":
		return "longtext"
	default:
		return "text"
	}
}
