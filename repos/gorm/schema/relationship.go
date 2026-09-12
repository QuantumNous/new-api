package schema

import (
	"context"
	"fmt"
	"reflect"
	"strings"

	"github.com/jinzhu/inflection"
	"gorm.io/gorm/clause"
)

// RelationshipType relationship type
type RelationshipType string

const (
	HasOne    RelationshipType = "has_one"      // HasOneRel has one relationship
	HasMany   RelationshipType = "has_many"     // HasManyRel has many relationship
	BelongsTo RelationshipType = "belongs_to"   // BelongsToRel belongs to relationship
	Many2Many RelationshipType = "many_to_many" // Many2ManyRel many to many relationship
	has       RelationshipType = "has"
)

type Relationships struct {
	HasOne    []*Relationship
	BelongsTo []*Relationship
	HasMany   []*Relationship
	Many2Many []*Relationship
	Relations map[string]*Relationship

	EmbeddedRelations map[string]*Relationships
}

type Relationship struct {
	Name                     string
	Type                     RelationshipType
	Field                    *Field
	Polymorphic              *Polymorphic
	References               []*Reference
	Schema                   *Schema
	FieldSchema              *Schema
	JoinTable                *Schema
	foreignKeys, primaryKeys []string
}

type Polymorphic struct {
	PolymorphicID   *Field
	PolymorphicType *Field
	Value           string
}

type Reference struct {
	PrimaryKey    *Field
	PrimaryValue  string
	ForeignKey    *Field
	OwnPrimaryKey bool
}

func (schema *Schema) parseRelation(field *Field) *Relationship {
	var (
		err        error
		fieldValue = reflect.New(field.IndirectFieldType).Interface()
		relation   = &Relationship{
			Name:        field.Name,
			Field:       field,
			Schema:      schema,
			foreignKeys: toColumns(field.TagSettings["FOREIGNKEY"]),
			primaryKeys: toColumns(field.TagSettings["REFERENCES"]),
		}
	)

	cacheStore := schema.cacheStore

	if relation.FieldSchema, err = getOrParse(fieldValue, cacheStore, schema.namer); err != nil {
		schema.err = err
		return nil
	}

	if polymorphic := field.TagSettings["POLYMORPHIC"]; polymorphic != "" {
		schema.buildPolymorphicRelation(relation, field, polymorphic)
	} else if many2many := field.TagSettings["MANY2MANY"]; many2many != "" {
		schema.buildMany2ManyRelation(relation, field, many2many)
	} else if belongsTo := field.TagSettings["BELONGSTO"]; belongsTo != "" {
		schema.guessRelation(relation, field, guessBelongs)
	} else {
		switch field.IndirectFieldType.Kind() {
		case reflect.Struct:
			schema.guessRelation(relation, field, guessGuess)
		case reflect.Slice:
			schema.guessRelation(relation, field, guessHas)
		default:
			schema.err = fmt.Errorf("unsupported data type %v for %v on field %s", relation.FieldSchema, schema, field.Name)
		}
	}

	if relation.Type == has {
		// don't add relations to embedded schema, which might be shared
		if relation.FieldSchema != relation.Schema && relation.Polymorphic == nil && field.OwnerSchema == nil {
			relation.FieldSchema.Relationships.Relations["_"+relation.Schema.Name+"_"+relation.Name] = relation
		}

		switch field.IndirectFieldType.Kind() {
		case reflect.Struct:
			relation.Type = HasOne
		case reflect.Slice:
			relation.Type = HasMany
		}
	}

	if schema.err == nil {
		schema.setRelation(relation)
		switch relation.Type {
		case HasOne:
			schema.Relationships.HasOne = append(schema.Relationships.HasOne, relation)
		case HasMany:
			schema.Relationships.HasMany = append(schema.Relationships.HasMany, relation)
		case BelongsTo:
			schema.Relationships.BelongsTo = append(schema.Relationships.BelongsTo, relation)
		case Many2Many:
			schema.Relationships.Many2Many = append(schema.Relationships.Many2Many, relation)
		}
	}

	return relation
}

