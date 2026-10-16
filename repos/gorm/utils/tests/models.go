package tests

import (
	"database/sql"
	"time"

	"gorm.io/gorm"
)

// User has one `Account` (has one), many `Pets` (has many) and `Toys` (has many - polymorphic)
// He works in a Company (belongs to), he has a Manager (belongs to - single-table), and also managed a Team (has many - single-table)
// He speaks many languages (many to many) and has many friends (many to many - single-table)
// His pet also has one Toy (has one - polymorphic)
// NamedPet is a reference to a named `Pet` (has one)
type User struct {
	gorm.Model
	Name      string
	Age       uint
	Birthday  *time.Time
	Account   Account
	Pets      []*Pet
	NamedPet  *Pet
	Toys      []Toy `gorm:"polymorphic:Owner"`
	CompanyID *int
	Company   Company
	ManagerID *uint
	Manager   *User
	Team      []User     `gorm:"foreignkey:ManagerID"`
	Languages []Language `gorm:"many2many:UserSpeak;"`
	Friends   []*User    `gorm:"many2many:user_friends;"`
	Active    bool
}

type Account struct {
	gorm.Model
	UserID sql.NullInt64
	Number string
}

type Pet struct {
	gorm.Model
	UserID *uint
	Name   string
	Toy    Toy `gorm:"polymorphic:Owner;"`
}

type Toy struct {
	gorm.Model
	Name      string
	OwnerID   string
	OwnerType string
}

type Company struct {
	ID   int
	Name string
}

type Language struct {
	Code string `gorm:"primarykey"`
	Name string
}

type Coupon struct {
	ID               int              `gorm:"primarykey; size:255"`
	AppliesToProduct []*CouponProduct `gorm:"foreignKey:CouponId;constraint:OnDelete:CASCADE"`
	AmountOff        uint32           `gorm:"column:amount_off"`
	PercentOff       float32          `gorm:"column:percent_off"`
}

type CouponProduct struct {
	CouponId  int    `gorm:"primarykey;size:255"`
	ProductId string `gorm:"primarykey;size:255"`
	Desc      string
}

type Order struct {
	gorm.Model
	Num      string
	Coupon   *Coupon
	CouponID string
}

type Parent struct {
	gorm.Model
	FavChildID uint
	FavChild   *Child
	Children   []*Child
}

type Child struct {
	gorm.Model
	Name     string
	ParentID *uint
	Parent   *Parent
}
