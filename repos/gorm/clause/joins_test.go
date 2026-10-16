package clause_test

import (
	"sync"
	"testing"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/schema"
	"gorm.io/gorm/utils/tests"
)

func TestJoin(t *testing.T) {
	results := []struct {
		name string
		join clause.Join
		sql  string
	}{
		{
			name: "LEFT JOIN",
			join: clause.Join{
				Type:  clause.LeftJoin,
				Table: clause.Table{Name: "user"},
				ON: clause.Where{
					Exprs: []clause.Expression{clause.Eq{clause.Column{Table: "user_info", Name: "user_id"}, clause.PrimaryColumn}},
				},
			},
			sql: "LEFT JOIN `user` ON `user_info`.`user_id` = `users`.`id`",
		},
		{
			name: "RIGHT JOIN",
			join: clause.Join{
				Type:  clause.RightJoin,
				Table: clause.Table{Name: "user"},
				ON: clause.Where{
					Exprs: []clause.Expression{clause.Eq{clause.Column{Table: "user_info", Name: "user_id"}, clause.PrimaryColumn}},
				},
			},
			sql: "RIGHT JOIN `user` ON `user_info`.`user_id` = `users`.`id`",
		},
		{
			name: "INNER JOIN",
			join: clause.Join{
				Type:  clause.InnerJoin,
				Table: clause.Table{Name: "user"},
				ON: clause.Where{
					Exprs: []clause.Expression{clause.Eq{clause.Column{Table: "user_info", Name: "user_id"}, clause.PrimaryColumn}},
				},
			},
			sql: "INNER JOIN `user` ON `user_info`.`user_id` = `users`.`id`",
		},
		{
			name: "CROSS JOIN",
			join: clause.Join{
				Type:  clause.CrossJoin,
				Table: clause.Table{Name: "user"},
				ON: clause.Where{
					Exprs: []clause.Expression{clause.Eq{clause.Column{Table: "user_info", Name: "user_id"}, clause.PrimaryColumn}},
				},
			},
			sql: "CROSS JOIN `user` ON `user_info`.`user_id` = `users`.`id`",
		},
		{
			name: "USING",
			join: clause.Join{
				Type:  clause.InnerJoin,
				Table: clause.Table{Name: "user"},
				Using: []string{"id"},
			},
			sql: "INNER JOIN `user` USING (`id`)",
		},
		{
			name: "Expression",
			join: clause.Join{
				// Invalid
				Type:  clause.LeftJoin,
				Table: clause.Table{Name: "user"},
				ON: clause.Where{
					Exprs: []clause.Expression{clause.Eq{clause.Column{Table: "user_info", Name: "user_id"}, clause.PrimaryColumn}},
				},
				// Valid
				Expression: clause.Join{
					Type:  clause.InnerJoin,
					Table: clause.Table{Name: "user"},
					Using: []string{"id"},
				},
			},
			sql: "INNER JOIN `user` USING (`id`)",
		},
	}
	for _, result := range results {
		t.Run(result.name, func(t *testing.T) {
			user, _ := schema.Parse(&tests.User{}, &sync.Map{}, db.NamingStrategy)
			stmt := &gorm.Statement{DB: db, Table: user.Table, Schema: user, Clauses: map[string]clause.Clause{}}
			result.join.Build(stmt)
			if result.sql != stmt.SQL.String() {
				t.Errorf("want: %s, got: %s", result.sql, stmt.SQL.String())
			}
		})
	}
}