func (schema *Schema) setRelation(relation *Relationship) {
	// set non-embedded relation
	if rel := schema.Relationships.Relations[relation.Name]; rel != nil {
		if len(rel.Field.BindNames) > 1 {
			schema.Relationships.Relations[relation.Name] = relation
		}
	} else {
		schema.Relationships.Relations[relation.Name] = relation
	}

	// set embedded relation
	if len(relation.Field.BindNames) <= 1 {
		return
	}
	relationships := &schema.Relationships
	for i, name := range relation.Field.BindNames {
		if i < len(relation.Field.BindNames)-1 {
			if relationships.EmbeddedRelations == nil {
				relationships.EmbeddedRelations = map[string]*Relationships{}
			}
			if r := relationships.EmbeddedRelations[name]; r == nil {
				relationships.EmbeddedRelations[name] = &Relationships{}
			}
			relationships = relationships.EmbeddedRelations[name]
		} else {
			if relationships.Relations == nil {
				relationships.Relations = map[string]*Relationship{}
			}
			relationships.Relations[relation.Name] = relation
		}
	}
}

// User has many Toys, its `Polymorphic` is `Owner`, Pet has one Toy, its `Polymorphic` is `Owner`
//
//	type User struct {
//	  Toys []Toy `gorm:"polymorphic:Owner;"`
//	}
//	type Pet struct {
//	  Toy Toy `gorm:"polymorphic:Owner;"`
//	}
//	type Toy struct {
//	  OwnerID   int
//	  OwnerType string
//	}
func (schema *Schema) buildPolymorphicRelation(relation *Relationship, field *Field, polymorphic string) {
	relation.Polymorphic = &Polymorphic{
		Value:           schema.Table,
		PolymorphicType: relation.FieldSchema.FieldsByName[polymorphic+"Type"],
		PolymorphicID:   relation.FieldSchema.FieldsByName[polymorphic+"ID"],
	}

	if value, ok := field.TagSettings["POLYMORPHICVALUE"]; ok {
		relation.Polymorphic.Value = strings.TrimSpace(value)
	}

	if relation.Polymorphic.PolymorphicType == nil {
		schema.err = fmt.Errorf("invalid polymorphic type %v for %v on field %s, missing field %s", relation.FieldSchema, schema, field.Name, polymorphic+"Type")
	}

	if relation.Polymorphic.PolymorphicID == nil {
		schema.err = fmt.Errorf("invalid polymorphic type %v for %v on field %s, missing field %s", relation.FieldSchema, schema, field.Name, polymorphic+"ID")
	}

	if schema.err == nil {
		relation.References = append(relation.References, &Reference{
			PrimaryValue: relation.Polymorphic.Value,
			ForeignKey:   relation.Polymorphic.PolymorphicType,
		})

		primaryKeyField := schema.PrioritizedPrimaryField
		if len(relation.foreignKeys) > 0 {
			if primaryKeyField = schema.LookUpField(relation.foreignKeys[0]); primaryKeyField == nil || len(relation.foreignKeys) > 1 {
				schema.err = fmt.Errorf("invalid polymorphic foreign keys %+v for %v on field %s", relation.foreignKeys, schema, field.Name)
			}
		}

		if primaryKeyField == nil {
			schema.err = fmt.Errorf("invalid polymorphic type %v for %v on field %s, missing primaryKey field", relation.FieldSchema, schema, field.Name)
			return
		}

		// use same data type for foreign keys
		if copyableDataType(primaryKeyField.DataType) {
			relation.Polymorphic.PolymorphicID.DataType = primaryKeyField.DataType
		}
		relation.Polymorphic.PolymorphicID.GORMDataType = primaryKeyField.GORMDataType
		if relation.Polymorphic.PolymorphicID.Size == 0 {
			relation.Polymorphic.PolymorphicID.Size = primaryKeyField.Size
		}

		relation.References = append(relation.References, &Reference{
			PrimaryKey:    primaryKeyField,
			ForeignKey:    relation.Polymorphic.PolymorphicID,
			OwnPrimaryKey: true,
		})
	}

	relation.Type = has
}

