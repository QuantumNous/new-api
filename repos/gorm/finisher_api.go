package gorm

import (
	"database/sql"
	"errors"
	"fmt"
	"reflect"
	"strings"

	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
	"gorm.io/gorm/utils"
)

// Create inserts value, returning the inserted data's primary key in value's id
func (db *DB) Create(value interface{}) (tx *DB) {
	if db.CreateBatchSize > 0 {
		return db.CreateInBatches(value, db.CreateBatchSize)
	}

	tx = db.getInstance()
	tx.Statement.Dest = value
	return tx.callbacks.Create().Execute(tx)
}

// CreateInBatches inserts value in batches of batchSize
func (db *DB) CreateInBatches(value interface{}, batchSize int) (tx *DB) {
	reflectValue := reflect.Indirect(reflect.ValueOf(value))

	switch reflectValue.Kind() {
	case reflect.Slice, reflect.Array:
		var rowsAffected int64
		tx = db.getInstance()

		// the reflection length judgment of the optimized value
		reflectLen := reflectValue.Len()

		callFc := func(tx *DB) error {
			for i := 0; i < reflectLen; i += batchSize {
				ends := i + batchSize
				if ends > reflectLen {
					ends = reflectLen
				}

				subtx := tx.getInstance()
				subtx.Statement.Dest = reflectValue.Slice(i, ends).Interface()
				subtx.callbacks.Create().Execute(subtx)
				if subtx.Error != nil {
					return subtx.Error
				}
				rowsAffected += subtx.RowsAffected
			}
			return nil
		}

		if tx.SkipDefaultTransaction || reflectLen <= batchSize {
			tx.AddError(callFc(tx.Session(&Session{})))
		} else {
			tx.AddError(tx.Transaction(callFc))
		}

		tx.RowsAffected = rowsAffected
	default:
		tx = db.getInstance()
		tx.Statement.Dest = value
		tx = tx.callbacks.Create().Execute(tx)
	}
	return
}

// Save updates value in database. If value doesn't contain a matching primary key, value is inserted.
func (db *DB) Save(value interface{}) (tx *DB) {
	tx = db.getInstance()
	tx.Statement.Dest = value

	reflectValue := reflect.Indirect(reflect.ValueOf(value))
	for reflectValue.Kind() == reflect.Ptr || reflectValue.Kind() == reflect.Interface {
		reflectValue = reflect.Indirect(reflectValue)
	}

	switch reflectValue.Kind() {
	case reflect.Slice, reflect.Array:
		if _, ok := tx.Statement.Clauses["ON CONFLICT"]; !ok {
			tx = tx.Clauses(clause.OnConflict{UpdateAll: true})
		}
		tx = tx.callbacks.Create().Execute(tx.Set("gorm:update_track_time", true))
	case reflect.Struct:
		if err := tx.Statement.Parse(value); err == nil && tx.Statement.Schema != nil {
			for _, pf := range tx.Statement.Schema.PrimaryFields {
				if _, isZero := pf.ValueOf(tx.Statement.Context, reflectValue); isZero {
					return tx.callbacks.Create().Execute(tx)
				}
			}
		}

		fallthrough
	default:
		selectedUpdate := len(tx.Statement.Selects) != 0
		// when updating, use all fields including those zero-value fields
		if !selectedUpdate {
			tx.Statement.Selects = append(tx.Statement.Selects, "*")
		}

		updateTx := tx.callbacks.Update().Execute(tx.Session(&Session{Initialized: true}))

		if updateTx.Error == nil && updateTx.RowsAffected == 0 && !updateTx.DryRun && !selectedUpdate {
			return tx.Session(&Session{SkipHooks: true}).Clauses(clause.OnConflict{UpdateAll: true}).Create(value)
		}

		return updateTx
	}

	return
}

