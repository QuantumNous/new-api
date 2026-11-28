package schema_test

import (
	"context"
	"database/sql"
	"reflect"
	"sync"
	"testing"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/schema"
	"gorm.io/gorm/utils/tests"
)

func TestFieldValuerAndSetter(t *testing.T) {
	var (
		userSchema, _ = schema.Parse(&tests.User{}, &sync.Map{}, schema.NamingStrategy{})
		user          = tests.User{
			Model: gorm.Model{
				ID:        10,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
				DeletedAt: gorm.DeletedAt{Time: time.Now(), Valid: true},
			},
			Name:     "valuer_and_setter",
			Age:      18,
			Birthday: tests.Now(),
			Active:   true,
		}
		reflectValue = reflect.ValueOf(&user)
	)

	// test valuer
	values := map[string]interface{}{
		"name":       user.Name,
		"id":         user.ID,
		"created_at": user.CreatedAt,
		"updated_at": user.UpdatedAt,
		"deleted_at": user.DeletedAt,
		"age":        user.Age,
		"birthday":   user.Birthday,
		"active":     true,
	}
	checkField(t, userSchema, reflectValue, values)

	var f *bool
	// test setter
	newValues := map[string]interface{}{
		"name":       "valuer_and_setter_2",
		"id":         2,
		"created_at": time.Now(),
		"updated_at": nil,
		"deleted_at": time.Now(),
		"age":        20,
		"birthday":   time.Now(),
		"active":     f,
	}

	for k, v := range newValues {
		if err := userSchema.FieldsByDBName[k].Set(context.Background(), reflectValue, v); err != nil {
			t.Errorf("no error should happen when assign value to field %v, but got %v", k, err)
		}
	}
	newValues["updated_at"] = time.Time{}
	newValues["active"] = false
	checkField(t, userSchema, reflectValue, newValues)

	// test valuer and other type
	age := myint(10)
	var nilTime *time.Time
	newValues2 := map[string]interface{}{
		"name":       sql.NullString{String: "valuer_and_setter_3", Valid: true},
		"id":         &sql.NullInt64{Int64: 3, Valid: true},
		"created_at": tests.Now(),
		"updated_at": nilTime,
		"deleted_at": time.Now(),
		"age":        &age,
		"birthday":   mytime(time.Now()),
		"active":     mybool(true),
	}

	for k, v := range newValues2 {
		if err := userSchema.FieldsByDBName[k].Set(context.Background(), reflectValue, v); err != nil {
			t.Errorf("no error should happen when assign value to field %v, but got %v", k, err)
		}
	}
	newValues2["updated_at"] = time.Time{}
	checkField(t, userSchema, reflectValue, newValues2)
}

func TestPointerFieldValuerAndSetter(t *testing.T) {
	var (
		userSchema, _      = schema.Parse(&User{}, &sync.Map{}, schema.NamingStrategy{})
		name               = "pointer_field_valuer_and_setter"
		age           uint = 18
		active             = true
		user               = User{
			Model: &gorm.Model{
				ID:        10,
				CreatedAt: time.Now(),
				DeletedAt: gorm.DeletedAt{Time: time.Now(), Valid: true},
			},
			Name:     &name,
			Age:      &age,
			Birthday: tests.Now(),
			Active:   &active,
		}
		reflectValue = reflect.ValueOf(&user)
	)

	// test valuer
	values := map[string]interface{}{
		"name":       user.Name,
		"id":         user.ID,
		"created_at": user.CreatedAt,
		"deleted_at": user.DeletedAt,
		"age":        user.Age,
		"birthday":   user.Birthday,
		"active":     true,
	}
	checkField(t, userSchema, reflectValue, values)

	// test setter
	newValues := map[string]interface{}{
		"name":       "valuer_and_setter_2",
		"id":         2,
		"created_at": time.Now(),
		"deleted_at": time.Now(),
		"age":        20,
		"birthday":   time.Now(),
		"active":     false,
	}

	for k, v := range newValues {
		if err := userSchema.FieldsByDBName[k].Set(context.Background(), reflectValue, v); err != nil {
			t.Errorf("no error should happen when assign value to field %v, but got %v", k, err)
		}
	}
	checkField(t, userSchema, reflectValue, newValues)

	// test valuer and other type
	age2 := myint(10)
	newValues2 := map[string]interface{}{
		"name":       sql.NullString{String: "valuer_and_setter_3", Valid: true},
		"id":         &sql.NullInt64{Int64: 3, Valid: true},
		"created_at": tests.Now(),
		"deleted_at": time.Now(),
		"age":        &age2,
		"birthday":   mytime(time.Now()),
		"active":     mybool(true),
	}

	for k, v := range newValues2 {
		if err := userSchema.FieldsByDBName[k].Set(context.Background(), reflectValue, v); err != nil {
			t.Errorf("no error should happen when assign value to field %v, but got %v", k, err)
		}
	}
	checkField(t, userSchema, reflectValue, newValues2)
}

