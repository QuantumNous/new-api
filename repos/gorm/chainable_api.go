package gorm

import (
	"fmt"
	"regexp"
	"strings"

	"gorm.io/gorm/clause"
	"gorm.io/gorm/utils"
)

// Model specify the model you would like to run db operations
//
//	// update all users's name to `hello`
//	db.Model(&User{}).Update("name", "hello")
//	// if user's primary key is non-blank, will use it as condition, then will only update that user's name to `hello`
//	db.Model(&user).Update("name", "hello")
func (db *DB) Model(value interface{}) (tx *DB) {
	tx = db.getInstance()
	tx.Statement.Model = value
	return
}

// Clauses Add clauses
//
// This supports both standard clauses (clause.OrderBy, clause.Limit, clause.Where) and more
// advanced techniques like specifying lock strength and optimizer hints. See the
// [docs] for more depth.
//
//	// add a simple limit clause
//	db.Clauses(clause.Limit{Limit: 1}).Find(&User{})
//	// tell the optimizer to use the `idx_user_name` index
//	db.Clauses(hints.UseIndex("idx_user_name")).Find(&User{})
//	// specify the lock strength to UPDATE
//	db.Clauses(clause.Locking{Strength: "UPDATE"}).Find(&users)
//
// [docs]: https://gorm.io/docs/sql_builder.html#Clauses
func (db *DB) Clauses(conds ...clause.Expression) (tx *DB) {
	tx = db.getInstance()
	var whereConds []interface{}

	for _, cond := range conds {
		if c, ok := cond.(clause.Interface); ok {
			tx.Statement.AddClause(c)
		} else if optimizer, ok := cond.(StatementModifier); ok {
			optimizer.ModifyStatement(tx.Statement)
		} else {
			whereConds = append(whereConds, cond)
		}
	}

	if len(whereConds) > 0 {
		tx.Statement.AddClause(clause.Where{Exprs: tx.Statement.BuildCondition(whereConds[0], whereConds[1:]...)})
	}
	return
}

var tableRegexp = regexp.MustCompile(`(?i)(?:.+? AS (\w+)\s*(?:$|,)|^\w+\s+(\w+)$)`)

// Table specify the table you would like to run db operations
//
//	// Get a user
//	db.Table("users").Take(&result)
func (db *DB) Table(name string, args ...interface{}) (tx *DB) {
	tx = db.getInstance()
	if strings.Contains(name, " ") || strings.Contains(name, "`") || len(args) > 0 {
		tx.Statement.TableExpr = &clause.Expr{SQL: name, Vars: args}
		if results := tableRegexp.FindStringSubmatch(name); len(results) == 3 {
			if results[1] != "" {
				tx.Statement.Table = results[1]
			} else {
				tx.Statement.Table = results[2]
			}
		}
	} else if tables := strings.Split(name, "."); len(tables) == 2 {
		tx.Statement.TableExpr = &clause.Expr{SQL: tx.Statement.Quote(name)}
		tx.Statement.Table = tables[1]
	} else if name != "" {
		tx.Statement.TableExpr = &clause.Expr{SQL: tx.Statement.Quote(name)}
		tx.Statement.Table = name
	} else {
		tx.Statement.TableExpr = nil
		tx.Statement.Table = ""
	}
	return
}

// Distinct specify distinct fields that you want querying
//
//	// Select distinct names of users
//	db.Distinct("name").Find(&results)
//	// Select distinct name/age pairs from users
//	db.Distinct("name", "age").Find(&results)
func (db *DB) Distinct(args ...interface{}) (tx *DB) {
	tx = db.getInstance()
	tx.Statement.Distinct = true
	if len(args) > 0 {
		tx = tx.Select(args[0], args[1:]...)
	}
	return
}

