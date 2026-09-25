package clause

type Values struct {
	Columns []Column
	Values  [][]interface{}
}

// Name from clause name
func (Values) Name() string {
	return "VALUES"
}

// Build build from clause
func (values Values) Build(builder Builder) {
	if len(values.Columns) > 0 {
		builder.WriteByte('(')
		for idx, column := range values.Columns {
			if idx > 0 {
				builder.WriteByte(',')
			}
			builder.WriteQuoted(column)
		}
		builder.WriteByte(')')

		builder.WriteString(" VALUES ")

		for idx, value := range values.Values {
			if idx > 0 {
				builder.WriteByte(',')
			}

			builder.WriteByte('(')
			builder.AddVar(builder, value...)
			builder.WriteByte(')')
		}
	} else {
		builder.WriteString("DEFAULT VALUES")
	}
}

// MergeClause merge values clauses
func (values Values) MergeClause(clause *Clause) {
	clause.Name = ""
	clause.Expression = values
}
