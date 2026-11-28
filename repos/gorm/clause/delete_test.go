package clause_test

import (
	"fmt"
	"testing"

	"gorm.io/gorm/clause"
)

func TestDelete(t *testing.T) {
	results := []struct {
		Clauses []clause.Interface
		Result  string
		Vars    []interface{}
	}{
		{
			[]clause.Interface{clause.Delete{}, clause.From{}},
			"DELETE FROM `users`", nil,
		},
		{
			[]clause.Interface{clause.Delete{Modifier: "LOW_PRIORITY"}, clause.From{}},
			"DELETE LOW_PRIORITY FROM `users`", nil,
		},
	}

	for idx, result := range results {
		t.Run(fmt.Sprintf("case #%v", idx), func(t *testing.T) {
			checkBuildClauses(t, result.Clauses, result.Result, result.Vars)
		})
	}
}
