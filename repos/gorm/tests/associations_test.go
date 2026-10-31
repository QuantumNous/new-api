package tests_test

import (
	"testing"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/schema"
	. "gorm.io/gorm/utils/tests"
)

func AssertAssociationCount(t *testing.T, data interface{}, name string, result int64, reason string) {
	if count := DB.Model(data).Association(name).Count(); count != result {
		t.Fatalf("invalid %v count %v, expects: %v got %v", name, reason, result, count)
	}

	var newUser User
	if user, ok := data.(User); ok {
		DB.Find(&newUser, "id = ?", user.ID)
	} else if user, ok := data.(*User); ok {
		DB.Find(&newUser, "id = ?", user.ID)
	}

	if newUser.ID != 0 {
		if count := DB.Model(&newUser).Association(name).Count(); count != result {
			t.Fatalf("invalid %v count %v, expects: %v got %v", name, reason, result, count)
		}
	}
}

func TestInvalidAssociation(t *testing.T) {
	user := *GetUser("invalid", Config{Company: true, Manager: true})
	if err := DB.Model(&user).Association("Invalid").Find(&user.Company).Error; err == nil {
		t.Fatalf("should return errors for invalid association, but got nil")
	}
}

func TestAssociationNotNullClear(t *testing.T) {
	type Profile struct {
		gorm.Model
		Number   string
		MemberID uint `gorm:"not null"`
	}

	type Member struct {
		gorm.Model
		Profiles []Profile
	}

	DB.Migrator().DropTable(&Member{}, &Profile{})

	if err := DB.AutoMigrate(&Member{}, &Profile{}); err != nil {
		t.Fatalf("Failed to migrate, got error: %v", err)
	}

	member := &Member{
		Profiles: []Profile{{
			Number: "1",
		}, {
			Number: "2",
		}},
	}

	if err := DB.Create(&member).Error; err != nil {
		t.Fatalf("Failed to create test data, got error: %v", err)
	}

	if err := DB.Model(member).Association("Profiles").Clear(); err == nil {
		t.Fatalf("No error occurred during clearind not null association")
	}
}

func TestForeignKeyConstraints(t *testing.T) {
	tidbSkip(t, "not support the foreign key feature")

	type Profile struct {
		ID       uint
		Name     string
		MemberID uint
	}

	type Member struct {
		ID      uint
		Refer   uint `gorm:"uniqueIndex"`
		Name    string
		Profile Profile `gorm:"Constraint:OnUpdate:CASCADE,OnDelete:CASCADE;FOREIGNKEY:MemberID;References:Refer"`
	}

	DB.Migrator().DropTable(&Profile{}, &Member{})

	if err := DB.AutoMigrate(&Profile{}, &Member{}); err != nil {
		t.Fatalf("Failed to migrate, got error: %v", err)
	}

	member := Member{Refer: 1, Name: "foreign_key_constraints", Profile: Profile{Name: "my_profile"}}

	DB.Create(&member)

	var profile Profile
	if err := DB.First(&profile, "id = ?", member.Profile.ID).Error; err != nil {
		t.Fatalf("failed to find profile, got error: %v", err)
	} else if profile.MemberID != member.ID {
		t.Fatalf("member id is not equal: expects: %v, got: %v", member.ID, profile.MemberID)
	}

	member.Profile = Profile{}
	DB.Model(&member).Update("Refer", 100)

	var profile2 Profile
	if err := DB.First(&profile2, "id = ?", profile.ID).Error; err != nil {
		t.Fatalf("failed to find profile, got error: %v", err)
	} else if profile2.MemberID != 100 {
		t.Fatalf("member id is not equal: expects: %v, got: %v", 100, profile2.MemberID)
	}

	if r := DB.Delete(&member); r.Error != nil || r.RowsAffected != 1 {
		t.Fatalf("Should delete member, got error: %v, affected: %v", r.Error, r.RowsAffected)
	}

	var result Member
	if err := DB.First(&result, member.ID).Error; err == nil {
		t.Fatalf("Should not find deleted member")
	}

	if err := DB.First(&profile2, profile.ID).Error; err == nil {
		t.Fatalf("Should not find deleted profile")
	}
}

