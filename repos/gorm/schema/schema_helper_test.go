package schema_test

import (
	"context"
	"fmt"
	"reflect"
	"strings"
	"testing"

	"gorm.io/gorm/schema"
	"gorm.io/gorm/utils/tests"
)

func checkSchema(t *testing.T, s *schema.Schema, v schema.Schema, primaryFields []string) {
	t.Run("CheckSchema/"+s.Name, func(t *testing.T) {
		tests.AssertObjEqual(t, s, v, "Name", "Table")

		for idx, field := range primaryFields {
			var found bool
			for _, f := range s.PrimaryFields {
				if f.Name == field {
					found = true
				}
			}

			if idx == 0 {
				if field != s.PrioritizedPrimaryField.Name {
					t.Errorf("schema %v prioritized primary field should be %v, but got %v", s, field, s.PrioritizedPrimaryField.Name)
				}
			}

			if !found {
				t.Errorf("schema %v failed to found primary key: %v", s, field)
			}
		}
	})
}

func checkSchemaField(t *testing.T, s *schema.Schema, f *schema.Field, fc func(*schema.Field)) {
	t.Run("CheckField/"+f.Name, func(t *testing.T) {
		if fc != nil {
			fc(f)
		}

		if f.TagSettings == nil {
			if f.Tag != "" {
				f.TagSettings = schema.ParseTagSetting(f.Tag.Get("gorm"), ";")
			} else {
				f.TagSettings = map[string]string{}
			}
		}

		parsedField, ok := s.FieldsByDBName[f.DBName]
		if !ok {
			parsedField, ok = s.FieldsByName[f.Name]
		}

		if !ok {
			t.Errorf("schema %v failed to look up field with name %v", s, f.Name)
		} else {
			tests.AssertObjEqual(t, parsedField, f, "Name", "DBName", "BindNames", "DataType", "PrimaryKey", "AutoIncrement", "Creatable", "Updatable", "Readable", "HasDefaultValue", "DefaultValue", "NotNull", "Unique", "Comment", "Size", "Precision", "TagSettings")

			if f.DBName != "" {
				if field, ok := s.FieldsByDBName[f.DBName]; !ok || parsedField != field {
					t.Errorf("schema %v failed to look up field with dbname %v", s, f.DBName)
				}
			}

			for _, name := range []string{f.DBName, f.Name} {
				if name != "" {
					if field := s.LookUpField(name); field == nil || (field.Name != name && field.DBName != name) {
						t.Errorf("schema %v failed to look up field with dbname %v", s, f.DBName)
					}
				}
			}

			if f.PrimaryKey {
				var found bool
				for _, primaryField := range s.PrimaryFields {
					if primaryField == parsedField {
						found = true
					}
				}

				if !found {
					t.Errorf("schema %v doesn't include field %v", s, f.Name)
				}
			}
		}
	})
}

type Relation struct {
	Name        string
	Type        schema.RelationshipType
	Schema      string
	FieldSchema string
	Polymorphic Polymorphic
	JoinTable   JoinTable
	References  []Reference
}

type Polymorphic struct {
	ID    string
	Type  string
	Value string
}

type JoinTable struct {
	Name   string
	Table  string
	Fields []schema.Field
}

type Reference struct {
	PrimaryKey    string
	PrimarySchema string
	ForeignKey    string
	ForeignSchema string
	PrimaryValue  string
	OwnPrimaryKey bool
}

