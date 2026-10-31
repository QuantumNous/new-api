package clause_test

import (
	"fmt"
	"testing"

	"gorm.io/gorm/clause"
)

func TestSelect(t *testing.T) {
	results := []struct {
		Clauses []clause.Interface
		Result  string
		Vars    []interface{}
	}{
		{
			[]clause.Interface{clause.Select{}, clause.From{}},
			"SELECT * FROM `users`", nil,
		},
		{
			[]clause.Interface{clause.Select{
				Columns: []clause.Column{clause.PrimaryColumn},
			}, clause.From{}},
			"SELECT `users`.`id` FROM `users`", nil,
		},
		{
			[]clause.Interface{clause.Select{
				Columns: []clause.Column{clause.PrimaryColumn},
			}, clause.Select{
				Columns: []clause.Column{{Name: "name"}},
			}, clause.From{}},
			"SELECT `name` FROM `users`", nil,
		},
		{
			[]clause.Interface{clause.Select{
				Expression: clause.CommaExpression{
					Exprs: []clause.Expression{
						clause.NamedExpr{"?", []interface{}{clause.Column{Name: "id"}}},
						clause.NamedExpr{"?", []interface{}{clause.Column{Name: "name"}}},
						clause.NamedExpr{"LENGTH(?)", []interface{}{clause.Column{Name: "mobile"}}},
					},
				},
			}, clause.From{}},
			"SELECT `id`, `name`, LENGTH(`mobile`) FROM `users`", nil,
		},
		{
			[]clause.Interface{clause.Select{
				Expression: clause.CommaExpression{
					Exprs: []clause.Expression{
						clause.Expr{
							SQL: "? as name",
							Vars: []interface{}{
								clause.Eq{
									Column: clause.Column{Name: "age"},
									Value:  18,
								},
							},
						},
					},
				},
			}, clause.From{}},
			"SELECT `age` = ? as name FROM `users`",
			[]interface{}{18},
		},
	}

	for idx, result := range results {
		t.Run(fmt.Sprintf("case #%v", idx), func(t *testing.T) {
			checkBuildClauses(t, result.Clauses, result.Result, result.Vars)
		})
	}
}
