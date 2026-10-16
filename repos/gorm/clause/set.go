package clause

import "sort"

type Set []Assignment

type Assignment struct {
	Column Column
	Value  interface{}
}

func (set Set) Name() string {
	return "SET"
}

func (set Set) Build(builder Builder) {
	if len(set) > 0 {
		for idx, assignment := range set {
			if idx > 0 {
				builder.WriteByte(',')
			}
			builder.WriteQuoted(assignment.Column)
			builder.WriteByte('=')
			builder.AddVar(builder, assignment.Value)
		}
	} else {
		builder.WriteQuoted(Column{Name: PrimaryKey})
		builder.WriteByte('=')
		builder.WriteQuoted(Column{Name: PrimaryKey})
	}
}

// MergeClause merge assignments clauses
func (set Set) MergeClause(clause *Clause) {
	copiedAssignments := make([]Assignment, len(set))
	copy(copiedAssignments, set)
	clause.Expression = Set(copiedAssignments)
}

func Assignments(values map[string]interface{}) Set {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	assignments := make([]Assignment, len(keys))
	for idx, key := range keys {
		assignments[idx] = Assignment{Column: Column{Name: key}, Value: values[key]}
	}
	return assignments
}

func AssignmentColumns(values []string) Set {
	assignments := make([]Assignment, len(values))
	for idx, value := range values {
		assignments[idx] = Assignment{Column: Column{Name: value}, Value: Column{Table: "excluded", Name: value}}
	}
	return assignments
}