// First finds the first record ordered by primary key, matching given conditions conds
func (db *DB) First(dest interface{}, conds ...interface{}) (tx *DB) {
	tx = db.Limit(1).Order(clause.OrderByColumn{
		Column: clause.Column{Table: clause.CurrentTable, Name: clause.PrimaryKey},
	})
	if len(conds) > 0 {
		if exprs := tx.Statement.BuildCondition(conds[0], conds[1:]...); len(exprs) > 0 {
			tx.Statement.AddClause(clause.Where{Exprs: exprs})
		}
	}
	tx.Statement.RaiseErrorOnNotFound = true
	tx.Statement.Dest = dest
	return tx.callbacks.Query().Execute(tx)
}

// Take finds the first record returned by the database in no specified order, matching given conditions conds
func (db *DB) Take(dest interface{}, conds ...interface{}) (tx *DB) {
	tx = db.Limit(1)
	if len(conds) > 0 {
		if exprs := tx.Statement.BuildCondition(conds[0], conds[1:]...); len(exprs) > 0 {
			tx.Statement.AddClause(clause.Where{Exprs: exprs})
		}
	}
	tx.Statement.RaiseErrorOnNotFound = true
	tx.Statement.Dest = dest
	return tx.callbacks.Query().Execute(tx)
}

// Last finds the last record ordered by primary key, matching given conditions conds
func (db *DB) Last(dest interface{}, conds ...interface{}) (tx *DB) {
	tx = db.Limit(1).Order(clause.OrderByColumn{
		Column: clause.Column{Table: clause.CurrentTable, Name: clause.PrimaryKey},
		Desc:   true,
	})
	if len(conds) > 0 {
		if exprs := tx.Statement.BuildCondition(conds[0], conds[1:]...); len(exprs) > 0 {
			tx.Statement.AddClause(clause.Where{Exprs: exprs})
		}
	}
	tx.Statement.RaiseErrorOnNotFound = true
	tx.Statement.Dest = dest
	return tx.callbacks.Query().Execute(tx)
}

// Find finds all records matching given conditions conds
func (db *DB) Find(dest interface{}, conds ...interface{}) (tx *DB) {
	tx = db.getInstance()
	if len(conds) > 0 {
		if exprs := tx.Statement.BuildCondition(conds[0], conds[1:]...); len(exprs) > 0 {
			tx.Statement.AddClause(clause.Where{Exprs: exprs})
		}
	}
	tx.Statement.Dest = dest
	return tx.callbacks.Query().Execute(tx)
}

// FindInBatches finds all records in batches of batchSize
func (db *DB) FindInBatches(dest interface{}, batchSize int, fc func(tx *DB, batch int) error) *DB {
	var (
		tx = db.Order(clause.OrderByColumn{
			Column: clause.Column{Table: clause.CurrentTable, Name: clause.PrimaryKey},
		}).Session(&Session{})
		queryDB      = tx
		rowsAffected int64
		batch        int
	)

	// user specified offset or limit
	var totalSize int
	if c, ok := tx.Statement.Clauses["LIMIT"]; ok {
		if limit, ok := c.Expression.(clause.Limit); ok {
			if limit.Limit != nil {
				totalSize = *limit.Limit
			}

			if totalSize > 0 && batchSize > totalSize {
				batchSize = totalSize
			}

			// reset to offset to 0 in next batch
			tx = tx.Offset(-1).Session(&Session{})
		}
	}

	for {
		result := queryDB.Limit(batchSize).Find(dest)
		rowsAffected += result.RowsAffected
		batch++

		if result.Error == nil && result.RowsAffected != 0 {
			fcTx := result.Session(&Session{NewDB: true})
			fcTx.RowsAffected = result.RowsAffected
			tx.AddError(fc(fcTx, batch))
		} else if result.Error != nil {
			tx.AddError(result.Error)
		}

		if tx.Error != nil || int(result.RowsAffected) < batchSize {
			break
		}

		if totalSize > 0 {
			if totalSize <= int(rowsAffected) {
				break
			}
			if totalSize/batchSize == batch {
				batchSize = totalSize % batchSize
			}
		}

		// Optimize for-break
		resultsValue := reflect.Indirect(reflect.ValueOf(dest))
		if result.Statement.Schema.PrioritizedPrimaryField == nil {
			tx.AddError(ErrPrimaryKeyRequired)
			break
		}

		primaryValue, zero := result.Statement.Schema.PrioritizedPrimaryField.ValueOf(tx.Statement.Context, resultsValue.Index(resultsValue.Len()-1))
		if zero {
			tx.AddError(ErrPrimaryKeyRequired)
			break
		}
		queryDB = tx.Clauses(clause.Gt{Column: clause.Column{Table: clause.CurrentTable, Name: clause.PrimaryKey}, Value: primaryValue})
	}

	tx.RowsAffected = rowsAffected
	return tx
}

