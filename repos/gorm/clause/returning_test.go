package clause_test

import (
	"fmt"
	"testing"

	"gorm.io/gorm/clause"
)

func TestReturning(t *testing.T) {
	results := []struct {
		Clauses []clause.Interface
		Result  string
		Vars    []interface{}
	}{
		{
			[]clause.Interface{clause.Select{}, clause.From{}, clause.Returning{
				[]clause.Column{clause.PrimaryColumn},
			}},
			"SELECT * FROM `users` RETURNING `users`.`id`", nil,
		}, {
			[]clause.Interface{clause.Select{}, clause.From{}, clause.Returning{
				[]clause.Column{clause.PrimaryColumn},
			}, clause.Returning{
				[]clause.Column{{Name: "name"}, {Name: "age"}},
			}},
			"SELECT * FROM `users` RETURNING `users`.`id`,`name`,`age`", nil,
		},
	}

	for idx, result := range results {
		t.Run(fmt.Sprintf("case #%v", idx), func(t *testing.T) {
			checkBuildClauses(t, result.Clauses, result.Result, result.Vars)
		})
	}
}