func TestAdvancedDataTypeValuerAndSetter(t *testing.T) {
	var (
		userSchema, _ = schema.Parse(&AdvancedDataTypeUser{}, &sync.Map{}, schema.NamingStrategy{})
		name          = "advanced_data_type_valuer_and_setter"
		deletedAt     = mytime(time.Now())
		isAdmin       = mybool(false)
		user          = AdvancedDataTypeUser{
			ID:           sql.NullInt64{Int64: 10, Valid: true},
			Name:         &sql.NullString{String: name, Valid: true},
			Birthday:     sql.NullTime{Time: time.Now(), Valid: true},
			RegisteredAt: mytime(time.Now()),
			DeletedAt:    &deletedAt,
			Active:       mybool(true),
			Admin:        &isAdmin,
		}
		reflectValue = reflect.ValueOf(&user)
	)

	// test valuer
	values := map[string]interface{}{
		"id":            user.ID,
		"name":          user.Name,
		"birthday":      user.Birthday,
		"registered_at": user.RegisteredAt,
		"deleted_at":    user.DeletedAt,
		"active":        user.Active,
		"admin":         user.Admin,
	}
	checkField(t, userSchema, reflectValue, values)

	// test setter
	newDeletedAt := mytime(time.Now())
	newIsAdmin := mybool(true)
	newValues := map[string]interface{}{
		"id":            sql.NullInt64{Int64: 1, Valid: true},
		"name":          &sql.NullString{String: name + "rename", Valid: true},
		"birthday":      time.Now(),
		"registered_at": mytime(time.Now()),
		"deleted_at":    &newDeletedAt,
		"active":        mybool(false),
		"admin":         &newIsAdmin,
	}

	for k, v := range newValues {
		if err := userSchema.FieldsByDBName[k].Set(context.Background(), reflectValue, v); err != nil {
			t.Errorf("no error should happen when assign value to field %v, but got %v", k, err)
		}
	}
	checkField(t, userSchema, reflectValue, newValues)

	newValues2 := map[string]interface{}{
		"id":            5,
		"name":          name + "rename2",
		"birthday":      time.Now(),
		"registered_at": time.Now(),
		"deleted_at":    time.Now(),
		"active":        true,
		"admin":         false,
	}

	for k, v := range newValues2 {
		if err := userSchema.FieldsByDBName[k].Set(context.Background(), reflectValue, v); err != nil {
			t.Errorf("no error should happen when assign value to field %v, but got %v", k, err)
		}
	}
	checkField(t, userSchema, reflectValue, newValues2)
}

type UserWithPermissionControl struct {
	ID    uint
	Name  string `gorm:"-"`
	Name2 string `gorm:"->"`
	Name3 string `gorm:"<-"`
	Name4 string `gorm:"<-:create"`
	Name5 string `gorm:"<-:update"`
	Name6 string `gorm:"<-:create,update"`
	Name7 string `gorm:"->:false;<-:create,update"`
	Name8 string `gorm:"->;-:migration"`
}