func (db *DB) assignInterfacesToValue(values ...interface{}) {
	for _, value := range values {
		switch v := value.(type) {
		case []clause.Expression:
			for _, expr := range v {
				if eq, ok := expr.(clause.Eq); ok {
					switch column := eq.Column.(type) {
					case string:
						if field := db.Statement.Schema.LookUpField(column); field != nil {
							db.AddError(field.Set(db.Statement.Context, db.Statement.ReflectValue, eq.Value))
						}
					case clause.Column:
						if field := db.Statement.Schema.LookUpField(column.Name); field != nil {
							db.AddError(field.Set(db.Statement.Context, db.Statement.ReflectValue, eq.Value))
						}
					}
				} else if andCond, ok := expr.(clause.AndConditions); ok {
					db.assignInterfacesToValue(andCond.Exprs)
				}
			}
		case clause.Expression, map[string]string, map[interface{}]interface{}, map[string]interface{}:
			if exprs := db.Statement.BuildCondition(value); len(exprs) > 0 {
				db.assignInterfacesToValue(exprs)
			}
		default:
			if s, err := schema.Parse(value, db.cacheStore, db.NamingStrategy); err == nil {
				reflectValue := reflect.Indirect(reflect.ValueOf(value))
				switch reflectValue.Kind() {
				case reflect.Struct:
					for _, f := range s.Fields {
						if f.Readable {
							if v, isZero := f.ValueOf(db.Statement.Context, reflectValue); !isZero {
								if field := db.Statement.Schema.LookUpField(f.Name); field != nil {
									db.AddError(field.Set(db.Statement.Context, db.Statement.ReflectValue, v))
								}
							}
						}
					}
				}
			} else if len(values) > 0 {
				if exprs := db.Statement.BuildCondition(values[0], values[1:]...); len(exprs) > 0 {
					db.assignInterfacesToValue(exprs)
				}
				return
			}
		}
	}
}

// FirstOrInit finds the first matching record, otherwise if not found initializes a new instance with given conds.
// Each conds must be a struct or map.
//
// FirstOrInit never modifies the database. It is often used with Assign and Attrs.
//
//	// assign an email if the record is not found
//	db.Where(User{Name: "non_existing"}).Attrs(User{Email: "fake@fake.org"}).FirstOrInit(&user)
//	// user -> User{Name: "non_existing", Email: "fake@fake.org"}
//
//	// assign email regardless of if record is found
//	db.Where(User{Name: "jinzhu"}).Assign(User{Email: "fake@fake.org"}).FirstOrInit(&user)
//	// user -> User{Name: "jinzhu", Age: 20, Email: "fake@fake.org"}
func (db *DB) FirstOrInit(dest interface{}, conds ...interface{}) (tx *DB) {
	queryTx := db.Limit(1).Order(clause.OrderByColumn{
		Column: clause.Column{Table: clause.CurrentTable, Name: clause.PrimaryKey},
	})

	if tx = queryTx.Find(dest, conds...); tx.RowsAffected == 0 {
		if c, ok := tx.Statement.Clauses["WHERE"]; ok {
			if where, ok := c.Expression.(clause.Where); ok {
				tx.assignInterfacesToValue(where.Exprs)
			}
		}

		// initialize with attrs, conds
		if len(tx.Statement.attrs) > 0 {
			tx.assignInterfacesToValue(tx.Statement.attrs...)
		}
	}

	// initialize with attrs, conds
	if len(tx.Statement.assigns) > 0 {
		tx.assignInterfacesToValue(tx.Statement.assigns...)
	}
	return
}

