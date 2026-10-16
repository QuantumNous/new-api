package schema_test

import (
	"sync"
	"testing"

	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func checkStructRelation(t *testing.T, data interface{}, relations ...Relation) {
	if s, err := schema.Parse(data, &sync.Map{}, schema.NamingStrategy{}); err != nil {
		t.Errorf("Failed to parse schema, got error %v", err)
	} else {
		for _, rel := range relations {
			checkSchemaRelation(t, s, rel)
		}
	}
}

func TestBelongsToOverrideForeignKey(t *testing.T) {
	type Profile struct {
		gorm.Model
		Name string
	}

	type User struct {
		gorm.Model
		Profile      Profile `gorm:"ForeignKey:ProfileRefer"`
		ProfileRefer int
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Profile", Type: schema.BelongsTo, Schema: "User", FieldSchema: "Profile",
		References: []Reference{{"ID", "Profile", "ProfileRefer", "User", "", false}},
	})
}

func TestBelongsToOverrideReferences(t *testing.T) {
	type Profile struct {
		gorm.Model
		Refer string
		Name  string
	}

	type User struct {
		gorm.Model
		Profile   Profile `gorm:"ForeignKey:ProfileID;References:Refer"`
		ProfileID int
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Profile", Type: schema.BelongsTo, Schema: "User", FieldSchema: "Profile",
		References: []Reference{{"Refer", "Profile", "ProfileID", "User", "", false}},
	})
}

func TestBelongsToWithOnlyReferences(t *testing.T) {
	type Profile struct {
		gorm.Model
		Refer string
		Name  string
	}

	type User struct {
		gorm.Model
		Profile      Profile `gorm:"References:Refer"`
		ProfileRefer int
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Profile", Type: schema.BelongsTo, Schema: "User", FieldSchema: "Profile",
		References: []Reference{{"Refer", "Profile", "ProfileRefer", "User", "", false}},
	})
}

func TestBelongsToWithOnlyReferences2(t *testing.T) {
	type Profile struct {
		gorm.Model
		Refer string
		Name  string
	}

	type User struct {
		gorm.Model
		Profile   Profile `gorm:"References:Refer"`
		ProfileID int
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Profile", Type: schema.BelongsTo, Schema: "User", FieldSchema: "Profile",
		References: []Reference{{"Refer", "Profile", "ProfileID", "User", "", false}},
	})
}

func TestSelfReferentialBelongsTo(t *testing.T) {
	type User struct {
		ID        int32 `gorm:"primaryKey"`
		Name      string
		CreatorID *int32
		Creator   *User
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Creator", Type: schema.BelongsTo, Schema: "User", FieldSchema: "User",
		References: []Reference{{"ID", "User", "CreatorID", "User", "", false}},
	})
}

func TestSelfReferentialBelongsToOverrideReferences(t *testing.T) {
	type User struct {
		ID        int32 `gorm:"primaryKey"`
		Name      string
		CreatedBy *int32
		Creator   *User `gorm:"foreignKey:CreatedBy;references:ID"`
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Creator", Type: schema.BelongsTo, Schema: "User", FieldSchema: "User",
		References: []Reference{{"ID", "User", "CreatedBy", "User", "", false}},
	})
}

func TestHasOneOverrideForeignKey(t *testing.T) {
	type Profile struct {
		gorm.Model
		Name      string
		UserRefer uint
	}

	type User struct {
		gorm.Model
		Profile Profile `gorm:"ForeignKey:UserRefer"`
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Profile", Type: schema.HasOne, Schema: "User", FieldSchema: "Profile",
		References: []Reference{{"ID", "User", "UserRefer", "Profile", "", true}},
	})
}

func TestHasOneOverrideReferences(t *testing.T) {
	type Profile struct {
		gorm.Model
		Name   string
		UserID uint
	}

	type User struct {
		gorm.Model
		Refer   string
		Profile Profile `gorm:"ForeignKey:UserID;References:Refer"`
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Profile", Type: schema.HasOne, Schema: "User", FieldSchema: "Profile",
		References: []Reference{{"Refer", "User", "UserID", "Profile", "", true}},
	})
}

