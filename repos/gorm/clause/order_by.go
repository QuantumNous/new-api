package clause

type OrderByColumn struct {
	Column  Column
	Desc    bool
	Reorder bool
}

type OrderBy struct {
	Columns    []OrderByColumn
	Expression Expression
}

// Name where clause name
func (orderBy OrderBy) Name() string {
	return "ORDER BY"
}

// Build build where clause
func (orderBy OrderBy) Build(builder Builder) {
	if orderBy.Expression != nil {
		orderBy.Expression.Build(builder)
	} else {
		for idx, column := range orderBy.Columns {
			if idx > 0 {
				builder.WriteByte(',')
			}

			builder.WriteQuoted(column.Column)
			if column.Desc {
				builder.WriteString(" DESC")
			}
		}
	}
}

// MergeClause merge order by clauses
func (orderBy OrderBy) MergeClause(clause *Clause) {
	if v, ok := clause.Expression.(OrderBy); ok {
		for i := len(orderBy.Columns) - 1; i >= 0; i-- {
			if orderBy.Columns[i].Reorder {
				orderBy.Columns = orderBy.Columns[i:]
				clause.Expression = orderBy
				return
			}
		}

		copiedColumns := make([]OrderByColumn, len(v.Columns))
		copy(copiedColumns, v.Columns)
		orderBy.Columns = append(copiedColumns, orderBy.Columns...)
	}

	clause.Expression = orderBy
}