// FirstOrCreate finds the first matching record, otherwise if not found creates a new instance with given conds.
// Each conds must be a struct or map.
//
// Using FirstOrCreate in conjunction with Assign will result in an update to the database even if the record exists.
//
//	// assign an email if the record is not found
//	result := db.Where(User{Name: "non_existing"}).Attrs(User{Email: "fake@fake.org"}).FirstOrCreate(&user)
//	// user -> User{Name: "non_existing", Email: "fake@fake.org"}
//	// result.RowsAffected -> 1
//
//	// assign email regardless of if record is found
//	result := db.Where(User{Name: "jinzhu"}).Assign(User{Email: "fake@fake.org"}).FirstOrCreate(&user)
//	// user -> User{Name: "jinzhu", Age: 20, Email: "fake@fake.org"}
//	// result.RowsAffected -> 1
func (db *DB) FirstOrCreate(dest interface{}, conds ...interface{}) (tx *DB) {
	tx = db.getInstance()
	queryTx := db.Session(&Session{}).Limit(1).Order(clause.OrderByColumn{
		Column: clause.Column{Table: clause.CurrentTable, Name: clause.PrimaryKey},
	})

	result := queryTx.Find(dest, conds...)
	if result.Error != nil {
		tx.Error = result.Error
		return tx
	}

	if result.RowsAffected == 0 {
		if c, ok := result.Statement.Clauses["WHERE"]; ok {
			if where, ok := c.Expression.(clause.Where); ok {
				result.assignInterfacesToValue(where.Exprs)
			}
		}

		// initialize with attrs, conds
		if len(db.Statement.attrs) > 0 {
			result.assignInterfacesToValue(db.Statement.attrs...)
		}

		// initialize with attrs, conds
		if len(db.Statement.assigns) > 0 {
			result.assignInterfacesToValue(db.Statement.assigns...)
		}

		return tx.Create(dest)
	} else if len(db.Statement.assigns) > 0 {
		exprs := tx.Statement.BuildCondition(db.Statement.assigns[0], db.Statement.assigns[1:]...)
		assigns := map[string]interface{}{}
		for _, expr := range exprs {
			if eq, ok := expr.(clause.Eq); ok {
				switch column := eq.Column.(type) {
				case string:
					assigns[column] = eq.Value
				case clause.Column:
					assigns[column.Name] = eq.Value
				}
			}
		}

		return tx.Model(dest).Updates(assigns)
	}

	return tx
}

// Update updates column with value using callbacks. Reference: https://gorm.io/docs/update.html#Update-Changed-Fields
func (db *DB) Update(column string, value interface{}) (tx *DB) {
	tx = db.getInstance()
	tx.Statement.Dest = map[string]interface{}{column: value}
	return tx.callbacks.Update().Execute(tx)
}

// Updates updates attributes using callbacks. values must be a struct or map. Reference: https://gorm.io/docs/update.html#Update-Changed-Fields
func (db *DB) Updates(values interface{}) (tx *DB) {
	tx = db.getInstance()
	tx.Statement.Dest = values
	return tx.callbacks.Update().Execute(tx)
}

func (db *DB) UpdateColumn(column string, value interface{}) (tx *DB) {
	tx = db.getInstance()
	tx.Statement.Dest = map[string]interface{}{column: value}
	tx.Statement.SkipHooks = true
	return tx.callbacks.Update().Execute(tx)
}

func (db *DB) UpdateColumns(values interface{}) (tx *DB) {
	tx = db.getInstance()
	tx.Statement.Dest = values
	tx.Statement.SkipHooks = true
	return tx.callbacks.Update().Execute(tx)
}