func (schema *Schema) buildMany2ManyRelation(relation *Relationship, field *Field, many2many string) {
	relation.Type = Many2Many

	var (
		err             error
		joinTableFields []reflect.StructField
		fieldsMap       = map[string]*Field{}
		ownFieldsMap    = map[string]*Field{} // fix self join many2many
		referFieldsMap  = map[string]*Field{}
		joinForeignKeys = toColumns(field.TagSettings["JOINFOREIGNKEY"])
		joinReferences  = toColumns(field.TagSettings["JOINREFERENCES"])
	)

	ownForeignFields := schema.PrimaryFields
	refForeignFields := relation.FieldSchema.PrimaryFields

	if len(relation.foreignKeys) > 0 {
		ownForeignFields = []*Field{}
		for _, foreignKey := range relation.foreignKeys {
			if field := schema.LookUpField(foreignKey); field != nil {
				ownForeignFields = append(ownForeignFields, field)
			} else {
				schema.err = fmt.Errorf("invalid foreign key: %s", foreignKey)
				return
			}
		}
	}

	if len(relation.primaryKeys) > 0 {
		refForeignFields = []*Field{}
		for _, foreignKey := range relation.primaryKeys {
			if field := relation.FieldSchema.LookUpField(foreignKey); field != nil {
				refForeignFields = append(refForeignFields, field)
			} else {
				schema.err = fmt.Errorf("invalid foreign key: %s", foreignKey)
				return
			}
		}
	}

	for idx, ownField := range ownForeignFields {
		joinFieldName := strings.Title(schema.Name) + ownField.Name
		if len(joinForeignKeys) > idx {
			joinFieldName = strings.Title(joinForeignKeys[idx])
		}

		ownFieldsMap[joinFieldName] = ownField
		fieldsMap[joinFieldName] = ownField
		joinTableFields = append(joinTableFields, reflect.StructField{
			Name:    joinFieldName,
			PkgPath: ownField.StructField.PkgPath,
			Type:    ownField.StructField.Type,
			Tag: removeSettingFromTag(appendSettingFromTag(ownField.StructField.Tag, "primaryKey"),
				"column", "autoincrement", "index", "unique", "uniqueindex"),
		})
	}

	for idx, relField := range refForeignFields {
		joinFieldName := strings.Title(relation.FieldSchema.Name) + relField.Name

		if _, ok := ownFieldsMap[joinFieldName]; ok {
			if field.Name != relation.FieldSchema.Name {
				joinFieldName = inflection.Singular(field.Name) + relField.Name
			} else {
				joinFieldName += "Reference"
			}
		}

		if len(joinReferences) > idx {
			joinFieldName = strings.Title(joinReferences[idx])
		}

		referFieldsMap[joinFieldName] = relField

		if _, ok := fieldsMap[joinFieldName]; !ok {
			fieldsMap[joinFieldName] = relField
			joinTableFields = append(joinTableFields, reflect.StructField{
				Name:    joinFieldName,
				PkgPath: relField.StructField.PkgPath,
				Type:    relField.StructField.Type,
				Tag: removeSettingFromTag(appendSettingFromTag(relField.StructField.Tag, "primaryKey"),
					"column", "autoincrement", "index", "unique", "uniqueindex"),
			})
		}
	}

	joinTableFields = append(joinTableFields, reflect.StructField{
		Name: strings.Title(schema.Name) + field.Name,
		Type: schema.ModelType,
		Tag:  `gorm:"-"`,
	})

	if relation.JoinTable, err = Parse(reflect.New(reflect.StructOf(joinTableFields)).Interface(), schema.cacheStore, schema.namer); err != nil {
		schema.err = err
	}
	relation.JoinTable.Name = many2many
	relation.JoinTable.Table = schema.namer.JoinTableName(many2many)
	relation.JoinTable.PrimaryFields = make([]*Field, 0, len(relation.JoinTable.Fields))

	relName := relation.Schema.Name
	relRefName := relation.FieldSchema.Name
	if relName == relRefName {
		relRefName = relation.Field.Name
	}

	if _, ok := relation.JoinTable.Relationships.Relations[relName]; !ok {
		relation.JoinTable.Relationships.Relations[relName] = &Relationship{
			Name:        relName,
			Type:        BelongsTo,
			Schema:      relation.JoinTable,
			FieldSchema: relation.Schema,
		}
	} else {
		relation.JoinTable.Relationships.Relations[relName].References = []*Reference{}
	}

	if _, ok := relation.JoinTable.Relationships.Relations[relRefName]; !ok {
		relation.JoinTable.Relationships.Relations[relRefName] = &Relationship{
			Name:        relRefName,
			Type:        BelongsTo,
			Schema:      relation.JoinTable,
			FieldSchema: relation.FieldSchema,
		}
	} else {
		relation.JoinTable.Relationships.Relations[relRefName].References = []*Reference{}
	}

	// build references
	for _, f := range relation.JoinTable.Fields {
		if f.Creatable || f.Readable || f.Updatable {
			// use same data type for foreign keys
			if copyableDataType(fieldsMap[f.Name].DataType) {
				f.DataType = fieldsMap[f.Name].DataType
			}
			f.GORMDataType = fieldsMap[f.Name].GORMDataType
			if f.Size == 0 {
				f.Size = fieldsMap[f.Name].Size
			}
			relation.JoinTable.PrimaryFields = append(relation.JoinTable.PrimaryFields, f)

			if of, ok := ownFieldsMap[f.Name]; ok {
				joinRel := relation.JoinTable.Relationships.Relations[relName]
				joinRel.Field = relation.Field
				joinRel.References = append(joinRel.References, &Reference{
					PrimaryKey: of,
					ForeignKey: f,
				})

				relation.References = append(relation.References, &Reference{
					PrimaryKey:    of,
					ForeignKey:    f,
					OwnPrimaryKey: true,
				})
			}

			if rf, ok := referFieldsMap[f.Name]; ok {
				joinRefRel := relation.JoinTable.Relationships.Relations[relRefName]
				if joinRefRel.Field == nil {
					joinRefRel.Field = relation.Field
				}
				joinRefRel.References = append(joinRefRel.References, &Reference{
					PrimaryKey: rf,
					ForeignKey: f,
				})

				relation.References = append(relation.References, &Reference{
					PrimaryKey: rf,
					ForeignKey: f,
				})
			}
		}
	}
}