func TestForeignKeyConstraintsBelongsTo(t *testing.T) {
	tidbSkip(t, "not support the foreign key feature")

	type Profile struct {
		ID    uint
		Name  string
		Refer uint `gorm:"uniqueIndex"`
	}

	type Member struct {
		ID        uint
		Name      string
		ProfileID uint
		Profile   Profile `gorm:"Constraint:OnUpdate:CASCADE,OnDelete:CASCADE;FOREIGNKEY:ProfileID;References:Refer"`
	}

	DB.Migrator().DropTable(&Profile{}, &Member{})

	if err := DB.AutoMigrate(&Profile{}, &Member{}); err != nil {
		t.Fatalf("Failed to migrate, got error: %v", err)
	}

	member := Member{Name: "foreign_key_constraints_belongs_to", Profile: Profile{Name: "my_profile_belongs_to", Refer: 1}}

	DB.Create(&member)

	var profile Profile
	if err := DB.First(&profile, "id = ?", member.Profile.ID).Error; err != nil {
		t.Fatalf("failed to find profile, got error: %v", err)
	} else if profile.Refer != member.ProfileID {
		t.Fatalf("member id is not equal: expects: %v, got: %v", profile.Refer, member.ProfileID)
	}

	DB.Model(&profile).Update("Refer", 100)

	var member2 Member
	if err := DB.First(&member2, "id = ?", member.ID).Error; err != nil {
		t.Fatalf("failed to find member, got error: %v", err)
	} else if member2.ProfileID != 100 {
		t.Fatalf("member id is not equal: expects: %v, got: %v", 100, member2.ProfileID)
	}

	if r := DB.Delete(&profile); r.Error != nil || r.RowsAffected != 1 {
		t.Fatalf("Should delete member, got error: %v, affected: %v", r.Error, r.RowsAffected)
	}

	var result Member
	if err := DB.First(&result, member.ID).Error; err == nil {
		t.Fatalf("Should not find deleted member")
	}

	if err := DB.First(&profile, profile.ID).Error; err == nil {
		t.Fatalf("Should not find deleted profile")
	}
}

func TestFullSaveAssociations(t *testing.T) {
	coupon := &Coupon{
		AppliesToProduct: []*CouponProduct{
			{ProductId: "full-save-association-product1"},
		},
		AmountOff:  10,
		PercentOff: 0.0,
	}

	err := DB.
		Session(&gorm.Session{FullSaveAssociations: true}).
		Create(coupon).Error
	if err != nil {
		t.Errorf("Failed, got error: %v", err)
	}

	if DB.First(&Coupon{}, "id = ?", coupon.ID).Error != nil {
		t.Errorf("Failed to query saved coupon")
	}

	if DB.First(&CouponProduct{}, "coupon_id = ? AND product_id = ?", coupon.ID, "full-save-association-product1").Error != nil {
		t.Errorf("Failed to query saved association")
	}

	orders := []Order{{Num: "order1", Coupon: coupon}, {Num: "order2", Coupon: coupon}}
	if err := DB.Create(&orders).Error; err != nil {
		t.Errorf("failed to create orders, got %v", err)
	}

	coupon2 := Coupon{
		AppliesToProduct: []*CouponProduct{{Desc: "coupon-description"}},
	}

	DB.Session(&gorm.Session{FullSaveAssociations: true}).Create(&coupon2)
	var result Coupon
	if err := DB.Preload("AppliesToProduct").First(&result, "id = ?", coupon2.ID).Error; err != nil {
		t.Errorf("Failed to create coupon w/o name, got error: %v", err)
	}

	if len(result.AppliesToProduct) != 1 {
		t.Errorf("Failed to preload AppliesToProduct")
	}
}

func TestSaveBelongsCircularReference(t *testing.T) {
	parent := Parent{}
	DB.Create(&parent)

	child := Child{ParentID: &parent.ID, Parent: &parent}
	DB.Create(&child)

	parent.FavChildID = child.ID
	parent.FavChild = &child
	DB.Save(&parent)

	var parent1 Parent
	DB.First(&parent1, parent.ID)
	AssertObjEqual(t, parent, parent1, "ID", "FavChildID")

	// Save and Updates is the same
	DB.Updates(&parent)
	DB.First(&parent1, parent.ID)
	AssertObjEqual(t, parent, parent1, "ID", "FavChildID")
}

func TestSaveHasManyCircularReference(t *testing.T) {
	parent := Parent{}
	DB.Create(&parent)

	child := Child{ParentID: &parent.ID, Parent: &parent, Name: "HasManyCircularReference"}
	child1 := Child{ParentID: &parent.ID, Parent: &parent, Name: "HasManyCircularReference1"}

	parent.Children = []*Child{&child, &child1}
	DB.Save(&parent)

	var children []*Child
	DB.Where("parent_id = ?", parent.ID).Find(&children)
	if len(children) != len(parent.Children) ||
		children[0].ID != parent.Children[0].ID ||
		children[1].ID != parent.Children[1].ID {
		t.Errorf("circular reference children save not equal children:%v parent.Children:%v",
			children, parent.Children)
	}
}

