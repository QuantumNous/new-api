package gorm

import (
	"fmt"
	"reflect"
	"strings"

	"gorm.io/gorm/clause"
	"gorm.io/gorm/schema"
	"gorm.io/gorm/utils"
)

// Association Mode contains some helper methods to handle relationship things easily.
type Association struct {
	DB           *DB
	Relationship *schema.Relationship
	Unscope      bool
	Error        error
}

func (db *DB) Association(column string) *Association {
	association := &Association{DB: db}
	table := db.Statement.Table

	if err := db.Statement.Parse(db.Statement.Model); err == nil {
		db.Statement.Table = table
		association.Relationship = db.Statement.Schema.Relationships.Relations[column]

		if association.Relationship == nil {
			association.Error = fmt.Errorf("%w: %s", ErrUnsupportedRelation, column)
		}

		db.Statement.ReflectValue = reflect.ValueOf(db.Statement.Model)
		for db.Statement.ReflectValue.Kind() == reflect.Ptr {
			db.Statement.ReflectValue = db.Statement.ReflectValue.Elem()
		}
	} else {
		association.Error = err
	}

	return association
}

func (association *Association) Unscoped() *Association {
	return &Association{
		DB:           association.DB,
		Relationship: association.Relationship,
		Error:        association.Error,
		Unscope:      true,
	}
}

func (association *Association) Find(out interface{}, conds ...interface{}) error {
	if association.Error == nil {
		association.Error = association.buildCondition().Find(out, conds...).Error
	}
	return association.Error
}

func (association *Association) Append(values ...interface{}) error {
	if association.Error == nil {
		switch association.Relationship.Type {
		case schema.HasOne, schema.BelongsTo:
			if len(values) > 0 {
				association.Error = association.Replace(values...)
			}
		default:
			association.saveAssociation( /*clear*/ false, values...)
		}
	}

	return association.Error
}