func TestHasOneOverrideReferences2(t *testing.T) {
	type Profile struct {
		gorm.Model
		Name string
	}

	type User struct {
		gorm.Model
		ProfileID uint     `gorm:"column:profile_id"`
		Profile   *Profile `gorm:"foreignKey:ID;references:ProfileID"`
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Profile", Type: schema.HasOne, Schema: "User", FieldSchema: "Profile",
		References: []Reference{{"ProfileID", "User", "ID", "Profile", "", true}},
	})
}

func TestHasOneWithOnlyReferences(t *testing.T) {
	type Profile struct {
		gorm.Model
		Name      string
		UserRefer uint
	}

	type User struct {
		gorm.Model
		Refer   string
		Profile Profile `gorm:"References:Refer"`
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Profile", Type: schema.HasOne, Schema: "User", FieldSchema: "Profile",
		References: []Reference{{"Refer", "User", "UserRefer", "Profile", "", true}},
	})
}

func TestHasOneWithOnlyReferences2(t *testing.T) {
	type Profile struct {
		gorm.Model
		Name   string
		UserID uint
	}

	type User struct {
		gorm.Model
		Refer   string
		Profile Profile `gorm:"References:Refer"`
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Profile", Type: schema.HasOne, Schema: "User", FieldSchema: "Profile",
		References: []Reference{{"Refer", "User", "UserID", "Profile", "", true}},
	})
}

func TestHasManyOverrideForeignKey(t *testing.T) {
	type Profile struct {
		gorm.Model
		Name      string
		UserRefer uint
	}

	type User struct {
		gorm.Model
		Profile []Profile `gorm:"ForeignKey:UserRefer"`
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Profile", Type: schema.HasMany, Schema: "User", FieldSchema: "Profile",
		References: []Reference{{"ID", "User", "UserRefer", "Profile", "", true}},
	})
}

func TestHasManyOverrideReferences(t *testing.T) {
	type Profile struct {
		gorm.Model
		Name   string
		UserID uint
	}

	type User struct {
		gorm.Model
		Refer   string
		Profile []Profile `gorm:"ForeignKey:UserID;References:Refer"`
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Profile", Type: schema.HasMany, Schema: "User", FieldSchema: "Profile",
		References: []Reference{{"Refer", "User", "UserID", "Profile", "", true}},
	})
}

func TestMany2ManyOverrideForeignKeyAndReferences(t *testing.T) {
	type Profile struct {
		gorm.Model
		Name      string
		UserRefer uint
	}

	type User struct {
		gorm.Model
		Profiles  []Profile `gorm:"many2many:user_profiles;ForeignKey:Refer;JoinForeignKey:UserReferID;References:UserRefer;JoinReferences:ProfileRefer"`
		Profiles2 []Profile `gorm:"many2many:user_profiles2;ForeignKey:refer;JoinForeignKey:user_refer_id;References:user_refer;JoinReferences:profile_refer"`
		Refer     uint
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Profiles", Type: schema.Many2Many, Schema: "User", FieldSchema: "Profile",
		JoinTable: JoinTable{Name: "user_profiles", Table: "user_profiles"},
		References: []Reference{
			{"Refer", "User", "UserReferID", "user_profiles", "", true},
			{"UserRefer", "Profile", "ProfileRefer", "user_profiles", "", false},
		},
	}, Relation{
		Name: "Profiles2", Type: schema.Many2Many, Schema: "User", FieldSchema: "Profile",
		JoinTable: JoinTable{Name: "user_profiles2", Table: "user_profiles2"},
		References: []Reference{
			{"Refer", "User", "User_refer_id", "user_profiles2", "", true},
			{"UserRefer", "Profile", "Profile_refer", "user_profiles2", "", false},
		},
	})
}