// Delete deletes value matching given conditions. If value contains primary key it is included in the conditions. If
// value includes a deleted_at field, then Delete performs a soft delete instead by setting deleted_at with the current
// time if null.
func (db *DB) Delete(value interface{}, conds ...interface{}) (tx *DB) {
	tx = db.getInstance()
	if len(conds) > 0 {
		if exprs := tx.Statement.BuildCondition(conds[0], conds[1:]...); len(exprs) > 0 {
			tx.Statement.AddClause(clause.Where{Exprs: exprs})
		}
	}
	tx.Statement.Dest = value
	return tx.callbacks.Delete().Execute(tx)
}

func (db *DB) Count(count *int64) (tx *DB) {
	tx = db.getInstance()
	if tx.Statement.Model == nil {
		tx.Statement.Model = tx.Statement.Dest
		defer func() {
			tx.Statement.Model = nil
		}()
	}

	if selectClause, ok := db.Statement.Clauses["SELECT"]; ok {
		defer func() {
			tx.Statement.Clauses["SELECT"] = selectClause
		}()
	} else {
		defer delete(tx.Statement.Clauses, "SELECT")
	}

	if len(tx.Statement.Selects) == 0 {
		tx.Statement.AddClause(clause.Select{Expression: clause.Expr{SQL: "count(*)"}})
	} else if !strings.HasPrefix(strings.TrimSpace(strings.ToLower(tx.Statement.Selects[0])), "count(") {
		expr := clause.Expr{SQL: "count(*)"}

		if len(tx.Statement.Selects) == 1 {
			dbName := tx.Statement.Selects[0]
			fields := strings.FieldsFunc(dbName, utils.IsValidDBNameChar)
			if len(fields) == 1 || (len(fields) == 3 && (strings.ToUpper(fields[1]) == "AS" || fields[1] == ".")) {
				if tx.Statement.Parse(tx.Statement.Model) == nil {
					if f := tx.Statement.Schema.LookUpField(dbName); f != nil {
						dbName = f.DBName
					}
				}

				if tx.Statement.Distinct {
					expr = clause.Expr{SQL: "COUNT(DISTINCT(?))", Vars: []interface{}{clause.Column{Name: dbName}}}
				} else if dbName != "*" {
					expr = clause.Expr{SQL: "COUNT(?)", Vars: []interface{}{clause.Column{Name: dbName}}}
				}
			}
		}

		tx.Statement.AddClause(clause.Select{Expression: expr})
	}

	if orderByClause, ok := db.Statement.Clauses["ORDER BY"]; ok {
		if _, ok := db.Statement.Clauses["GROUP BY"]; !ok {
			delete(tx.Statement.Clauses, "ORDER BY")
			defer func() {
				tx.Statement.Clauses["ORDER BY"] = orderByClause
			}()
		}
	}

	tx.Statement.Dest = count
	tx = tx.callbacks.Query().Execute(tx)

	if _, ok := db.Statement.Clauses["GROUP BY"]; ok || tx.RowsAffected != 1 {
		*count = tx.RowsAffected
	}

	return
}

func (db *DB) Row() *sql.Row {
	tx := db.getInstance().Set("rows", false)
	tx = tx.callbacks.Row().Execute(tx)
	row, ok := tx.Statement.Dest.(*sql.Row)
	if !ok && tx.DryRun {
		db.Logger.Error(tx.Statement.Context, ErrDryRunModeUnsupported.Error())
	}
	return row
}

func (db *DB) Rows() (*sql.Rows, error) {
	tx := db.getInstance().Set("rows", true)
	tx = tx.callbacks.Row().Execute(tx)
	rows, ok := tx.Statement.Dest.(*sql.Rows)
	if !ok && tx.DryRun && tx.Error == nil {
		tx.Error = ErrDryRunModeUnsupported
	}
	return rows, tx.Error
}