// Select specify fields that you want when querying, creating, updating
//
// Use Select when you only want a subset of the fields. By default, GORM will select all fields.
// Select accepts both string arguments and arrays.
//
//	// Select name and age of user using multiple arguments
//	db.Select("name", "age").Find(&users)
//	// Select name and age of user using an array
//	db.Select([]string{"name", "age"}).Find(&users)
func (db *DB) Select(query interface{}, args ...interface{}) (tx *DB) {
	tx = db.getInstance()

	switch v := query.(type) {
	case []string:
		tx.Statement.Selects = v

		for _, arg := range args {
			switch arg := arg.(type) {
			case string:
				tx.Statement.Selects = append(tx.Statement.Selects, arg)
			case []string:
				tx.Statement.Selects = append(tx.Statement.Selects, arg...)
			default:
				tx.AddError(fmt.Errorf("unsupported select args %v %v", query, args))
				return
			}
		}

		if clause, ok := tx.Statement.Clauses["SELECT"]; ok {
			clause.Expression = nil
			tx.Statement.Clauses["SELECT"] = clause
		}
	case string:
		if strings.Count(v, "?") >= len(args) && len(args) > 0 {
			tx.Statement.AddClause(clause.Select{
				Distinct:   db.Statement.Distinct,
				Expression: clause.Expr{SQL: v, Vars: args},
			})
		} else if strings.Count(v, "@") > 0 && len(args) > 0 {
			tx.Statement.AddClause(clause.Select{
				Distinct:   db.Statement.Distinct,
				Expression: clause.NamedExpr{SQL: v, Vars: args},
			})
		} else {
			tx.Statement.Selects = []string{v}

			for _, arg := range args {
				switch arg := arg.(type) {
				case string:
					tx.Statement.Selects = append(tx.Statement.Selects, arg)
				case []string:
					tx.Statement.Selects = append(tx.Statement.Selects, arg...)
				default:
					tx.Statement.AddClause(clause.Select{
						Distinct:   db.Statement.Distinct,
						Expression: clause.Expr{SQL: v, Vars: args},
					})
					return
				}
			}

			if clause, ok := tx.Statement.Clauses["SELECT"]; ok {
				clause.Expression = nil
				tx.Statement.Clauses["SELECT"] = clause
			}
		}
	default:
		tx.AddError(fmt.Errorf("unsupported select args %v %v", query, args))
	}

	return
}

// Omit specify fields that you want to ignore when creating, updating and querying
func (db *DB) Omit(columns ...string) (tx *DB) {
	tx = db.getInstance()

	if len(columns) == 1 && strings.ContainsRune(columns[0], ',') {
		tx.Statement.Omits = strings.FieldsFunc(columns[0], utils.IsValidDBNameChar)
	} else {
		tx.Statement.Omits = columns
	}
	return
}

// Where add conditions
//
// See the [docs] for details on the various formats that where clauses can take. By default, where clauses chain with AND.
//
//	// Find the first user with name jinzhu
//	db.Where("name = ?", "jinzhu").First(&user)
//	// Find the first user with name jinzhu and age 20
//	db.Where(&User{Name: "jinzhu", Age: 20}).First(&user)
//	// Find the first user with name jinzhu and age not equal to 20
//	db.Where("name = ?", "jinzhu").Where("age <> ?", "20").First(&user)
//
// [docs]: https://gorm.io/docs/query.html#Conditions
func (db *DB) Where(query interface{}, args ...interface{}) (tx *DB) {
	tx = db.getInstance()
	if conds := tx.Statement.BuildCondition(query, args...); len(conds) > 0 {
		tx.Statement.AddClause(clause.Where{Exprs: conds})
	}
	return
}

// Not add NOT conditions
//
// Not works similarly to where, and has the same syntax.
//
//	// Find the first user with name not equal to jinzhu
//	db.Not("name = ?", "jinzhu").First(&user)
func (db *DB) Not(query interface{}, args ...interface{}) (tx *DB) {
	tx = db.getInstance()
	if conds := tx.Statement.BuildCondition(query, args...); len(conds) > 0 {
		tx.Statement.AddClause(clause.Where{Exprs: []clause.Expression{clause.Not(conds...)}})
	}
	return
}

// Or add OR conditions
//
// Or is used to chain together queries with an OR.
//
//	// Find the first user with name equal to jinzhu or john
//	db.Where("name = ?", "jinzhu").Or("name = ?", "john").First(&user)
func (db *DB) Or(query interface{}, args ...interface{}) (tx *DB) {
	tx = db.getInstance()
	if conds := tx.Statement.BuildCondition(query, args...); len(conds) > 0 {
		tx.Statement.AddClause(clause.Where{Exprs: []clause.Expression{clause.Or(clause.And(conds...))}})
	}
	return
}

// Joins specify Joins conditions
//
//	db.Joins("Account").Find(&user)
//	db.Joins("JOIN emails ON emails.user_id = users.id AND emails.email = ?", "jinzhu@example.org").Find(&user)
//	db.Joins("Account", DB.Select("id").Where("user_id = users.id AND name = ?", "someName").Model(&Account{}))
func (db *DB) Joins(query string, args ...interface{}) (tx *DB) {
	return joins(db, clause.LeftJoin, query, args...)
}

