package schema_test

import (
	"database/sql"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/utils/tests"
)

type User struct {
	*gorm.Model
	Name      *string
	Age       *uint
	Birthday  *time.Time
	Account   *tests.Account
	Pets      []*tests.Pet
	Toys      []*tests.Toy `gorm:"polymorphic:Owner"`
	CompanyID *int
	Company   *tests.Company
	ManagerID *uint
	Manager   *User
	Team      []*User           `gorm:"foreignkey:ManagerID"`
	Languages []*tests.Language `gorm:"many2many:UserSpeak"`
	Friends   []*User           `gorm:"many2many:user_friends"`
	Active    *bool
}

type (
	mytime time.Time
	myint  int
	mybool = bool
)

type AdvancedDataTypeUser struct {
	ID           sql.NullInt64
	Name         *sql.NullString
	Birthday     sql.NullTime
	RegisteredAt mytime
	DeletedAt    *mytime
	Active       mybool
	Admin        *mybool
}

type BaseModel struct {
	ID        uint
	CreatedAt time.Time
	CreatedBy *int
	Created   *VersionUser `gorm:"foreignKey:CreatedBy"`
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

type VersionModel struct {
	BaseModel
	Version int
}

type VersionUser struct {
	VersionModel
	Name     string
	Age      uint
	Birthday *time.Time
}