func TestMany2ManyOverrideForeignKey(t *testing.T) {
	type Profile struct {
		gorm.Model
		Name      string
		UserRefer uint
	}

	type User struct {
		gorm.Model
		Profiles []Profile `gorm:"many2many:user_profiles;ForeignKey:Refer;References:UserRefer"`
		Refer    uint
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Profiles", Type: schema.Many2Many, Schema: "User", FieldSchema: "Profile",
		JoinTable: JoinTable{Name: "user_profiles", Table: "user_profiles"},
		References: []Reference{
			{"Refer", "User", "UserRefer", "user_profiles", "", true},
			{"UserRefer", "Profile", "ProfileUserRefer", "user_profiles", "", false},
		},
	})
}

func TestMany2ManySharedForeignKey(t *testing.T) {
	type Profile struct {
		gorm.Model
		Name         string
		Kind         string
		ProfileRefer uint
	}

	type User struct {
		gorm.Model
		Profiles []Profile `gorm:"many2many:user_profiles;foreignKey:Refer,Kind;joinForeignKey:UserRefer,Kind;References:ProfileRefer,Kind;joinReferences:ProfileR,Kind"`
		Kind     string
		Refer    uint
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Profiles", Type: schema.Many2Many, Schema: "User", FieldSchema: "Profile",
		JoinTable: JoinTable{Name: "user_profiles", Table: "user_profiles"},
		References: []Reference{
			{"Refer", "User", "UserRefer", "user_profiles", "", true},
			{"Kind", "User", "Kind", "user_profiles", "", true},
			{"ProfileRefer", "Profile", "ProfileR", "user_profiles", "", false},
			{"Kind", "Profile", "Kind", "user_profiles", "", false},
		},
	})
}

func TestMany2ManyOverrideJoinForeignKey(t *testing.T) {
	type Profile struct {
		gorm.Model
		Name      string
		UserRefer uint
	}

	type User struct {
		gorm.Model
		Profiles []Profile `gorm:"many2many:user_profile;JoinForeignKey:UserReferID;JoinReferences:ProfileRefer"`
		Refer    uint
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Profiles", Type: schema.Many2Many, Schema: "User", FieldSchema: "Profile",
		JoinTable: JoinTable{Name: "user_profile", Table: "user_profile"},
		References: []Reference{
			{"ID", "User", "UserReferID", "user_profile", "", true},
			{"ID", "Profile", "ProfileRefer", "user_profile", "", false},
		},
	})
}

func TestBuildReadonlyMany2ManyRelation(t *testing.T) {
	type Profile struct {
		gorm.Model
		Name      string
		UserRefer uint
	}

	type User struct {
		gorm.Model
		Profiles []Profile `gorm:"->;many2many:user_profile;JoinForeignKey:UserReferID;JoinReferences:ProfileRefer"`
		Refer    uint
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Profiles", Type: schema.Many2Many, Schema: "User", FieldSchema: "Profile",
		JoinTable: JoinTable{Name: "user_profile", Table: "user_profile"},
		References: []Reference{
			{"ID", "User", "UserReferID", "user_profile", "", true},
			{"ID", "Profile", "ProfileRefer", "user_profile", "", false},
		},
	})
}