type guessLevel int

const (
	guessGuess guessLevel = iota
	guessBelongs
	guessEmbeddedBelongs
	guessHas
	guessEmbeddedHas
)

func (schema *Schema) guessRelation(relation *Relationship, field *Field, cgl guessLevel) {
	var (
		primaryFields, foreignFields []*Field
		primarySchema, foreignSchema = schema, relation.FieldSchema
		gl                           = cgl
	)

	if gl == guessGuess {
		if field.Schema == relation.FieldSchema {
			gl = guessBelongs
		} else {
			gl = guessHas
		}
	}

	reguessOrErr := func() {
		switch cgl {
		case guessGuess:
			schema.guessRelation(relation, field, guessBelongs)
		case guessBelongs:
			schema.guessRelation(relation, field, guessEmbeddedBelongs)
		case guessEmbeddedBelongs:
			schema.guessRelation(relation, field, guessHas)
		case guessHas:
			schema.guessRelation(relation, field, guessEmbeddedHas)
		// case guessEmbeddedHas:
		default:
			schema.err = fmt.Errorf("invalid field found for struct %v's field %s: define a valid foreign key for relations or implement the Valuer/Scanner interface", schema, field.Name)
		}
	}

	switch gl {
	case guessBelongs:
		primarySchema, foreignSchema = relation.FieldSchema, schema
	case guessEmbeddedBelongs:
		if field.OwnerSchema == nil {
			reguessOrErr()
			return
		}
		primarySchema, foreignSchema = relation.FieldSchema, field.OwnerSchema
	case guessHas:
	case guessEmbeddedHas:
		if field.OwnerSchema == nil {
			reguessOrErr()
			return
		}
		primarySchema, foreignSchema = field.OwnerSchema, relation.FieldSchema
	}

	if len(relation.foreignKeys) > 0 {
		for _, foreignKey := range relation.foreignKeys {
			f := foreignSchema.LookUpField(foreignKey)
			if f == nil {
				reguessOrErr()
				return
			}
			foreignFields = append(foreignFields, f)
		}
	} else {
		primarySchemaName := primarySchema.Name
		if primarySchemaName == "" {
			primarySchemaName = relation.FieldSchema.Name
		}

		if len(relation.primaryKeys) > 0 {
			for _, primaryKey := range relation.primaryKeys {
				if f := primarySchema.LookUpField(primaryKey); f != nil {
					primaryFields = append(primaryFields, f)
				}
			}
		} else {
			primaryFields = primarySchema.PrimaryFields
		}

	primaryFieldLoop:
		for _, primaryField := range primaryFields {
			lookUpName := primarySchemaName + primaryField.Name
			if gl == guessBelongs {
				lookUpName = field.Name + primaryField.Name
			}

			lookUpNames := []string{lookUpName}
			if len(primaryFields) == 1 {
				lookUpNames = append(lookUpNames, strings.TrimSuffix(lookUpName, primaryField.Name)+"ID", strings.TrimSuffix(lookUpName, primaryField.Name)+"Id", schema.namer.ColumnName(foreignSchema.Table, strings.TrimSuffix(lookUpName, primaryField.Name)+"ID"))
			}

			for _, name := range lookUpNames {
				if f := foreignSchema.LookUpFieldByBindName(field.BindNames, name); f != nil {
					foreignFields = append(foreignFields, f)
					primaryFields = append(primaryFields, primaryField)
					continue primaryFieldLoop
				}
			}
			for _, name := range lookUpNames {
				if f := foreignSchema.LookUpField(name); f != nil {
					foreignFields = append(foreignFields, f)
					primaryFields = append(primaryFields, primaryField)
					continue primaryFieldLoop
				}
			}
		}
	}

	switch {
	case len(foreignFields) == 0:
		reguessOrErr()
		return
	case len(relation.primaryKeys) > 0:
		for idx, primaryKey := range relation.primaryKeys {
			if f := primarySchema.LookUpField(primaryKey); f != nil {
				if len(primaryFields) < idx+1 {
					primaryFields = append(primaryFields, f)
				} else if f != primaryFields[idx] {
					reguessOrErr()
					return
				}
			} else {
				reguessOrErr()
				return
			}
		}
	case len(primaryFields) == 0:
		if len(foreignFields) == 1 && primarySchema.PrioritizedPrimaryField != nil {
			primaryFields = append(primaryFields, primarySchema.PrioritizedPrimaryField)
		} else if len(primarySchema.PrimaryFields) == len(foreignFields) {
			primaryFields = append(primaryFields, primarySchema.PrimaryFields...)
		} else {
			reguessOrErr()
			return
		}
	}

	// build references
	for idx, foreignField := range foreignFields {
		// use same data type for foreign keys
		if copyableDataType(primaryFields[idx].DataType) {
			foreignField.DataType = primaryFields[idx].DataType
		}
		foreignField.GORMDataType = primaryFields[idx].GORMDataType
		if foreignField.Size == 0 {
			foreignField.Size = primaryFields[idx].Size
		}

		relation.References = append(relation.References, &Reference{
			PrimaryKey:    primaryFields[idx],
			ForeignKey:    foreignField,
			OwnPrimaryKey: (schema == primarySchema && gl == guessHas) || (field.OwnerSchema == primarySchema && gl == guessEmbeddedHas),
		})
	}

	if gl == guessHas || gl == guessEmbeddedHas {
		relation.Type = has
	} else {
		relation.Type = BelongsTo
	}
}