func TestParseFieldWithPermission(t *testing.T) {
	user, err := schema.Parse(&UserWithPermissionControl{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatalf("Failed to parse user with permission, got error %v", err)
	}

	fields := []*schema.Field{
		{Name: "ID", DBName: "id", BindNames: []string{"ID"}, DataType: schema.Uint, PrimaryKey: true, Size: 64, Creatable: true, Updatable: true, Readable: true, HasDefaultValue: true, AutoIncrement: true},
		{Name: "Name", DBName: "", BindNames: []string{"Name"}, DataType: "", Tag: `gorm:"-"`, Creatable: false, Updatable: false, Readable: false},
		{Name: "Name2", DBName: "name2", BindNames: []string{"Name2"}, DataType: schema.String, Tag: `gorm:"->"`, Creatable: false, Updatable: false, Readable: true},
		{Name: "Name3", DBName: "name3", BindNames: []string{"Name3"}, DataType: schema.String, Tag: `gorm:"<-"`, Creatable: true, Updatable: true, Readable: true},
		{Name: "Name4", DBName: "name4", BindNames: []string{"Name4"}, DataType: schema.String, Tag: `gorm:"<-:create"`, Creatable: true, Updatable: false, Readable: true},
		{Name: "Name5", DBName: "name5", BindNames: []string{"Name5"}, DataType: schema.String, Tag: `gorm:"<-:update"`, Creatable: false, Updatable: true, Readable: true},
		{Name: "Name6", DBName: "name6", BindNames: []string{"Name6"}, DataType: schema.String, Tag: `gorm:"<-:create,update"`, Creatable: true, Updatable: true, Readable: true},
		{Name: "Name7", DBName: "name7", BindNames: []string{"Name7"}, DataType: schema.String, Tag: `gorm:"->:false;<-:create,update"`, Creatable: true, Updatable: true, Readable: false},
		{Name: "Name8", DBName: "name8", BindNames: []string{"Name8"}, DataType: schema.String, Tag: `gorm:"->;-:migration"`, Creatable: false, Updatable: false, Readable: true, IgnoreMigration: true},
	}

	for _, f := range fields {
		checkSchemaField(t, user, f, func(f *schema.Field) {})
	}
}

type (
	ID      int64
	INT     int
	INT8    int8
	INT16   int16
	INT32   int32
	INT64   int64
	UINT    uint
	UINT8   uint8
	UINT16  uint16
	UINT32  uint32
	UINT64  uint64
	FLOAT32 float32
	FLOAT64 float64
	BOOL    bool
	STRING  string
	TIME    time.Time
	BYTES   []byte

	TypeAlias struct {
		ID
		INT     `gorm:"column:fint"`
		INT8    `gorm:"column:fint8"`
		INT16   `gorm:"column:fint16"`
		INT32   `gorm:"column:fint32"`
		INT64   `gorm:"column:fint64"`
		UINT    `gorm:"column:fuint"`
		UINT8   `gorm:"column:fuint8"`
		UINT16  `gorm:"column:fuint16"`
		UINT32  `gorm:"column:fuint32"`
		UINT64  `gorm:"column:fuint64"`
		FLOAT32 `gorm:"column:ffloat32"`
		FLOAT64 `gorm:"column:ffloat64"`
		BOOL    `gorm:"column:fbool"`
		STRING  `gorm:"column:fstring"`
		TIME    `gorm:"column:ftime"`
		BYTES   `gorm:"column:fbytes"`
	}
)

func TestTypeAliasField(t *testing.T) {
	alias, err := schema.Parse(&TypeAlias{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatalf("Failed to parse TypeAlias with permission, got error %v", err)
	}

	fields := []*schema.Field{
		{Name: "ID", DBName: "id", BindNames: []string{"ID"}, DataType: schema.Int, Creatable: true, Updatable: true, Readable: true, Size: 64, PrimaryKey: true, HasDefaultValue: true, AutoIncrement: true},
		{Name: "INT", DBName: "fint", BindNames: []string{"INT"}, DataType: schema.Int, Creatable: true, Updatable: true, Readable: true, Size: 64, Tag: `gorm:"column:fint"`},
		{Name: "INT8", DBName: "fint8", BindNames: []string{"INT8"}, DataType: schema.Int, Creatable: true, Updatable: true, Readable: true, Size: 8, Tag: `gorm:"column:fint8"`},
		{Name: "INT16", DBName: "fint16", BindNames: []string{"INT16"}, DataType: schema.Int, Creatable: true, Updatable: true, Readable: true, Size: 16, Tag: `gorm:"column:fint16"`},
		{Name: "INT32", DBName: "fint32", BindNames: []string{"INT32"}, DataType: schema.Int, Creatable: true, Updatable: true, Readable: true, Size: 32, Tag: `gorm:"column:fint32"`},
		{Name: "INT64", DBName: "fint64", BindNames: []string{"INT64"}, DataType: schema.Int, Creatable: true, Updatable: true, Readable: true, Size: 64, Tag: `gorm:"column:fint64"`},
		{Name: "UINT", DBName: "fuint", BindNames: []string{"UINT"}, DataType: schema.Uint, Creatable: true, Updatable: true, Readable: true, Size: 64, Tag: `gorm:"column:fuint"`},
		{Name: "UINT8", DBName: "fuint8", BindNames: []string{"UINT8"}, DataType: schema.Uint, Creatable: true, Updatable: true, Readable: true, Size: 8, Tag: `gorm:"column:fuint8"`},
		{Name: "UINT16", DBName: "fuint16", BindNames: []string{"UINT16"}, DataType: schema.Uint, Creatable: true, Updatable: true, Readable: true, Size: 16, Tag: `gorm:"column:fuint16"`},
		{Name: "UINT32", DBName: "fuint32", BindNames: []string{"UINT32"}, DataType: schema.Uint, Creatable: true, Updatable: true, Readable: true, Size: 32, Tag: `gorm:"column:fuint32"`},
		{Name: "UINT64", DBName: "fuint64", BindNames: []string{"UINT64"}, DataType: schema.Uint, Creatable: true, Updatable: true, Readable: true, Size: 64, Tag: `gorm:"column:fuint64"`},
		{Name: "FLOAT32", DBName: "ffloat32", BindNames: []string{"FLOAT32"}, DataType: schema.Float, Creatable: true, Updatable: true, Readable: true, Size: 32, Tag: `gorm:"column:ffloat32"`},
		{Name: "FLOAT64", DBName: "ffloat64", BindNames: []string{"FLOAT64"}, DataType: schema.Float, Creatable: true, Updatable: true, Readable: true, Size: 64, Tag: `gorm:"column:ffloat64"`},
		{Name: "BOOL", DBName: "fbool", BindNames: []string{"BOOL"}, DataType: schema.Bool, Creatable: true, Updatable: true, Readable: true, Tag: `gorm:"column:fbool"`},
		{Name: "STRING", DBName: "fstring", BindNames: []string{"STRING"}, DataType: schema.String, Creatable: true, Updatable: true, Readable: true, Tag: `gorm:"column:fstring"`},
		{Name: "TIME", DBName: "ftime", BindNames: []string{"TIME"}, DataType: schema.Time, Creatable: true, Updatable: true, Readable: true, Tag: `gorm:"column:ftime"`},
		{Name: "BYTES", DBName: "fbytes", BindNames: []string{"BYTES"}, DataType: schema.Bytes, Creatable: true, Updatable: true, Readable: true, Tag: `gorm:"column:fbytes"`},
	}

	for _, f := range fields {
		checkSchemaField(t, alias, f, func(f *schema.Field) {})
	}
}