func TestAssociationError(t *testing.T) {
	user := *GetUser("TestAssociationError", Config{Pets: 2, Company: true, Account: true, Languages: 2})
	DB.Create(&user)

	var user1 User
	DB.Preload("Company").Preload("Pets").Preload("Account").Preload("Languages").First(&user1)

	var emptyUser User
	var err error
	// belongs to
	err = DB.Model(&emptyUser).Association("Company").Delete(&user1.Company)
	AssertEqual(t, err, gorm.ErrPrimaryKeyRequired)
	// has many
	err = DB.Model(&emptyUser).Association("Pets").Delete(&user1.Pets)
	AssertEqual(t, err, gorm.ErrPrimaryKeyRequired)
	// has one
	err = DB.Model(&emptyUser).Association("Account").Delete(&user1.Account)
	AssertEqual(t, err, gorm.ErrPrimaryKeyRequired)
	// many to many
	err = DB.Model(&emptyUser).Association("Languages").Delete(&user1.Languages)
	AssertEqual(t, err, gorm.ErrPrimaryKeyRequired)
}

type (
	myType           string
	emptyQueryClause struct {
		Field *schema.Field
	}
)

func (myType) QueryClauses(f *schema.Field) []clause.Interface {
	return []clause.Interface{emptyQueryClause{Field: f}}
}

func (sd emptyQueryClause) Name() string {
	return "empty"
}

func (sd emptyQueryClause) Build(clause.Builder) {
}

func (sd emptyQueryClause) MergeClause(*clause.Clause) {
}

func (sd emptyQueryClause) ModifyStatement(stmt *gorm.Statement) {
	// do nothing
}

func TestAssociationEmptyQueryClause(t *testing.T) {
	type Organization struct {
		gorm.Model
		Name string
	}
	type Region struct {
		gorm.Model
		Name          string
		Organizations []Organization `gorm:"many2many:region_orgs;"`
	}
	type RegionOrg struct {
		RegionId       uint
		OrganizationId uint
		Empty          myType
	}
	if err := DB.SetupJoinTable(&Region{}, "Organizations", &RegionOrg{}); err != nil {
		t.Fatalf("Failed to set up join table, got error: %s", err)
	}
	if err := DB.Migrator().DropTable(&Organization{}, &Region{}); err != nil {
		t.Fatalf("Failed to migrate, got error: %s", err)
	}
	if err := DB.AutoMigrate(&Organization{}, &Region{}); err != nil {
		t.Fatalf("Failed to migrate, got error: %v", err)
	}
	region := &Region{Name: "Region1"}
	if err := DB.Create(region).Error; err != nil {
		t.Fatalf("fail to create region %v", err)
	}
	var orgs []Organization

	if err := DB.Model(&Region{}).Association("Organizations").Find(&orgs); err != nil {
		t.Fatalf("fail to find region organizations %v", err)
	} else {
		AssertEqual(t, len(orgs), 0)
	}
}

type AssociationEmptyUser struct {
	ID   uint
	Name string
	Pets []AssociationEmptyPet
}

type AssociationEmptyPet struct {
	AssociationEmptyUserID *uint  `gorm:"uniqueIndex:uniq_user_id_name"`
	Name                   string `gorm:"uniqueIndex:uniq_user_id_name;size:256"`
}

func TestAssociationEmptyPrimaryKey(t *testing.T) {
	if DB.Dialector.Name() != "mysql" {
		t.Skip()
	}
	DB.Migrator().DropTable(&AssociationEmptyUser{}, &AssociationEmptyPet{})
	DB.AutoMigrate(&AssociationEmptyUser{}, &AssociationEmptyPet{})

	id := uint(100)
	user := AssociationEmptyUser{
		ID:   id,
		Name: "jinzhu",
		Pets: []AssociationEmptyPet{
			{AssociationEmptyUserID: &id, Name: "bar"},
			{AssociationEmptyUserID: &id, Name: "foo"},
		},
	}

	err := DB.Session(&gorm.Session{FullSaveAssociations: true}).Create(&user).Error
	if err != nil {
		t.Fatalf("Failed to create, got error: %v", err)
	}

	var result AssociationEmptyUser
	err = DB.Preload("Pets").First(&result, &id).Error
	if err != nil {
		t.Fatalf("Failed to find, got error: %v", err)
	}

	AssertEqual(t, result, user)
}
