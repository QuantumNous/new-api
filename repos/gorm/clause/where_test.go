package clause_test

import (
	"fmt"
	"testing"

	"gorm.io/gorm/clause"
)

func TestWhere(t *testing.T) {
	results := []struct {
		Clauses []clause.Interface
		Result  string
		Vars    []interface{}
	}{
		{
			[]clause.Interface{clause.Select{}, clause.From{}, clause.Where{
				Exprs: []clause.Expression{clause.Eq{Column: clause.PrimaryColumn, Value: "1"}, clause.Gt{Column: "age", Value: 18}, clause.Or(clause.Neq{Column: "name", Value: "jinzhu"})},
			}},
			"SELECT * FROM `users` WHERE `users`.`id` = ? AND `age` > ? OR `name` <> ?",
			[]interface{}{"1", 18, "jinzhu"},
		},
		{
			[]clause.Interface{clause.Select{}, clause.From{}, clause.Where{
				Exprs: []clause.Expression{clause.Or(clause.Neq{Column: "name", Value: "jinzhu"}), clause.Eq{Column: clause.PrimaryColumn, Value: "1"}, clause.Gt{Column: "age", Value: 18}},
			}},
			"SELECT * FROM `users` WHERE `users`.`id` = ? OR `name` <> ? AND `age` > ?",
			[]interface{}{"1", "jinzhu", 18},
		},
		{
			[]clause.Interface{clause.Select{}, clause.From{}, clause.Where{
				Exprs: []clause.Expression{clause.Or(clause.Neq{Column: "name", Value: "jinzhu"}), clause.Eq{Column: clause.PrimaryColumn, Value: "1"}, clause.Gt{Column: "age", Value: 18}},
			}},
			"SELECT * FROM `users` WHERE `users`.`id` = ? OR `name` <> ? AND `age` > ?",
			[]interface{}{"1", "jinzhu", 18},
		},
		{
			[]clause.Interface{clause.Select{}, clause.From{}, clause.Where{
				Exprs: []clause.Expression{clause.Or(clause.Eq{Column: clause.PrimaryColumn, Value: "1"}), clause.Or(clause.Neq{Column: "name", Value: "jinzhu"})},
			}},
			"SELECT * FROM `users` WHERE `users`.`id` = ? OR `name` <> ?",
			[]interface{}{"1", "jinzhu"},
		},
		{
			[]clause.Interface{clause.Select{}, clause.From{}, clause.Where{
				Exprs: []clause.Expression{clause.Eq{Column: clause.PrimaryColumn, Value: "1"}, clause.Gt{Column: "age", Value: 18}, clause.Or(clause.Neq{Column: "name", Value: "jinzhu"})},
			}, clause.Where{
				Exprs: []clause.Expression{clause.Or(clause.Gt{Column: "score", Value: 100}, clause.Like{Column: "name", Value: "%linus%"})},
			}},
			"SELECT * FROM `users` WHERE `users`.`id` = ? AND `age` > ? OR `name` <> ? AND (`score` > ? OR `name` LIKE ?)",
			[]interface{}{"1", 18, "jinzhu", 100, "%linus%"},
		},
		{
			[]clause.Interface{clause.Select{}, clause.From{}, clause.Where{
				Exprs: []clause.Expression{clause.Not(clause.Eq{Column: clause.PrimaryColumn, Value: "1"}, clause.Gt{Column: "age", Value: 18}), clause.Or(clause.Neq{Column: "name", Value: "jinzhu"})},
			}, clause.Where{
				Exprs: []clause.Expression{clause.Or(clause.Not(clause.Gt{Column: "score", Value: 100}), clause.Like{Column: "name", Value: "%linus%"})},
			}},
			"SELECT * FROM `users` WHERE (`users`.`id` <> ? AND `age` <= ?) OR `name` <> ? AND (`score` <= ? OR `name` LIKE ?)",
			[]interface{}{"1", 18, "jinzhu", 100, "%linus%"},
		},
		{
			[]clause.Interface{clause.Select{}, clause.From{}, clause.Where{
				Exprs: []clause.Expression{clause.And(clause.Eq{Column: "age", Value: 18}, clause.Or(clause.Neq{Column: "name", Value: "jinzhu"}))},
			}},
			"SELECT * FROM `users` WHERE (`age` = ? OR `name` <> ?)",
			[]interface{}{18, "jinzhu"},
		},
		{
			[]clause.Interface{clause.Select{}, clause.From{}, clause.Where{
				Exprs: []clause.Expression{clause.Not(clause.Eq{Column: clause.PrimaryColumn, Value: "1"}, clause.Gt{Column: "age", Value: 18}), clause.And(clause.Expr{SQL: "`score` <= ?", Vars: []interface{}{100}, WithoutParentheses: false})},
			}},
			"SELECT * FROM `users` WHERE (`users`.`id` <> ? AND `age` <= ?) AND `score` <= ?",
			[]interface{}{"1", 18, 100},
		},
		{
			[]clause.Interface{clause.Select{}, clause.From{}, clause.Where{
				Exprs: []clause.Expression{clause.Not(clause.Eq{Column: clause.PrimaryColumn, Value: "1"}, clause.Gt{Column: "age", Value: 18}), clause.Expr{SQL: "`score` <= ?", Vars: []interface{}{100}, WithoutParentheses: false}},
			}},
			"SELECT * FROM `users` WHERE (`users`.`id` <> ? AND `age` <= ?) AND `score` <= ?",
			[]interface{}{"1", 18, 100},
		},
		{
			[]clause.Interface{clause.Select{}, clause.From{}, clause.Where{
				Exprs: []clause.Expression{clause.Not(clause.Eq{Column: clause.PrimaryColumn, Value: "1"}, clause.Gt{Column: "age", Value: 18}), clause.Or(clause.Expr{SQL: "`score` <= ?", Vars: []interface{}{100}, WithoutParentheses: false})},
			}},
			"SELECT * FROM `users` WHERE (`users`.`id` <> ? AND `age` <= ?) OR `score` <= ?",
			[]interface{}{"1", 18, 100},
		},
		{
			[]clause.Interface{clause.Select{}, clause.From{}, clause.Where{
				Exprs: []clause.Expression{
					clause.And(clause.Not(clause.Eq{Column: clause.PrimaryColumn, Value: "1"}),
						clause.And(clause.Expr{SQL: "`score` <= ?", Vars: []interface{}{100}, WithoutParentheses: false})),
				},
			}},
			"SELECT * FROM `users` WHERE (`users`.`id` <> ? AND `score` <= ?)",
			[]interface{}{"1", 100},
		},
		{
			[]clause.Interface{clause.Select{}, clause.From{}, clause.Where{
				Exprs: []clause.Expression{clause.Not(clause.Eq{Column: clause.PrimaryColumn, Value: "1"},
					clause.And(clause.Expr{SQL: "`score` <= ?", Vars: []interface{}{100}, WithoutParentheses: false}))},
			}},
			"SELECT * FROM `users` WHERE (`users`.`id` <> ? AND NOT `score` <= ?)",
			[]interface{}{"1", 100},
		},
	}

	for idx, result := range results {
		t.Run(fmt.Sprintf("case #%v", idx), func(t *testing.T) {
			checkBuildClauses(t, result.Clauses, result.Result, result.Vars)
		})
	}
}