func (association *Association) Replace(values ...interface{}) error {
	if association.Error == nil {
		reflectValue := association.DB.Statement.ReflectValue
		rel := association.Relationship

		var oldBelongsToExpr clause.Expression
		// we have to record the old BelongsTo value
		if association.Unscope && rel.Type == schema.BelongsTo {
			var foreignFields []*schema.Field
			for _, ref := range rel.References {
				if !ref.OwnPrimaryKey {
					foreignFields = append(foreignFields, ref.ForeignKey)
				}
			}
			if _, fvs := schema.GetIdentityFieldValuesMap(association.DB.Statement.Context, reflectValue, foreignFields); len(fvs) > 0 {
				column, values := schema.ToQueryValues(rel.FieldSchema.Table, rel.FieldSchema.PrimaryFieldDBNames, fvs)
				oldBelongsToExpr = clause.IN{Column: column, Values: values}
			}
		}

		// save associations
		if association.saveAssociation( /*clear*/ true, values...); association.Error != nil {
			return association.Error
		}

		// set old associations's foreign key to null
		switch rel.Type {
		case schema.BelongsTo:
			if len(values) == 0 {
				updateMap := map[string]interface{}{}
				switch reflectValue.Kind() {
				case reflect.Slice, reflect.Array:
					for i := 0; i < reflectValue.Len(); i++ {
						association.Error = rel.Field.Set(association.DB.Statement.Context, reflectValue.Index(i), reflect.Zero(rel.Field.FieldType).Interface())
					}
				case reflect.Struct:
					association.Error = rel.Field.Set(association.DB.Statement.Context, reflectValue, reflect.Zero(rel.Field.FieldType).Interface())
				}

				for _, ref := range rel.References {
					updateMap[ref.ForeignKey.DBName] = nil
				}

				association.Error = association.DB.UpdateColumns(updateMap).Error
			}
			if association.Unscope && oldBelongsToExpr != nil {
				association.Error = association.DB.Model(nil).Where(oldBelongsToExpr).Delete(reflect.New(rel.FieldSchema.ModelType).Interface()).Error
			}
		case schema.HasOne, schema.HasMany:
			var (
				primaryFields []*schema.Field
				foreignKeys   []string
				updateMap     = map[string]interface{}{}
				relValues     = schema.GetRelationsValues(association.DB.Statement.Context, reflectValue, []*schema.Relationship{rel})
				modelValue    = reflect.New(rel.FieldSchema.ModelType).Interface()
				tx            = association.DB.Model(modelValue)
			)

			if _, rvs := schema.GetIdentityFieldValuesMap(association.DB.Statement.Context, relValues, rel.FieldSchema.PrimaryFields); len(rvs) > 0 {
				if column, values := schema.ToQueryValues(rel.FieldSchema.Table, rel.FieldSchema.PrimaryFieldDBNames, rvs); len(values) > 0 {
					tx.Not(clause.IN{Column: column, Values: values})
				}
			}

			for _, ref := range rel.References {
				if ref.OwnPrimaryKey {
					primaryFields = append(primaryFields, ref.PrimaryKey)
					foreignKeys = append(foreignKeys, ref.ForeignKey.DBName)
					updateMap[ref.ForeignKey.DBName] = nil
				} else if ref.PrimaryValue != "" {
					tx.Where(clause.Eq{Column: ref.ForeignKey.DBName, Value: ref.PrimaryValue})
				}
			}

			if _, pvs := schema.GetIdentityFieldValuesMap(association.DB.Statement.Context, reflectValue, primaryFields); len(pvs) > 0 {
				column, values := schema.ToQueryValues(rel.FieldSchema.Table, foreignKeys, pvs)
				if association.Unscope {
					association.Error = tx.Where(clause.IN{Column: column, Values: values}).Delete(modelValue).Error
				} else {
					association.Error = tx.Where(clause.IN{Column: column, Values: values}).UpdateColumns(updateMap).Error
				}
			}
		case schema.Many2Many:
			var (
				primaryFields, relPrimaryFields     []*schema.Field
				joinPrimaryKeys, joinRelPrimaryKeys []string
				modelValue                          = reflect.New(rel.JoinTable.ModelType).Interface()
				tx                                  = association.DB.Model(modelValue)
			)

			for _, ref := range rel.References {
				if ref.PrimaryValue == "" {
					if ref.OwnPrimaryKey {
						primaryFields = append(primaryFields, ref.PrimaryKey)
						joinPrimaryKeys = append(joinPrimaryKeys, ref.ForeignKey.DBName)
					} else {
						relPrimaryFields = append(relPrimaryFields, ref.PrimaryKey)
						joinRelPrimaryKeys = append(joinRelPrimaryKeys, ref.ForeignKey.DBName)
					}
				} else {
					tx.Clauses(clause.Eq{Column: ref.ForeignKey.DBName, Value: ref.PrimaryValue})
				}
			}

			_, pvs := schema.GetIdentityFieldValuesMap(association.DB.Statement.Context, reflectValue, primaryFields)
			if column, values := schema.ToQueryValues(rel.JoinTable.Table, joinPrimaryKeys, pvs); len(values) > 0 {
				tx.Where(clause.IN{Column: column, Values: values})
			} else {
				return ErrPrimaryKeyRequired
			}

			_, rvs := schema.GetIdentityFieldValuesMapFromValues(association.DB.Statement.Context, values, relPrimaryFields)
			if relColumn, relValues := schema.ToQueryValues(rel.JoinTable.Table, joinRelPrimaryKeys, rvs); len(relValues) > 0 {
				tx.Where(clause.Not(clause.IN{Column: relColumn, Values: relValues}))
			}

			association.Error = tx.Delete(modelValue).Error
		}
	}
	return association.Error
}