// InnerJoins specify inner joins conditions
// db.InnerJoins("Account").Find(&user)
func (db *DB) InnerJoins(query string, args ...interface{}) (tx *DB) {
	return joins(db, clause.InnerJoin, query, args...)
}

func joins(db *DB, joinType clause.JoinType, query string, args ...interface{}) (tx *DB) {
	tx = db.getInstance()

	if len(args) == 1 {
		if db, ok := args[0].(*DB); ok {
			j := join{
				Name: query, Conds: args, Selects: db.Statement.Selects,
				Omits: db.Statement.Omits, JoinType: joinType,
			}
			if where, ok := db.Statement.Clauses["WHERE"].Expression.(clause.Where); ok {
				j.On = &where
			}
			tx.Statement.Joins = append(tx.Statement.Joins, j)
			return
		}
	}

	tx.Statement.Joins = append(tx.Statement.Joins, join{Name: query, Conds: args, JoinType: joinType})
	return
}

// Group specify the group method on the find
//
//	// Select the sum age of users with given names
//	db.Model(&User{}).Select("name, sum(age) as total").Group("name").Find(&results)
func (db *DB) Group(name string) (tx *DB) {
	tx = db.getInstance()

	fields := strings.FieldsFunc(name, utils.IsValidDBNameChar)
	tx.Statement.AddClause(clause.GroupBy{
		Columns: []clause.Column{{Name: name, Raw: len(fields) != 1}},
	})
	return
}

// Having specify HAVING conditions for GROUP BY
//
//	// Select the sum age of users with name jinzhu
//	db.Model(&User{}).Select("name, sum(age) as total").Group("name").Having("name = ?", "jinzhu").Find(&result)
func (db *DB) Having(query interface{}, args ...interface{}) (tx *DB) {
	tx = db.getInstance()
	tx.Statement.AddClause(clause.GroupBy{
		Having: tx.Statement.BuildCondition(query, args...),
	})
	return
}

// Order specify order when retrieving records from database
//
//	db.Order("name DESC")
//	db.Order(clause.OrderByColumn{Column: clause.Column{Name: "name"}, Desc: true})
func (db *DB) Order(value interface{}) (tx *DB) {
	tx = db.getInstance()

	switch v := value.(type) {
	case clause.OrderByColumn:
		tx.Statement.AddClause(clause.OrderBy{
			Columns: []clause.OrderByColumn{v},
		})
	case string:
		if v != "" {
			tx.Statement.AddClause(clause.OrderBy{
				Columns: []clause.OrderByColumn{{
					Column: clause.Column{Name: v, Raw: true},
				}},
			})
		}
	}
	return
}

// Limit specify the number of records to be retrieved
//
// Limit conditions can be cancelled by using `Limit(-1)`.
//
//	// retrieve 3 users
//	db.Limit(3).Find(&users)
//	// retrieve 3 users into users1, and all users into users2
//	db.Limit(3).Find(&users1).Limit(-1).Find(&users2)
func (db *DB) Limit(limit int) (tx *DB) {
	tx = db.getInstance()
	tx.Statement.AddClause(clause.Limit{Limit: &limit})
	return
}

// Offset specify the number of records to skip before starting to return the records
//
// Offset conditions can be cancelled by using `Offset(-1)`.
//
//	// select the third user
//	db.Offset(2).First(&user)
//	// select the first user by cancelling an earlier chained offset
//	db.Offset(5).Offset(-1).First(&user)
func (db *DB) Offset(offset int) (tx *DB) {
	tx = db.getInstance()
	tx.Statement.AddClause(clause.Limit{Offset: offset})
	return
}

// Scopes pass current database connection to arguments `func(DB) DB`, which could be used to add conditions dynamically
//
//	func AmountGreaterThan1000(db *gorm.DB) *gorm.DB {
//	    return db.Where("amount > ?", 1000)
//	}
//
//	func OrderStatus(status []string) func (db *gorm.DB) *gorm.DB {
//	    return func (db *gorm.DB) *gorm.DB {
//	        return db.Scopes(AmountGreaterThan1000).Where("status in (?)", status)
//	    }
//	}
//
//	db.Scopes(AmountGreaterThan1000, OrderStatus([]string{"paid", "shipped"})).Find(&orders)
func (db *DB) Scopes(funcs ...func(*DB) *DB) (tx *DB) {
	tx = db.getInstance()
	tx.Statement.scopes = append(tx.Statement.scopes, funcs...)
	return tx
}