type Constraint struct {
	Name            string
	Field           *Field
	Schema          *Schema
	ForeignKeys     []*Field
	ReferenceSchema *Schema
	References      []*Field
	OnDelete        string
	OnUpdate        string
}

func (rel *Relationship) ParseConstraint() *Constraint {
	str := rel.Field.TagSettings["CONSTRAINT"]
	if str == "-" {
		return nil
	}

	if rel.Type == BelongsTo {
		for _, r := range rel.FieldSchema.Relationships.Relations {
			if r != rel && r.FieldSchema == rel.Schema && len(rel.References) == len(r.References) {
				matched := true
				for idx, ref := range r.References {
					if !(rel.References[idx].PrimaryKey == ref.PrimaryKey && rel.References[idx].ForeignKey == ref.ForeignKey &&
						rel.References[idx].PrimaryValue == ref.PrimaryValue) {
						matched = false
					}
				}

				if matched {
					return nil
				}
			}
		}
	}

	var (
		name     string
		idx      = strings.Index(str, ",")
		settings = ParseTagSetting(str, ",")
	)

	// optimize match english letters and midline
	// The following code is basically called in for.
	// In order to avoid the performance problems caused by repeated compilation of regular expressions,
	// it only needs to be done once outside, so optimization is done here.
	if idx != -1 && regEnLetterAndMidline.MatchString(str[0:idx]) {
		name = str[0:idx]
	} else {
		name = rel.Schema.namer.RelationshipFKName(*rel)
	}

	constraint := Constraint{
		Name:     name,
		Field:    rel.Field,
		OnUpdate: settings["ONUPDATE"],
		OnDelete: settings["ONDELETE"],
	}

	for _, ref := range rel.References {
		if ref.PrimaryKey != nil && (rel.JoinTable == nil || ref.OwnPrimaryKey) {
			constraint.ForeignKeys = append(constraint.ForeignKeys, ref.ForeignKey)
			constraint.References = append(constraint.References, ref.PrimaryKey)

			if ref.OwnPrimaryKey {
				constraint.Schema = ref.ForeignKey.Schema
				constraint.ReferenceSchema = rel.Schema
			} else {
				constraint.Schema = rel.Schema
				constraint.ReferenceSchema = ref.PrimaryKey.Schema
			}
		}
	}

	return &constraint
}