func (association *Association) Delete(values ...interface{}) error {
	if association.Error == nil {
		var (
			reflectValue  = association.DB.Statement.ReflectValue
			rel           = association.Relationship
			primaryFields []*schema.Field
			foreignKeys   []string
			updateAttrs   = map[string]interface{}{}
			conds         []clause.Expression
		)

		for _, ref := range rel.References {
			if ref.PrimaryValue == "" {
				primaryFields = append(primaryFields, ref.PrimaryKey)
				foreignKeys = append(foreignKeys, ref.ForeignKey.DBName)
				updateAttrs[ref.ForeignKey.DBName] = nil
			} else {
				conds = append(conds, clause.Eq{Column: ref.ForeignKey.DBName, Value: ref.PrimaryValue})
			}
		}

		switch rel.Type {
		case schema.BelongsTo:
			associationDB := association.DB.Session(&Session{})
			tx := associationDB.Model(reflect.New(rel.Schema.ModelType).Interface())

			_, pvs := schema.GetIdentityFieldValuesMap(association.DB.Statement.Context, reflectValue, rel.Schema.PrimaryFields)
			if pcolumn, pvalues := schema.ToQueryValues(rel.Schema.Table, rel.Schema.PrimaryFieldDBNames, pvs); len(pvalues) > 0 {
				conds = append(conds, clause.IN{Column: pcolumn, Values: pvalues})
			} else {
				return ErrPrimaryKeyRequired
			}

			_, rvs := schema.GetIdentityFieldValuesMapFromValues(association.DB.Statement.Context, values, primaryFields)
			relColumn, relValues := schema.ToQueryValues(rel.Schema.Table, foreignKeys, rvs)
			conds = append(conds, clause.IN{Column: relColumn, Values: relValues})

			association.Error = tx.Clauses(conds...).UpdateColumns(updateAttrs).Error
			if association.Unscope {
				var foreignFields []*schema.Field
				for _, ref := range rel.References {
					if !ref.OwnPrimaryKey {
						foreignFields = append(foreignFields, ref.ForeignKey)
					}
				}
				if _, fvs := schema.GetIdentityFieldValuesMap(association.DB.Statement.Context, reflectValue, foreignFields); len(fvs) > 0 {
					column, values := schema.ToQueryValues(rel.FieldSchema.Table, rel.FieldSchema.PrimaryFieldDBNames, fvs)
					association.Error = associationDB.Model(nil).Where(clause.IN{Column: column, Values: values}).Delete(reflect.New(rel.FieldSchema.ModelType).Interface()).Error
				}
			}
		case schema.HasOne, schema.HasMany:
			model := reflect.New(rel.FieldSchema.ModelType).Interface()
			tx := association.DB.Model(model)

			_, pvs := schema.GetIdentityFieldValuesMap(association.DB.Statement.Context, reflectValue, primaryFields)
			if pcolumn, pvalues := schema.ToQueryValues(rel.FieldSchema.Table, foreignKeys, pvs); len(pvalues) > 0 {
				conds = append(conds, clause.IN{Column: pcolumn, Values: pvalues})
			} else {
				return ErrPrimaryKeyRequired
			}

			_, rvs := schema.GetIdentityFieldValuesMapFromValues(association.DB.Statement.Context, values, rel.FieldSchema.PrimaryFields)
			relColumn, relValues := schema.ToQueryValues(rel.FieldSchema.Table, rel.FieldSchema.PrimaryFieldDBNames, rvs)
			conds = append(conds, clause.IN{Column: relColumn, Values: relValues})

			if association.Unscope {
				association.Error = tx.Clauses(conds...).Delete(model).Error
			} else {
				association.Error = tx.Clauses(conds...).UpdateColumns(updateAttrs).Error
			}
		case schema.Many2Many:
			var (
				primaryFields, relPrimaryFields     []*schema.Field
				joinPrimaryKeys, joinRelPrimaryKeys []string
				joinValue                           = reflect.New(rel.JoinTable.ModelType).Interface()
			)

			for _, ref := range rel.References {
				if ref.PrimaryValue == "" {
					if ref.OwnPrimaryKey {
						primaryFields = append(primaryFields, ref.PrimaryKey)
						joinPrimaryKeys = append(joinPrimaryKeys, ref.ForeignKey.DBName)
					} else {
						relPrimaryFields = append(relPrimaryFields, ref.PrimaryKey)
						joinRelPrimaryKeys = append(joinRelPrimaryKeys, ref.ForeignKey.DBName)
					}
				} else {
					conds = append(conds, clause.Eq{Column: ref.ForeignKey.DBName, Value: ref.PrimaryValue})
				}
			}

			_, pvs := schema.GetIdentityFieldValuesMap(association.DB.Statement.Context, reflectValue, primaryFields)
			if pcolumn, pvalues := schema.ToQueryValues(rel.JoinTable.Table, joinPrimaryKeys, pvs); len(pvalues) > 0 {
				conds = append(conds, clause.IN{Column: pcolumn, Values: pvalues})
			} else {
				return ErrPrimaryKeyRequired
			}

			_, rvs := schema.GetIdentityFieldValuesMapFromValues(association.DB.Statement.Context, values, relPrimaryFields)
			relColumn, relValues := schema.ToQueryValues(rel.JoinTable.Table, joinRelPrimaryKeys, rvs)
			conds = append(conds, clause.IN{Column: relColumn, Values: relValues})

			association.Error = association.DB.Where(clause.Where{Exprs: conds}).Model(nil).Delete(joinValue).Error
		}

		if association.Error == nil {
			// clean up deleted values's foreign key
			relValuesMap, _ := schema.GetIdentityFieldValuesMapFromValues(association.DB.Statement.Context, values, rel.FieldSchema.PrimaryFields)

			cleanUpDeletedRelations := func(data reflect.Value) {
				if _, zero := rel.Field.ValueOf(association.DB.Statement.Context, data); !zero {
					fieldValue := reflect.Indirect(rel.Field.ReflectValueOf(association.DB.Statement.Context, data))
					primaryValues := make([]interface{}, len(rel.FieldSchema.PrimaryFields))

					switch fieldValue.Kind() {
					case reflect.Slice, reflect.Array:
						validFieldValues := reflect.Zero(rel.Field.IndirectFieldType)
						for i := 0; i < fieldValue.Len(); i++ {
							for idx, field := range rel.FieldSchema.PrimaryFields {
								primaryValues[idx], _ = field.ValueOf(association.DB.Statement.Context, fieldValue.Index(i))
							}

							if _, ok := relValuesMap[utils.ToStringKey(primaryValues...)]; !ok {
								validFieldValues = reflect.Append(validFieldValues, fieldValue.Index(i))
							}
						}

						association.Error = rel.Field.Set(association.DB.Statement.Context, data, validFieldValues.Interface())
					case reflect.Struct:
						for idx, field := range rel.FieldSchema.PrimaryFields {
							primaryValues[idx], _ = field.ValueOf(association.DB.Statement.Context, fieldValue)
						}

						if _, ok := relValuesMap[utils.ToStringKey(primaryValues...)]; ok {
							if association.Error = rel.Field.Set(association.DB.Statement.Context, data, reflect.Zero(rel.FieldSchema.ModelType).Interface()); association.Error != nil {
								break
							}

							if rel.JoinTable == nil {
								for _, ref := range rel.References {
									if ref.OwnPrimaryKey || ref.PrimaryValue != "" {
										association.Error = ref.ForeignKey.Set(association.DB.Statement.Context, fieldValue, reflect.Zero(ref.ForeignKey.FieldType).Interface())
									} else {
										association.Error = ref.ForeignKey.Set(association.DB.Statement.Context, data, reflect.Zero(ref.ForeignKey.FieldType).Interface())
									}
								}
							}
						}
					}
				}
			}

			switch reflectValue.Kind() {
			case reflect.Slice, reflect.Array:
				for i := 0; i < reflectValue.Len(); i++ {
					cleanUpDeletedRelations(reflect.Indirect(reflectValue.Index(i)))
				}
			case reflect.Struct:
				cleanUpDeletedRelations(reflectValue)
			}
		}
	}

	return association.Error
}

