package clause

type Insert struct {
	Table    Table
	Modifier string
}

// Name insert clause name
func (insert Insert) Name() string {
	return "INSERT"
}

// Build build insert clause
func (insert Insert) Build(builder Builder) {
	if insert.Modifier != "" {
		builder.WriteString(insert.Modifier)
		builder.WriteByte(' ')
	}

	builder.WriteString("INTO ")
	if insert.Table.Name == "" {
		builder.WriteQuoted(currentTable)
	} else {
		builder.WriteQuoted(insert.Table)
	}
}

// MergeClause merge insert clause
func (insert Insert) MergeClause(clause *Clause) {
	if v, ok := clause.Expression.(Insert); ok {
		if insert.Modifier == "" {
			insert.Modifier = v.Modifier
		}
		if insert.Table.Name == "" {
			insert.Table = v.Table
		}
	}
	clause.Expression = insert
}
