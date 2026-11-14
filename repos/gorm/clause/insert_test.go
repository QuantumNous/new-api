package clause_test

import (
	"fmt"
	"testing"

	"gorm.io/gorm/clause"
)

func TestInsert(t *testing.T) {
	results := []struct {
		Clauses []clause.Interface
		Result  string
		Vars    []interface{}
	}{
		{
			[]clause.Interface{clause.Insert{}},
			"INSERT INTO `users`", nil,
		},
		{
			[]clause.Interface{clause.Insert{Modifier: "LOW_PRIORITY"}},
			"INSERT LOW_PRIORITY INTO `users`", nil,
		},
		{
			[]clause.Interface{clause.Insert{Table: clause.Table{Name: "products"}, Modifier: "LOW_PRIORITY"}},
			"INSERT LOW_PRIORITY INTO `products`", nil,
		},
	}

	for idx, result := range results {
		t.Run(fmt.Sprintf("case #%v", idx), func(t *testing.T) {
			checkBuildClauses(t, result.Clauses, result.Result, result.Vars)
		})
	}
}