func (association *Association) Clear() error {
	return association.Replace()
}

func (association *Association) Count() (count int64) {
	if association.Error == nil {
		association.Error = association.buildCondition().Count(&count).Error
	}
	return
}

type assignBack struct {
	Source reflect.Value
	Index  int
	Dest   reflect.Value
}

func (association *Association) saveAssociation(clear bool, values ...interface{}) {
	var (
		reflectValue = association.DB.Statement.ReflectValue
		assignBacks  []assignBack // assign association values back to arguments after save
	)

	appendToRelations := func(source, rv reflect.Value, clear bool) {
		switch association.Relationship.Type {
		case schema.HasOne, schema.BelongsTo:
			switch rv.Kind() {
			case reflect.Slice, reflect.Array:
				if rv.Len() > 0 {
					association.Error = association.Relationship.Field.Set(association.DB.Statement.Context, source, rv.Index(0).Addr().Interface())

					if association.Relationship.Field.FieldType.Kind() == reflect.Struct {
						assignBacks = append(assignBacks, assignBack{Source: source, Dest: rv.Index(0)})
					}
				}
			case reflect.Struct:
				association.Error = association.Relationship.Field.Set(association.DB.Statement.Context, source, rv.Addr().Interface())

				if association.Relationship.Field.FieldType.Kind() == reflect.Struct {
					assignBacks = append(assignBacks, assignBack{Source: source, Dest: rv})
				}
			}
		case schema.HasMany, schema.Many2Many:
			elemType := association.Relationship.Field.IndirectFieldType.Elem()
			oldFieldValue := reflect.Indirect(association.Relationship.Field.ReflectValueOf(association.DB.Statement.Context, source))
			var fieldValue reflect.Value
			if clear {
				fieldValue = reflect.MakeSlice(oldFieldValue.Type(), 0, oldFieldValue.Cap())
			} else {
				fieldValue = reflect.MakeSlice(oldFieldValue.Type(), oldFieldValue.Len(), oldFieldValue.Cap())
				reflect.Copy(fieldValue, oldFieldValue)
			}

			appendToFieldValues := func(ev reflect.Value) {
				if ev.Type().AssignableTo(elemType) {
					fieldValue = reflect.Append(fieldValue, ev)
				} else if ev.Type().Elem().AssignableTo(elemType) {
					fieldValue = reflect.Append(fieldValue, ev.Elem())
				} else {
					association.Error = fmt.Errorf("unsupported data type: %v for relation %s", ev.Type(), association.Relationship.Name)
				}

				if elemType.Kind() == reflect.Struct {
					assignBacks = append(assignBacks, assignBack{Source: source, Dest: ev, Index: fieldValue.Len()})
				}
			}

			switch rv.Kind() {
			case reflect.Slice, reflect.Array:
				for i := 0; i < rv.Len(); i++ {
					appendToFieldValues(reflect.Indirect(rv.Index(i)).Addr())
				}
			case reflect.Struct:
				appendToFieldValues(rv.Addr())
			}

			if association.Error == nil {
				association.Error = association.Relationship.Field.Set(association.DB.Statement.Context, source, fieldValue.Interface())
			}
		}
	}

	selectedSaveColumns := []string{association.Relationship.Name}
	omitColumns := []string{}
	selectColumns, _ := association.DB.Statement.SelectAndOmitColumns(true, false)
	for name, ok := range selectColumns {
		columnName := ""
		if strings.HasPrefix(name, association.Relationship.Name) {
			if columnName = strings.TrimPrefix(name, association.Relationship.Name); columnName == ".*" {
				columnName = name
			}
		} else if strings.HasPrefix(name, clause.Associations) {
			columnName = name
		}

		if columnName != "" {
			if ok {
				selectedSaveColumns = append(selectedSaveColumns, columnName)
			} else {
				omitColumns = append(omitColumns, columnName)
			}
		}
	}

	for _, ref := range association.Relationship.References {
		if !ref.OwnPrimaryKey {
			selectedSaveColumns = append(selectedSaveColumns, ref.ForeignKey.Name)
		}
	}

	associationDB := association.DB.Session(&Session{}).Model(nil)
	if !association.DB.FullSaveAssociations {
		associationDB.Select(selectedSaveColumns)
	}
	if len(omitColumns) > 0 {
		associationDB.Omit(omitColumns...)
	}
	associationDB = associationDB.Session(&Session{})

	switch reflectValue.Kind() {
	case reflect.Slice, reflect.Array:
		if len(values) != reflectValue.Len() {
			// clear old data
			if clear && len(values) == 0 {
				for i := 0; i < reflectValue.Len(); i++ {
					if err := association.Relationship.Field.Set(association.DB.Statement.Context, reflectValue.Index(i), reflect.New(association.Relationship.Field.IndirectFieldType).Interface()); err != nil {
						association.Error = err
						break
					}

					if association.Relationship.JoinTable == nil {
						for _, ref := range association.Relationship.References {
							if !ref.OwnPrimaryKey && ref.PrimaryValue == "" {
								if err := ref.ForeignKey.Set(association.DB.Statement.Context, reflectValue.Index(i), reflect.Zero(ref.ForeignKey.FieldType).Interface()); err != nil {
									association.Error = err
									break
								}
							}
						}
					}
				}
				break
			}

			association.Error = ErrInvalidValueOfLength
			return
		}

		for i := 0; i < reflectValue.Len(); i++ {
			appendToRelations(reflectValue.Index(i), reflect.Indirect(reflect.ValueOf(values[i])), clear)

			// TODO support save slice data, sql with case?
			association.Error = associationDB.Updates(reflectValue.Index(i).Addr().Interface()).Error
		}
	case reflect.Struct:
		// clear old data
		if clear && len(values) == 0 {
			association.Error = association.Relationship.Field.Set(association.DB.Statement.Context, reflectValue, reflect.New(association.Relationship.Field.IndirectFieldType).Interface())

			if association.Relationship.JoinTable == nil && association.Error == nil {
				for _, ref := range association.Relationship.References {
					if !ref.OwnPrimaryKey && ref.PrimaryValue == "" {
						association.Error = ref.ForeignKey.Set(association.DB.Statement.Context, reflectValue, reflect.Zero(ref.ForeignKey.FieldType).Interface())
					}
				}
			}
		}

		for idx, value := range values {
			rv := reflect.Indirect(reflect.ValueOf(value))
			appendToRelations(reflectValue, rv, clear && idx == 0)
		}

		if len(values) > 0 {
			association.Error = associationDB.Updates(reflectValue.Addr().Interface()).Error
		}
	}

	for _, assignBack := range assignBacks {
		fieldValue := reflect.Indirect(association.Relationship.Field.ReflectValueOf(association.DB.Statement.Context, assignBack.Source))
		if assignBack.Index > 0 {
			reflect.Indirect(assignBack.Dest).Set(fieldValue.Index(assignBack.Index - 1))
		} else {
			reflect.Indirect(assignBack.Dest).Set(fieldValue)
		}
	}
}