func checkSchemaRelation(t *testing.T, s *schema.Schema, relation Relation) {
	t.Run("CheckRelation/"+relation.Name, func(t *testing.T) {
		if r, ok := s.Relationships.Relations[relation.Name]; ok {
			if r.Name != relation.Name {
				t.Errorf("schema %v relation name expects %v, but got %v", s, r.Name, relation.Name)
			}

			if r.Type != relation.Type {
				t.Errorf("schema %v relation name expects %v, but got %v", s, r.Type, relation.Type)
			}

			if r.Schema.Name != relation.Schema {
				t.Errorf("schema %v relation's schema expects %v, but got %v", s, relation.Schema, r.Schema.Name)
			}

			if r.FieldSchema.Name != relation.FieldSchema {
				t.Errorf("schema %v field relation's schema expects %v, but got %v", s, relation.FieldSchema, r.FieldSchema.Name)
			}

			if r.Polymorphic != nil {
				if r.Polymorphic.PolymorphicID.Name != relation.Polymorphic.ID {
					t.Errorf("schema %v relation's polymorphic id field expects %v, but got %v", s, relation.Polymorphic.ID, r.Polymorphic.PolymorphicID.Name)
				}

				if r.Polymorphic.PolymorphicType.Name != relation.Polymorphic.Type {
					t.Errorf("schema %v relation's polymorphic type field expects %v, but got %v", s, relation.Polymorphic.Type, r.Polymorphic.PolymorphicType.Name)
				}

				if r.Polymorphic.Value != relation.Polymorphic.Value {
					t.Errorf("schema %v relation's polymorphic value expects %v, but got %v", s, relation.Polymorphic.Value, r.Polymorphic.Value)
				}
			}

			if r.JoinTable != nil {
				if r.JoinTable.Name != relation.JoinTable.Name {
					t.Errorf("schema %v relation's join table name expects %v, but got %v", s, relation.JoinTable.Name, r.JoinTable.Name)
				}

				if r.JoinTable.Table != relation.JoinTable.Table {
					t.Errorf("schema %v relation's join table tablename expects %v, but got %v", s, relation.JoinTable.Table, r.JoinTable.Table)
				}

				for _, f := range relation.JoinTable.Fields {
					checkSchemaField(t, r.JoinTable, &f, nil)
				}
			}

			if len(relation.References) != len(r.References) {
				t.Errorf("schema %v relation's reference's count doesn't match, expects %v, but got %v", s, len(relation.References), len(r.References))
			}

			for _, ref := range relation.References {
				var found bool
				for _, rf := range r.References {
					if (rf.PrimaryKey == nil || (rf.PrimaryKey.Name == ref.PrimaryKey && rf.PrimaryKey.Schema.Name == ref.PrimarySchema)) && (rf.PrimaryValue == ref.PrimaryValue) && (rf.ForeignKey.Name == ref.ForeignKey && rf.ForeignKey.Schema.Name == ref.ForeignSchema) && (rf.OwnPrimaryKey == ref.OwnPrimaryKey) {
						found = true
					}
				}

				if !found {
					var refs []string
					for _, rf := range r.References {
						var primaryKey, primaryKeySchema string
						if rf.PrimaryKey != nil {
							primaryKey, primaryKeySchema = rf.PrimaryKey.Name, rf.PrimaryKey.Schema.Name
						}
						refs = append(refs, fmt.Sprintf(
							"{PrimaryKey: %v PrimaryKeySchame: %v ForeignKey: %v ForeignKeySchema: %v PrimaryValue: %v OwnPrimaryKey: %v}",
							primaryKey, primaryKeySchema, rf.ForeignKey.Name, rf.ForeignKey.Schema.Name, rf.PrimaryValue, rf.OwnPrimaryKey,
						))
					}
					t.Errorf("schema %v relation %v failed to found reference %+v, has %v", s, relation.Name, ref, strings.Join(refs, ", "))
				}
			}
		} else {
			t.Errorf("schema %v failed to find relations by name %v", s, relation.Name)
		}
	})
}

type EmbeddedRelations struct {
	Relations         map[string]Relation
	EmbeddedRelations map[string]EmbeddedRelations
}

func checkEmbeddedRelations(t *testing.T, actual map[string]*schema.Relationships, expected map[string]EmbeddedRelations) {
	for name, relations := range actual {
		rs := expected[name]
		t.Run("CheckEmbeddedRelations/"+name, func(t *testing.T) {
			if len(relations.Relations) != len(rs.Relations) {
				t.Errorf("schema relations count don't match, expects %d, got %d", len(rs.Relations), len(relations.Relations))
			}
			if len(relations.EmbeddedRelations) != len(rs.EmbeddedRelations) {
				t.Errorf("schema embedded relations count don't match, expects %d, got %d", len(rs.EmbeddedRelations), len(relations.EmbeddedRelations))
			}
			for n, rel := range relations.Relations {
				if r, ok := rs.Relations[n]; !ok {
					t.Errorf("failed to find relation by name %s", n)
				} else {
					checkSchemaRelation(t, &schema.Schema{
						Relationships: schema.Relationships{
							Relations: map[string]*schema.Relationship{n: rel},
						},
					}, r)
				}
			}
			checkEmbeddedRelations(t, relations.EmbeddedRelations, rs.EmbeddedRelations)
		})
	}
}

func checkField(t *testing.T, s *schema.Schema, value reflect.Value, values map[string]interface{}) {
	for k, v := range values {
		t.Run("CheckField/"+k, func(t *testing.T) {
			fv, _ := s.FieldsByDBName[k].ValueOf(context.Background(), value)
			tests.AssertEqual(t, v, fv)
		})
	}
}
