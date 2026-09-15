package schema

import (
	"context"
	"errors"
	"fmt"
	"go/ast"
	"reflect"
	"strings"
	"sync"

	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

// ErrUnsupportedDataType unsupported data type
var ErrUnsupportedDataType = errors.New("unsupported data type")

type Schema struct {
	Name                      string
	ModelType                 reflect.Type
	Table                     string
	PrioritizedPrimaryField   *Field
	DBNames                   []string
	PrimaryFields             []*Field
	PrimaryFieldDBNames       []string
	Fields                    []*Field
	FieldsByName              map[string]*Field
	FieldsByBindName          map[string]*Field // embedded fields is 'Embed.Field'
	FieldsByDBName            map[string]*Field
	FieldsWithDefaultDBValue  []*Field // fields with default value assigned by database
	Relationships             Relationships
	CreateClauses             []clause.Interface
	QueryClauses              []clause.Interface
	UpdateClauses             []clause.Interface
	DeleteClauses             []clause.Interface
	BeforeCreate, AfterCreate bool
	BeforeUpdate, AfterUpdate bool
	BeforeDelete, AfterDelete bool
	BeforeSave, AfterSave     bool
	AfterFind                 bool
	err                       error
	initialized               chan struct{}
	namer                     Namer
	cacheStore                *sync.Map
}

func (schema Schema) String() string {
	if schema.ModelType.Name() == "" {
		return fmt.Sprintf("%s(%s)", schema.Name, schema.Table)
	}
	return fmt.Sprintf("%s.%s", schema.ModelType.PkgPath(), schema.ModelType.Name())
}

func (schema Schema) MakeSlice() reflect.Value {
	slice := reflect.MakeSlice(reflect.SliceOf(reflect.PtrTo(schema.ModelType)), 0, 20)
	results := reflect.New(slice.Type())
	results.Elem().Set(slice)
	return results
}

func (schema Schema) LookUpField(name string) *Field {
	if field, ok := schema.FieldsByDBName[name]; ok {
		return field
	}
	if field, ok := schema.FieldsByName[name]; ok {
		return field
	}
	return nil
}

// LookUpFieldByBindName looks for the closest field in the embedded struct.
//
//	type Struct struct {
//		Embedded struct {
//			ID string // is selected by LookUpFieldByBindName([]string{"Embedded", "ID"}, "ID")
//		}
//		ID string // is selected by LookUpFieldByBindName([]string{"ID"}, "ID")
//	}
func (schema Schema) LookUpFieldByBindName(bindNames []string, name string) *Field {
	if len(bindNames) == 0 {
		return nil
	}
	for i := len(bindNames) - 1; i >= 0; i-- {
		find := strings.Join(bindNames[:i], ".") + "." + name
		if field, ok := schema.FieldsByBindName[find]; ok {
			return field
		}
	}
	return nil
}

type Tabler interface {
	TableName() string
}

type TablerWithNamer interface {
	TableName(Namer) string
}

// Parse get data type from dialector
func Parse(dest interface{}, cacheStore *sync.Map, namer Namer) (*Schema, error) {
	return ParseWithSpecialTableName(dest, cacheStore, namer, "")
}

// ParseWithSpecialTableName get data type from dialector with extra schema table
func ParseWithSpecialTableName(dest interface{}, cacheStore *sync.Map, namer Namer, specialTableName string) (*Schema, error) {
	if dest == nil {
		return nil, fmt.Errorf("%w: %+v", ErrUnsupportedDataType, dest)
	}

	value := reflect.ValueOf(dest)
	if value.Kind() == reflect.Ptr && value.IsNil() {
		value = reflect.New(value.Type().Elem())
	}
	modelType := reflect.Indirect(value).Type()

	if modelType.Kind() == reflect.Interface {
		modelType = reflect.Indirect(reflect.ValueOf(dest)).Elem().Type()
	}

	for modelType.Kind() == reflect.Slice || modelType.Kind() == reflect.Array || modelType.Kind() == reflect.Ptr {
		modelType = modelType.Elem()
	}

	if modelType.Kind() != reflect.Struct {
		if modelType.PkgPath() == "" {
			return nil, fmt.Errorf("%w: %+v", ErrUnsupportedDataType, dest)
		}
		return nil, fmt.Errorf("%w: %s.%s", ErrUnsupportedDataType, modelType.PkgPath(), modelType.Name())
	}

	// Cache the Schema for performance,
	// Use the modelType or modelType + schemaTable (if it present) as cache key.
	var schemaCacheKey interface{}
	if specialTableName != "" {
		schemaCacheKey = fmt.Sprintf("%p-%s", modelType, specialTableName)
	} else {
		schemaCacheKey = modelType
	}

	// Load exist schema cache, return if exists
	if v, ok := cacheStore.Load(schemaCacheKey); ok {
		s := v.(*Schema)
		// Wait for the initialization of other goroutines to complete
		<-s.initialized
		return s, s.err
	}

	modelValue := reflect.New(modelType)
	tableName := namer.TableName(modelType.Name())
	if tabler, ok := modelValue.Interface().(Tabler); ok {
		tableName = tabler.TableName()
	}
	if tabler, ok := modelValue.Interface().(TablerWithNamer); ok {
		tableName = tabler.TableName(namer)
	}
	if en, ok := namer.(embeddedNamer); ok {
		tableName = en.Table
	}
	if specialTableName != "" && specialTableName != tableName {
		tableName = specialTableName
	}

	schema := &Schema{
		Name:             modelType.Name(),
		ModelType:        modelType,
		Table:            tableName,
		FieldsByName:     map[string]*Field{},
		FieldsByBindName: map[string]*Field{},
		FieldsByDBName:   map[string]*Field{},
		Relationships:    Relationships{Relations: map[string]*Relationship{}},
		cacheStore:       cacheStore,
		namer:            namer,
		initialized:      make(chan struct{}),
	}
	// When the schema initialization is completed, the channel will be closed
	defer close(schema.initialized)

	// Load exist schema cache, return if exists
	if v, ok := cacheStore.Load(schemaCacheKey); ok {
		s := v.(*Schema)
		// Wait for the initialization of other goroutines to complete
		<-s.initialized
		return s, s.err
	}

	for i := 0; i < modelType.NumField(); i++ {
		if fieldStruct := modelType.Field(i); ast.IsExported(fieldStruct.Name) {
			if field := schema.ParseField(fieldStruct); field.EmbeddedSchema != nil {
				schema.Fields = append(schema.Fields, field.EmbeddedSchema.Fields...)
			} else {
				schema.Fields = append(schema.Fields, field)
			}
		}
	}

	for _, field := range schema.Fields {
		if field.DBName == "" && field.DataType != "" {
			field.DBName = namer.ColumnName(schema.Table, field.Name)
		}

		bindName := field.BindName()
		if field.DBName != "" {
			// nonexistence or shortest path or first appear prioritized if has permission
			if v, ok := schema.FieldsByDBName[field.DBName]; !ok || ((field.Creatable || field.Updatable || field.Readable) && len(field.BindNames) < len(v.BindNames)) {
				if _, ok := schema.FieldsByDBName[field.DBName]; !ok {
					schema.DBNames = append(schema.DBNames, field.DBName)
				}
				schema.FieldsByDBName[field.DBName] = field
				schema.FieldsByName[field.Name] = field
				schema.FieldsByBindName[bindName] = field

				if v != nil && v.PrimaryKey {
					for idx, f := range schema.PrimaryFields {
						if f == v {
							schema.PrimaryFields = append(schema.PrimaryFields[0:idx], schema.PrimaryFields[idx+1:]...)
						}
					}
				}

				if field.PrimaryKey {
					schema.PrimaryFields = append(schema.PrimaryFields, field)
				}
			}
		}

		if of, ok := schema.FieldsByName[field.Name]; !ok || of.TagSettings["-"] == "-" {
			schema.FieldsByName[field.Name] = field
		}
		if of, ok := schema.FieldsByBindName[bindName]; !ok || of.TagSettings["-"] == "-" {
			schema.FieldsByBindName[bindName] = field
		}

		field.setupValuerAndSetter()
	}

	prioritizedPrimaryField := schema.LookUpField("id")
	if prioritizedPrimaryField == nil {
		prioritizedPrimaryField = schema.LookUpField("ID")
	}

	if prioritizedPrimaryField != nil {
		if prioritizedPrimaryField.PrimaryKey {
			schema.PrioritizedPrimaryField = prioritizedPrimaryField
		} else if len(schema.PrimaryFields) == 0 {
			prioritizedPrimaryField.PrimaryKey = true
			schema.PrioritizedPrimaryField = prioritizedPrimaryField
			schema.PrimaryFields = append(schema.PrimaryFields, prioritizedPrimaryField)
		}
	}

	if schema.PrioritizedPrimaryField == nil {
		if len(schema.PrimaryFields) == 1 {
			schema.PrioritizedPrimaryField = schema.PrimaryFields[0]
		} else if len(schema.PrimaryFields) > 1 {
			// If there are multiple primary keys, the AUTOINCREMENT field is prioritized
			for _, field := range schema.PrimaryFields {
				if field.AutoIncrement {
					schema.PrioritizedPrimaryField = field
					break
				}
			}
		}
	}

	for _, field := range schema.PrimaryFields {
		schema.PrimaryFieldDBNames = append(schema.PrimaryFieldDBNames, field.DBName)
	}

	for _, field := range schema.Fields {
		if field.DataType != "" && field.HasDefaultValue && field.DefaultValueInterface == nil {
			schema.FieldsWithDefaultDBValue = append(schema.FieldsWithDefaultDBValue, field)
		}
	}

	if field := schema.PrioritizedPrimaryField; field != nil {
		switch field.GORMDataType {
		case Int, Uint:
			if _, ok := field.TagSettings["AUTOINCREMENT"]; !ok {
				if !field.HasDefaultValue || field.DefaultValueInterface != nil {
					schema.FieldsWithDefaultDBValue = append(schema.FieldsWithDefaultDBValue, field)
				}

				field.HasDefaultValue = true
				field.AutoIncrement = true
			}
		}
	}

	callbacks := []string{"BeforeCreate", "AfterCreate", "BeforeUpdate", "AfterUpdate", "BeforeSave", "AfterSave", "BeforeDelete", "AfterDelete", "AfterFind"}
	for _, name := range callbacks {
		if methodValue := modelValue.MethodByName(name); methodValue.IsValid() {
			switch methodValue.Type().String() {
			case "func(*gorm.DB) error": // TODO hack
				reflect.Indirect(reflect.ValueOf(schema)).FieldByName(name).SetBool(true)
			default:
				logger.Default.Warn(context.Background(), "Model %v don't match %vInterface, should be `%v(*gorm.DB) error`. Please see https://gorm.io/docs/hooks.html", schema, name, name)
			}
		}
	}

	// Cache the schema
	if v, loaded := cacheStore.LoadOrStore(schemaCacheKey, schema); loaded {
		s := v.(*Schema)
		// Wait for the initialization of other goroutines to complete
		<-s.initialized
		return s, s.err
	}

	defer func() {
		if schema.err != nil {
			logger.Default.Error(context.Background(), schema.err.Error())
			cacheStore.Delete(modelType)
		}
	}()

	if _, embedded := schema.cacheStore.Load(embeddedCacheKey); !embedded {
		for _, field := range schema.Fields {
			if field.DataType == "" && (field.Creatable || field.Updatable || field.Readable) {
				if schema.parseRelation(field); schema.err != nil {
					return schema, schema.err
				} else {
					schema.FieldsByName[field.Name] = field
					schema.FieldsByBindName[field.BindName()] = field
				}
			}

			fieldValue := reflect.New(field.IndirectFieldType)
			fieldInterface := fieldValue.Interface()
			if fc, ok := fieldInterface.(CreateClausesInterface); ok {
				field.Schema.CreateClauses = append(field.Schema.CreateClauses, fc.CreateClauses(field)...)
			}

			if fc, ok := fieldInterface.(QueryClausesInterface); ok {
				field.Schema.QueryClauses = append(field.Schema.QueryClauses, fc.QueryClauses(field)...)
			}

			if fc, ok := fieldInterface.(UpdateClausesInterface); ok {
				field.Schema.UpdateClauses = append(field.Schema.UpdateClauses, fc.UpdateClauses(field)...)
			}

			if fc, ok := fieldInterface.(DeleteClausesInterface); ok {
				field.Schema.DeleteClauses = append(field.Schema.DeleteClauses, fc.DeleteClauses(field)...)
			}
		}
	}

	return schema, schema.err
}

func getOrParse(dest interface{}, cacheStore *sync.Map, namer Namer) (*Schema, error) {
	modelType := reflect.ValueOf(dest).Type()
	for modelType.Kind() == reflect.Slice || modelType.Kind() == reflect.Array || modelType.Kind() == reflect.Ptr {
		modelType = modelType.Elem()
	}

	if modelType.Kind() != reflect.Struct {
		if modelType.PkgPath() == "" {
			return nil, fmt.Errorf("%w: %+v", ErrUnsupportedDataType, dest)
		}
		return nil, fmt.Errorf("%w: %s.%s", ErrUnsupportedDataType, modelType.PkgPath(), modelType.Name())
	}

	if v, ok := cacheStore.Load(modelType); ok {
		return v.(*Schema), nil
	}

	return Parse(dest, cacheStore, namer)
}
