package clause_test

import (
	"fmt"
	"testing"

	"gorm.io/gorm/clause"
)

func TestValues(t *testing.T) {
	results := []struct {
		Clauses []clause.Interface
		Result  string
		Vars    []interface{}
	}{
		{
			[]clause.Interface{
				clause.Insert{},
				clause.Values{
					Columns: []clause.Column{{Name: "name"}, {Name: "age"}},
					Values:  [][]interface{}{{"jinzhu", 18}, {"josh", 1}},
				},
			},
			"INSERT INTO `users` (`name`,`age`) VALUES (?,?),(?,?)",
			[]interface{}{"jinzhu", 18, "josh", 1},
		},
	}

	for idx, result := range results {
		t.Run(fmt.Sprintf("case #%v", idx), func(t *testing.T) {
			checkBuildClauses(t, result.Clauses, result.Result, result.Vars)
		})
	}
}
