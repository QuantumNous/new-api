package callbacks

import "gorm.io/gorm"

type BeforeCreateInterface interface {
	BeforeCreate(*gorm.DB) error
}

type AfterCreateInterface interface {
	AfterCreate(*gorm.DB) error
}

type BeforeUpdateInterface interface {
	BeforeUpdate(*gorm.DB) error
}

type AfterUpdateInterface interface {
	AfterUpdate(*gorm.DB) error
}

type BeforeSaveInterface interface {
	BeforeSave(*gorm.DB) error
}

type AfterSaveInterface interface {
	AfterSave(*gorm.DB) error
}

type BeforeDeleteInterface interface {
	BeforeDelete(*gorm.DB) error
}

type AfterDeleteInterface interface {
	AfterDelete(*gorm.DB) error
}

type AfterFindInterface interface {
	AfterFind(*gorm.DB) error
}