func (association *Association) buildCondition() *DB {
	var (
		queryConds = association.Relationship.ToQueryConditions(association.DB.Statement.Context, association.DB.Statement.ReflectValue)
		modelValue = reflect.New(association.Relationship.FieldSchema.ModelType).Interface()
		tx         = association.DB.Model(modelValue)
	)

	if association.Relationship.JoinTable != nil {
		if !tx.Statement.Unscoped && len(association.Relationship.JoinTable.QueryClauses) > 0 {
			joinStmt := Statement{DB: tx, Context: tx.Statement.Context, Schema: association.Relationship.JoinTable, Table: association.Relationship.JoinTable.Table, Clauses: map[string]clause.Clause{}}
			for _, queryClause := range association.Relationship.JoinTable.QueryClauses {
				joinStmt.AddClause(queryClause)
			}
			joinStmt.Build("WHERE")
			if len(joinStmt.SQL.String()) > 0 {
				tx.Clauses(clause.Expr{SQL: strings.Replace(joinStmt.SQL.String(), "WHERE ", "", 1), Vars: joinStmt.Vars})
			}
		}

		tx = tx.Session(&Session{QueryFields: true}).Clauses(clause.From{Joins: []clause.Join{{
			Table: clause.Table{Name: association.Relationship.JoinTable.Table},
			ON:    clause.Where{Exprs: queryConds},
		}}})
	} else {
		tx.Clauses(clause.Where{Exprs: queryConds})
	}

	return tx
}
