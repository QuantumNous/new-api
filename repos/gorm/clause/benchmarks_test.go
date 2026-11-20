package clause_test

import (
	"sync"
	"testing"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/schema"
	"gorm.io/gorm/utils/tests"
)

func BenchmarkSelect(b *testing.B) {
	user, _ := schema.Parse(&tests.User{}, &sync.Map{}, db.NamingStrategy)

	for i := 0; i < b.N; i++ {
		stmt := gorm.Statement{DB: db, Table: user.Table, Schema: user, Clauses: map[string]clause.Clause{}}
		clauses := []clause.Interface{clause.Select{}, clause.From{}, clause.Where{Exprs: []clause.Expression{clause.Eq{Column: clause.PrimaryColumn, Value: "1"}, clause.Gt{Column: "age", Value: 18}, clause.Or(clause.Neq{Column: "name", Value: "jinzhu"})}}}

		for _, clause := range clauses {
			stmt.AddClause(clause)
		}

		stmt.Build("SELECT", "FROM", "WHERE")
		_ = stmt.SQL.String()
	}
}

func BenchmarkComplexSelect(b *testing.B) {
	user, _ := schema.Parse(&tests.User{}, &sync.Map{}, db.NamingStrategy)

	limit10 := 10
	for i := 0; i < b.N; i++ {
		stmt := gorm.Statement{DB: db, Table: user.Table, Schema: user, Clauses: map[string]clause.Clause{}}
		clauses := []clause.Interface{
			clause.Select{},
			clause.From{},
			clause.Where{Exprs: []clause.Expression{
				clause.Eq{Column: clause.PrimaryColumn, Value: "1"},
				clause.Gt{Column: "age", Value: 18},
				clause.Or(clause.Neq{Column: "name", Value: "jinzhu"}),
			}},
			clause.Where{Exprs: []clause.Expression{
				clause.Or(clause.Gt{Column: "score", Value: 100}, clause.Like{Column: "name", Value: "%linus%"}),
			}},
			clause.GroupBy{Columns: []clause.Column{{Name: "role"}}, Having: []clause.Expression{clause.Eq{"role", "admin"}}},
			clause.Limit{Limit: &limit10, Offset: 20},
			clause.OrderBy{Columns: []clause.OrderByColumn{{Column: clause.PrimaryColumn, Desc: true}}},
		}

		for _, clause := range clauses {
			stmt.AddClause(clause)
		}

		stmt.Build("SELECT", "FROM", "WHERE", "GROUP BY", "LIMIT", "ORDER BY")
		_ = stmt.SQL.String()
	}
}