func (db *DB) executeScopes() (tx *DB) {
	tx = db.getInstance()
	scopes := db.Statement.scopes
	if len(scopes) == 0 {
		return tx
	}
	tx.Statement.scopes = nil

	conditions := make([]clause.Interface, 0, 4)
	if cs, ok := tx.Statement.Clauses["WHERE"]; ok && cs.Expression != nil {
		conditions = append(conditions, cs.Expression.(clause.Interface))
		cs.Expression = nil
		tx.Statement.Clauses["WHERE"] = cs
	}

	for _, scope := range scopes {
		tx = scope(tx)
		if cs, ok := tx.Statement.Clauses["WHERE"]; ok && cs.Expression != nil {
			conditions = append(conditions, cs.Expression.(clause.Interface))
			cs.Expression = nil
			tx.Statement.Clauses["WHERE"] = cs
		}
	}

	for _, condition := range conditions {
		tx.Statement.AddClause(condition)
	}
	return tx
}

// Preload preload associations with given conditions
//
//	// get all users, and preload all non-cancelled orders
//	db.Preload("Orders", "state NOT IN (?)", "cancelled").Find(&users)
func (db *DB) Preload(query string, args ...interface{}) (tx *DB) {
	tx = db.getInstance()
	if tx.Statement.Preloads == nil {
		tx.Statement.Preloads = map[string][]interface{}{}
	}
	tx.Statement.Preloads[query] = args
	return
}

// Attrs provide attributes used in [FirstOrCreate] or [FirstOrInit]
//
// Attrs only adds attributes if the record is not found.
//
//	// assign an email if the record is not found
//	db.Where(User{Name: "non_existing"}).Attrs(User{Email: "fake@fake.org"}).FirstOrInit(&user)
//	// user -> User{Name: "non_existing", Email: "fake@fake.org"}
//
//	// assign an email if the record is not found, otherwise ignore provided email
//	db.Where(User{Name: "jinzhu"}).Attrs(User{Email: "fake@fake.org"}).FirstOrInit(&user)
//	// user -> User{Name: "jinzhu", Age: 20}
//
// [FirstOrCreate]: https://gorm.io/docs/advanced_query.html#FirstOrCreate
// [FirstOrInit]: https://gorm.io/docs/advanced_query.html#FirstOrInit
func (db *DB) Attrs(attrs ...interface{}) (tx *DB) {
	tx = db.getInstance()
	tx.Statement.attrs = attrs
	return
}

// Assign provide attributes used in [FirstOrCreate] or [FirstOrInit]
//
// Assign adds attributes even if the record is found. If using FirstOrCreate, this means that
// records will be updated even if they are found.
//
//	// assign an email regardless of if the record is not found
//	db.Where(User{Name: "non_existing"}).Assign(User{Email: "fake@fake.org"}).FirstOrInit(&user)
//	// user -> User{Name: "non_existing", Email: "fake@fake.org"}
//
//	// assign email regardless of if record is found
//	db.Where(User{Name: "jinzhu"}).Assign(User{Email: "fake@fake.org"}).FirstOrInit(&user)
//	// user -> User{Name: "jinzhu", Age: 20, Email: "fake@fake.org"}
//
// [FirstOrCreate]: https://gorm.io/docs/advanced_query.html#FirstOrCreate
// [FirstOrInit]: https://gorm.io/docs/advanced_query.html#FirstOrInit
func (db *DB) Assign(attrs ...interface{}) (tx *DB) {
	tx = db.getInstance()
	tx.Statement.assigns = attrs
	return
}

func (db *DB) Unscoped() (tx *DB) {
	tx = db.getInstance()
	tx.Statement.Unscoped = true
	return
}

func (db *DB) Raw(sql string, values ...interface{}) (tx *DB) {
	tx = db.getInstance()
	tx.Statement.SQL = strings.Builder{}

	if strings.Contains(sql, "@") {
		clause.NamedExpr{SQL: sql, Vars: values}.Build(tx.Statement)
	} else {
		clause.Expr{SQL: sql, Vars: values}.Build(tx.Statement)
	}
	return
}
