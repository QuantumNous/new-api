package clause_test

import (
	"fmt"
	"testing"

	"gorm.io/gorm/clause"
)

func TestUpdate(t *testing.T) {
	results := []struct {
		Clauses []clause.Interface
		Result  string
		Vars    []interface{}
	}{
		{
			[]clause.Interface{clause.Update{}},
			"UPDATE `users`", nil,
		},
		{
			[]clause.Interface{clause.Update{Modifier: "LOW_PRIORITY"}},
			"UPDATE LOW_PRIORITY `users`", nil,
		},
		{
			[]clause.Interface{clause.Update{Table: clause.Table{Name: "products"}, Modifier: "LOW_PRIORITY"}},
			"UPDATE LOW_PRIORITY `products`", nil,
		},
	}

	for idx, result := range results {
		t.Run(fmt.Sprintf("case #%v", idx), func(t *testing.T) {
			checkBuildClauses(t, result.Clauses, result.Result, result.Vars)
		})
	}
}
