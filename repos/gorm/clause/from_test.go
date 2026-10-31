package clause_test

import (
	"fmt"
	"testing"

	"gorm.io/gorm/clause"
)

func TestFrom(t *testing.T) {
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
			[]clause.Interface{
				clause.Select{}, clause.From{
					Tables: []clause.Table{{Name: "users"}},
					Joins: []clause.Join{
						{
							Type:  clause.InnerJoin,
							Table: clause.Table{Name: "articles"},
							ON: clause.Where{
								[]clause.Expression{clause.Eq{clause.Column{Table: "articles", Name: "id"}, clause.PrimaryColumn}},
							},
						},
					},
				},
			},
			"SELECT * FROM `users` INNER JOIN `articles` ON `articles`.`id` = `users`.`id`", nil,
		},
		{
			[]clause.Interface{
				clause.Select{}, clause.From{
					Tables: []clause.Table{{Name: "users"}},
					Joins: []clause.Join{
						{
							Type:  clause.RightJoin,
							Table: clause.Table{Name: "profiles"},
							ON: clause.Where{
								[]clause.Expression{clause.Eq{clause.Column{Table: "profiles", Name: "email"}, clause.Column{Table: clause.CurrentTable, Name: "email"}}},
							},
						},
					},
				}, clause.From{
					Joins: []clause.Join{
						{
							Type:  clause.InnerJoin,
							Table: clause.Table{Name: "articles"},
							ON: clause.Where{
								[]clause.Expression{clause.Eq{clause.Column{Table: "articles", Name: "id"}, clause.PrimaryColumn}},
							},
						}, {
							Type:  clause.LeftJoin,
							Table: clause.Table{Name: "companies"},
							Using: []string{"company_name"},
						},
					},
				},
			},
			"SELECT * FROM `users` INNER JOIN `articles` ON `articles`.`id` = `users`.`id` LEFT JOIN `companies` USING (`company_name`)", nil,
		},
	}

	for idx, result := range results {
		t.Run(fmt.Sprintf("case #%v", idx), func(t *testing.T) {
			checkBuildClauses(t, result.Clauses, result.Result, result.Vars)
		})
	}
}