func TestMany2ManyWithMultiPrimaryKeys(t *testing.T) {
	type Tag struct {
		ID     uint   `gorm:"primary_key"`
		Locale string `gorm:"primary_key"`
		Value  string
	}

	type Blog struct {
		ID         uint   `gorm:"primary_key"`
		Locale     string `gorm:"primary_key"`
		Subject    string
		Body       string
		Tags       []Tag `gorm:"many2many:blog_tags;"`
		SharedTags []Tag `gorm:"many2many:shared_blog_tags;ForeignKey:id;References:id"`
		LocaleTags []Tag `gorm:"many2many:locale_blog_tags;ForeignKey:id,locale;References:id"`
	}

	checkStructRelation(t, &Blog{},
		Relation{
			Name: "Tags", Type: schema.Many2Many, Schema: "Blog", FieldSchema: "Tag",
			JoinTable: JoinTable{Name: "blog_tags", Table: "blog_tags"},
			References: []Reference{
				{"ID", "Blog", "BlogID", "blog_tags", "", true},
				{"Locale", "Blog", "BlogLocale", "blog_tags", "", true},
				{"ID", "Tag", "TagID", "blog_tags", "", false},
				{"Locale", "Tag", "TagLocale", "blog_tags", "", false},
			},
		},
		Relation{
			Name: "SharedTags", Type: schema.Many2Many, Schema: "Blog", FieldSchema: "Tag",
			JoinTable: JoinTable{Name: "shared_blog_tags", Table: "shared_blog_tags"},
			References: []Reference{
				{"ID", "Blog", "BlogID", "shared_blog_tags", "", true},
				{"ID", "Tag", "TagID", "shared_blog_tags", "", false},
			},
		},
		Relation{
			Name: "LocaleTags", Type: schema.Many2Many, Schema: "Blog", FieldSchema: "Tag",
			JoinTable: JoinTable{Name: "locale_blog_tags", Table: "locale_blog_tags"},
			References: []Reference{
				{"ID", "Blog", "BlogID", "locale_blog_tags", "", true},
				{"Locale", "Blog", "BlogLocale", "locale_blog_tags", "", true},
				{"ID", "Tag", "TagID", "locale_blog_tags", "", false},
			},
		},
	)
}

func TestMultipleMany2Many(t *testing.T) {
	type Thing struct {
		ID int
	}

	type Person struct {
		ID       int
		Likes    []Thing `gorm:"many2many:likes"`
		Dislikes []Thing `gorm:"many2many:dislikes"`
	}

	checkStructRelation(t, &Person{},
		Relation{
			Name: "Likes", Type: schema.Many2Many, Schema: "Person", FieldSchema: "Thing",
			JoinTable: JoinTable{Name: "likes", Table: "likes"},
			References: []Reference{
				{"ID", "Person", "PersonID", "likes", "", true},
				{"ID", "Thing", "ThingID", "likes", "", false},
			},
		},
		Relation{
			Name: "Dislikes", Type: schema.Many2Many, Schema: "Person", FieldSchema: "Thing",
			JoinTable: JoinTable{Name: "dislikes", Table: "dislikes"},
			References: []Reference{
				{"ID", "Person", "PersonID", "dislikes", "", true},
				{"ID", "Thing", "ThingID", "dislikes", "", false},
			},
		},
	)
}

func TestSelfReferentialMany2Many(t *testing.T) {
	type User struct {
		ID         int32 `gorm:"primaryKey"`
		Name       string
		CreatedBy  int32
		Creators   []User      `gorm:"foreignKey:CreatedBy"`
		AnotherPro interface{} `gorm:"-"`
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Creators", Type: schema.HasMany, Schema: "User", FieldSchema: "User",
		References: []Reference{{"ID", "User", "CreatedBy", "User", "", true}},
	})

	user, err := schema.Parse(&User{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatalf("failed to parse schema")
	}

	relSchema := user.Relationships.Relations["Creators"].FieldSchema
	if user != relSchema {
		t.Fatalf("schema should be same, expects %p but got %p", user, relSchema)
	}
}

type CreatedByModel struct {
	CreatedByID uint
	CreatedBy   *CreatedUser
}

type CreatedUser struct {
	gorm.Model
	CreatedByModel
}