// Scan scans selected value to the struct dest
func (db *DB) Scan(dest interface{}) (tx *DB) {
	config := *db.Config
	currentLogger, newLogger := config.Logger, logger.Recorder.New()
	config.Logger = newLogger

	tx = db.getInstance()
	tx.Config = &config

	if rows, err := tx.Rows(); err == nil {
		if rows.Next() {
			tx.ScanRows(rows, dest)
		} else {
			tx.RowsAffected = 0
			tx.AddError(rows.Err())
		}
		tx.AddError(rows.Close())
	}

	currentLogger.Trace(tx.Statement.Context, newLogger.BeginAt, func() (string, int64) {
		return newLogger.SQL, tx.RowsAffected
	}, tx.Error)
	tx.Logger = currentLogger
	return
}

// Pluck queries a single column from a model, returning in the slice dest. E.g.:
//
//	var ages []int64
//	db.Model(&users).Pluck("age", &ages)
func (db *DB) Pluck(column string, dest interface{}) (tx *DB) {
	tx = db.getInstance()
	if tx.Statement.Model != nil {
		if tx.Statement.Parse(tx.Statement.Model) == nil {
			if f := tx.Statement.Schema.LookUpField(column); f != nil {
				column = f.DBName
			}
		}
	}

	if len(tx.Statement.Selects) != 1 {
		fields := strings.FieldsFunc(column, utils.IsValidDBNameChar)
		tx.Statement.AddClauseIfNotExists(clause.Select{
			Distinct: tx.Statement.Distinct,
			Columns:  []clause.Column{{Name: column, Raw: len(fields) != 1}},
		})
	}
	tx.Statement.Dest = dest
	return tx.callbacks.Query().Execute(tx)
}

func (db *DB) ScanRows(rows *sql.Rows, dest interface{}) error {
	tx := db.getInstance()
	if err := tx.Statement.Parse(dest); !errors.Is(err, schema.ErrUnsupportedDataType) {
		tx.AddError(err)
	}
	tx.Statement.Dest = dest
	tx.Statement.ReflectValue = reflect.ValueOf(dest)
	for tx.Statement.ReflectValue.Kind() == reflect.Ptr {
		elem := tx.Statement.ReflectValue.Elem()
		if !elem.IsValid() {
			elem = reflect.New(tx.Statement.ReflectValue.Type().Elem())
			tx.Statement.ReflectValue.Set(elem)
		}
		tx.Statement.ReflectValue = elem
	}
	Scan(rows, tx, ScanInitialized)
	return tx.Error
}

// Connection uses a db connection to execute an arbitrary number of commands in fc. When finished, the connection is
// returned to the connection pool.
func (db *DB) Connection(fc func(tx *DB) error) (err error) {
	if db.Error != nil {
		return db.Error
	}

	tx := db.getInstance()
	sqlDB, err := tx.DB()
	if err != nil {
		return
	}

	conn, err := sqlDB.Conn(tx.Statement.Context)
	if err != nil {
		return
	}

	defer conn.Close()
	tx.Statement.ConnPool = conn
	return fc(tx)
}

// Transaction start a transaction as a block, return error will rollback, otherwise to commit. Transaction executes an
// arbitrary number of commands in fc within a transaction. On success the changes are committed; if an error occurs
// they are rolled back.
func (db *DB) Transaction(fc func(tx *DB) error, opts ...*sql.TxOptions) (err error) {
	panicked := true

	if committer, ok := db.Statement.ConnPool.(TxCommitter); ok && committer != nil {
		// nested transaction
		if !db.DisableNestedTransaction {
			err = db.SavePoint(fmt.Sprintf("sp%p", fc)).Error
			if err != nil {
				return
			}
			defer func() {
				// Make sure to rollback when panic, Block error or Commit error
				if panicked || err != nil {
					db.RollbackTo(fmt.Sprintf("sp%p", fc))
				}
			}()
		}
		err = fc(db.Session(&Session{NewDB: db.clone == 1}))
	} else {
		tx := db.Begin(opts...)
		if tx.Error != nil {
			return tx.Error
		}

		defer func() {
			// Make sure to rollback when panic, Block error or Commit error
			if panicked || err != nil {
				tx.Rollback()
			}
		}()

		if err = fc(tx); err == nil {
			panicked = false
			return tx.Commit().Error
		}
	}

	panicked = false
	return
}

