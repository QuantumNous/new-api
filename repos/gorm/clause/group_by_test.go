package clause_test

import (
	"fmt"
	"testing"

	"gorm.io/gorm/clause"
)

func TestGroupBy(t *testing.T) {
	results := []struct {
		Clauses []clause.Interface
		Result  string
		Vars    []interface{}
	}{
		{
			[]clause.Interface{clause.Select{}, clause.From{}, clause.GroupBy{
				Columns: []clause.Column{{Name: "role"}},
				Having:  []clause.Expression{clause.Eq{"role", "admin"}},
			}},
			"SELECT * FROM `users` GROUP BY `role` HAVING `role` = ?",
			[]interface{}{"admin"},
		},
		{
			[]clause.Interface{clause.Select{}, clause.From{}, clause.GroupBy{
				Columns: []clause.Column{{Name: "role"}},
				Having:  []clause.Expression{clause.Eq{"role", "admin"}},
			}, clause.GroupBy{
				Columns: []clause.Column{{Name: "gender"}},
				Having:  []clause.Expression{clause.Neq{"gender", "U"}},
			}},
			"SELECT * FROM `users` GROUP BY `role`,`gender` HAVING `role` = ? AND `gender` <> ?",
			[]interface{}{"admin", "U"},
		},
	}

	for idx, result := range results {
		t.Run(fmt.Sprintf("case #%v", idx), func(t *testing.T) {
			checkBuildClauses(t, result.Clauses, result.Result, result.Vars)
		})
	}
}