func (rel *Relationship) ToQueryConditions(ctx context.Context, reflectValue reflect.Value) (conds []clause.Expression) {
	table := rel.FieldSchema.Table
	foreignFields := []*Field{}
	relForeignKeys := []string{}

	if rel.JoinTable != nil {
		table = rel.JoinTable.Table
		for _, ref := range rel.References {
			if ref.OwnPrimaryKey {
				foreignFields = append(foreignFields, ref.PrimaryKey)
				relForeignKeys = append(relForeignKeys, ref.ForeignKey.DBName)
			} else if ref.PrimaryValue != "" {
				conds = append(conds, clause.Eq{
					Column: clause.Column{Table: rel.JoinTable.Table, Name: ref.ForeignKey.DBName},
					Value:  ref.PrimaryValue,
				})
			} else {
				conds = append(conds, clause.Eq{
					Column: clause.Column{Table: rel.JoinTable.Table, Name: ref.ForeignKey.DBName},
					Value:  clause.Column{Table: rel.FieldSchema.Table, Name: ref.PrimaryKey.DBName},
				})
			}
		}
	} else {
		for _, ref := range rel.References {
			if ref.OwnPrimaryKey {
				relForeignKeys = append(relForeignKeys, ref.ForeignKey.DBName)
				foreignFields = append(foreignFields, ref.PrimaryKey)
			} else if ref.PrimaryValue != "" {
				conds = append(conds, clause.Eq{
					Column: clause.Column{Table: rel.FieldSchema.Table, Name: ref.ForeignKey.DBName},
					Value:  ref.PrimaryValue,
				})
			} else {
				relForeignKeys = append(relForeignKeys, ref.PrimaryKey.DBName)
				foreignFields = append(foreignFields, ref.ForeignKey)
			}
		}
	}

	_, foreignValues := GetIdentityFieldValuesMap(ctx, reflectValue, foreignFields)
	column, values := ToQueryValues(table, relForeignKeys, foreignValues)

	conds = append(conds, clause.IN{Column: column, Values: values})
	return
}

func copyableDataType(str DataType) bool {
	for _, s := range []string{"auto_increment", "primary key"} {
		if strings.Contains(strings.ToLower(string(str)), s) {
			return false
		}
	}
	return true
}