// Begin begins a transaction with any transaction options opts
func (db *DB) Begin(opts ...*sql.TxOptions) *DB {
	var (
		// clone statement
		tx  = db.getInstance().Session(&Session{Context: db.Statement.Context, NewDB: db.clone == 1})
		opt *sql.TxOptions
		err error
	)

	if len(opts) > 0 {
		opt = opts[0]
	}

	switch beginner := tx.Statement.ConnPool.(type) {
	case TxBeginner:
		tx.Statement.ConnPool, err = beginner.BeginTx(tx.Statement.Context, opt)
	case ConnPoolBeginner:
		tx.Statement.ConnPool, err = beginner.BeginTx(tx.Statement.Context, opt)
	default:
		err = ErrInvalidTransaction
	}

	if err != nil {
		tx.AddError(err)
	}

	return tx
}

// Commit commits the changes in a transaction
func (db *DB) Commit() *DB {
	if committer, ok := db.Statement.ConnPool.(TxCommitter); ok && committer != nil && !reflect.ValueOf(committer).IsNil() {
		db.AddError(committer.Commit())
	} else {
		db.AddError(ErrInvalidTransaction)
	}
	return db
}

// Rollback rollbacks the changes in a transaction
func (db *DB) Rollback() *DB {
	if committer, ok := db.Statement.ConnPool.(TxCommitter); ok && committer != nil {
		if !reflect.ValueOf(committer).IsNil() {
			db.AddError(committer.Rollback())
		}
	} else {
		db.AddError(ErrInvalidTransaction)
	}
	return db
}

func (db *DB) SavePoint(name string) *DB {
	if savePointer, ok := db.Dialector.(SavePointerDialectorInterface); ok {
		// close prepared statement, because SavePoint not support prepared statement.
		// e.g. mysql8.0 doc: https://dev.mysql.com/doc/refman/8.0/en/sql-prepared-statements.html
		var (
			preparedStmtTx   *PreparedStmtTX
			isPreparedStmtTx bool
		)
		// close prepared statement, because SavePoint not support prepared statement.
		if preparedStmtTx, isPreparedStmtTx = db.Statement.ConnPool.(*PreparedStmtTX); isPreparedStmtTx {
			db.Statement.ConnPool = preparedStmtTx.Tx
		}
		db.AddError(savePointer.SavePoint(db, name))
		// restore prepared statement
		if isPreparedStmtTx {
			db.Statement.ConnPool = preparedStmtTx
		}
	} else {
		db.AddError(ErrUnsupportedDriver)
	}
	return db
}

func (db *DB) RollbackTo(name string) *DB {
	if savePointer, ok := db.Dialector.(SavePointerDialectorInterface); ok {
		// close prepared statement, because RollbackTo not support prepared statement.
		// e.g. mysql8.0 doc: https://dev.mysql.com/doc/refman/8.0/en/sql-prepared-statements.html
		var (
			preparedStmtTx   *PreparedStmtTX
			isPreparedStmtTx bool
		)
		// close prepared statement, because SavePoint not support prepared statement.
		if preparedStmtTx, isPreparedStmtTx = db.Statement.ConnPool.(*PreparedStmtTX); isPreparedStmtTx {
			db.Statement.ConnPool = preparedStmtTx.Tx
		}
		db.AddError(savePointer.RollbackTo(db, name))
		// restore prepared statement
		if isPreparedStmtTx {
			db.Statement.ConnPool = preparedStmtTx
		}
	} else {
		db.AddError(ErrUnsupportedDriver)
	}
	return db
}

// Exec executes raw sql
func (db *DB) Exec(sql string, values ...interface{}) (tx *DB) {
	tx = db.getInstance()
	tx.Statement.SQL = strings.Builder{}

	if strings.Contains(sql, "@") {
		clause.NamedExpr{SQL: sql, Vars: values}.Build(tx.Statement)
	} else {
		clause.Expr{SQL: sql, Vars: values}.Build(tx.Statement)
	}

	return tx.callbacks.Raw().Execute(tx)
}
