package schema_test

import (
	"strings"
	"sync"
	"testing"

	"gorm.io/gorm"
	"gorm.io/gorm/schema"
	"gorm.io/gorm/utils/tests"
)

func TestParseSchema(t *testing.T) {
	user, err := schema.Parse(&tests.User{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatalf("failed to parse user, got error %v", err)
	}

	checkUserSchema(t, user)
}

func TestParseSchemaWithPointerFields(t *testing.T) {
	user, err := schema.Parse(&User{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatalf("failed to parse pointer user, got error %v", err)
	}

	checkUserSchema(t, user)
}

func checkUserSchema(t *testing.T, user *schema.Schema) {
	// check schema
	checkSchema(t, user, schema.Schema{Name: "User", Table: "users"}, []string{"ID"})

	// check fields
	fields := []schema.Field{
		{Name: "ID", DBName: "id", BindNames: []string{"Model", "ID"}, DataType: schema.Uint, PrimaryKey: true, Tag: `gorm:"primarykey"`, TagSettings: map[string]string{"PRIMARYKEY": "PRIMARYKEY"}, Size: 64, HasDefaultValue: true, AutoIncrement: true},
		{Name: "CreatedAt", DBName: "created_at", BindNames: []string{"Model", "CreatedAt"}, DataType: schema.Time},
		{Name: "UpdatedAt", DBName: "updated_at", BindNames: []string{"Model", "UpdatedAt"}, DataType: schema.Time},
		{Name: "DeletedAt", DBName: "deleted_at", BindNames: []string{"Model", "DeletedAt"}, Tag: `gorm:"index"`, DataType: schema.Time},
		{Name: "Name", DBName: "name", BindNames: []string{"Name"}, DataType: schema.String},
		{Name: "Age", DBName: "age", BindNames: []string{"Age"}, DataType: schema.Uint, Size: 64},
		{Name: "Birthday", DBName: "birthday", BindNames: []string{"Birthday"}, DataType: schema.Time},
		{Name: "CompanyID", DBName: "company_id", BindNames: []string{"CompanyID"}, DataType: schema.Int, Size: 64},
		{Name: "ManagerID", DBName: "manager_id", BindNames: []string{"ManagerID"}, DataType: schema.Uint, Size: 64},
		{Name: "Active", DBName: "active", BindNames: []string{"Active"}, DataType: schema.Bool},
	}

	for _, f := range fields {
		checkSchemaField(t, user, &f, func(f *schema.Field) {
			f.Creatable = true
			f.Updatable = true
			f.Readable = true
		})
	}

	// check relations
	relations := []Relation{
		{
			Name: "Account", Type: schema.HasOne, Schema: "User", FieldSchema: "Account",
			References: []Reference{{"ID", "User", "UserID", "Account", "", true}},
		},
		{
			Name: "Pets", Type: schema.HasMany, Schema: "User", FieldSchema: "Pet",
			References: []Reference{{"ID", "User", "UserID", "Pet", "", true}},
		},
		{
			Name: "Toys", Type: schema.HasMany, Schema: "User", FieldSchema: "Toy",
			Polymorphic: Polymorphic{ID: "OwnerID", Type: "OwnerType", Value: "users"},
			References:  []Reference{{"ID", "User", "OwnerID", "Toy", "", true}, {"", "", "OwnerType", "Toy", "users", false}},
		},
		{
			Name: "Company", Type: schema.BelongsTo, Schema: "User", FieldSchema: "Company",
			References: []Reference{{"ID", "Company", "CompanyID", "User", "", false}},
		},
		{
			Name: "Manager", Type: schema.BelongsTo, Schema: "User", FieldSchema: "User",
			References: []Reference{{"ID", "User", "ManagerID", "User", "", false}},
		},
		{
			Name: "Team", Type: schema.HasMany, Schema: "User", FieldSchema: "User",
			References: []Reference{{"ID", "User", "ManagerID", "User", "", true}},
		},
		{
			Name: "Languages", Type: schema.Many2Many, Schema: "User", FieldSchema: "Language",
			JoinTable: JoinTable{Name: "UserSpeak", Table: "user_speaks", Fields: []schema.Field{
				{
					Name: "UserID", DBName: "user_id", BindNames: []string{"UserID"}, DataType: schema.Uint,
					Tag: `gorm:"primarykey"`, Creatable: true, Updatable: true, Readable: true, PrimaryKey: true, Size: 64,
				},
				{
					Name: "LanguageCode", DBName: "language_code", BindNames: []string{"LanguageCode"}, DataType: schema.String,
					Tag: `gorm:"primarykey"`, Creatable: true, Updatable: true, Readable: true, PrimaryKey: true,
				},
			}},
			References: []Reference{{"ID", "User", "UserID", "UserSpeak", "", true}, {"Code", "Language", "LanguageCode", "UserSpeak", "", false}},
		},
		{
			Name: "Friends", Type: schema.Many2Many, Schema: "User", FieldSchema: "User",
			JoinTable: JoinTable{Name: "user_friends", Table: "user_friends", Fields: []schema.Field{
				{
					Name: "UserID", DBName: "user_id", BindNames: []string{"UserID"}, DataType: schema.Uint,
					Tag: `gorm:"primarykey"`, Creatable: true, Updatable: true, Readable: true, PrimaryKey: true, Size: 64,
				},
				{
					Name: "FriendID", DBName: "friend_id", BindNames: []string{"FriendID"}, DataType: schema.Uint,
					Tag: `gorm:"primarykey"`, Creatable: true, Updatable: true, Readable: true, PrimaryKey: true, Size: 64,
				},
			}},
			References: []Reference{{"ID", "User", "UserID", "user_friends", "", true}, {"ID", "User", "FriendID", "user_friends", "", false}},
		},
	}

	for _, relation := range relations {
		checkSchemaRelation(t, user, relation)
	}
}

func TestParseSchemaWithAdvancedDataType(t *testing.T) {
	user, err := schema.Parse(&AdvancedDataTypeUser{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatalf("failed to parse pointer user, got error %v", err)
	}

	// check schema
	checkSchema(t, user, schema.Schema{Name: "AdvancedDataTypeUser", Table: "advanced_data_type_users"}, []string{"ID"})

	// check fields
	fields := []schema.Field{
		{Name: "ID", DBName: "id", BindNames: []string{"ID"}, DataType: schema.Int, PrimaryKey: true, Size: 64, HasDefaultValue: true, AutoIncrement: true},
		{Name: "Name", DBName: "name", BindNames: []string{"Name"}, DataType: schema.String},
		{Name: "Birthday", DBName: "birthday", BindNames: []string{"Birthday"}, DataType: schema.Time},
		{Name: "RegisteredAt", DBName: "registered_at", BindNames: []string{"RegisteredAt"}, DataType: schema.Time},
		{Name: "DeletedAt", DBName: "deleted_at", BindNames: []string{"DeletedAt"}, DataType: schema.Time},
		{Name: "Active", DBName: "active", BindNames: []string{"Active"}, DataType: schema.Bool},
		{Name: "Admin", DBName: "admin", BindNames: []string{"Admin"}, DataType: schema.Bool},
	}

	for _, f := range fields {
		checkSchemaField(t, user, &f, func(f *schema.Field) {
			f.Creatable = true
			f.Updatable = true
			f.Readable = true
		})
	}
}

type CustomizeTable struct{}

func (CustomizeTable) TableName() string {
	return "customize"
}

func TestCustomizeTableName(t *testing.T) {
	customize, err := schema.Parse(&CustomizeTable{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatalf("failed to parse pointer user, got error %v", err)
	}

	if customize.Table != "customize" {
		t.Errorf("Failed to customize table with TableName method")
	}
}

func TestNestedModel(t *testing.T) {
	versionUser, err := schema.Parse(&VersionUser{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatalf("failed to parse nested user, got error %v", err)
	}

	fields := []schema.Field{
		{Name: "ID", DBName: "id", BindNames: []string{"VersionModel", "BaseModel", "ID"}, DataType: schema.Uint, PrimaryKey: true, Size: 64, HasDefaultValue: true, AutoIncrement: true},
		{Name: "CreatedBy", DBName: "created_by", BindNames: []string{"VersionModel", "BaseModel", "CreatedBy"}, DataType: schema.Uint, Size: 64},
		{Name: "Version", DBName: "version", BindNames: []string{"VersionModel", "Version"}, DataType: schema.Int, Size: 64},
	}

	for _, f := range fields {
		checkSchemaField(t, versionUser, &f, func(f *schema.Field) {
			f.Creatable = true
			f.Updatable = true
			f.Readable = true
		})
	}
}

func TestEmbeddedStruct(t *testing.T) {
	type CorpBase struct {
		gorm.Model
		OwnerID string
	}

	type Company struct {
		ID      int
		OwnerID int
		Name    string
		Ignored string `gorm:"-"`
	}

	type Corp struct {
		CorpBase
		Base Company `gorm:"embedded;embeddedPrefix:company_"`
	}

	cropSchema, err := schema.Parse(&Corp{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatalf("failed to parse embedded struct with primary key, got error %v", err)
	}

	fields := []schema.Field{
		{Name: "ID", DBName: "id", BindNames: []string{"CorpBase", "Model", "ID"}, DataType: schema.Uint, PrimaryKey: true, Size: 64, HasDefaultValue: true, AutoIncrement: true, TagSettings: map[string]string{"PRIMARYKEY": "PRIMARYKEY"}},
		{Name: "ID", DBName: "company_id", BindNames: []string{"Base", "ID"}, DataType: schema.Int, Size: 64, TagSettings: map[string]string{"EMBEDDED": "EMBEDDED", "EMBEDDEDPREFIX": "company_"}},
		{Name: "Name", DBName: "company_name", BindNames: []string{"Base", "Name"}, DataType: schema.String, TagSettings: map[string]string{"EMBEDDED": "EMBEDDED", "EMBEDDEDPREFIX": "company_"}},
		{Name: "Ignored", BindNames: []string{"Base", "Ignored"}, TagSettings: map[string]string{"-": "-", "EMBEDDED": "EMBEDDED", "EMBEDDEDPREFIX": "company_"}},
		{Name: "OwnerID", DBName: "company_owner_id", BindNames: []string{"Base", "OwnerID"}, DataType: schema.Int, Size: 64, TagSettings: map[string]string{"EMBEDDED": "EMBEDDED", "EMBEDDEDPREFIX": "company_"}},
		{Name: "OwnerID", DBName: "owner_id", BindNames: []string{"CorpBase", "OwnerID"}, DataType: schema.String},
	}

	for _, f := range fields {
		checkSchemaField(t, cropSchema, &f, func(f *schema.Field) {
			if f.Name != "Ignored" {
				f.Creatable = true
				f.Updatable = true
				f.Readable = true
			}
		})
	}
}

type CustomizedNamingStrategy struct {
	schema.NamingStrategy
}

func (ns CustomizedNamingStrategy) ColumnName(table, column string) string {
	baseColumnName := ns.NamingStrategy.ColumnName(table, column)

	if table == "" {
		return baseColumnName
	}

	s := strings.Split(table, "_")

	var prefix string
	switch len(s) {
	case 1:
		prefix = s[0][:3]
	case 2:
		prefix = s[0][:1] + s[1][:2]
	default:
		prefix = s[0][:1] + s[1][:1] + s[2][:1]
	}
	return prefix + "_" + baseColumnName
}

func TestEmbeddedStructForCustomizedNamingStrategy(t *testing.T) {
	type CorpBase struct {
		gorm.Model
		OwnerID string
	}

	type Company struct {
		ID      int
		OwnerID int
		Name    string
		Ignored string `gorm:"-"`
	}

	type Corp struct {
		CorpBase
		Base Company `gorm:"embedded;embeddedPrefix:company_"`
	}

	cropSchema, err := schema.Parse(&Corp{}, &sync.Map{}, CustomizedNamingStrategy{schema.NamingStrategy{}})
	if err != nil {
		t.Fatalf("failed to parse embedded struct with primary key, got error %v", err)
	}

	fields := []schema.Field{
		{Name: "ID", DBName: "cor_id", BindNames: []string{"CorpBase", "Model", "ID"}, DataType: schema.Uint, PrimaryKey: true, Size: 64, HasDefaultValue: true, AutoIncrement: true, TagSettings: map[string]string{"PRIMARYKEY": "PRIMARYKEY"}},
		{Name: "ID", DBName: "company_cor_id", BindNames: []string{"Base", "ID"}, DataType: schema.Int, Size: 64, TagSettings: map[string]string{"EMBEDDED": "EMBEDDED", "EMBEDDEDPREFIX": "company_"}},
		{Name: "Name", DBName: "company_cor_name", BindNames: []string{"Base", "Name"}, DataType: schema.String, TagSettings: map[string]string{"EMBEDDED": "EMBEDDED", "EMBEDDEDPREFIX": "company_"}},
		{Name: "Ignored", BindNames: []string{"Base", "Ignored"}, TagSettings: map[string]string{"-": "-", "EMBEDDED": "EMBEDDED", "EMBEDDEDPREFIX": "company_"}},
		{Name: "OwnerID", DBName: "company_cor_owner_id", BindNames: []string{"Base", "OwnerID"}, DataType: schema.Int, Size: 64, TagSettings: map[string]string{"EMBEDDED": "EMBEDDED", "EMBEDDEDPREFIX": "company_"}},
		{Name: "OwnerID", DBName: "cor_owner_id", BindNames: []string{"CorpBase", "OwnerID"}, DataType: schema.String},
	}

	for _, f := range fields {
		checkSchemaField(t, cropSchema, &f, func(f *schema.Field) {
			if f.Name != "Ignored" {
				f.Creatable = true
				f.Updatable = true
				f.Readable = true
			}
		})
	}
}

func TestCompositePrimaryKeyWithAutoIncrement(t *testing.T) {
	type Product struct {
		ProductID    uint `gorm:"primaryKey;autoIncrement"`
		LanguageCode uint `gorm:"primaryKey"`
		Code         string
		Name         string
	}
	type ProductNonAutoIncrement struct {
		ProductID    uint `gorm:"primaryKey;autoIncrement:false"`
		LanguageCode uint `gorm:"primaryKey"`
		Code         string
		Name         string
	}

	product, err := schema.Parse(&Product{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatalf("failed to parse product struct with composite primary key, got error %v", err)
	}

	prioritizedPrimaryField := schema.Field{
		Name: "ProductID", DBName: "product_id", BindNames: []string{"ProductID"}, DataType: schema.Uint, PrimaryKey: true, Size: 64, HasDefaultValue: true, AutoIncrement: true, TagSettings: map[string]string{"PRIMARYKEY": "PRIMARYKEY", "AUTOINCREMENT": "AUTOINCREMENT"},
	}

	product.Fields = []*schema.Field{product.PrioritizedPrimaryField}

	checkSchemaField(t, product, &prioritizedPrimaryField, func(f *schema.Field) {
		f.Creatable = true
		f.Updatable = true
		f.Readable = true
	})

	productNonAutoIncrement, err := schema.Parse(&ProductNonAutoIncrement{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatalf("failed to parse productNonAutoIncrement struct with composite primary key, got error %v", err)
	}

	if productNonAutoIncrement.PrioritizedPrimaryField != nil {
		t.Fatalf("PrioritizedPrimaryField of non autoincrement composite key should be nil")
	}
}
