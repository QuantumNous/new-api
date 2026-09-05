package clause

type Locking struct {
	Strength string
	Table    Table
	Options  string
}

// Name where clause name
func (locking Locking) Name() string {
	return "FOR"
}

// Build build where clause
func (locking Locking) Build(builder Builder) {
	builder.WriteString(locking.Strength)
	if locking.Table.Name != "" {
		builder.WriteString(" OF ")
		builder.WriteQuoted(locking.Table)
	}

	if locking.Options != "" {
		builder.WriteByte(' ')
		builder.WriteString(locking.Options)
	}
}

// MergeClause merge order by clauses
func (locking Locking) MergeClause(clause *Clause) {
	clause.Expression = locking
}
