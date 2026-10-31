package clause_test

import (
	"fmt"
	"testing"

	"gorm.io/gorm/clause"
)

func TestOrderBy(t *testing.T) {
	results := []struct {
		Clauses []clause.Interface
		Result  string
		Vars    []interface{}
	}{
		{
			[]clause.Interface{clause.Select{}, clause.From{}, clause.OrderBy{
				Columns: []clause.OrderByColumn{{Column: clause.PrimaryColumn, Desc: true}},
			}},
			"SELECT * FROM `users` ORDER BY `users`.`id` DESC", nil,
		},
		{
			[]clause.Interface{
				clause.Select{}, clause.From{}, clause.OrderBy{
					Columns: []clause.OrderByColumn{{Column: clause.PrimaryColumn, Desc: true}},
				}, clause.OrderBy{
					Columns: []clause.OrderByColumn{{Column: clause.Column{Name: "name"}}},
				},
			},
			"SELECT * FROM `users` ORDER BY `users`.`id` DESC,`name`", nil,
		},
		{
			[]clause.Interface{
				clause.Select{}, clause.From{}, clause.OrderBy{
					Columns: []clause.OrderByColumn{{Column: clause.PrimaryColumn, Desc: true}},
				}, clause.OrderBy{
					Columns: []clause.OrderByColumn{{Column: clause.Column{Name: "name"}, Reorder: true}},
				},
			},
			"SELECT * FROM `users` ORDER BY `name`", nil,
		},
		{
			[]clause.Interface{
				clause.Select{}, clause.From{}, clause.OrderBy{
					Expression: clause.Expr{SQL: "FIELD(id, ?)", Vars: []interface{}{[]int{1, 2, 3}}, WithoutParentheses: true},
				},
			},
			"SELECT * FROM `users` ORDER BY FIELD(id, ?,?,?)",
			[]interface{}{1, 2, 3},
		},
	}

	for idx, result := range results {
		t.Run(fmt.Sprintf("case #%v", idx), func(t *testing.T) {
			checkBuildClauses(t, result.Clauses, result.Result, result.Vars)
		})
	}
}
