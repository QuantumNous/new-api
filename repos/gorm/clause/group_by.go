package clause

// GroupBy group by clause
type GroupBy struct {
	Columns []Column
	Having  []Expression
}

// Name from clause name
func (groupBy GroupBy) Name() string {
	return "GROUP BY"
}

// Build build group by clause
func (groupBy GroupBy) Build(builder Builder) {
	for idx, column := range groupBy.Columns {
		if idx > 0 {
			builder.WriteByte(',')
		}

		builder.WriteQuoted(column)
	}

	if len(groupBy.Having) > 0 {
		builder.WriteString(" HAVING ")
		Where{Exprs: groupBy.Having}.Build(builder)
	}
}

// MergeClause merge group by clause
func (groupBy GroupBy) MergeClause(clause *Clause) {
	if v, ok := clause.Expression.(GroupBy); ok {
		copiedColumns := make([]Column, len(v.Columns))
		copy(copiedColumns, v.Columns)
		groupBy.Columns = append(copiedColumns, groupBy.Columns...)

		copiedHaving := make([]Expression, len(v.Having))
		copy(copiedHaving, v.Having)
		groupBy.Having = append(copiedHaving, groupBy.Having...)
	}
	clause.Expression = groupBy

	if len(groupBy.Columns) == 0 {
		clause.Name = ""
	} else {
		clause.Name = groupBy.Name()
	}
}
