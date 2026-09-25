package gorm

import (
	"fmt"
	"reflect"
	"testing"

	"gorm.io/gorm/clause"
)

func TestWhereCloneCorruption(t *testing.T) {
	for whereCount := 1; whereCount <= 8; whereCount++ {
		t.Run(fmt.Sprintf("w=%d", whereCount), func(t *testing.T) {
			s := new(Statement)
			for w := 0; w < whereCount; w++ {
				s = s.clone()
				s.AddClause(clause.Where{
					Exprs: s.BuildCondition(fmt.Sprintf("where%d", w)),
				})
			}

			s1 := s.clone()
			s1.AddClause(clause.Where{
				Exprs: s.BuildCondition("FINAL1"),
			})
			s2 := s.clone()
			s2.AddClause(clause.Where{
				Exprs: s.BuildCondition("FINAL2"),
			})

			if reflect.DeepEqual(s1.Clauses["WHERE"], s2.Clauses["WHERE"]) {
				t.Errorf("Where conditions should be different")
			}
		})
	}
}

func TestNilCondition(t *testing.T) {
	s := new(Statement)
	if len(s.BuildCondition(nil)) != 0 {
		t.Errorf("Nil condition should be empty")
	}
}

func TestNameMatcher(t *testing.T) {
	for k, v := range map[string][]string{
		"table.name":         {"table", "name"},
		"`table`.`name`":     {"table", "name"},
		"'table'.'name'":     {"table", "name"},
		"'table'.name":       {"table", "name"},
		"table1.name_23":     {"table1", "name_23"},
		"`table_1`.`name23`": {"table_1", "name23"},
		"'table23'.'name_1'": {"table23", "name_1"},
		"'table23'.name1":    {"table23", "name1"},
		"'name1'":            {"", "name1"},
		"`name_1`":           {"", "name_1"},
		"`Name_1`":           {"", "Name_1"},
		"`Table`.`nAme`":     {"Table", "nAme"},
	} {
		if matches := nameMatcher.FindStringSubmatch(k); len(matches) < 3 || matches[1] != v[0] || matches[2] != v[1] {
			t.Errorf("failed to match value: %v, got %v, expect: %v", k, matches, v)
		}
	}
}