func TestEmbeddedRelation(t *testing.T) {
	checkStructRelation(t, &CreatedUser{}, Relation{
		Name: "CreatedBy", Type: schema.BelongsTo, Schema: "CreatedUser", FieldSchema: "CreatedUser",
		References: []Reference{
			{"ID", "CreatedUser", "CreatedByID", "CreatedUser", "", false},
		},
	})

	userSchema, err := schema.Parse(&CreatedUser{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatalf("failed to parse schema, got error %v", err)
	}

	if len(userSchema.Relationships.Relations) != 1 {
		t.Fatalf("expects 1 relations, but got %v", len(userSchema.Relationships.Relations))
	}

	if createdByRel, ok := userSchema.Relationships.Relations["CreatedBy"]; ok {
		if createdByRel.FieldSchema != userSchema {
			t.Fatalf("expects same field schema, but got new %p, old %p", createdByRel.FieldSchema, userSchema)
		}
	} else {
		t.Fatalf("expects created by relations, but not found")
	}
}

func TestEmbeddedHas(t *testing.T) {
	type Toy struct {
		ID        int
		Name      string
		OwnerID   int
		OwnerType string
	}
	type User struct {
		ID  int
		Cat struct {
			Name string
			Toy  Toy   `gorm:"polymorphic:Owner;"`
			Toys []Toy `gorm:"polymorphic:Owner;"`
		} `gorm:"embedded;embeddedPrefix:cat_"`
		Dog struct {
			ID     int
			Name   string
			UserID int
			Toy    Toy   `gorm:"polymorphic:Owner;"`
			Toys   []Toy `gorm:"polymorphic:Owner;"`
		}
		Toys []Toy `gorm:"polymorphic:Owner;"`
	}

	s, err := schema.Parse(&User{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatalf("Failed to parse schema, got error %v", err)
	}

	checkEmbeddedRelations(t, s.Relationships.EmbeddedRelations, map[string]EmbeddedRelations{
		"Cat": {
			Relations: map[string]Relation{
				"Toy": {
					Name:        "Toy",
					Type:        schema.HasOne,
					Schema:      "User",
					FieldSchema: "Toy",
					Polymorphic: Polymorphic{ID: "OwnerID", Type: "OwnerType", Value: "users"},
					References: []Reference{
						{ForeignKey: "OwnerType", ForeignSchema: "Toy", PrimaryValue: "users"},
						{ForeignKey: "OwnerType", ForeignSchema: "Toy", PrimaryValue: "users"},
					},
				},
				"Toys": {
					Name:        "Toys",
					Type:        schema.HasMany,
					Schema:      "User",
					FieldSchema: "Toy",
					Polymorphic: Polymorphic{ID: "OwnerID", Type: "OwnerType", Value: "users"},
					References: []Reference{
						{ForeignKey: "OwnerType", ForeignSchema: "Toy", PrimaryValue: "users"},
						{ForeignKey: "OwnerType", ForeignSchema: "Toy", PrimaryValue: "users"},
					},
				},
			},
		},
	})
}

func TestEmbeddedBelongsTo(t *testing.T) {
	type Country struct {
		ID   int `gorm:"primaryKey"`
		Name string
	}
	type Address struct {
		CountryID int
		Country   Country
	}
	type NestedAddress struct {
		Address
	}
	type Org struct {
		ID              int
		PostalAddress   Address `gorm:"embedded;embeddedPrefix:postal_address_"`
		VisitingAddress Address `gorm:"embedded;embeddedPrefix:visiting_address_"`
		AddressID       int
		Address         struct {
			ID int
			Address
		}
		NestedAddress *NestedAddress `gorm:"embedded;embeddedPrefix:nested_address_"`
	}

	s, err := schema.Parse(&Org{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Errorf("Failed to parse schema, got error %v", err)
	}

	checkEmbeddedRelations(t, s.Relationships.EmbeddedRelations, map[string]EmbeddedRelations{
		"PostalAddress": {
			Relations: map[string]Relation{
				"Country": {
					Name: "Country", Type: schema.BelongsTo, Schema: "Org", FieldSchema: "Country",
					References: []Reference{
						{PrimaryKey: "ID", PrimarySchema: "Country", ForeignKey: "CountryID", ForeignSchema: "Org"},
					},
				},
			},
		},
		"VisitingAddress": {
			Relations: map[string]Relation{
				"Country": {
					Name: "Country", Type: schema.BelongsTo, Schema: "Org", FieldSchema: "Country",
					References: []Reference{
						{PrimaryKey: "ID", PrimarySchema: "Country", ForeignKey: "CountryID", ForeignSchema: "Org"},
					},
				},
			},
		},
		"NestedAddress": {
			EmbeddedRelations: map[string]EmbeddedRelations{
				"Address": {
					Relations: map[string]Relation{
						"Country": {
							Name: "Country", Type: schema.BelongsTo, Schema: "Org", FieldSchema: "Country",
							References: []Reference{
								{PrimaryKey: "ID", PrimarySchema: "Country", ForeignKey: "CountryID", ForeignSchema: "Org"},
							},
						},
					},
				},
			},
		},
	})
}

func TestVariableRelation(t *testing.T) {
	var result struct {
		User
	}

	checkStructRelation(t, &result, Relation{
		Name: "Account", Type: schema.HasOne, Schema: "", FieldSchema: "Account",
		References: []Reference{
			{"ID", "", "UserID", "Account", "", true},
		},
	})

	checkStructRelation(t, &result, Relation{
		Name: "Company", Type: schema.BelongsTo, Schema: "", FieldSchema: "Company",
		References: []Reference{
			{"ID", "Company", "CompanyID", "", "", false},
		},
	})
}

func TestSameForeignKey(t *testing.T) {
	type UserAux struct {
		gorm.Model
		Aux  string
		UUID string
	}

	type User struct {
		gorm.Model
		Name string
		UUID string
		Aux  *UserAux `gorm:"foreignkey:UUID;references:UUID"`
	}

	checkStructRelation(t, &User{},
		Relation{
			Name: "Aux", Type: schema.HasOne, Schema: "User", FieldSchema: "UserAux",
			References: []Reference{
				{"UUID", "User", "UUID", "UserAux", "", true},
			},
		},
	)
}

func TestBelongsToSameForeignKey(t *testing.T) {
	type User struct {
		gorm.Model
		Name string
		UUID string
	}

	type UserAux struct {
		gorm.Model
		Aux  string
		UUID string
		User User `gorm:"ForeignKey:UUID;references:UUID;belongsTo"`
	}

	checkStructRelation(t, &UserAux{},
		Relation{
			Name: "User", Type: schema.BelongsTo, Schema: "UserAux", FieldSchema: "User",
			References: []Reference{
				{"UUID", "User", "UUID", "UserAux", "", false},
			},
		},
	)
}

func TestHasOneWithSameForeignKey(t *testing.T) {
	type Profile struct {
		gorm.Model
		Name         string
		ProfileRefer int // not used in relationship
	}

	type User struct {
		gorm.Model
		Profile      Profile `gorm:"ForeignKey:ID;references:ProfileRefer"`
		ProfileRefer int
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Profile", Type: schema.HasOne, Schema: "User", FieldSchema: "Profile",
		References: []Reference{{"ProfileRefer", "User", "ID", "Profile", "", true}},
	})
}

func TestHasManySameForeignKey(t *testing.T) {
	type Profile struct {
		gorm.Model
		Name      string
		UserRefer uint
	}

	type User struct {
		gorm.Model
		UserRefer uint
		Profile   []Profile `gorm:"ForeignKey:UserRefer"`
	}

	checkStructRelation(t, &User{}, Relation{
		Name: "Profile", Type: schema.HasMany, Schema: "User", FieldSchema: "Profile",
		References: []Reference{{"ID", "User", "UserRefer", "Profile", "", true}},
	})
}

type Author struct {
	gorm.Model
}

type Book struct {
	gorm.Model
	Author   Author
	AuthorID uint
}

func (Book) TableName() string {
	return "my_schema.a_very_very_very_very_very_very_very_very_long_table_name"
}

func TestParseConstraintNameWithSchemaQualifiedLongTableName(t *testing.T) {
	s, err := schema.Parse(
		&Book{},
		&sync.Map{},
		schema.NamingStrategy{IdentifierMaxLength: 64},
	)
	if err != nil {
		t.Fatalf("Failed to parse schema")
	}

	expectedConstraintName := "fk_my_schema_a_very_very_very_very_very_very_very_very_l4db13eec"
	constraint := s.Relationships.Relations["Author"].ParseConstraint()

	if constraint.Name != expectedConstraintName {
		t.Fatalf(
			"expected constraint name %s, got %s",
			expectedConstraintName,
			constraint.Name,
		)
	}
}
